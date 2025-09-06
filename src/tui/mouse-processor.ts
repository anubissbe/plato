/**
 * Mouse Event Processing System
 * Handles coordinate mapping, event throttling, and validation
 */

import {
  MouseEvent,
  MouseCoordinates,
  MouseBounds,
  MouseEventProcessingOptions,
  MouseState,
  MouseBoundsError,
  DEFAULT_PROCESSING_OPTIONS
} from './mouse-types.js';

/**
 * Mouse event processor with throttling and validation
 */
export class MouseEventProcessor {
  private options: MouseEventProcessingOptions;
  private eventQueue: MouseEvent[] = [];
  private lastProcessedTime = 0;
  private mouseState: MouseState;
  private bounds: MouseBounds = { width: 80, height: 24 }; // Default terminal size

  constructor(options: Partial<MouseEventProcessingOptions> = {}) {
    this.options = { ...DEFAULT_PROCESSING_OPTIONS, ...options };
    this.mouseState = this.createInitialMouseState();
  }

  /**
   * Process a single mouse event
   */
  processEvent(event: MouseEvent, bounds?: MouseBounds): MouseEvent | null {
    if (bounds) {
      this.bounds = bounds;
    }

    try {
      // Validate coordinates
      if (this.options.validateBounds && !this.validateCoordinates(event.coordinates, this.bounds)) {
        if (this.options.debug) {
          console.debug(`[MouseProcessor] Event outside bounds: ${event.coordinates.x}, ${event.coordinates.y}`);
        }
        return null;
      }

      // Update mouse state
      this.updateMouseState(event);

      // Apply coordinate transformations if needed
      const processedEvent = this.transformEvent(event);

      // Add to queue for throttling
      this.addToQueue(processedEvent);

      return processedEvent;
    } catch (error) {
      if (this.options.debug) {
        console.error('[MouseProcessor] Error processing event:', error);
      }
      return null;
    }
  }

  /**
   * Process event queue with throttling
   */
  processEventQueue(): MouseEvent[] {
    const now = Date.now();
    
    if (now - this.lastProcessedTime < this.options.throttleMs) {
      return []; // Too soon, return empty array
    }

    const events = this.throttleEvents([...this.eventQueue]);
    this.eventQueue = []; // Clear processed events
    this.lastProcessedTime = now;

    if (this.options.debug && events.length > 0) {
      console.debug(`[MouseProcessor] Processed ${events.length} events from queue`);
    }

    return events;
  }

  /**
   * Throttle rapid mouse events
   */
  throttleEvents(events: MouseEvent[]): MouseEvent[] {
    if (events.length === 0) return events;

    const throttledEvents: MouseEvent[] = [];
    let lastEventTime = 0;
    const throttleMs = this.options.throttleMs;

    // Group events by type for different throttling strategies
    const eventGroups = this.groupEventsByType(events);

    // Apply type-specific throttling
    for (const [eventType, typeEvents] of eventGroups) {
      switch (eventType) {
        case 'move':
          // Aggressively throttle move events
          throttledEvents.push(...this.throttleByTime(typeEvents, throttleMs * 2));
          break;
        
        case 'scroll':
          // Moderate throttling for scroll events
          throttledEvents.push(...this.throttleByTime(typeEvents, throttleMs));
          break;
        
        case 'drag':
          // Light throttling for drag events to maintain smoothness
          throttledEvents.push(...this.throttleByTime(typeEvents, throttleMs / 2));
          break;
        
        case 'click':
        case 'drag_start':
        case 'drag_end':
          // No throttling for discrete events
          throttledEvents.push(...typeEvents);
          break;
        
        default:
          throttledEvents.push(...this.throttleByTime(typeEvents, throttleMs));
      }
    }

    // Sort by timestamp to maintain chronological order
    return throttledEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Validate coordinates against terminal bounds
   */
  validateCoordinates(coords: MouseCoordinates, bounds: MouseBounds): boolean {
    return coords.x >= 0 && 
           coords.x < bounds.width && 
           coords.y >= 0 && 
           coords.y < bounds.height;
  }

  /**
   * Update internal mouse state
   */
  private updateMouseState(event: MouseEvent): void {
    this.mouseState.currentPosition = event.coordinates;
    this.mouseState.modifiers = event.modifiers;

    // Update button press state
    if (event.type === 'click') {
      this.mouseState.pressedButtons.add(event.button);
      this.mouseState.isPressed = true;
    } else if (event.type === 'drag_end') {
      this.mouseState.pressedButtons.delete(event.button);
      this.mouseState.isPressed = this.mouseState.pressedButtons.size > 0;
    }

    // Update drag state
    if (event.type === 'drag_start' || (event.type === 'click' && !this.mouseState.dragState.isDragging)) {
      this.mouseState.dragState.isDragging = true;
      this.mouseState.dragState.startPosition = event.coordinates;
      this.mouseState.dragState.currentPosition = event.coordinates;
      this.mouseState.dragState.button = event.button;
    } else if (event.type === 'drag') {
      this.mouseState.dragState.currentPosition = event.coordinates;
    } else if (event.type === 'drag_end') {
      this.mouseState.dragState.isDragging = false;
      this.mouseState.dragState.startPosition = null;
      this.mouseState.dragState.currentPosition = null;
      this.mouseState.dragState.button = null;
    }

    // Update hover state (simplified - would be enhanced by component system)
    if (event.type === 'move') {
      if (!this.mouseState.hoverState.currentTarget) {
        this.mouseState.hoverState.hoverStartTime = Date.now();
      }
    }
  }

  /**
   * Transform event coordinates or add metadata
   */
  private transformEvent(event: MouseEvent): MouseEvent {
    // For now, pass through unchanged
    // Future enhancements could add:
    // - Coordinate system transformations
    // - Component-relative coordinates
    // - Event target resolution
    return { ...event };
  }

  /**
   * Add event to processing queue
   */
  private addToQueue(event: MouseEvent): void {
    this.eventQueue.push(event);

    // Prevent queue overflow
    if (this.eventQueue.length > this.options.maxQueueSize) {
      // Remove oldest events
      const overflow = this.eventQueue.length - this.options.maxQueueSize;
      this.eventQueue.splice(0, overflow);
      
      if (this.options.debug) {
        console.warn(`[MouseProcessor] Event queue overflow, removed ${overflow} events`);
      }
    }
  }

  /**
   * Group events by type for targeted throttling
   */
  private groupEventsByType(events: MouseEvent[]): Map<string, MouseEvent[]> {
    const groups = new Map<string, MouseEvent[]>();
    
    for (const event of events) {
      const key = event.type;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }
    
    return groups;
  }

  /**
   * Apply time-based throttling to events
   */
  private throttleByTime(events: MouseEvent[], minInterval: number): MouseEvent[] {
    if (events.length === 0) return events;

    const throttled: MouseEvent[] = [events[0]]; // Always include first event
    let lastTime = events[0].timestamp;

    for (let i = 1; i < events.length; i++) {
      const event = events[i];
      if (event.timestamp - lastTime >= minInterval) {
        throttled.push(event);
        lastTime = event.timestamp;
      }
    }

    return throttled;
  }

  /**
   * Create initial mouse state
   */
  private createInitialMouseState(): MouseState {
    return {
      currentPosition: { x: 0, y: 0 },
      isPressed: false,
      pressedButtons: new Set(),
      modifiers: { shift: false, ctrl: false, alt: false, meta: false },
      dragState: {
        isDragging: false,
        startPosition: null,
        currentPosition: null,
        button: null
      },
      hoverState: {
        currentTarget: null,
        hoverStartTime: null
      }
    };
  }

  /**
   * Get current mouse state (readonly)
   */
  getMouseState(): Readonly<MouseState> {
    return { ...this.mouseState };
  }

  /**
   * Update terminal bounds
   */
  setBounds(bounds: MouseBounds): void {
    this.bounds = bounds;
  }

  /**
   * Get current bounds
   */
  getBounds(): MouseBounds {
    return { ...this.bounds };
  }

  /**
   * Clear event queue
   */
  clearEventQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { size: number; maxSize: number; lastProcessed: number } {
    return {
      size: this.eventQueue.length,
      maxSize: this.options.maxQueueSize,
      lastProcessed: this.lastProcessedTime
    };
  }

  /**
   * Update processing options
   */
  updateOptions(options: Partial<MouseEventProcessingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.eventQueue = [];
    this.lastProcessedTime = 0;
    this.mouseState = this.createInitialMouseState();
  }

  /**
   * Calculate drag distance
   */
  getDragDistance(): number {
    const { startPosition, currentPosition } = this.mouseState.dragState;
    if (!startPosition || !currentPosition) return 0;

    const dx = currentPosition.x - startPosition.x;
    const dy = currentPosition.y - startPosition.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if coordinates are within drag threshold
   */
  isDragThresholdExceeded(threshold = 3): boolean {
    return this.getDragDistance() > threshold;
  }

  /**
   * Get events in queue by type
   */
  getQueuedEventsByType(eventType: MouseEvent['type']): MouseEvent[] {
    return this.eventQueue.filter(event => event.type === eventType);
  }
}