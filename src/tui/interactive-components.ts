/**
 * Interactive UI Components System
 * Provides clickable components with visual feedback and hover states
 */

import { MouseEvent, MouseEventHandler } from './mouse-types.js';

/**
 * Component bounds defining clickable area
 */
export interface ComponentBounds {
  /** Left edge (0-based) */
  x: number;
  /** Top edge (0-based) */
  y: number;
  /** Component width in characters */
  width: number;
  /** Component height in lines */
  height: number;
}

/**
 * Visual feedback configuration for component states
 */
export interface VisualFeedback {
  /** Type of visual feedback */
  type: 'highlight' | 'underline' | 'color_change' | 'border' | 'shadow' | 'invert';
  /** Feedback intensity */
  intensity: 'subtle' | 'normal' | 'strong';
  /** Custom color (ANSI color code or hex) */
  color?: string;
  /** Duration in milliseconds (0 = permanent until cleared) */
  duration?: number;
  /** Animation type */
  animation?: 'none' | 'blink' | 'pulse' | 'fade';
}

/**
 * Component accessibility configuration
 */
export interface ComponentAccessibility {
  /** Accessible role */
  role: 'button' | 'link' | 'menu' | 'menuitem' | 'tab' | 'textbox' | 'checkbox';
  /** Accessible label */
  label: string;
  /** Tab index for keyboard navigation (-1 = not focusable) */
  tabIndex: number;
  /** Whether component supports keyboard activation */
  keyboardActivatable: boolean;
  /** Custom keyboard shortcuts */
  shortcuts?: string[];
}

/**
 * Component state information
 */
export interface ComponentState {
  /** Whether component is currently hovered */
  isHovered: boolean;
  /** Whether component is currently focused */
  isFocused: boolean;
  /** Whether component is currently active/pressed */
  isActive: boolean;
  /** Current visual feedback state */
  visualFeedback: VisualFeedback | null;
  /** Last interaction timestamp */
  lastInteraction: number;
}

/**
 * Event handlers for component interactions
 */
export interface ComponentEventHandlers {
  /** Called when component is clicked */
  onClick?: MouseEventHandler;
  /** Called when component is double-clicked */
  onDoubleClick?: MouseEventHandler;
  /** Called when mouse enters component bounds */
  onMouseEnter?: MouseEventHandler;
  /** Called when mouse moves within component */
  onMouseMove?: MouseEventHandler;
  /** Called when mouse leaves component bounds */
  onMouseLeave?: () => void | Promise<void>;
  /** Called when component receives focus */
  onFocus?: () => void | Promise<void>;
  /** Called when component loses focus */
  onBlur?: () => void | Promise<void>;
  /** Called when component is activated via keyboard */
  onKeyboardActivate?: (key: string) => void | Promise<void>;
}

/**
 * Base interface for all interactive components
 */
export interface ClickableComponent {
  /** Unique component identifier */
  id: string;
  /** Component type for styling and behavior */
  type: 'button' | 'link' | 'menu_item' | 'input' | 'scrollable' | 'tab' | 'checkbox' | 'custom';
  /** Component bounds in terminal coordinates */
  bounds: ComponentBounds;
  /** Whether component responds to interactions */
  isEnabled: boolean;
  /** Whether component is visible and should be rendered */
  isVisible: boolean;
  /** Rendering priority (higher = rendered on top) */
  priority: number;
  /** Event handlers */
  handlers: ComponentEventHandlers;
  /** Accessibility configuration */
  accessibility: ComponentAccessibility;
  /** Custom data for component-specific logic */
  data?: Record<string, any>;
  /** CSS-like styling properties */
  style?: ComponentStyle;
}

/**
 * Component styling configuration
 */
export interface ComponentStyle {
  /** Background color */
  backgroundColor?: string;
  /** Foreground/text color */
  color?: string;
  /** Border style */
  border?: 'none' | 'solid' | 'dashed' | 'dotted';
  /** Border color */
  borderColor?: string;
  /** Padding inside component */
  padding?: { top: number; right: number; bottom: number; left: number };
  /** Text alignment */
  textAlign?: 'left' | 'center' | 'right';
  /** Font weight */
  fontWeight?: 'normal' | 'bold';
  /** Text decoration */
  textDecoration?: 'none' | 'underline' | 'strikethrough';
}

/**
 * Component factory for creating common component types
 */
export class ComponentFactory {
  /**
   * Create a button component
   */
  static createButton(
    id: string,
    bounds: ComponentBounds,
    label: string,
    onClick: MouseEventHandler
  ): ClickableComponent {
    return {
      id,
      type: 'button',
      bounds,
      isEnabled: true,
      isVisible: true,
      priority: 1,
      handlers: {
        onClick,
        onMouseEnter: (event) => console.debug(`Button ${id} hovered`),
        onMouseLeave: () => console.debug(`Button ${id} unhovered`)
      },
      accessibility: {
        role: 'button',
        label,
        tabIndex: 0,
        keyboardActivatable: true,
        shortcuts: ['Enter', ' ']
      },
      style: {
        backgroundColor: '#444',
        color: '#fff',
        border: 'solid',
        borderColor: '#666',
        padding: { top: 0, right: 1, bottom: 0, left: 1 },
        textAlign: 'center'
      }
    };
  }

  /**
   * Create a link component
   */
  static createLink(
    id: string,
    bounds: ComponentBounds,
    label: string,
    onClick: MouseEventHandler
  ): ClickableComponent {
    return {
      id,
      type: 'link',
      bounds,
      isEnabled: true,
      isVisible: true,
      priority: 1,
      handlers: {
        onClick,
        onMouseEnter: (event) => console.debug(`Link ${id} hovered`),
        onMouseLeave: () => console.debug(`Link ${id} unhovered`)
      },
      accessibility: {
        role: 'link',
        label,
        tabIndex: 0,
        keyboardActivatable: true,
        shortcuts: ['Enter']
      },
      style: {
        color: '#4A90E2',
        textDecoration: 'underline',
        textAlign: 'left'
      }
    };
  }

  /**
   * Create a menu item component
   */
  static createMenuItem(
    id: string,
    bounds: ComponentBounds,
    label: string,
    onClick: MouseEventHandler
  ): ClickableComponent {
    return {
      id,
      type: 'menu_item',
      bounds,
      isEnabled: true,
      isVisible: true,
      priority: 2,
      handlers: {
        onClick,
        onMouseEnter: (event) => console.debug(`Menu item ${id} hovered`),
        onMouseLeave: () => console.debug(`Menu item ${id} unhovered`)
      },
      accessibility: {
        role: 'menuitem',
        label,
        tabIndex: -1, // Menu items typically not directly tabbable
        keyboardActivatable: true,
        shortcuts: ['Enter']
      },
      style: {
        backgroundColor: 'transparent',
        color: '#fff',
        padding: { top: 0, right: 1, bottom: 0, left: 1 },
        textAlign: 'left'
      }
    };
  }

  /**
   * Create a custom component with minimal defaults
   */
  static createCustom(
    id: string,
    type: ClickableComponent['type'],
    bounds: ComponentBounds,
    handlers: ComponentEventHandlers = {},
    accessibility: Partial<ComponentAccessibility> = {}
  ): ClickableComponent {
    return {
      id,
      type,
      bounds,
      isEnabled: true,
      isVisible: true,
      priority: 1,
      handlers,
      accessibility: {
        role: 'button',
        label: id,
        tabIndex: 0,
        keyboardActivatable: true,
        ...accessibility
      }
    };
  }
}

/**
 * Component bounds utility functions
 */
export class ComponentBounds {
  /**
   * Check if point is within bounds
   */
  static contains(bounds: ComponentBounds, x: number, y: number): boolean {
    return x >= bounds.x && 
           x < bounds.x + bounds.width &&
           y >= bounds.y && 
           y < bounds.y + bounds.height;
  }

  /**
   * Check if two bounds overlap
   */
  static overlaps(bounds1: ComponentBounds, bounds2: ComponentBounds): boolean {
    return !(bounds1.x + bounds1.width <= bounds2.x ||
             bounds2.x + bounds2.width <= bounds1.x ||
             bounds1.y + bounds1.height <= bounds2.y ||
             bounds2.y + bounds2.height <= bounds1.y);
  }

  /**
   * Calculate intersection of two bounds
   */
  static intersection(bounds1: ComponentBounds, bounds2: ComponentBounds): ComponentBounds | null {
    const left = Math.max(bounds1.x, bounds2.x);
    const top = Math.max(bounds1.y, bounds2.y);
    const right = Math.min(bounds1.x + bounds1.width, bounds2.x + bounds2.width);
    const bottom = Math.min(bounds1.y + bounds1.height, bounds2.y + bounds2.height);

    if (left < right && top < bottom) {
      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
      };
    }

    return null;
  }

  /**
   * Calculate union of two bounds
   */
  static union(bounds1: ComponentBounds, bounds2: ComponentBounds): ComponentBounds {
    const left = Math.min(bounds1.x, bounds2.x);
    const top = Math.min(bounds1.y, bounds2.y);
    const right = Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width);
    const bottom = Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height);

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    };
  }

  /**
   * Validate bounds values
   */
  static isValid(bounds: ComponentBounds): boolean {
    return bounds.width > 0 && 
           bounds.height > 0 &&
           bounds.x >= 0 &&
           bounds.y >= 0;
  }

  /**
   * Clamp bounds to terminal dimensions
   */
  static clampToTerminal(bounds: ComponentBounds, terminalWidth: number, terminalHeight: number): ComponentBounds {
    return {
      x: Math.max(0, Math.min(bounds.x, terminalWidth - 1)),
      y: Math.max(0, Math.min(bounds.y, terminalHeight - 1)),
      width: Math.max(1, Math.min(bounds.width, terminalWidth - bounds.x)),
      height: Math.max(1, Math.min(bounds.height, terminalHeight - bounds.y))
    };
  }

  /**
   * Get center point of bounds
   */
  static getCenter(bounds: ComponentBounds): { x: number; y: number } {
    return {
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + Math.floor(bounds.height / 2)
    };
  }

  /**
   * Get all corner points of bounds
   */
  static getCorners(bounds: ComponentBounds): Array<{ x: number; y: number }> {
    return [
      { x: bounds.x, y: bounds.y }, // Top-left
      { x: bounds.x + bounds.width - 1, y: bounds.y }, // Top-right
      { x: bounds.x, y: bounds.y + bounds.height - 1 }, // Bottom-left
      { x: bounds.x + bounds.width - 1, y: bounds.y + bounds.height - 1 } // Bottom-right
    ];
  }
}

/**
 * Visual feedback utilities
 */
export class VisualFeedbackUtils {
  /**
   * Create default hover feedback
   */
  static createHoverFeedback(intensity: VisualFeedback['intensity'] = 'subtle'): VisualFeedback {
    return {
      type: 'highlight',
      intensity,
      color: intensity === 'subtle' ? '#333' : '#444',
      animation: 'none'
    };
  }

  /**
   * Create default click feedback
   */
  static createClickFeedback(duration = 200): VisualFeedback {
    return {
      type: 'highlight',
      intensity: 'normal',
      color: '#555',
      duration,
      animation: 'pulse'
    };
  }

  /**
   * Create focus feedback
   */
  static createFocusFeedback(): VisualFeedback {
    return {
      type: 'border',
      intensity: 'normal',
      color: '#4A90E2',
      animation: 'none'
    };
  }

  /**
   * Create error/invalid feedback
   */
  static createErrorFeedback(duration = 1000): VisualFeedback {
    return {
      type: 'color_change',
      intensity: 'strong',
      color: '#E74C3C',
      duration,
      animation: 'blink'
    };
  }

  /**
   * Create success feedback
   */
  static createSuccessFeedback(duration = 500): VisualFeedback {
    return {
      type: 'color_change',
      intensity: 'normal',
      color: '#27AE60',
      duration,
      animation: 'fade'
    };
  }
}

/**
 * Component validation utilities
 */
export class ComponentValidator {
  /**
   * Validate component configuration
   */
  static validate(component: ClickableComponent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!component.id || component.id.trim() === '') {
      errors.push('Component ID is required and cannot be empty');
    }

    // Validate bounds
    if (!ComponentBounds.isValid(component.bounds)) {
      errors.push('Component bounds must have positive width and height, and non-negative coordinates');
    }

    // Check priority range
    if (component.priority < 0 || component.priority > 1000) {
      errors.push('Component priority should be between 0 and 1000');
    }

    // Validate accessibility
    if (!component.accessibility.label || component.accessibility.label.trim() === '') {
      errors.push('Accessibility label is required');
    }

    if (component.accessibility.tabIndex < -1) {
      errors.push('Tab index should be -1 or greater');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if component can handle mouse event at coordinates
   */
  static canHandleEventAt(component: ClickableComponent, x: number, y: number, eventType: MouseEvent['type']): boolean {
    if (!component.isEnabled || !component.isVisible) {
      return false;
    }

    if (!ComponentBounds.contains(component.bounds, x, y)) {
      return false;
    }

    // Check if component has appropriate handler for event type
    switch (eventType) {
      case 'click':
        return !!component.handlers.onClick;
      case 'move':
        return !!(component.handlers.onMouseEnter || component.handlers.onMouseMove);
      default:
        return false;
    }
  }
}

/**
 * Default component configurations
 */
export const DEFAULT_COMPONENT_CONFIG = {
  BUTTON: {
    priority: 1,
    style: {
      backgroundColor: '#444',
      color: '#fff',
      border: 'solid' as const,
      borderColor: '#666',
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
      textAlign: 'center' as const
    }
  },
  LINK: {
    priority: 1,
    style: {
      color: '#4A90E2',
      textDecoration: 'underline' as const,
      textAlign: 'left' as const
    }
  },
  MENU_ITEM: {
    priority: 2,
    style: {
      backgroundColor: 'transparent',
      color: '#fff',
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
      textAlign: 'left' as const
    }
  }
} as const;