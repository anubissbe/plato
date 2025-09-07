/**
 * LayoutManager - Manages multi-panel layout system
 * Handles panel registration, state management, and layout modes
 */

import { EventEmitter } from 'events';

export type PanelType = 'conversation' | 'info' | 'tools' | 'status';
export type LayoutMode = 'single' | 'split' | 'multi';

export interface PanelConfig {
  id: string;
  type: PanelType;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  collapsible?: boolean;
  defaultPosition?: 'left' | 'right' | 'top' | 'bottom';
}

export interface PanelState {
  width: number;
  height?: number;
  visible: boolean;
  collapsed: boolean;
  focused: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export interface PanelInfo {
  id: string;
  config: PanelConfig;
  state: PanelState;
}

export interface LayoutConfig {
  mode: LayoutMode;
  panels: PanelInfo[];
  focusedPanelId?: string;
  terminalSize?: { columns: number; rows: number };
}

export class LayoutManager {
  private panels: Map<string, PanelInfo> = new Map();
  private layoutMode: LayoutMode = 'multi';
  private focusedPanelId: string | null = null;
  private eventEmitter: EventEmitter;
  private terminalSize = { columns: 120, rows: 40 };
  private destroyed = false;
  private previousWidths: Map<string, number> = new Map();
  private savedLayoutWidths: Map<string, number> = new Map();
  private preCollapseWidths: Map<string, number> = new Map();
  
  // Layout constraints
  private readonly MIN_TERMINAL_WIDTH_FOR_MULTI = 120;
  private readonly MIN_PANEL_WIDTH = 20;
  private readonly MAX_PANELS = 4;
  
  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }
  
  /**
   * Register a new panel
   */
  registerPanel(config: PanelConfig): void {
    if (this.panels.has(config.id)) {
      throw new Error(`Panel with id "${config.id}" already registered`);
    }
    
    const state: PanelState = {
      width: config.defaultWidth,
      visible: true,
      collapsed: false,
      focused: this.panels.size === 0, // First panel gets focus
      position: config.defaultPosition
    };
    
    this.panels.set(config.id, { id: config.id, config, state });
    
    if (this.panels.size === 1) {
      this.focusedPanelId = config.id;
    }
    
    this.eventEmitter.emit('layout:panel:register', { panelId: config.id });
  }
  
  /**
   * Get panel by ID
   */
  getPanel(id: string): PanelInfo | undefined {
    return this.panels.get(id);
  }
  
  /**
   * Get all panels
   */
  getPanels(): PanelInfo[] {
    return Array.from(this.panels.values());
  }
  
  /**
   * Toggle panel visibility
   */
  togglePanel(id: string): void {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    // Don't allow hiding the only visible panel
    const visiblePanels = this.getVisiblePanels();
    if (visiblePanels.length === 1 && visiblePanels[0].id === id) {
      throw new Error('Cannot hide the only visible panel');
    }
    
    panel.state.visible = !panel.state.visible;
    
    if (!panel.state.visible && panel.state.focused) {
      // Move focus to another visible panel
      const nextVisible = this.getVisiblePanels().find(p => p.id !== id);
      if (nextVisible) {
        this.focusPanel(nextVisible.id);
      }
    }
    
    this.eventEmitter.emit('layout:panel:toggle', {
      panelId: id,
      visible: panel.state.visible
    });
    
    this.rebalancePanelWidths();
  }
  
  /**
   * Collapse a panel
   */
  collapsePanel(id: string): void {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    // Default to collapsible if not explicitly set to false
    if (panel.config.collapsible === false) return;
    
    // Store all current visible panel widths before collapsing
    this.getVisiblePanels().forEach(p => {
      this.preCollapseWidths.set(p.id, p.state.width);
    });
    
    const previousWidth = panel.state.width;
    this.previousWidths.set(id, previousWidth);
    
    panel.state.collapsed = true;
    panel.state.width = 0;
    
    this.eventEmitter.emit('layout:panel:collapse', {
      panelId: id,
      previousWidth
    });
    
    this.rebalancePanelWidths();
  }
  
  /**
   * Expand a panel
   */
  expandPanel(id: string): void {
    const panel = this.panels.get(id);
    if (!panel || !panel.state.collapsed) return;
    
    panel.state.collapsed = false;
    
    // Restore all pre-collapse widths if available
    const hasPreCollapseWidths = this.preCollapseWidths.has(id);
    if (hasPreCollapseWidths) {
      this.getVisiblePanels().forEach(p => {
        const savedWidth = this.preCollapseWidths.get(p.id);
        if (savedWidth && p.id !== id) {
          p.state.width = savedWidth;
        }
      });
      
      // Restore the expanding panel's width
      const previousWidth = this.preCollapseWidths.get(id) || panel.config.defaultWidth;
      panel.state.width = previousWidth;
      
      // Clear pre-collapse widths as they've been used
      this.preCollapseWidths.clear();
    } else {
      // Fallback to stored width or default
      const previousWidth = this.previousWidths.get(id) || panel.config.defaultWidth;
      panel.state.width = previousWidth;
    }
    
    this.eventEmitter.emit('layout:panel:expand', {
      panelId: id,
      width: panel.state.width
    });
    
    // Don't rebalance if we restored pre-collapse widths
    if (!hasPreCollapseWidths) {
      this.rebalancePanelWidths();
    }
  }
  
  /**
   * Resize a panel
   */
  resizePanel(id: string, newWidth: number): void {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    // Default to resizable if not explicitly set to false
    if (panel.config.resizable === false) return;
    
    const minWidth = panel.config.minWidth || this.MIN_PANEL_WIDTH;
    const maxWidth = panel.config.maxWidth || 100;
    const oldWidth = panel.state.width;
    
    // Constrain to min/max
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    const widthChange = newWidth - oldWidth;
    panel.state.width = newWidth;
    
    // Adjust other visible panels to maintain total width of 100
    const visiblePanels = this.getVisiblePanels();
    const otherPanels = visiblePanels.filter(p => p.id !== id);
    
    if (otherPanels.length > 0 && Math.abs(widthChange) > 0.1) {
      // Distribute the width change proportionally among other panels
      const totalOtherWidth = otherPanels.reduce((sum, p) => sum + p.state.width, 0);
      
      if (totalOtherWidth > 0) {
        let totalAdjusted = 0;
        
        // Apply proportional adjustments
        otherPanels.forEach((otherPanel, index) => {
          const proportion = otherPanel.state.width / totalOtherWidth;
          let adjustment = widthChange * proportion;
          
          // For the last panel, use remaining adjustment to ensure exact total
          if (index === otherPanels.length - 1) {
            adjustment = widthChange - totalAdjusted;
          } else {
            totalAdjusted += adjustment;
          }
          
          otherPanel.state.width = Math.max(
            otherPanel.config.minWidth || this.MIN_PANEL_WIDTH,
            Math.min(
              otherPanel.config.maxWidth || 100,
              otherPanel.state.width - adjustment
            )
          );
        });
        
        // Final adjustment to ensure exact 100 total
        const currentTotal = visiblePanels.reduce((sum, p) => sum + p.state.width, 0);
        if (Math.abs(currentTotal - 100) > 0.001) {
          const difference = 100 - currentTotal;
          // Apply difference to the largest panel that can accommodate it
          const adjustablePanel = otherPanels.find(p => {
            const newWidth = p.state.width + difference;
            const minWidth = p.config.minWidth || this.MIN_PANEL_WIDTH;
            const maxWidth = p.config.maxWidth || 100;
            return newWidth >= minWidth && newWidth <= maxWidth;
          }) || otherPanels[0]; // Fallback to first panel
          
          if (adjustablePanel) {
            adjustablePanel.state.width += difference;
          }
        }
      }
    }
    
    // Update saved layout widths for all panels if in multi mode
    if (this.layoutMode === 'multi') {
      this.getVisiblePanels().forEach(p => {
        this.savedLayoutWidths.set(p.id, p.state.width);
      });
    }
    
    this.eventEmitter.emit('layout:panel:resize', {
      panelId: id,
      oldWidth,
      newWidth
    });
  }
  
  /**
   * Focus a panel
   */
  focusPanel(id: string): void {
    const panel = this.panels.get(id);
    if (!panel || !panel.state.visible) return;
    
    // Don't emit if already focused
    if (this.focusedPanelId === id) return;
    
    const previousPanelId = this.focusedPanelId;
    
    // Unfocus all panels
    this.panels.forEach(p => {
      p.state.focused = false;
    });
    
    panel.state.focused = true;
    this.focusedPanelId = id;
    
    this.eventEmitter.emit('layout:panel:focus', {
      panelId: id,
      previousPanelId
    });
  }
  
  /**
   * Focus next panel in cycle
   */
  focusNextPanel(): void {
    const visiblePanels = this.getVisiblePanels();
    if (visiblePanels.length === 0) return;
    
    const currentIndex = visiblePanels.findIndex(p => p.id === this.focusedPanelId);
    const nextIndex = (currentIndex + 1) % visiblePanels.length;
    this.focusPanel(visiblePanels[nextIndex].id);
  }
  
  /**
   * Focus previous panel in cycle
   */
  focusPreviousPanel(): void {
    const visiblePanels = this.getVisiblePanels();
    if (visiblePanels.length === 0) return;
    
    const currentIndex = visiblePanels.findIndex(p => p.id === this.focusedPanelId);
    const prevIndex = currentIndex === 0 ? visiblePanels.length - 1 : currentIndex - 1;
    this.focusPanel(visiblePanels[prevIndex].id);
  }
  
  /**
   * Get focused panel
   */
  getFocusedPanel(): PanelInfo | undefined {
    if (!this.focusedPanelId) return undefined;
    return this.panels.get(this.focusedPanelId);
  }
  
  /**
   * Set layout mode
   */
  setLayoutMode(mode: LayoutMode): void {
    const oldMode = this.layoutMode;
    
    // Save current widths if not already saved and we have a valid multi-panel layout
    if (oldMode === 'multi') {
      const visiblePanels = this.getVisiblePanels();
      // Only save if we have multiple visible panels (valid multi-panel state)
      if (visiblePanels.length > 1) {
        this.panels.forEach(panel => {
          this.savedLayoutWidths.set(panel.id, panel.state.width);
        });
      }
    }
    
    this.layoutMode = mode;
    
    // Adjust panel visibility based on mode
    switch (mode) {
      case 'single':
        // Only show focused panel
        this.panels.forEach(panel => {
          panel.state.visible = panel.id === this.focusedPanelId;
        });
        break;
        
      case 'split':
        // Show two panels
        const panels = Array.from(this.panels.values());
        panels.forEach((panel, index) => {
          panel.state.visible = index < 2;
        });
        break;
        
      case 'multi':
        // Show all panels (up to terminal width constraints)
        this.panels.forEach(panel => {
          panel.state.visible = !panel.state.collapsed;
          
          // Restore saved widths if available
          const savedWidth = this.savedLayoutWidths.get(panel.id);
          if (savedWidth) {
            panel.state.width = savedWidth;
          }
        });
        break;
    }
    
    this.eventEmitter.emit('layout:mode:change', {
      oldMode,
      newMode: mode
    });
    
    this.rebalancePanelWidths();
  }
  
  /**
   * Get current layout mode
   */
  getLayoutMode(): LayoutMode {
    return this.layoutMode;
  }
  
  /**
   * Handle terminal resize
   */
  handleTerminalResize(columns: number, rows: number): void {
    this.terminalSize = { columns, rows };
    
    // Auto-switch to single mode on narrow terminals
    if (columns < this.MIN_TERMINAL_WIDTH_FOR_MULTI && this.layoutMode !== 'single') {
      this.setLayoutMode('single');
    } else if (columns >= this.MIN_TERMINAL_WIDTH_FOR_MULTI && this.layoutMode === 'single') {
      // Restore multi-panel mode when space allows
      this.setLayoutMode('multi');
    }
    
    this.eventEmitter.emit('layout:terminal:resize', { columns, rows });
  }
  
  /**
   * Get terminal size
   */
  getTerminalSize(): { columns: number; rows: number } {
    return { ...this.terminalSize };
  }
  
  /**
   * Serialize layout configuration
   */
  serialize(): LayoutConfig {
    const panels = Array.from(this.panels.values()).map(panel => {
      // Create deep copy to avoid modifying original
      const serializedPanel = {
        id: panel.id,
        config: { ...panel.config },
        state: { ...panel.state }
      };
      
      // For single mode, use saved layout widths if available to preserve logical widths
      if (this.layoutMode === 'single' && this.savedLayoutWidths.has(panel.id)) {
        serializedPanel.state.width = this.savedLayoutWidths.get(panel.id) || panel.state.width;
      }
      
      return serializedPanel;
    });
    
    return {
      mode: this.layoutMode,
      panels,
      focusedPanelId: this.focusedPanelId || undefined,
      terminalSize: { ...this.terminalSize }
    };
  }
  
  /**
   * Restore layout from configuration
   */
  restore(config: LayoutConfig): void {
    // Clear existing panels
    this.panels.clear();
    
    // Restore panels
    config.panels.forEach(panelInfo => {
      this.panels.set(panelInfo.id, {
        id: panelInfo.id,
        config: { ...panelInfo.config },
        state: { ...panelInfo.state }
      });
    });
    
    // Restore layout mode and focus
    this.layoutMode = config.mode;
    this.focusedPanelId = config.focusedPanelId || null;
    
    if (config.terminalSize) {
      this.terminalSize = { ...config.terminalSize };
    }
  }
  
  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.destroyed = true;
    this.panels.clear();
    this.focusedPanelId = null;
  }
  
  /**
   * Private: Get visible panels
   */
  private getVisiblePanels(): PanelInfo[] {
    return Array.from(this.panels.values()).filter(p => p.state.visible && !p.state.collapsed);
  }
  
  /**
   * Private: Rebalance panel widths to maintain 100% total
   */
  private rebalancePanelWidths(): void {
    const visiblePanels = this.getVisiblePanels();
    if (visiblePanels.length === 0) return;
    
    // Calculate current total width
    const totalWidth = visiblePanels.reduce((sum, p) => sum + p.state.width, 0);
    
    if (Math.abs(totalWidth - 100) > 0.1) {
      // Need to rebalance
      if (visiblePanels.length === 1) {
        // Single panel takes full width
        visiblePanels[0].state.width = 100;
      } else if (visiblePanels.length === 2) {
        // Two panels - try to maintain both panels within their constraints
        const focused = visiblePanels.find(p => p.state.focused);
        const other = visiblePanels.find(p => !p.state.focused);
        
        if (focused && other) {
          // Calculate ideal distribution
          let focusedWidth = focused.state.width;
          let otherWidth = other.state.width;
          
          // If total is not 100, adjust proportionally
          if (Math.abs(totalWidth - 100) > 0.1) {
            const focusedRatio = focusedWidth / totalWidth;
            focusedWidth = focusedRatio * 100;
            otherWidth = 100 - focusedWidth;
          }
          
          // Apply constraints
          const focusedMin = focused.config.minWidth || this.MIN_PANEL_WIDTH;
          const focusedMax = focused.config.maxWidth || 100;
          const otherMin = other.config.minWidth || this.MIN_PANEL_WIDTH;
          const otherMax = other.config.maxWidth || 100;
          
          // Constrain focused panel
          focusedWidth = Math.max(focusedMin, Math.min(focusedMax, focusedWidth));
          otherWidth = 100 - focusedWidth;
          
          // Constrain other panel and adjust if needed
          if (otherWidth < otherMin) {
            otherWidth = otherMin;
            focusedWidth = 100 - otherMin;
          } else if (otherWidth > otherMax) {
            otherWidth = otherMax;
            focusedWidth = 100 - otherMax;
          }
          
          focused.state.width = Math.round(focusedWidth);
          other.state.width = Math.round(otherWidth);
        }
      } else {
        // Multiple panels - distribute proportionally
        const scale = 100 / totalWidth;
        visiblePanels.forEach(panel => {
          panel.state.width = Math.round(panel.state.width * scale);
        });
      }
    }
  }
}