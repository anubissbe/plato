/**
 * Click Handler System
 * Manages click events for buttons, links, and interactive elements
 */

import { MouseEvent } from './mouse-types.js';
import { 
  ClickableComponent, 
  VisualFeedback, 
  ComponentState,
  VisualFeedbackUtils,
  ComponentValidator
} from './interactive-components.js';

/**
 * Click event context information
 */
export interface ClickContext {
  /** The component that was clicked */
  component: ClickableComponent;
  /** The mouse event that triggered the click */
  event: MouseEvent;
  /** Local coordinates within the component */
  localCoordinates: { x: number; y: number };
  /** Whether this is a double-click */
  isDoubleClick: boolean;
  /** Time since last click on this component */
  timeSinceLastClick: number;
}

/**
 * Click result information
 */
export interface ClickResult {
  /** Whether the click was handled successfully */
  handled: boolean;
  /** Whether the click should prevent other handlers */
  preventDefault: boolean;
  /** Whether the click should stop propagation to parent components */
  stopPropagation: boolean;
  /** Any data returned by the click handler */
  data?: any;
  /** Error that occurred during click handling */
  error?: Error;
}

/**
 * Click configuration options
 */
export interface ClickConfig {
  /** Double-click detection threshold (ms) */
  doubleClickThreshold: number;
  /** Maximum time between click attempts (ms) */
  clickTimeout: number;
  /** Enable visual feedback for clicks */
  enableVisualFeedback: boolean;
  /** Default click feedback duration */
  feedbackDuration: number;
  /** Enable click debugging */
  debug: boolean;
  /** Enable click sound feedback */
  enableSoundFeedback: boolean;
}

/**
 * Click statistics for performance monitoring
 */
export interface ClickStats {
  /** Total clicks processed */
  totalClicks: number;
  /** Successful click handlers */
  successfulClicks: number;
  /** Failed click handlers */
  failedClicks: number;
  /** Double clicks detected */
  doubleClicks: number;
  /** Average click processing time (ms) */
  averageProcessingTime: number;
  /** Click frequency (clicks per minute) */
  clickFrequency: number;
}

/**
 * Default click configuration
 */
const DEFAULT_CLICK_CONFIG: ClickConfig = {
  doubleClickThreshold: 500,
  clickTimeout: 5000,
  enableVisualFeedback: true,
  feedbackDuration: 200,
  debug: false,
  enableSoundFeedback: false
};

/**
 * Click event handler types
 */
export type ClickEventHandler = (context: ClickContext) => Promise<ClickResult> | ClickResult;
export type DoubleClickEventHandler = (context: ClickContext) => Promise<ClickResult> | ClickResult;

export interface ClickEventHandlers {
  beforeClick?: ClickEventHandler;
  afterClick?: (context: ClickContext, result: ClickResult) => void | Promise<void>;
  onClickError?: (context: ClickContext, error: Error) => void | Promise<void>;
  onDoubleClick?: DoubleClickEventHandler;
}

/**
 * Click tracking information for double-click detection
 */
interface ClickTrack {
  componentId: string;
  timestamp: number;
  position: { x: number; y: number };
  clickCount: number;
}

/**
 * Click Handler System
 * Processes and manages click events for interactive components
 */
export class ClickHandlerSystem {
  private config: ClickConfig;
  private componentStates = new Map<string, ComponentState>();
  private clickTracks = new Map<string, ClickTrack>();
  private stats: ClickStats;
  private eventHandlers: ClickEventHandlers = {};
  private processingTimes: number[] = [];

  constructor(config: Partial<ClickConfig> = {}) {
    this.config = { ...DEFAULT_CLICK_CONFIG, ...config };
    this.stats = this.initializeStats();
  }

  /**
   * Process click event for component
   */
  async processClick(
    component: ClickableComponent,
    event: MouseEvent
  ): Promise<ClickResult> {
    const startTime = performance.now();
    this.stats.totalClicks++;

    try {
      // Validate component can handle click
      if (!this.canHandleClick(component, event)) {
        return {
          handled: false,
          preventDefault: false,
          stopPropagation: false
        };
      }

      // Create click context
      const context = await this.createClickContext(component, event);

      // Check for before-click handler
      if (this.eventHandlers.beforeClick) {
        const beforeResult = await this.eventHandlers.beforeClick(context);
        if (beforeResult.preventDefault) {
          return beforeResult;
        }
      }

      // Handle double-click detection
      if (context.isDoubleClick && component.handlers.onDoubleClick) {
        return await this.handleDoubleClick(context);
      }

      // Handle regular click
      const result = await this.handleSingleClick(context);

      // Apply visual feedback if enabled
      if (this.config.enableVisualFeedback && result.handled) {
        await this.applyClickFeedback(component);
      }

      // Call after-click handler
      if (this.eventHandlers.afterClick) {
        await this.eventHandlers.afterClick(context, result);
      }

      // Update statistics
      if (result.handled) {
        this.stats.successfulClicks++;
      } else {
        this.stats.failedClicks++;
      }

      return result;
    } catch (error) {
      this.stats.failedClicks++;
      
      const context = await this.createClickContext(component, event);
      const clickError = error instanceof Error ? error : new Error(String(error));

      // Call error handler
      if (this.eventHandlers.onClickError) {
        await this.eventHandlers.onClickError(context, clickError);
      }

      if (this.config.debug) {
        console.error(`[ClickHandler] Error processing click for ${component.id}:`, error);
      }

      return {
        handled: false,
        preventDefault: false,
        stopPropagation: false,
        error: clickError
      };
    } finally {
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updateProcessingTime(processingTime);
    }
  }

  /**
   * Handle single click event
   */
  private async handleSingleClick(context: ClickContext): Promise<ClickResult> {
    const { component } = context;

    if (!component.handlers.onClick) {
      return {
        handled: false,
        preventDefault: false,
        stopPropagation: false
      };
    }

    try {
      // Call component's click handler
      await component.handlers.onClick(context.event);

      // Update component state
      const componentState = this.getOrCreateComponentState(component.id);
      componentState.isActive = true;
      componentState.lastInteraction = context.event.timestamp;

      // Reset active state after brief delay
      setTimeout(() => {
        componentState.isActive = false;
      }, this.config.feedbackDuration);

      if (this.config.debug) {
        console.debug(`[ClickHandler] Handled single click for ${component.id}`);
      }

      return {
        handled: true,
        preventDefault: false,
        stopPropagation: false
      };
    } catch (error) {
      throw new Error(`Click handler failed for ${component.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle double-click event
   */
  private async handleDoubleClick(context: ClickContext): Promise<ClickResult> {
    const { component } = context;

    if (!component.handlers.onDoubleClick) {
      return {
        handled: false,
        preventDefault: false,
        stopPropagation: false
      };
    }

    try {
      this.stats.doubleClicks++;

      // Call component's double-click handler
      await component.handlers.onDoubleClick(context.event);

      // Update component state
      const componentState = this.getOrCreateComponentState(component.id);
      componentState.isActive = true;
      componentState.lastInteraction = context.event.timestamp;

      // Apply stronger visual feedback for double-click
      if (this.config.enableVisualFeedback) {
        await this.applyDoubleClickFeedback(component);
      }

      // Call global double-click handler if available
      if (this.eventHandlers.onDoubleClick) {
        await this.eventHandlers.onDoubleClick(context);
      }

      if (this.config.debug) {
        console.debug(`[ClickHandler] Handled double click for ${component.id}`);
      }

      return {
        handled: true,
        preventDefault: true, // Double-click typically prevents other actions
        stopPropagation: true
      };
    } catch (error) {
      throw new Error(`Double-click handler failed for ${component.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Create click context from component and event
   */
  private async createClickContext(
    component: ClickableComponent,
    event: MouseEvent
  ): Promise<ClickContext> {
    // Calculate local coordinates
    const localCoordinates = {
      x: event.coordinates.x - component.bounds.x,
      y: event.coordinates.y - component.bounds.y
    };

    // Check for double-click
    const { isDoubleClick, timeSinceLastClick } = this.detectDoubleClick(component, event);

    return {
      component,
      event,
      localCoordinates,
      isDoubleClick,
      timeSinceLastClick
    };
  }

  /**
   * Detect if this is a double-click
   */
  private detectDoubleClick(
    component: ClickableComponent,
    event: MouseEvent
  ): { isDoubleClick: boolean; timeSinceLastClick: number } {
    const now = event.timestamp;
    const lastClick = this.clickTracks.get(component.id);

    if (!lastClick) {
      // First click on this component
      this.clickTracks.set(component.id, {
        componentId: component.id,
        timestamp: now,
        position: event.coordinates,
        clickCount: 1
      });
      return { isDoubleClick: false, timeSinceLastClick: 0 };
    }

    const timeSinceLastClick = now - lastClick.timestamp;
    const isWithinThreshold = timeSinceLastClick <= this.config.doubleClickThreshold;
    const isNearPosition = this.isNearPreviousClick(event.coordinates, lastClick.position);

    if (isWithinThreshold && isNearPosition) {
      // This is a double-click
      lastClick.clickCount++;
      lastClick.timestamp = now;
      lastClick.position = event.coordinates;
      
      return { isDoubleClick: true, timeSinceLastClick };
    } else {
      // Reset click tracking
      this.clickTracks.set(component.id, {
        componentId: component.id,
        timestamp: now,
        position: event.coordinates,
        clickCount: 1
      });
      
      return { isDoubleClick: false, timeSinceLastClick };
    }
  }

  /**
   * Check if click position is near previous click
   */
  private isNearPreviousClick(
    current: { x: number; y: number },
    previous: { x: number; y: number },
    threshold = 2
  ): boolean {
    const dx = Math.abs(current.x - previous.x);
    const dy = Math.abs(current.y - previous.y);
    return dx <= threshold && dy <= threshold;
  }

  /**
   * Check if component can handle click
   */
  private canHandleClick(component: ClickableComponent, event: MouseEvent): boolean {
    // Basic validation
    if (!component.isEnabled || !component.isVisible) {
      return false;
    }

    // Validate component configuration
    const validation = ComponentValidator.validate(component);
    if (!validation.valid) {
      if (this.config.debug) {
        console.warn(`[ClickHandler] Invalid component ${component.id}:`, validation.errors);
      }
      return false;
    }

    // Check if component can handle the event at coordinates
    return ComponentValidator.canHandleEventAt(component, event.coordinates.x, event.coordinates.y, event.type);
  }

  /**
   * Apply visual feedback for click
   */
  private async applyClickFeedback(component: ClickableComponent): Promise<void> {
    const feedback = this.getClickFeedback(component);
    
    // Store feedback in component state
    const componentState = this.getOrCreateComponentState(component.id);
    componentState.visualFeedback = feedback;

    // Clear feedback after duration
    if (feedback.duration) {
      setTimeout(() => {
        if (componentState.visualFeedback === feedback) {
          componentState.visualFeedback = null;
        }
      }, feedback.duration);
    }

    if (this.config.debug) {
      console.debug(`[ClickHandler] Applied ${feedback.type} feedback to ${component.id}`);
    }
  }

  /**
   * Apply visual feedback for double-click
   */
  private async applyDoubleClickFeedback(component: ClickableComponent): Promise<void> {
    const feedback = VisualFeedbackUtils.createClickFeedback(this.config.feedbackDuration * 1.5);
    feedback.intensity = 'strong';
    feedback.animation = 'pulse';

    const componentState = this.getOrCreateComponentState(component.id);
    componentState.visualFeedback = feedback;

    setTimeout(() => {
      if (componentState.visualFeedback === feedback) {
        componentState.visualFeedback = null;
      }
    }, feedback.duration || this.config.feedbackDuration * 1.5);
  }

  /**
   * Get appropriate click feedback for component
   */
  private getClickFeedback(component: ClickableComponent): VisualFeedback {
    // Check for custom feedback in component data
    if (component.data?.clickFeedback) {
      return component.data.clickFeedback as VisualFeedback;
    }

    // Use type-specific feedback
    switch (component.type) {
      case 'button':
        return VisualFeedbackUtils.createClickFeedback(this.config.feedbackDuration);
      case 'link':
        return {
          type: 'color_change',
          intensity: 'normal',
          color: '#8FC7FF',
          duration: this.config.feedbackDuration,
          animation: 'fade'
        };
      case 'menu_item':
        return {
          type: 'highlight',
          intensity: 'normal',
          color: '#555',
          duration: this.config.feedbackDuration,
          animation: 'none'
        };
      default:
        return VisualFeedbackUtils.createClickFeedback(this.config.feedbackDuration);
    }
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
   * Update processing time statistics
   */
  private updateProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    // Update average
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length;
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): ClickStats {
    return {
      totalClicks: 0,
      successfulClicks: 0,
      failedClicks: 0,
      doubleClicks: 0,
      averageProcessingTime: 0,
      clickFrequency: 0
    };
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
  setEventHandlers(handlers: Partial<ClickEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Get current statistics
   */
  getStats(): ClickStats {
    // Calculate click frequency (clicks per minute)
    const now = Date.now();
    const recentClicks = Array.from(this.clickTracks.values()).filter(
      track => now - track.timestamp < 60000 // Last minute
    );
    
    this.stats.clickFrequency = recentClicks.length;
    
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClickConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ClickConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.processingTimes = [];
  }

  /**
   * Clear old click tracks (prevent memory leaks)
   */
  clearOldClickTracks(): void {
    const now = Date.now();
    const timeout = this.config.clickTimeout;
    
    for (const [componentId, track] of this.clickTracks) {
      if (now - track.timestamp > timeout) {
        this.clickTracks.delete(componentId);
      }
    }
  }

  /**
   * Remove component tracking
   */
  removeComponent(componentId: string): void {
    this.componentStates.delete(componentId);
    this.clickTracks.delete(componentId);
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      stats: this.getStats(),
      componentStatesCount: this.componentStates.size,
      clickTracksCount: this.clickTracks.size,
      processingTimesCount: this.processingTimes.length
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.componentStates.clear();
    this.clickTracks.clear();
    this.processingTimes = [];
    this.eventHandlers = {};
    this.stats = this.initializeStats();
  }
}