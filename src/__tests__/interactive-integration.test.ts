/**
 * Integration Tests for Interactive UI Components
 * Tests complete mouse and keyboard interaction workflows
 */

import { ComponentRegistry } from '../tui/component-registry.js';
import { ClickHandlerSystem } from '../tui/click-handler.js';
import { HoverStateManager } from '../tui/hover-manager.js';
import { FocusManager } from '../tui/focus-manager.js';
import { VisualFeedbackRenderer } from '../tui/visual-feedback.js';
import { 
  ClickableComponent, 
  ComponentFactory, 
  ComponentBounds,
  VisualFeedback
} from '../tui/interactive-components.js';
import { MouseEvent, KeyboardEvent } from '../tui/mouse-types.js';

/**
 * Mock terminal dimensions for testing
 */
const MOCK_TERMINAL = { width: 80, height: 24 };

/**
 * Create mock mouse event
 */
function createMouseEvent(x: number, y: number, type: MouseEvent['type'] = 'click'): MouseEvent {
  return {
    type,
    coordinates: { x, y },
    button: 'left',
    modifiers: { shift: false, ctrl: false, alt: false, meta: false },
    timestamp: Date.now()
  };
}

/**
 * Create mock keyboard event
 */
function createKeyboardEvent(key: string, modifiers: Partial<KeyboardEvent['modifiers']> = {}): KeyboardEvent {
  return {
    key,
    timestamp: Date.now(),
    modifiers: {
      shift: false,
      ctrl: false,
      alt: false,
      meta: false,
      ...modifiers
    },
    repeat: false
  };
}

/**
 * Complete interaction system for testing
 */
class TestInteractionSystem {
  registry: ComponentRegistry;
  clickHandler: ClickHandlerSystem;
  hoverManager: HoverStateManager;
  focusManager: FocusManager;
  visualRenderer: VisualFeedbackRenderer;

  constructor() {
    this.registry = new ComponentRegistry();
    this.clickHandler = new ClickHandlerSystem();
    this.hoverManager = new HoverStateManager();
    this.focusManager = new FocusManager(this.registry);
    this.visualRenderer = new VisualFeedbackRenderer();
  }

  async processMouseEvent(event: MouseEvent): Promise<void> {
    // Find component at coordinates
    const component = this.registry.findAt(event.coordinates.x, event.coordinates.y);
    
    // Process hover
    await this.hoverManager.processMouseEvent(event, component);
    
    // Process click
    if (event.type === 'click' && component) {
      await this.clickHandler.processClick(component, event);
      
      // Focus component on click
      await this.focusManager.setFocus(component);
    }
  }

  async processKeyboardEvent(event: KeyboardEvent): Promise<boolean> {
    return await this.focusManager.processKeyboardEvent(event);
  }

  cleanup(): void {
    this.registry.dispose();
    this.clickHandler.dispose();
    this.hoverManager.dispose();
    this.focusManager.dispose();
    this.visualRenderer.dispose();
  }
}

describe('Interactive UI Components - Integration Tests', () => {
  let system: TestInteractionSystem;
  let testComponents: ClickableComponent[];

  beforeEach(() => {
    system = new TestInteractionSystem();
    
    // Create test components in a grid layout
    testComponents = [
      ComponentFactory.createButton('btn1', { x: 5, y: 5, width: 10, height: 1 }, 'Button 1', jest.fn()),
      ComponentFactory.createButton('btn2', { x: 20, y: 5, width: 10, height: 1 }, 'Button 2', jest.fn()),
      ComponentFactory.createLink('link1', { x: 5, y: 10, width: 8, height: 1 }, 'Link 1', jest.fn()),
      ComponentFactory.createMenuItem('menu1', { x: 20, y: 10, width: 12, height: 1 }, 'Menu Item', jest.fn()),
      ComponentFactory.createButton('btn3', { x: 5, y: 15, width: 10, height: 1 }, 'Button 3', jest.fn())
    ];

    // Register all components
    testComponents.forEach(component => {
      system.registry.register(component);
    });
  });

  afterEach(() => {
    system.cleanup();
  });

  describe('Mouse Interaction Workflow', () => {
    test('complete click workflow with visual feedback', async () => {
      const button = testComponents[0]; // btn1
      const clickHandler = jest.fn();
      button.handlers.onClick = clickHandler;

      // Click on button
      const clickEvent = createMouseEvent(10, 5); // Center of btn1
      await system.processMouseEvent(clickEvent);

      // Verify click was handled
      expect(clickHandler).toHaveBeenCalledWith(clickEvent);
      
      // Verify component is focused
      expect(system.focusManager.getCurrentFocus()).toBe(button);
      
      // Verify component state
      const state = system.focusManager.getComponentState(button.id);
      expect(state?.isFocused).toBe(true);
    });

    test('hover workflow with state transitions', async () => {
      const button = testComponents[0]; // btn1
      const hoverEnterHandler = jest.fn();
      const hoverLeaveHandler = jest.fn();
      
      button.handlers.onMouseEnter = hoverEnterHandler;
      button.handlers.onMouseLeave = hoverLeaveHandler;

      // Hover over button
      const hoverEvent = createMouseEvent(10, 5, 'move');
      await system.processMouseEvent(hoverEvent);

      expect(hoverEnterHandler).toHaveBeenCalled();
      expect(system.hoverManager.isComponentHovered(button.id)).toBe(true);

      // Move away from button
      const leaveEvent = createMouseEvent(50, 5, 'move');
      await system.processMouseEvent(leaveEvent);

      expect(system.hoverManager.isComponentHovered(button.id)).toBe(false);
    });

    test('click outside components clears focus', async () => {
      const button = testComponents[0]; // btn1

      // First click on button
      await system.processMouseEvent(createMouseEvent(10, 5));
      expect(system.focusManager.getCurrentFocus()).toBe(button);

      // Click outside any component
      await system.processMouseEvent(createMouseEvent(50, 20));
      expect(system.focusManager.getCurrentFocus()).toBeNull();
    });

    test('component priority affects interaction', async () => {
      // Create overlapping components with different priorities
      const lowPriorityBtn = ComponentFactory.createButton(
        'low', { x: 5, y: 5, width: 10, height: 3 }, 'Low', jest.fn()
      );
      lowPriorityBtn.priority = 1;

      const highPriorityBtn = ComponentFactory.createButton(
        'high', { x: 7, y: 6, width: 6, height: 1 }, 'High', jest.fn()
      );
      highPriorityBtn.priority = 10;

      system.registry.register(lowPriorityBtn);
      system.registry.register(highPriorityBtn);

      // Click in overlapping area
      const clickEvent = createMouseEvent(9, 6);
      await system.processMouseEvent(clickEvent);

      // Should focus high priority component
      expect(system.focusManager.getCurrentFocus()).toBe(highPriorityBtn);
    });
  });

  describe('Keyboard Navigation Workflow', () => {
    test('tab navigation through components', async () => {
      // Focus should start with no component focused
      expect(system.focusManager.getCurrentFocus()).toBeNull();

      // Tab to first component
      await system.processKeyboardEvent(createKeyboardEvent('Tab'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[0]);

      // Tab to next component
      await system.processKeyboardEvent(createKeyboardEvent('Tab'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[1]);

      // Shift+Tab back to previous
      await system.processKeyboardEvent(createKeyboardEvent('Tab', { shift: true }));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[0]);
    });

    test('arrow key spatial navigation', async () => {
      // Start with first component focused
      await system.focusManager.setFocus(testComponents[0]); // btn1 at (5,5)

      // Arrow right should go to btn2 at (20,5)
      await system.processKeyboardEvent(createKeyboardEvent('ArrowRight'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[1]);

      // Arrow down should go to menu1 at (20,10)
      await system.processKeyboardEvent(createKeyboardEvent('ArrowDown'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[3]);

      // Arrow left should go to link1 at (5,10)
      await system.processKeyboardEvent(createKeyboardEvent('ArrowLeft'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[2]);
    });

    test('home and end navigation', async () => {
      // Focus middle component
      await system.focusManager.setFocus(testComponents[2]);

      // Home should go to first component
      await system.processKeyboardEvent(createKeyboardEvent('Home'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[0]);

      // End should go to last component
      await system.processKeyboardEvent(createKeyboardEvent('End'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[4]);
    });

    test('enter key activates focused component', async () => {
      const button = testComponents[0];
      const clickHandler = jest.fn();
      button.handlers.onClick = clickHandler;

      // Focus the button
      await system.focusManager.setFocus(button);

      // Press Enter
      await system.processKeyboardEvent(createKeyboardEvent('Enter'));

      expect(clickHandler).toHaveBeenCalled();
    });

    test('space key activates focused component', async () => {
      const button = testComponents[0];
      const clickHandler = jest.fn();
      button.handlers.onClick = clickHandler;

      // Focus the button
      await system.focusManager.setFocus(button);

      // Press Space
      await system.processKeyboardEvent(createKeyboardEvent(' '));

      expect(clickHandler).toHaveBeenCalled();
    });

    test('escape clears focus', async () => {
      // Focus a component
      await system.focusManager.setFocus(testComponents[0]);
      expect(system.focusManager.getCurrentFocus()).not.toBeNull();

      // Press Escape
      await system.processKeyboardEvent(createKeyboardEvent('Escape'));
      expect(system.focusManager.getCurrentFocus()).toBeNull();
    });
  });

  describe('Mixed Mouse and Keyboard Interaction', () => {
    test('click focuses component, then keyboard navigates', async () => {
      const button2 = testComponents[1]; // btn2

      // Click on second button
      await system.processMouseEvent(createMouseEvent(25, 5));
      expect(system.focusManager.getCurrentFocus()).toBe(button2);

      // Tab to next component
      await system.processKeyboardEvent(createKeyboardEvent('Tab'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[2]);

      // Arrow key navigation
      await system.processKeyboardEvent(createKeyboardEvent('ArrowDown'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[4]);
    });

    test('keyboard focus then mouse click on different component', async () => {
      // Tab to first component
      await system.processKeyboardEvent(createKeyboardEvent('Tab'));
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[0]);

      // Click on different component
      await system.processMouseEvent(createMouseEvent(25, 10)); // menu1
      expect(system.focusManager.getCurrentFocus()).toBe(testComponents[3]);
    });

    test('hover preserves keyboard focus', async () => {
      // Focus first component via keyboard
      await system.processKeyboardEvent(createKeyboardEvent('Tab'));
      const focusedComponent = system.focusManager.getCurrentFocus();

      // Hover over different component
      await system.processMouseEvent(createMouseEvent(25, 5, 'move'));

      // Focus should remain on keyboard-focused component
      expect(system.focusManager.getCurrentFocus()).toBe(focusedComponent);
      
      // But hover state should be on hovered component
      expect(system.hoverManager.isComponentHovered(testComponents[1].id)).toBe(true);
    });
  });

  describe('Visual Feedback Integration', () => {
    test('focus visual feedback is applied and removed', async () => {
      const button = testComponents[0];

      // Focus component
      await system.focusManager.setFocus(button);
      
      // Check visual feedback is applied
      const state = system.focusManager.getComponentState(button.id);
      expect(state?.visualFeedback).toBeDefined();
      expect(state?.visualFeedback?.type).toBe('border');

      // Clear focus
      await system.focusManager.clearFocus();
      
      // Check visual feedback is removed
      const clearedState = system.focusManager.getComponentState(button.id);
      expect(clearedState?.visualFeedback).toBeNull();
    });

    test('hover and focus feedback coexist', async () => {
      const button = testComponents[0];

      // Focus via keyboard
      await system.focusManager.setFocus(button);
      const focusState = system.focusManager.getComponentState(button.id);
      expect(focusState?.isFocused).toBe(true);

      // Add hover
      await system.processMouseEvent(createMouseEvent(10, 5, 'move'));
      const hoverState = system.hoverManager.getComponentState(button.id);
      expect(hoverState?.isHovered).toBe(true);

      // Both states should be active
      expect(system.focusManager.isFocused(button.id)).toBe(true);
      expect(system.hoverManager.isComponentHovered(button.id)).toBe(true);
    });

    test('visual feedback rendering produces valid ANSI sequences', () => {
      const feedback: VisualFeedback = {
        type: 'highlight',
        intensity: 'normal',
        color: '#4A90E2'
      };

      const context = {
        bounds: { x: 5, y: 5, width: 10, height: 1 },
        terminalSize: MOCK_TERMINAL,
        optimize: false
      };

      const rendered = system.visualRenderer.render(feedback, context);
      
      expect(rendered.startSequence).toBeTruthy();
      expect(rendered.endSequence).toBeTruthy();
      expect(rendered.startSequence).toContain('\x1b'); // ANSI escape sequence
    });
  });

  describe('Component State Management', () => {
    test('disabled components are not interactive', async () => {
      const button = testComponents[0];
      button.isEnabled = false;

      // Try to click disabled component
      const clickHandler = jest.fn();
      button.handlers.onClick = clickHandler;
      
      await system.processMouseEvent(createMouseEvent(10, 5));
      
      // Should not be clickable or focusable
      expect(clickHandler).not.toHaveBeenCalled();
      expect(system.focusManager.getCurrentFocus()).toBeNull();
    });

    test('invisible components are not interactive', async () => {
      const button = testComponents[0];
      button.isVisible = false;

      // Component should not be found at coordinates
      const foundComponent = system.registry.findAt(10, 5);
      expect(foundComponent).toBeNull();

      // Should not be included in focus navigation
      await system.processKeyboardEvent(createKeyboardEvent('Tab'));
      expect(system.focusManager.getCurrentFocus()).not.toBe(button);
    });

    test('component removal clears associated states', async () => {
      const button = testComponents[0];

      // Focus and hover the component
      await system.focusManager.setFocus(button);
      await system.processMouseEvent(createMouseEvent(10, 5, 'move'));

      expect(system.focusManager.isFocused(button.id)).toBe(true);
      expect(system.hoverManager.isComponentHovered(button.id)).toBe(true);

      // Unregister component
      system.registry.unregister(button.id);

      // States should be cleared
      expect(system.focusManager.getCurrentFocus()).toBeNull();
      expect(system.hoverManager.isComponentHovered(button.id)).toBe(false);
    });
  });

  describe('Performance and Resource Management', () => {
    test('handles large number of components efficiently', async () => {
      const startTime = performance.now();

      // Create many components
      for (let i = 0; i < 1000; i++) {
        const component = ComponentFactory.createButton(
          `btn_${i}`,
          { x: i % 80, y: Math.floor(i / 80), width: 1, height: 1 },
          `Button ${i}`,
          jest.fn()
        );
        system.registry.register(component);
      }

      const registrationTime = performance.now() - startTime;

      // Perform lookups
      const lookupStart = performance.now();
      for (let i = 0; i < 100; i++) {
        system.registry.findAt(i % 80, Math.floor(i / 80));
      }
      const lookupTime = performance.now() - lookupStart;

      // Should complete quickly
      expect(registrationTime).toBeLessThan(1000); // 1 second
      expect(lookupTime).toBeLessThan(100); // 100ms
    });

    test('memory cleanup on disposal', () => {
      const initialMemory = process.memoryUsage();

      // Create and register many components
      for (let i = 0; i < 500; i++) {
        const component = ComponentFactory.createButton(
          `btn_${i}`,
          { x: i % 50, y: Math.floor(i / 50), width: 1, height: 1 },
          `Button ${i}`,
          jest.fn()
        );
        system.registry.register(component);
      }

      // Interact with components
      system.processMouseEvent(createMouseEvent(25, 5));
      system.processKeyboardEvent(createKeyboardEvent('Tab'));

      // Cleanup
      system.cleanup();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory should not have grown significantly (allowing for test overhead)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles invalid coordinates gracefully', async () => {
      // Click outside terminal bounds
      await expect(
        system.processMouseEvent(createMouseEvent(-10, -10))
      ).resolves.not.toThrow();

      await expect(
        system.processMouseEvent(createMouseEvent(1000, 1000))
      ).resolves.not.toThrow();
    });

    test('handles rapid event sequences', async () => {
      const button = testComponents[0];
      const clickHandler = jest.fn();
      button.handlers.onClick = clickHandler;

      // Rapid click sequence
      const events = [
        system.processMouseEvent(createMouseEvent(10, 5, 'move')),
        system.processMouseEvent(createMouseEvent(10, 5)),
        system.processMouseEvent(createMouseEvent(10, 5)),
        system.processKeyboardEvent(createKeyboardEvent('Tab')),
        system.processKeyboardEvent(createKeyboardEvent('Enter'))
      ];

      await Promise.all(events);

      // Should handle all events without errors
      expect(clickHandler).toHaveBeenCalled();
    });

    test('handles component modification during interaction', async () => {
      const button = testComponents[0];

      // Start hover
      await system.processMouseEvent(createMouseEvent(10, 5, 'move'));
      expect(system.hoverManager.isComponentHovered(button.id)).toBe(true);

      // Modify component bounds during hover
      button.bounds = { x: 50, y: 5, width: 10, height: 1 };
      system.registry.update(button);

      // Continue interaction - should handle gracefully
      await expect(
        system.processMouseEvent(createMouseEvent(10, 5))
      ).resolves.not.toThrow();
    });
  });
});