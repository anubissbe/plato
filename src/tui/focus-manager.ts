/**
 * Focus Management System
 * Handles keyboard navigation, focus states, and accessibility for interactive components
 */

import { ClickableComponent, ComponentState, VisualFeedback, VisualFeedbackUtils } from './interactive-components.js';
import { ComponentRegistry } from './component-registry.js';

/**
 * Keyboard event information
 */
export interface KeyboardEvent {
  /** Key that was pressed */
  key: string;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Modifier keys that were held */
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
  /** Whether this is a repeat event (key held down) */
  repeat: boolean;
}

/**
 * Focus navigation direction
 */
export type FocusDirection = 'forward' | 'backward' | 'up' | 'down' | 'left' | 'right' | 'first' | 'last';

/**
 * Focus change event information
 */
export interface FocusChangeEvent {
  /** Previous focused component (null if none) */
  previous: ClickableComponent | null;
  /** New focused component (null if none) */
  current: ClickableComponent | null;
  /** Direction of focus change */
  direction: FocusDirection;
  /** Timestamp of focus change */
  timestamp: number;
  /** Whether focus change was caused by keyboard navigation */
  viaKeyboard: boolean;
}

/**
 * Focus configuration options
 */
export interface FocusConfig {
  /** Whether to enable focus management */
  enabled: boolean;
  /** Whether to show visual focus indicators */
  visualIndicators: boolean;
  /** Whether to enable keyboard navigation */
  keyboardNavigation: boolean;
  /** Whether to wrap focus at boundaries */
  wrapFocus: boolean;
  /** Tab key navigation mode */
  tabNavigation: 'sequential' | 'spatial' | 'custom';
  /** Arrow key navigation mode */
  arrowNavigation: 'spatial' | 'sequential' | 'disabled';
  /** Whether to announce focus changes for screen readers */
  announcements: boolean;
  /** Focus trap behavior */
  trapFocus: boolean;
  /** Skip disabled components during navigation */
  skipDisabled: boolean;
  /** Skip invisible components during navigation */
  skipInvisible: boolean;
  /** Focus restoration behavior */
  restoreFocus: boolean;
  /** Debug focus events */
  debug: boolean;
}

/**
 * Focus group for managing related components
 */
export interface FocusGroup {
  /** Unique group identifier */
  id: string;
  /** Components in this focus group */
  components: ClickableComponent[];
  /** Navigation order (if custom) */
  tabOrder?: number[];
  /** Whether this group is active */
  active: boolean;
  /** Focus wrap behavior for this group */
  wrap: boolean;
  /** Group-specific navigation mode */
  navigationMode: 'sequential' | 'spatial' | 'custom';
}

/**
 * Default focus configuration
 */
const DEFAULT_FOCUS_CONFIG: FocusConfig = {
  enabled: true,
  visualIndicators: true,
  keyboardNavigation: true,
  wrapFocus: true,
  tabNavigation: 'sequential',
  arrowNavigation: 'spatial',
  announcements: false,
  trapFocus: false,
  skipDisabled: true,
  skipInvisible: true,
  restoreFocus: true,
  debug: false
};

/**
 * Focus event handler types
 */
export type FocusEventHandler = (event: FocusChangeEvent) => void | Promise<void>;
export type KeyboardEventHandler = (event: KeyboardEvent, component: ClickableComponent) => boolean | Promise<boolean>;

export interface FocusEventHandlers {
  onFocusChange?: FocusEventHandler;
  onFocusEnter?: (component: ClickableComponent) => void | Promise<void>;
  onFocusLeave?: (component: ClickableComponent) => void | Promise<void>;
  onKeyboardEvent?: KeyboardEventHandler;
  onFocusTrap?: (direction: FocusDirection) => void | Promise<void>;
}

/**
 * Focus Manager System
 * Manages keyboard focus, navigation, and accessibility for interactive components
 */
export class FocusManager {
  private config: FocusConfig;
  private componentRegistry: ComponentRegistry;
  private currentFocus: ClickableComponent | null = null;
  private previousFocus: ClickableComponent | null = null;
  private componentStates = new Map<string, ComponentState>();
  private focusGroups = new Map<string, FocusGroup>();
  private focusStack: ClickableComponent[] = [];
  private eventHandlers: FocusEventHandlers = {};
  private tabOrderCache = new Map<string, ClickableComponent[]>();
  private navigationHistory: ClickableComponent[] = [];
  private focusRestoreStack: ClickableComponent[] = [];

  constructor(componentRegistry: ComponentRegistry, config: Partial<FocusConfig> = {}) {
    this.componentRegistry = componentRegistry;
    this.config = { ...DEFAULT_FOCUS_CONFIG, ...config };
    this.setupComponentRegistryListener();
  }

  /**
   * Set up listener for component registry changes
   */
  private setupComponentRegistryListener(): void {
    // Listen for component changes to update tab order cache
    this.componentRegistry.addChangeListener((changeEvent) => {
      if (changeEvent.type === 'added' || changeEvent.type === 'removed' || changeEvent.type === 'updated') {
        this.invalidateTabOrderCache();
        
        // If currently focused component was removed, move focus
        if (changeEvent.type === 'removed' && this.currentFocus?.id === changeEvent.componentId) {
          this.moveFocus('forward');
        }
      }
    });
  }

  /**
   * Process keyboard event
   */
  async processKeyboardEvent(event: KeyboardEvent): Promise<boolean> {
    if (!this.config.enabled || !this.config.keyboardNavigation) {
      return false;
    }

    // Call component-specific keyboard handler first
    if (this.currentFocus) {
      const componentState = this.getOrCreateComponentState(this.currentFocus.id);
      
      // Call component's keyboard handler
      if (this.currentFocus.handlers.onKeyboardActivate) {
        await this.currentFocus.handlers.onKeyboardActivate(event.key);
      }

      // Call global keyboard handler
      if (this.eventHandlers.onKeyboardEvent) {
        const handled = await this.eventHandlers.onKeyboardEvent(event, this.currentFocus);
        if (handled) {
          return true;
        }
      }
    }

    // Handle navigation keys
    return await this.handleNavigationKey(event);
  }

  /**
   * Handle navigation keyboard events
   */
  private async handleNavigationKey(event: KeyboardEvent): Promise<boolean> {
    const { key, modifiers } = event;

    // Tab navigation
    if (key === 'Tab') {
      const direction = modifiers.shift ? 'backward' : 'forward';
      await this.moveFocus(direction);
      return true;
    }

    // Arrow navigation (if enabled)
    if (this.config.arrowNavigation !== 'disabled') {
      switch (key) {
        case 'ArrowUp':
          await this.moveFocus('up');
          return true;
        case 'ArrowDown':
          await this.moveFocus('down');
          return true;
        case 'ArrowLeft':
          await this.moveFocus('left');
          return true;
        case 'ArrowRight':
          await this.moveFocus('right');
          return true;
      }
    }

    // Home/End navigation
    if (key === 'Home') {
      await this.moveFocus('first');
      return true;
    }
    if (key === 'End') {
      await this.moveFocus('last');
      return true;
    }

    // Escape - clear focus
    if (key === 'Escape') {
      await this.clearFocus();
      return true;
    }

    // Enter/Space - activate component
    if ((key === 'Enter' || key === ' ') && this.currentFocus) {
      if (this.currentFocus.accessibility.keyboardActivatable) {
        // Create synthetic mouse event for activation
        const syntheticEvent = {
          type: 'click' as const,
          coordinates: {
            x: this.currentFocus.bounds.x + Math.floor(this.currentFocus.bounds.width / 2),
            y: this.currentFocus.bounds.y + Math.floor(this.currentFocus.bounds.height / 2)
          },
          button: 'left' as const,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false },
          timestamp: event.timestamp
        };

        if (this.currentFocus.handlers.onClick) {
          await this.currentFocus.handlers.onClick(syntheticEvent);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Move focus in specified direction
   */
  async moveFocus(direction: FocusDirection): Promise<boolean> {
    const focusableComponents = this.getFocusableComponents();
    
    if (focusableComponents.length === 0) {
      return false;
    }

    let nextComponent: ClickableComponent | null = null;

    switch (direction) {
      case 'first':
        nextComponent = focusableComponents[0];
        break;
      case 'last':
        nextComponent = focusableComponents[focusableComponents.length - 1];
        break;
      case 'forward':
      case 'backward':
        nextComponent = this.getNextInTabOrder(direction, focusableComponents);
        break;
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        nextComponent = this.getNextInSpatialOrder(direction, focusableComponents);
        break;
    }

    if (nextComponent && nextComponent !== this.currentFocus) {
      await this.setFocus(nextComponent, direction, true);
      return true;
    }

    // Handle focus trap
    if (this.config.trapFocus && this.eventHandlers.onFocusTrap) {
      await this.eventHandlers.onFocusTrap(direction);
    }

    return false;
  }

  /**
   * Get next component in tab order
   */
  private getNextInTabOrder(direction: 'forward' | 'backward', components: ClickableComponent[]): ClickableComponent | null {
    if (components.length === 0) return null;
    
    const orderedComponents = this.getTabOrderedComponents(components);
    
    if (!this.currentFocus) {
      return direction === 'forward' ? orderedComponents[0] : orderedComponents[orderedComponents.length - 1];
    }

    const currentIndex = orderedComponents.findIndex(c => c.id === this.currentFocus!.id);
    if (currentIndex === -1) {
      return direction === 'forward' ? orderedComponents[0] : orderedComponents[orderedComponents.length - 1];
    }

    let nextIndex: number;
    if (direction === 'forward') {
      nextIndex = currentIndex + 1;
      if (nextIndex >= orderedComponents.length) {
        nextIndex = this.config.wrapFocus ? 0 : currentIndex;
      }
    } else {
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = this.config.wrapFocus ? orderedComponents.length - 1 : currentIndex;
      }
    }

    return orderedComponents[nextIndex];
  }

  /**
   * Get next component in spatial order
   */
  private getNextInSpatialOrder(direction: 'up' | 'down' | 'left' | 'right', components: ClickableComponent[]): ClickableComponent | null {
    if (!this.currentFocus || components.length === 0) return null;

    const currentBounds = this.currentFocus.bounds;
    const currentCenter = {
      x: currentBounds.x + currentBounds.width / 2,
      y: currentBounds.y + currentBounds.height / 2
    };

    let bestComponent: ClickableComponent | null = null;
    let bestDistance = Infinity;

    for (const component of components) {
      if (component.id === this.currentFocus.id) continue;

      const bounds = component.bounds;
      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      };

      // Check if component is in the right direction
      let inDirection = false;
      switch (direction) {
        case 'up':
          inDirection = center.y < currentCenter.y;
          break;
        case 'down':
          inDirection = center.y > currentCenter.y;
          break;
        case 'left':
          inDirection = center.x < currentCenter.x;
          break;
        case 'right':
          inDirection = center.x > currentCenter.x;
          break;
      }

      if (!inDirection) continue;

      // Calculate distance with directional bias
      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;
      let distance = Math.sqrt(dx * dx + dy * dy);

      // Add penalty for off-axis movement
      switch (direction) {
        case 'up':
        case 'down':
          distance += Math.abs(dx) * 0.5; // Prefer vertical alignment
          break;
        case 'left':
        case 'right':
          distance += Math.abs(dy) * 0.5; // Prefer horizontal alignment
          break;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestComponent = component;
      }
    }

    return bestComponent;
  }

  /**
   * Set focus to a component
   */
  async setFocus(component: ClickableComponent | null, direction: FocusDirection = 'forward', viaKeyboard = false): Promise<void> {
    if (component === this.currentFocus) {
      return;
    }

    const previousFocus = this.currentFocus;
    
    // Remove focus from previous component
    if (previousFocus) {
      await this.removeFocusFromComponent(previousFocus);
    }

    // Set focus to new component
    this.previousFocus = previousFocus;
    this.currentFocus = component;

    if (component) {
      await this.applyFocusToComponent(component);
      this.addToNavigationHistory(component);
    }

    // Create focus change event
    const focusEvent: FocusChangeEvent = {
      previous: previousFocus,
      current: component,
      direction,
      timestamp: Date.now(),
      viaKeyboard
    };

    // Call event handlers
    if (this.eventHandlers.onFocusChange) {
      await this.eventHandlers.onFocusChange(focusEvent);
    }

    if (previousFocus && this.eventHandlers.onFocusLeave) {
      await this.eventHandlers.onFocusLeave(previousFocus);
    }

    if (component && this.eventHandlers.onFocusEnter) {
      await this.eventHandlers.onFocusEnter(component);
    }

    if (this.config.debug) {
      console.debug(`[FocusManager] Focus changed: ${previousFocus?.id || 'none'} → ${component?.id || 'none'}`);
    }
  }

  /**
   * Apply focus to component
   */
  private async applyFocusToComponent(component: ClickableComponent): Promise<void> {
    const componentState = this.getOrCreateComponentState(component.id);
    componentState.isFocused = true;
    componentState.lastInteraction = Date.now();

    // Apply visual feedback if enabled
    if (this.config.visualIndicators) {
      const focusFeedback = this.getFocusFeedback(component);
      componentState.visualFeedback = focusFeedback;
    }

    // Call component's focus handler
    if (component.handlers.onFocus) {
      await component.handlers.onFocus();
    }

    // Add to focus stack for restoration
    if (this.config.restoreFocus) {
      this.focusRestoreStack.push(component);
      
      // Limit stack size
      if (this.focusRestoreStack.length > 50) {
        this.focusRestoreStack.shift();
      }
    }
  }

  /**
   * Remove focus from component
   */
  private async removeFocusFromComponent(component: ClickableComponent): Promise<void> {
    const componentState = this.getOrCreateComponentState(component.id);
    componentState.isFocused = false;
    componentState.visualFeedback = null;

    // Call component's blur handler
    if (component.handlers.onBlur) {
      await component.handlers.onBlur();
    }
  }

  /**
   * Clear focus from all components
   */
  async clearFocus(): Promise<void> {
    await this.setFocus(null);
  }

  /**
   * Get focus feedback for component
   */
  private getFocusFeedback(component: ClickableComponent): VisualFeedback {
    // Check for custom focus feedback in component data
    if (component.data?.focusFeedback) {
      return component.data.focusFeedback as VisualFeedback;
    }

    // Use accessibility-compliant focus feedback
    return VisualFeedbackUtils.createFocusFeedback();
  }

  /**
   * Get components that can receive focus
   */
  private getFocusableComponents(): ClickableComponent[] {
    const allComponents = this.componentRegistry.getAllComponents();
    
    return allComponents.filter(component => {
      // Skip disabled components if configured
      if (this.config.skipDisabled && !component.isEnabled) {
        return false;
      }

      // Skip invisible components if configured
      if (this.config.skipInvisible && !component.isVisible) {
        return false;
      }

      // Must have valid tab index
      if (component.accessibility.tabIndex < 0) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get components ordered by tab index
   */
  private getTabOrderedComponents(components: ClickableComponent[]): ClickableComponent[] {
    const cacheKey = components.map(c => c.id).sort().join('|');
    
    if (this.tabOrderCache.has(cacheKey)) {
      return this.tabOrderCache.get(cacheKey)!;
    }

    // Sort by tab index, then by position
    const ordered = [...components].sort((a, b) => {
      // Tab index comparison
      if (a.accessibility.tabIndex !== b.accessibility.tabIndex) {
        return a.accessibility.tabIndex - b.accessibility.tabIndex;
      }

      // Position comparison (top to bottom, left to right)
      if (a.bounds.y !== b.bounds.y) {
        return a.bounds.y - b.bounds.y;
      }

      return a.bounds.x - b.bounds.x;
    });

    this.tabOrderCache.set(cacheKey, ordered);
    return ordered;
  }

  /**
   * Invalidate tab order cache
   */
  private invalidateTabOrderCache(): void {
    this.tabOrderCache.clear();
  }

  /**
   * Add component to navigation history
   */
  private addToNavigationHistory(component: ClickableComponent): void {
    this.navigationHistory.push(component);
    
    // Limit history size
    if (this.navigationHistory.length > 100) {
      this.navigationHistory.shift();
    }
  }

  /**
   * Create focus group
   */
  createFocusGroup(
    id: string,
    components: ClickableComponent[],
    options: Partial<Omit<FocusGroup, 'id' | 'components'>> = {}
  ): void {
    const focusGroup: FocusGroup = {
      id,
      components,
      active: true,
      wrap: true,
      navigationMode: 'sequential',
      ...options
    };

    this.focusGroups.set(id, focusGroup);
    this.invalidateTabOrderCache();
  }

  /**
   * Remove focus group
   */
  removeFocusGroup(id: string): void {
    this.focusGroups.delete(id);
    this.invalidateTabOrderCache();
  }

  /**
   * Get or create component state
   */
  private getOrCreateComponentState(componentId: string): ComponentState {
    if (!this.componentStates.has(componentId)) {
      this.componentStates.set(componentId, {
        isHovered: false,
        isFocused: false,
        isActive: false,
        visualFeedback: null,
        lastInteraction: Date.now()
      });
    }
    return this.componentStates.get(componentId)!;
  }

  /**
   * Get current focused component
   */
  getCurrentFocus(): ClickableComponent | null {
    return this.currentFocus;
  }

  /**
   * Get previous focused component
   */
  getPreviousFocus(): ClickableComponent | null {
    return this.previousFocus;
  }

  /**
   * Check if component is currently focused
   */
  isFocused(componentId: string): boolean {
    return this.currentFocus?.id === componentId;
  }

  /**
   * Get component state
   */
  getComponentState(componentId: string): ComponentState | null {
    return this.componentStates.get(componentId) || null;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<FocusEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FocusConfig>): void {
    this.config = { ...this.config, ...config };
    this.invalidateTabOrderCache();
  }

  /**
   * Get current configuration
   */
  getConfig(): FocusConfig {
    return { ...this.config };
  }

  /**
   * Restore previous focus
   */
  async restoreFocus(): Promise<boolean> {
    if (!this.config.restoreFocus || this.focusRestoreStack.length === 0) {
      return false;
    }

    // Find the most recent valid component in the stack
    while (this.focusRestoreStack.length > 0) {
      const component = this.focusRestoreStack.pop()!;
      
      // Check if component still exists and is focusable
      const current = this.componentRegistry.get(component.id);
      if (current && current.isEnabled && current.isVisible && current.accessibility.tabIndex >= 0) {
        await this.setFocus(current);
        return true;
      }
    }

    return false;
  }

  /**
   * Get navigation history
   */
  getNavigationHistory(): ClickableComponent[] {
    return [...this.navigationHistory];
  }

  /**
   * Get focus groups
   */
  getFocusGroups(): Map<string, FocusGroup> {
    return new Map(this.focusGroups);
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      currentFocus: this.currentFocus?.id || null,
      previousFocus: this.previousFocus?.id || null,
      componentStatesCount: this.componentStates.size,
      focusGroupsCount: this.focusGroups.size,
      navigationHistoryCount: this.navigationHistory.length,
      focusRestoreStackCount: this.focusRestoreStack.length,
      tabOrderCacheSize: this.tabOrderCache.size
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.currentFocus = null;
    this.previousFocus = null;
    this.componentStates.clear();
    this.focusGroups.clear();
    this.focusStack = [];
    this.eventHandlers = {};
    this.tabOrderCache.clear();
    this.navigationHistory = [];
    this.focusRestoreStack = [];
  }
}