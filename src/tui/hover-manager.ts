/**
 * Hover State Management System
 * Manages component hover states with visual feedback and transitions
 */

import { MouseEvent } from './mouse-types.js';
import { 
  ClickableComponent, 
  VisualFeedback, 
  ComponentState,
  VisualFeedbackUtils 
} from './interactive-components.js';

/**
 * Hover state information
 */
export interface HoverState {
  /** Currently hovered component ID */
  componentId: string | null;
  /** Whether any component is currently being hovered */
  isHovering: boolean;
  /** Timestamp when current hover started */
  hoverStartTime: number | null;
  /** Last mouse position during hover */
  lastHoverPosition: { x: number; y: number } | null;
  /** Previous component that was hovered */
  previousComponentId: string | null;
  /** Hover duration threshold for "long hover" events */
  longHoverThreshold: number;
}

/**
 * Hover transition information
 */
export interface HoverTransition {
  /** Component being exited */
  from: string | null;
  /** Component being entered */
  to: string | null;
  /** Timestamp of transition */
  timestamp: number;
  /** Mouse position during transition */
  position: { x: number; y: number };
  /** Type of transition */
  type: 'enter' | 'exit' | 'move' | 'timeout';
}

/**
 * Hover configuration options
 */
export interface HoverConfig {
  /** Delay before hover is considered active (ms) */
  hoverDelay: number;
  /** Duration for long hover detection (ms) */
  longHoverThreshold: number;
  /** Whether to enable hover transitions */
  enableTransitions: boolean;
  /** Default visual feedback for hover */
  defaultHoverFeedback: VisualFeedback;
  /** Whether to enable hover debugging */
  debug: boolean;
}

/**
 * Default hover configuration
 */
const DEFAULT_HOVER_CONFIG: HoverConfig = {
  hoverDelay: 100,
  longHoverThreshold: 2000,
  enableTransitions: true,
  defaultHoverFeedback: VisualFeedbackUtils.createHoverFeedback('subtle'),
  debug: false
};

/**
 * Hover event callback types
 */
export type HoverEventHandler = (transition: HoverTransition) => void | Promise<void>;

export interface HoverEventHandlers {
  onHoverEnter?: HoverEventHandler;
  onHoverExit?: HoverEventHandler;
  onHoverMove?: HoverEventHandler;
  onLongHover?: HoverEventHandler;
  onHoverTimeout?: HoverEventHandler;
}

/**
 * Hover State Manager
 * Manages component hover states with visual feedback
 */
export class HoverStateManager {
  private hoverState: HoverState;
  private config: HoverConfig;
  private componentStates = new Map<string, ComponentState>();
  private visualFeedbacks = new Map<string, VisualFeedback>();
  private hoverTimeout: NodeJS.Timeout | null = null;
  private longHoverTimeout: NodeJS.Timeout | null = null;
  private eventHandlers: HoverEventHandlers = {};

  constructor(config: Partial<HoverConfig> = {}) {
    this.config = { ...DEFAULT_HOVER_CONFIG, ...config };
    this.hoverState = this.createInitialHoverState();
  }

  /**
   * Process mouse event for hover state management
   */
  async processMouseEvent(
    event: MouseEvent,
    component: ClickableComponent | null
  ): Promise<HoverTransition | null> {
    const currentComponentId = component?.id || null;
    const previousComponentId = this.hoverState.componentId;

    // No change if same component
    if (currentComponentId === previousComponentId) {
      if (currentComponentId && event.type === 'move') {
        await this.handleHoverMove(event, component!);
      }
      return null;
    }

    // Create transition
    const transition: HoverTransition = {
      from: previousComponentId,
      to: currentComponentId,
      timestamp: event.timestamp,
      position: event.coordinates,
      type: currentComponentId ? 'enter' : 'exit'
    };

    // Handle hover exit
    if (previousComponentId) {
      await this.handleHoverExit(transition);
    }

    // Handle hover enter
    if (currentComponentId) {
      await this.handleHoverEnter(transition, component!);
    } else {
      // No component - clear hover state
      this.clearHoverState(event.coordinates);
    }

    return transition;
  }

  /**
   * Handle mouse entering component
   */
  private async handleHoverEnter(
    transition: HoverTransition,
    component: ClickableComponent
  ): Promise<void> {
    // Update hover state
    this.hoverState = {
      ...this.hoverState,
      componentId: component.id,
      isHovering: true,
      hoverStartTime: transition.timestamp,
      lastHoverPosition: transition.position,
      previousComponentId: transition.from
    };

    // Update component state
    const componentState = this.getOrCreateComponentState(component.id);
    componentState.isHovered = true;
    componentState.lastInteraction = transition.timestamp;

    // Apply visual feedback
    await this.applyHoverFeedback(component);

    // Call component's mouse enter handler
    if (component.handlers.onMouseEnter) {
      const mouseEvent: MouseEvent = {
        type: 'move',
        coordinates: transition.position,
        button: 'left',
        modifiers: { shift: false, ctrl: false, alt: false, meta: false },
        timestamp: transition.timestamp
      };
      await component.handlers.onMouseEnter(mouseEvent);
    }

    // Set up long hover timeout
    this.scheduleLongHoverCheck(component);

    // Fire hover enter event
    if (this.eventHandlers.onHoverEnter) {
      await this.eventHandlers.onHoverEnter(transition);
    }

    if (this.config.debug) {
      console.debug(`[HoverManager] Enter: ${component.id} at (${transition.position.x}, ${transition.position.y})`);
    }
  }

  /**
   * Handle mouse exiting component
   */
  private async handleHoverExit(transition: HoverTransition): Promise<void> {
    const componentId = transition.from!;
    
    // Update component state
    const componentState = this.componentStates.get(componentId);
    if (componentState) {
      componentState.isHovered = false;
      componentState.lastInteraction = transition.timestamp;
    }

    // Clear visual feedback
    this.clearVisualFeedback(componentId);

    // Clear timeouts
    this.clearHoverTimeouts();

    // Fire hover exit event
    if (this.eventHandlers.onHoverExit) {
      await this.eventHandlers.onHoverExit(transition);
    }

    if (this.config.debug) {
      console.debug(`[HoverManager] Exit: ${componentId} at (${transition.position.x}, ${transition.position.y})`);
    }
  }

  /**
   * Handle mouse movement within component
   */
  private async handleHoverMove(
    event: MouseEvent,
    component: ClickableComponent
  ): Promise<void> {
    // Update hover position
    this.hoverState.lastHoverPosition = event.coordinates;

    // Update component state
    const componentState = this.getOrCreateComponentState(component.id);
    componentState.lastInteraction = event.timestamp;

    // Call component's mouse move handler
    if (component.handlers.onMouseMove) {
      await component.handlers.onMouseMove(event);
    }

    // Fire hover move event
    if (this.eventHandlers.onHoverMove) {
      const transition: HoverTransition = {
        from: component.id,
        to: component.id,
        timestamp: event.timestamp,
        position: event.coordinates,
        type: 'move'
      };
      await this.eventHandlers.onHoverMove(transition);
    }
  }

  /**
   * Apply visual feedback for hovered component
   */
  private async applyHoverFeedback(component: ClickableComponent): Promise<void> {
    // Use component-specific feedback or default
    const feedback = this.getComponentHoverFeedback(component);
    
    // Store feedback
    this.visualFeedbacks.set(component.id, feedback);

    // Update component state
    const componentState = this.getOrCreateComponentState(component.id);
    componentState.visualFeedback = feedback;

    if (this.config.debug) {
      console.debug(`[HoverManager] Applied ${feedback.type} feedback to ${component.id}`);
    }
  }

  /**
   * Get hover feedback for component
   */
  private getComponentHoverFeedback(component: ClickableComponent): VisualFeedback {
    // Check if component has custom hover feedback in data
    if (component.data?.hoverFeedback) {
      return component.data.hoverFeedback as VisualFeedback;
    }

    // Use type-specific defaults
    switch (component.type) {
      case 'button':
        return VisualFeedbackUtils.createHoverFeedback('normal');
      case 'link':
        return {
          type: 'color_change',
          intensity: 'normal',
          color: '#6AB7FF',
          animation: 'none'
        };
      case 'menu_item':
        return {
          type: 'highlight',
          intensity: 'subtle',
          color: '#444',
          animation: 'none'
        };
      default:
        return this.config.defaultHoverFeedback;
    }
  }

  /**
   * Schedule long hover check
   */
  private scheduleLongHoverCheck(component: ClickableComponent): void {
    this.clearLongHoverTimeout();
    
    this.longHoverTimeout = setTimeout(async () => {
      if (this.hoverState.componentId === component.id) {
        await this.handleLongHover(component);
      }
    }, this.config.longHoverThreshold);
  }

  /**
   * Handle long hover event
   */
  private async handleLongHover(component: ClickableComponent): Promise<void> {
    if (this.eventHandlers.onLongHover && this.hoverState.lastHoverPosition) {
      const transition: HoverTransition = {
        from: component.id,
        to: component.id,
        timestamp: Date.now(),
        position: this.hoverState.lastHoverPosition,
        type: 'timeout'
      };
      
      await this.eventHandlers.onLongHover(transition);
    }

    if (this.config.debug) {
      console.debug(`[HoverManager] Long hover: ${component.id}`);
    }
  }

  /**
   * Clear hover state
   */
  private clearHoverState(position: { x: number; y: number }): void {
    this.hoverState = {
      ...this.hoverState,
      componentId: null,
      isHovering: false,
      hoverStartTime: null,
      lastHoverPosition: position,
      previousComponentId: this.hoverState.componentId
    };

    this.clearHoverTimeouts();
  }

  /**
   * Clear hover-related timeouts
   */
  private clearHoverTimeouts(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    this.clearLongHoverTimeout();
  }

  /**
   * Clear long hover timeout
   */
  private clearLongHoverTimeout(): void {
    if (this.longHoverTimeout) {
      clearTimeout(this.longHoverTimeout);
      this.longHoverTimeout = null;
    }
  }

  /**
   * Clear visual feedback for component
   */
  private clearVisualFeedback(componentId: string): void {
    this.visualFeedbacks.delete(componentId);
    
    const componentState = this.componentStates.get(componentId);
    if (componentState) {
      componentState.visualFeedback = null;
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
   * Create initial hover state
   */
  private createInitialHoverState(): HoverState {
    return {
      componentId: null,
      isHovering: false,
      hoverStartTime: null,
      lastHoverPosition: null,
      previousComponentId: null,
      longHoverThreshold: this.config.longHoverThreshold
    };
  }

  /**
   * Get current hover state (readonly)
   */
  getHoverState(): Readonly<HoverState> {
    return { ...this.hoverState };
  }

  /**
   * Get component state
   */
  getComponentState(componentId: string): ComponentState | null {
    return this.componentStates.get(componentId) || null;
  }

  /**
   * Get visual feedback for component
   */
  getVisualFeedback(componentId: string): VisualFeedback | null {
    return this.visualFeedbacks.get(componentId) || null;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<HoverEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HoverConfig>): void {
    this.config = { ...this.config, ...config };
    this.hoverState.longHoverThreshold = this.config.longHoverThreshold;
  }

  /**
   * Get current configuration
   */
  getConfig(): HoverConfig {
    return { ...this.config };
  }

  /**
   * Check if component is currently hovered
   */
  isComponentHovered(componentId: string): boolean {
    return this.hoverState.componentId === componentId && this.hoverState.isHovering;
  }

  /**
   * Get hover duration for current component
   */
  getCurrentHoverDuration(): number {
    if (!this.hoverState.isHovering || !this.hoverState.hoverStartTime) {
      return 0;
    }
    return Date.now() - this.hoverState.hoverStartTime;
  }

  /**
   * Force clear hover state (useful for cleanup)
   */
  forceExit(): void {
    this.clearHoverTimeouts();
    
    const currentPosition = this.hoverState.lastHoverPosition || { x: 0, y: 0 };
    
    this.hoverState = {
      componentId: null,
      isHovering: false,
      hoverStartTime: null,
      lastHoverPosition: currentPosition,
      previousComponentId: this.hoverState.componentId,
      longHoverThreshold: this.config.longHoverThreshold
    };

    // Clear all component hover states
    for (const [componentId, state] of this.componentStates) {
      state.isHovered = false;
      state.visualFeedback = null;
    }

    // Clear all visual feedback
    this.visualFeedbacks.clear();
  }

  /**
   * Remove component state tracking
   */
  removeComponent(componentId: string): void {
    // Clear hover state if this component is currently hovered
    if (this.hoverState.componentId === componentId) {
      this.forceExit();
    }

    // Clean up component state
    this.componentStates.delete(componentId);
    this.visualFeedbacks.delete(componentId);
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      hoverState: this.hoverState,
      componentStatesCount: this.componentStates.size,
      visualFeedbacksCount: this.visualFeedbacks.size,
      config: this.config,
      hasActiveTimeouts: {
        hover: this.hoverTimeout !== null,
        longHover: this.longHoverTimeout !== null
      }
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearHoverTimeouts();
    this.componentStates.clear();
    this.visualFeedbacks.clear();
    this.eventHandlers = {};
    this.hoverState = this.createInitialHoverState();
  }
}