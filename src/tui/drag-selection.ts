/**
 * Drag-to-Select System
 * Integrates mouse drag events with text selection for real-time selection updates
 */

import { MouseEvent } from './mouse-types.js';
import { TextSelection, TextPosition, TextRange, SelectionEvent } from './text-selection.js';
import { ComponentRegistry } from './component-registry.js';

/**
 * Drag selection state
 */
export interface DragSelectionState {
  /** Whether drag selection is active */
  isDragging: boolean;
  /** Drag start position */
  startPosition: TextPosition | null;
  /** Current drag position */
  currentPosition: TextPosition | null;
  /** Drag start time */
  startTime: number;
  /** Last update time */
  lastUpdate: number;
  /** Total drag distance */
  dragDistance: number;
  /** Drag direction */
  direction: 'horizontal' | 'vertical' | 'diagonal' | 'none';
}

/**
 * Drag selection configuration
 */
export interface DragSelectionConfig {
  /** Enable drag selection */
  enabled: boolean;
  /** Minimum drag distance to start selection */
  dragThreshold: number;
  /** Update frequency for real-time updates (ms) */
  updateInterval: number;
  /** Enable selection preview during drag */
  showPreview: boolean;
  /** Auto-scroll during drag selection */
  autoScroll: boolean;
  /** Auto-scroll speed */
  autoScrollSpeed: number;
  /** Maximum drag distance before auto-scroll */
  autoScrollThreshold: number;
  /** Enable word-snap during drag */
  enableWordSnap: boolean;
  /** Word snap threshold */
  wordSnapThreshold: number;
  /** Debug drag events */
  debug: boolean;
}

/**
 * Terminal viewport information
 */
export interface TerminalViewport {
  /** Visible width in characters */
  width: number;
  /** Visible height in lines */
  height: number;
  /** Scroll offset from top */
  scrollTop: number;
  /** Scroll offset from left */
  scrollLeft: number;
  /** Total content width */
  contentWidth: number;
  /** Total content height */
  contentHeight: number;
}

/**
 * Auto-scroll direction
 */
export type AutoScrollDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Default drag selection configuration
 */
const DEFAULT_DRAG_CONFIG: DragSelectionConfig = {
  enabled: true,
  dragThreshold: 3,
  updateInterval: 16, // ~60fps
  showPreview: true,
  autoScroll: false,
  autoScrollSpeed: 1,
  autoScrollThreshold: 2,
  enableWordSnap: false,
  wordSnapThreshold: 5,
  debug: false
};

/**
 * Drag selection event types
 */
export interface DragSelectionEvent {
  type: 'dragStart' | 'dragUpdate' | 'dragEnd' | 'dragCancel' | 'autoScroll';
  dragState: DragSelectionState;
  selectionRange: TextRange | null;
  mouseEvent: MouseEvent;
  timestamp: number;
}

/**
 * Drag selection event handlers
 */
export type DragSelectionEventHandler = (event: DragSelectionEvent) => void | Promise<void>;

export interface DragSelectionEventHandlers {
  onDragStart?: DragSelectionEventHandler;
  onDragUpdate?: DragSelectionEventHandler;
  onDragEnd?: DragSelectionEventHandler;
  onDragCancel?: DragSelectionEventHandler;
  onAutoScroll?: DragSelectionEventHandler;
}

/**
 * Coordinate mapping utilities
 */
export class CoordinateMapper {
  /**
   * Convert mouse coordinates to text position
   */
  static mouseToTextPosition(
    mouseX: number, 
    mouseY: number, 
    viewport: TerminalViewport,
    content: string[]
  ): TextPosition {
    // Convert screen coordinates to content coordinates
    const line = Math.max(0, Math.min(mouseY + viewport.scrollTop, content.length - 1));
    const column = Math.max(0, mouseX + viewport.scrollLeft);
    
    // Clamp column to line length
    if (line < content.length) {
      const clampedColumn = Math.min(column, content[line].length);
      return { line, column: clampedColumn };
    }
    
    return { line: content.length - 1, column: 0 };
  }

  /**
   * Convert text position to screen coordinates
   */
  static textToScreenPosition(
    position: TextPosition,
    viewport: TerminalViewport
  ): { x: number; y: number } {
    return {
      x: position.column - viewport.scrollLeft,
      y: position.line - viewport.scrollTop
    };
  }

  /**
   * Check if position is within viewport
   */
  static isPositionInViewport(position: TextPosition, viewport: TerminalViewport): boolean {
    return position.line >= viewport.scrollTop &&
           position.line < viewport.scrollTop + viewport.height &&
           position.column >= viewport.scrollLeft &&
           position.column < viewport.scrollLeft + viewport.width;
  }

  /**
   * Calculate distance between two positions
   */
  static calculateDistance(pos1: TextPosition, pos2: TextPosition): number {
    const dx = pos2.column - pos1.column;
    const dy = pos2.line - pos1.line;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Determine drag direction
   */
  static getDragDirection(start: TextPosition, current: TextPosition): DragSelectionState['direction'] {
    const dx = Math.abs(current.column - start.column);
    const dy = Math.abs(current.line - start.line);
    
    if (dx < 2 && dy < 2) return 'none';
    if (dx > dy * 2) return 'horizontal';
    if (dy > dx * 2) return 'vertical';
    return 'diagonal';
  }
}

/**
 * Auto-scroll manager for drag selection
 */
export class AutoScrollManager {
  private viewport: TerminalViewport;
  private config: DragSelectionConfig;
  private scrollTimer: NodeJS.Timeout | null = null;
  private scrollCallbacks: Set<(direction: AutoScrollDirection) => void> = new Set();

  constructor(viewport: TerminalViewport, config: DragSelectionConfig) {
    this.viewport = viewport;
    this.config = config;
  }

  /**
   * Check if auto-scroll should be activated
   */
  shouldAutoScroll(mouseX: number, mouseY: number): AutoScrollDirection | null {
    if (!this.config.autoScroll) return null;

    const threshold = this.config.autoScrollThreshold;

    if (mouseY < threshold) return 'up';
    if (mouseY > this.viewport.height - threshold) return 'down';
    if (mouseX < threshold) return 'left';
    if (mouseX > this.viewport.width - threshold) return 'right';

    return null;
  }

  /**
   * Start auto-scroll in direction
   */
  startAutoScroll(direction: AutoScrollDirection): void {
    this.stopAutoScroll();

    this.scrollTimer = setInterval(() => {
      this.performScroll(direction);
    }, 100 / this.config.autoScrollSpeed);
  }

  /**
   * Stop auto-scroll
   */
  stopAutoScroll(): void {
    if (this.scrollTimer) {
      clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
  }

  /**
   * Perform scroll operation
   */
  private performScroll(direction: AutoScrollDirection): void {
    switch (direction) {
      case 'up':
        if (this.viewport.scrollTop > 0) {
          this.viewport.scrollTop = Math.max(0, this.viewport.scrollTop - 1);
        }
        break;
      case 'down':
        if (this.viewport.scrollTop < this.viewport.contentHeight - this.viewport.height) {
          this.viewport.scrollTop = Math.min(
            this.viewport.contentHeight - this.viewport.height,
            this.viewport.scrollTop + 1
          );
        }
        break;
      case 'left':
        if (this.viewport.scrollLeft > 0) {
          this.viewport.scrollLeft = Math.max(0, this.viewport.scrollLeft - 1);
        }
        break;
      case 'right':
        if (this.viewport.scrollLeft < this.viewport.contentWidth - this.viewport.width) {
          this.viewport.scrollLeft = Math.min(
            this.viewport.contentWidth - this.viewport.width,
            this.viewport.scrollLeft + 1
          );
        }
        break;
    }

    // Notify callbacks
    this.scrollCallbacks.forEach(callback => callback(direction));
  }

  /**
   * Add scroll callback
   */
  onScroll(callback: (direction: AutoScrollDirection) => void): void {
    this.scrollCallbacks.add(callback);
  }

  /**
   * Remove scroll callback
   */
  offScroll(callback: (direction: AutoScrollDirection) => void): void {
    this.scrollCallbacks.delete(callback);
  }

  /**
   * Update viewport
   */
  updateViewport(viewport: TerminalViewport): void {
    this.viewport = viewport;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAutoScroll();
    this.scrollCallbacks.clear();
  }
}

/**
 * Drag Selection Manager
 * Handles drag-to-select functionality with real-time updates
 */
export class DragSelectionManager {
  private config: DragSelectionConfig;
  private textSelection: TextSelection;
  private componentRegistry: ComponentRegistry;
  private viewport: TerminalViewport;
  private autoScrollManager: AutoScrollManager;
  private dragState: DragSelectionState;
  private updateTimer: NodeJS.Timeout | null = null;
  private eventHandlers: DragSelectionEventHandlers = {};
  private content: string[] = [];

  constructor(
    textSelection: TextSelection,
    componentRegistry: ComponentRegistry,
    viewport: TerminalViewport,
    config: Partial<DragSelectionConfig> = {}
  ) {
    this.config = { ...DEFAULT_DRAG_CONFIG, ...config };
    this.textSelection = textSelection;
    this.componentRegistry = componentRegistry;
    this.viewport = viewport;
    this.autoScrollManager = new AutoScrollManager(viewport, this.config);
    this.dragState = this.createInitialDragState();

    // Setup auto-scroll callback
    this.autoScrollManager.onScroll((direction) => {
      this.handleAutoScroll(direction);
    });
  }

  /**
   * Create initial drag state
   */
  private createInitialDragState(): DragSelectionState {
    return {
      isDragging: false,
      startPosition: null,
      currentPosition: null,
      startTime: 0,
      lastUpdate: 0,
      dragDistance: 0,
      direction: 'none'
    };
  }

  /**
   * Update content for coordinate mapping
   */
  updateContent(content: string[]): void {
    this.content = [...content];
    this.textSelection.updateContent(content);
  }

  /**
   * Update viewport for coordinate calculations
   */
  updateViewport(viewport: TerminalViewport): void {
    this.viewport = viewport;
    this.autoScrollManager.updateViewport(viewport);
  }

  /**
   * Process mouse event for drag selection
   */
  async processMouseEvent(event: MouseEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    switch (event.type) {
      case 'click':
        await this.handleMouseDown(event);
        break;
      case 'move':
        await this.handleMouseMove(event);
        break;
      case 'drag_end':
        await this.handleMouseUp(event);
        break;
      case 'drag':
        await this.handleMouseDrag(event);
        break;
    }
  }

  /**
   * Handle mouse down event
   */
  private async handleMouseDown(event: MouseEvent): Promise<void> {
    // Convert mouse coordinates to text position
    const textPosition = CoordinateMapper.mouseToTextPosition(
      event.coordinates.x,
      event.coordinates.y,
      this.viewport,
      this.content
    );

    // Check if clicking on a UI component (should not start text selection)
    const component = this.componentRegistry.findAt(event.coordinates.x, event.coordinates.y);
    if (component) {
      return; // Let component handle the interaction
    }

    // Initialize drag state
    this.dragState = {
      isDragging: false, // Will be set to true when drag threshold is exceeded
      startPosition: textPosition,
      currentPosition: textPosition,
      startTime: event.timestamp,
      lastUpdate: event.timestamp,
      dragDistance: 0,
      direction: 'none'
    };

    // Start selection at position
    this.textSelection.startSelection(textPosition, 'character', 'mouse');

    if (this.config.debug) {
      console.debug(`[DragSelection] Mouse down at text position (${textPosition.line}, ${textPosition.column})`);
    }
  }

  /**
   * Handle mouse move event
   */
  private async handleMouseMove(event: MouseEvent): Promise<void> {
    if (!this.dragState.startPosition) {
      return;
    }

    const textPosition = CoordinateMapper.mouseToTextPosition(
      event.coordinates.x,
      event.coordinates.y,
      this.viewport,
      this.content
    );

    // Calculate drag distance
    const dragDistance = CoordinateMapper.calculateDistance(
      this.dragState.startPosition,
      textPosition
    );

    // Check if drag threshold is exceeded
    if (!this.dragState.isDragging && dragDistance >= this.config.dragThreshold) {
      this.dragState.isDragging = true;
      await this.startDragSelection(event);
    }

    if (this.dragState.isDragging) {
      // Update drag state
      this.dragState.currentPosition = textPosition;
      this.dragState.dragDistance = dragDistance;
      this.dragState.direction = CoordinateMapper.getDragDirection(
        this.dragState.startPosition,
        textPosition
      );
      this.dragState.lastUpdate = event.timestamp;

      // Apply word snapping if enabled
      const finalPosition = this.config.enableWordSnap ? 
        this.applyWordSnap(textPosition) : textPosition;

      // Update text selection
      this.textSelection.updateSelection(finalPosition, 'mouse');

      // Check for auto-scroll
      const scrollDirection = this.autoScrollManager.shouldAutoScroll(
        event.coordinates.x,
        event.coordinates.y
      );

      if (scrollDirection) {
        this.autoScrollManager.startAutoScroll(scrollDirection);
      } else {
        this.autoScrollManager.stopAutoScroll();
      }

      // Fire drag update event
      await this.fireDragEvent('dragUpdate', event);

      // Throttle updates if configured
      if (this.config.updateInterval > 0) {
        this.scheduleUpdate();
      }
    }
  }

  /**
   * Handle mouse drag event (if mouse system provides specific drag events)
   */
  private async handleMouseDrag(event: MouseEvent): Promise<void> {
    // This is similar to mouse move but specifically for drag events
    await this.handleMouseMove(event);
  }

  /**
   * Handle mouse up event
   */
  private async handleMouseUp(event: MouseEvent): Promise<void> {
    if (this.dragState.isDragging) {
      // Stop auto-scroll
      this.autoScrollManager.stopAutoScroll();

      // Finalize selection
      const finalRange = this.textSelection.endSelection('mouse');

      // Fire drag end event
      await this.fireDragEvent('dragEnd', event);

      if (this.config.debug && finalRange) {
        const selectedText = this.textSelection.getSelectedText();
        console.debug(`[DragSelection] Drag completed: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`);
      }
    } else if (this.dragState.startPosition) {
      // Single click - clear any existing selection
      this.textSelection.clearSelection();
    }

    // Reset drag state
    this.dragState = this.createInitialDragState();
    this.clearUpdateTimer();
  }

  /**
   * Start drag selection
   */
  private async startDragSelection(event: MouseEvent): Promise<void> {
    await this.fireDragEvent('dragStart', event);

    if (this.config.debug) {
      console.debug(`[DragSelection] Drag selection started`);
    }
  }

  /**
   * Apply word snapping to position
   */
  private applyWordSnap(position: TextPosition): TextPosition {
    if (this.dragState.dragDistance < this.config.wordSnapThreshold) {
      return position;
    }

    // Find nearest word boundary
    if (position.line < this.content.length) {
      const line = this.content[position.line];
      const char = line[position.column];

      if (char && /\w/.test(char)) {
        // Snap to end of word
        let endCol = position.column;
        while (endCol < line.length && /\w/.test(line[endCol])) {
          endCol++;
        }
        return { line: position.line, column: endCol };
      } else if (position.column > 0 && /\w/.test(line[position.column - 1])) {
        // Snap to start of word
        let startCol = position.column - 1;
        while (startCol > 0 && /\w/.test(line[startCol - 1])) {
          startCol--;
        }
        return { line: position.line, column: startCol };
      }
    }

    return position;
  }

  /**
   * Handle auto-scroll event
   */
  private async handleAutoScroll(direction: AutoScrollDirection): Promise<void> {
    if (!this.dragState.isDragging || !this.dragState.currentPosition) {
      return;
    }

    // Update selection with current position after scroll
    this.textSelection.updateSelection(this.dragState.currentPosition, 'mouse');

    // Fire auto-scroll event
    const event: DragSelectionEvent = {
      type: 'autoScroll',
      dragState: { ...this.dragState },
      selectionRange: this.textSelection.getSelection(),
      mouseEvent: {
        type: 'move',
        coordinates: { x: 0, y: 0 }, // Not relevant for auto-scroll
        button: 'left',
        modifiers: { shift: false, ctrl: false, alt: false, meta: false },
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    if (this.eventHandlers.onAutoScroll) {
      await this.eventHandlers.onAutoScroll(event);
    }
  }

  /**
   * Schedule throttled update
   */
  private scheduleUpdate(): void {
    if (this.updateTimer) {
      return; // Update already scheduled
    }

    this.updateTimer = setTimeout(() => {
      this.updateTimer = null;
      // Additional update processing if needed
    }, this.config.updateInterval);
  }

  /**
   * Clear update timer
   */
  private clearUpdateTimer(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Fire drag selection event
   */
  private async fireDragEvent(type: DragSelectionEvent['type'], mouseEvent: MouseEvent): Promise<void> {
    const event: DragSelectionEvent = {
      type,
      dragState: { ...this.dragState },
      selectionRange: this.textSelection.getSelection(),
      mouseEvent,
      timestamp: Date.now()
    };

    // Call appropriate handler
    switch (type) {
      case 'dragStart':
        if (this.eventHandlers.onDragStart) {
          await this.eventHandlers.onDragStart(event);
        }
        break;
      case 'dragUpdate':
        if (this.eventHandlers.onDragUpdate) {
          await this.eventHandlers.onDragUpdate(event);
        }
        break;
      case 'dragEnd':
        if (this.eventHandlers.onDragEnd) {
          await this.eventHandlers.onDragEnd(event);
        }
        break;
      case 'dragCancel':
        if (this.eventHandlers.onDragCancel) {
          await this.eventHandlers.onDragCancel(event);
        }
        break;
    }
  }

  /**
   * Cancel current drag operation
   */
  cancelDrag(): void {
    if (this.dragState.isDragging) {
      this.autoScrollManager.stopAutoScroll();
      this.textSelection.clearSelection();

      // Fire cancel event
      const event: DragSelectionEvent = {
        type: 'dragCancel',
        dragState: { ...this.dragState },
        selectionRange: null,
        mouseEvent: {
          type: 'move',
          coordinates: { x: 0, y: 0 },
          button: 'left',
          modifiers: { shift: false, ctrl: false, alt: false, meta: false },
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };

      this.eventHandlers.onDragCancel?.(event);
    }

    this.dragState = this.createInitialDragState();
    this.clearUpdateTimer();
  }

  /**
   * Check if drag is currently active
   */
  isDragging(): boolean {
    return this.dragState.isDragging;
  }

  /**
   * Get current drag state
   */
  getDragState(): Readonly<DragSelectionState> {
    return { ...this.dragState };
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<DragSelectionEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DragSelectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): DragSelectionConfig {
    return { ...this.config };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      dragState: this.dragState,
      viewport: this.viewport,
      contentLineCount: this.content.length,
      hasUpdateTimer: this.updateTimer !== null,
      textSelectionActive: this.textSelection.isSelectionActive()
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.cancelDrag();
    this.autoScrollManager.dispose();
    this.eventHandlers = {};
    this.content = [];
  }
}