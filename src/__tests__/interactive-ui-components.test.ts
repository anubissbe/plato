import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MouseEvent } from '../tui/mouse-types.js';

// Interactive UI Component Types and Interfaces
interface ComponentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ClickableComponent {
  id: string;
  type: 'button' | 'link' | 'menu_item' | 'input' | 'scrollable';
  bounds: ComponentBounds;
  isEnabled: boolean;
  isVisible: boolean;
  onClick?: (event: MouseEvent) => void | Promise<void>;
  onHover?: (event: MouseEvent) => void | Promise<void>;
  onLeave?: () => void | Promise<void>;
  priority: number;
}

interface HoverState {
  componentId: string | null;
  isHovering: boolean;
  hoverStartTime: number | null;
  lastHoverPosition: { x: number; y: number } | null;
}

interface VisualFeedback {
  type: 'highlight' | 'underline' | 'color_change' | 'border' | 'shadow';
  intensity: 'subtle' | 'normal' | 'strong';
  color?: string;
  duration?: number;
}

interface ComponentInteractionSystem {
  registerComponent(component: ClickableComponent): boolean;
  unregisterComponent(componentId: string): boolean;
  findComponentAt(x: number, y: number): ClickableComponent | null;
  handleMouseEvent(event: MouseEvent): Promise<boolean>;
  getHoverState(): HoverState;
  getVisualFeedback(componentId: string): VisualFeedback | null;
  setComponentEnabled(componentId: string, enabled: boolean): boolean;
  clearAllComponents(): void;
}

// Mock implementation for testing
class MockComponentInteractionSystem implements ComponentInteractionSystem {
  private components = new Map<string, ClickableComponent>();
  private hoverState: HoverState = {
    componentId: null,
    isHovering: false,
    hoverStartTime: null,
    lastHoverPosition: null
  };
  private visualFeedbacks = new Map<string, VisualFeedback>();

  registerComponent(component: ClickableComponent): boolean {
    if (this.components.has(component.id)) {
      return false; // Component already exists
    }
    this.components.set(component.id, { ...component });
    return true;
  }

  unregisterComponent(componentId: string): boolean {
    const existed = this.components.has(componentId);
    this.components.delete(componentId);
    this.visualFeedbacks.delete(componentId);
    
    // Clear hover state if this component was being hovered
    if (this.hoverState.componentId === componentId) {
      this.hoverState = {
        componentId: null,
        isHovering: false,
        hoverStartTime: null,
        lastHoverPosition: null
      };
    }
    
    return existed;
  }

  findComponentAt(x: number, y: number): ClickableComponent | null {
    // Find highest priority component at coordinates
    let bestMatch: ClickableComponent | null = null;
    let highestPriority = -1;

    for (const component of this.components.values()) {
      if (!component.isVisible || !component.isEnabled) continue;

      const bounds = component.bounds;
      if (x >= bounds.x && 
          x < bounds.x + bounds.width &&
          y >= bounds.y && 
          y < bounds.y + bounds.height) {
        if (component.priority > highestPriority) {
          bestMatch = component;
          highestPriority = component.priority;
        }
      }
    }

    return bestMatch;
  }

  async handleMouseEvent(event: MouseEvent): Promise<boolean> {
    const component = this.findComponentAt(event.coordinates.x, event.coordinates.y);
    
    if (event.type === 'click' && component?.onClick) {
      await component.onClick(event);
      this.setVisualFeedback(component.id, {
        type: 'highlight',
        intensity: 'normal',
        duration: 200
      });
      return true;
    }

    if (event.type === 'move') {
      await this.handleHoverEvent(event, component);
      return component !== null;
    }

    return false;
  }

  private async handleHoverEvent(event: MouseEvent, component: ClickableComponent | null): Promise<void> {
    const currentComponentId = component?.id || null;
    const wasHovering = this.hoverState.isHovering;
    const previousComponentId = this.hoverState.componentId;

    // Handle hover exit
    if (wasHovering && previousComponentId !== currentComponentId) {
      const previousComponent = previousComponentId ? this.components.get(previousComponentId) : null;
      if (previousComponent?.onLeave) {
        await previousComponent.onLeave();
      }
      this.clearVisualFeedback(previousComponentId!);
    }

    // Handle hover enter/continue
    if (component) {
      const isNewHover = currentComponentId !== previousComponentId;
      
      this.hoverState = {
        componentId: currentComponentId,
        isHovering: true,
        hoverStartTime: isNewHover ? Date.now() : this.hoverState.hoverStartTime,
        lastHoverPosition: { x: event.coordinates.x, y: event.coordinates.y }
      };

      if (component.onHover) {
        await component.onHover(event);
      }

      if (isNewHover) {
        this.setVisualFeedback(component.id, {
          type: 'highlight',
          intensity: 'subtle',
          color: '#333'
        });
      }
    } else {
      // No component under mouse
      this.hoverState = {
        componentId: null,
        isHovering: false,
        hoverStartTime: null,
        lastHoverPosition: { x: event.coordinates.x, y: event.coordinates.y }
      };
    }
  }

  getHoverState(): HoverState {
    return { ...this.hoverState };
  }

  getVisualFeedback(componentId: string): VisualFeedback | null {
    return this.visualFeedbacks.get(componentId) || null;
  }

  setComponentEnabled(componentId: string, enabled: boolean): boolean {
    const component = this.components.get(componentId);
    if (!component) return false;
    
    component.isEnabled = enabled;
    return true;
  }

  clearAllComponents(): void {
    this.components.clear();
    this.visualFeedbacks.clear();
    this.hoverState = {
      componentId: null,
      isHovering: false,
      hoverStartTime: null,
      lastHoverPosition: null
    };
  }

  private setVisualFeedback(componentId: string, feedback: VisualFeedback): void {
    this.visualFeedbacks.set(componentId, feedback);
    
    // Auto-clear temporary feedback
    if (feedback.duration) {
      setTimeout(() => {
        this.visualFeedbacks.delete(componentId);
      }, feedback.duration);
    }
  }

  private clearVisualFeedback(componentId: string): void {
    this.visualFeedbacks.delete(componentId);
  }

  // Test helpers
  getComponentCount(): number {
    return this.components.size;
  }

  getComponent(componentId: string): ClickableComponent | undefined {
    return this.components.get(componentId);
  }
}

// Helper to create mouse events for testing
function createMouseEvent(
  type: MouseEvent['type'],
  x: number,
  y: number,
  button: MouseEvent['button'] = 'left'
): MouseEvent {
  return {
    type,
    coordinates: { x, y },
    button,
    modifiers: { shift: false, ctrl: false, alt: false, meta: false },
    timestamp: Date.now()
  };
}

describe('Interactive UI Components System', () => {
  let interactionSystem: MockComponentInteractionSystem;
  let clickHandler: jest.Mock;
  let hoverHandler: jest.Mock;
  let leaveHandler: jest.Mock;

  beforeEach(() => {
    interactionSystem = new MockComponentInteractionSystem();
    clickHandler = jest.fn();
    hoverHandler = jest.fn();
    leaveHandler = jest.fn();
  });

  afterEach(() => {
    interactionSystem.clearAllComponents();
  });

  describe('Component Registration', () => {
    it('should register new components successfully', () => {
      const button: ClickableComponent = {
        id: 'test-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 1
      };

      const result = interactionSystem.registerComponent(button);
      
      expect(result).toBe(true);
      expect(interactionSystem.getComponentCount()).toBe(1);
    });

    it('should reject duplicate component IDs', () => {
      const button1: ClickableComponent = {
        id: 'duplicate-id',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 1
      };

      const button2: ClickableComponent = {
        id: 'duplicate-id',
        type: 'link',
        bounds: { x: 40, y: 10, width: 15, height: 2 },
        isEnabled: true,
        isVisible: true,
        priority: 2
      };

      expect(interactionSystem.registerComponent(button1)).toBe(true);
      expect(interactionSystem.registerComponent(button2)).toBe(false);
      expect(interactionSystem.getComponentCount()).toBe(1);
    });

    it('should unregister components and clean up state', () => {
      const button: ClickableComponent = {
        id: 'removable-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 1
      };

      interactionSystem.registerComponent(button);
      expect(interactionSystem.getComponentCount()).toBe(1);

      const result = interactionSystem.unregisterComponent('removable-button');
      
      expect(result).toBe(true);
      expect(interactionSystem.getComponentCount()).toBe(0);
    });

    it('should return false when unregistering non-existent component', () => {
      const result = interactionSystem.unregisterComponent('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Component Detection', () => {
    beforeEach(() => {
      // Register test components
      interactionSystem.registerComponent({
        id: 'button-1',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 1
      });

      interactionSystem.registerComponent({
        id: 'link-1',
        type: 'link',
        bounds: { x: 35, y: 10, width: 15, height: 2 },
        isEnabled: true,
        isVisible: true,
        priority: 2
      });

      interactionSystem.registerComponent({
        id: 'disabled-button',
        type: 'button',
        bounds: { x: 5, y: 15, width: 25, height: 3 },
        isEnabled: false,
        isVisible: true,
        priority: 3
      });
    });

    it('should find components at correct coordinates', () => {
      const foundButton = interactionSystem.findComponentAt(20, 6);
      const foundLink = interactionSystem.findComponentAt(40, 11);
      
      expect(foundButton?.id).toBe('button-1');
      expect(foundLink?.id).toBe('link-1');
    });

    it('should return null for coordinates outside all components', () => {
      const result = interactionSystem.findComponentAt(100, 100);
      expect(result).toBeNull();
    });

    it('should ignore disabled components', () => {
      const result = interactionSystem.findComponentAt(15, 16);
      expect(result).toBeNull();
    });

    it('should prioritize higher priority components in overlapping areas', () => {
      // Add overlapping component with higher priority
      interactionSystem.registerComponent({
        id: 'high-priority',
        type: 'menu_item',
        bounds: { x: 15, y: 5, width: 10, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 10
      });

      const result = interactionSystem.findComponentAt(20, 6);
      expect(result?.id).toBe('high-priority');
    });

    it('should ignore invisible components', () => {
      interactionSystem.registerComponent({
        id: 'invisible-component',
        type: 'button',
        bounds: { x: 60, y: 20, width: 10, height: 2 },
        isEnabled: true,
        isVisible: false,
        priority: 5
      });

      const result = interactionSystem.findComponentAt(65, 21);
      expect(result).toBeNull();
    });
  });

  describe('Click Handling', () => {
    it('should handle click events on registered components', async () => {
      const button: ClickableComponent = {
        id: 'clickable-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onClick: clickHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      const clickEvent = createMouseEvent('click', 20, 6);
      const handled = await interactionSystem.handleMouseEvent(clickEvent);

      expect(handled).toBe(true);
      expect(clickHandler).toHaveBeenCalledWith(clickEvent);
    });

    it('should not handle clicks on components without click handlers', async () => {
      const button: ClickableComponent = {
        id: 'non-clickable-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 1
        // No onClick handler
      };

      interactionSystem.registerComponent(button);

      const clickEvent = createMouseEvent('click', 20, 6);
      const handled = await interactionSystem.handleMouseEvent(clickEvent);

      expect(handled).toBe(false);
    });

    it('should provide visual feedback for clicked components', async () => {
      const button: ClickableComponent = {
        id: 'feedback-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onClick: clickHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      const clickEvent = createMouseEvent('click', 20, 6);
      await interactionSystem.handleMouseEvent(clickEvent);

      const feedback = interactionSystem.getVisualFeedback('feedback-button');
      expect(feedback).not.toBeNull();
      expect(feedback?.type).toBe('highlight');
      expect(feedback?.intensity).toBe('normal');
    });
  });

  describe('Hover State Management', () => {
    it('should track hover state when mouse moves over component', async () => {
      const button: ClickableComponent = {
        id: 'hover-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onHover: hoverHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      const moveEvent = createMouseEvent('move', 20, 6);
      await interactionSystem.handleMouseEvent(moveEvent);

      const hoverState = interactionSystem.getHoverState();
      expect(hoverState.isHovering).toBe(true);
      expect(hoverState.componentId).toBe('hover-button');
      expect(hoverState.hoverStartTime).not.toBeNull();
      expect(hoverHandler).toHaveBeenCalledWith(moveEvent);
    });

    it('should call onLeave when mouse exits component', async () => {
      const button: ClickableComponent = {
        id: 'leave-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onHover: hoverHandler,
        onLeave: leaveHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      // Enter component
      await interactionSystem.handleMouseEvent(createMouseEvent('move', 20, 6));
      expect(hoverHandler).toHaveBeenCalledTimes(1);

      // Exit component
      await interactionSystem.handleMouseEvent(createMouseEvent('move', 50, 20));
      
      const hoverState = interactionSystem.getHoverState();
      expect(hoverState.isHovering).toBe(false);
      expect(hoverState.componentId).toBeNull();
      expect(leaveHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle hover transitions between components', async () => {
      const button1: ClickableComponent = {
        id: 'button-1',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onHover: jest.fn(),
        onLeave: jest.fn(),
        priority: 1
      };

      const button2: ClickableComponent = {
        id: 'button-2',
        type: 'button',
        bounds: { x: 40, y: 10, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onHover: jest.fn(),
        onLeave: jest.fn(),
        priority: 1
      };

      interactionSystem.registerComponent(button1);
      interactionSystem.registerComponent(button2);

      // Hover over button1
      await interactionSystem.handleMouseEvent(createMouseEvent('move', 20, 6));
      expect(interactionSystem.getHoverState().componentId).toBe('button-1');

      // Move to button2
      await interactionSystem.handleMouseEvent(createMouseEvent('move', 50, 11));
      
      expect(button1.onLeave).toHaveBeenCalledTimes(1);
      expect(button2.onHover).toHaveBeenCalledTimes(1);
      expect(interactionSystem.getHoverState().componentId).toBe('button-2');
    });
  });

  describe('Component State Management', () => {
    it('should enable and disable components', () => {
      const button: ClickableComponent = {
        id: 'toggleable-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      expect(interactionSystem.setComponentEnabled('toggleable-button', false)).toBe(true);
      const component = interactionSystem.getComponent('toggleable-button');
      expect(component?.isEnabled).toBe(false);

      // Disabled component should not be found
      const found = interactionSystem.findComponentAt(20, 6);
      expect(found).toBeNull();
    });

    it('should return false when trying to modify non-existent component', () => {
      const result = interactionSystem.setComponentEnabled('non-existent', false);
      expect(result).toBe(false);
    });
  });

  describe('Visual Feedback System', () => {
    it('should provide visual feedback for hover states', async () => {
      const button: ClickableComponent = {
        id: 'visual-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onHover: hoverHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      await interactionSystem.handleMouseEvent(createMouseEvent('move', 20, 6));

      const feedback = interactionSystem.getVisualFeedback('visual-button');
      expect(feedback).not.toBeNull();
      expect(feedback?.type).toBe('highlight');
      expect(feedback?.intensity).toBe('subtle');
    });

    it('should clear visual feedback when hover ends', async () => {
      const button: ClickableComponent = {
        id: 'clear-feedback-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onHover: hoverHandler,
        onLeave: leaveHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      // Start hover
      await interactionSystem.handleMouseEvent(createMouseEvent('move', 20, 6));
      expect(interactionSystem.getVisualFeedback('clear-feedback-button')).not.toBeNull();

      // End hover
      await interactionSystem.handleMouseEvent(createMouseEvent('move', 100, 100));
      expect(interactionSystem.getVisualFeedback('clear-feedback-button')).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle mouse events with no components registered', async () => {
      const clickEvent = createMouseEvent('click', 20, 6);
      const handled = await interactionSystem.handleMouseEvent(clickEvent);
      expect(handled).toBe(false);
    });

    it('should handle components with zero-sized bounds', () => {
      const zeroButton: ClickableComponent = {
        id: 'zero-size',
        type: 'button',
        bounds: { x: 10, y: 5, width: 0, height: 0 },
        isEnabled: true,
        isVisible: true,
        priority: 1
      };

      interactionSystem.registerComponent(zeroButton);
      const found = interactionSystem.findComponentAt(10, 5);
      expect(found).toBeNull(); // Zero-width/height should not be findable
    });

    it('should handle negative coordinates', () => {
      const result = interactionSystem.findComponentAt(-10, -5);
      expect(result).toBeNull();
    });

    it('should handle async errors in event handlers gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      
      const button: ClickableComponent = {
        id: 'error-button',
        type: 'button',
        bounds: { x: 10, y: 5, width: 20, height: 3 },
        isEnabled: true,
        isVisible: true,
        onClick: errorHandler,
        priority: 1
      };

      interactionSystem.registerComponent(button);

      // Should not throw despite handler error
      await expect(
        interactionSystem.handleMouseEvent(createMouseEvent('click', 20, 6))
      ).resolves.toBe(true);
      
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large numbers of components efficiently', () => {
      // Register 100 components
      for (let i = 0; i < 100; i++) {
        interactionSystem.registerComponent({
          id: `component-${i}`,
          type: 'button',
          bounds: { x: i * 5, y: i % 20, width: 4, height: 1 },
          isEnabled: true,
          isVisible: true,
          priority: i
        });
      }

      expect(interactionSystem.getComponentCount()).toBe(100);

      // Should still find components efficiently
      const found = interactionSystem.findComponentAt(250, 10);
      expect(found?.id).toBe('component-50');
    });

    it('should clear all components and reset state', () => {
      // Add multiple components
      for (let i = 0; i < 5; i++) {
        interactionSystem.registerComponent({
          id: `component-${i}`,
          type: 'button',
          bounds: { x: i * 10, y: 5, width: 8, height: 2 },
          isEnabled: true,
          isVisible: true,
          priority: 1
        });
      }

      interactionSystem.clearAllComponents();

      expect(interactionSystem.getComponentCount()).toBe(0);
      expect(interactionSystem.getHoverState().isHovering).toBe(false);
      expect(interactionSystem.findComponentAt(10, 5)).toBeNull();
    });
  });
});