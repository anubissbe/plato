/**
 * Focus Manager for TUI components
 */

export interface FocusableComponent {
  id: string;
  type: string;
  priority: number;
  canFocus: () => boolean;
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
}

export interface FocusManagerOptions {
  trapFocus?: boolean;
  restoreFocus?: boolean;
  autoFocus?: boolean;
}

export interface FocusState {
  currentFocus: string | null;
  previousFocus: string | null;
  focusHistory: string[];
  trapActive: boolean;
}

export class FocusManager {
  private options: FocusManagerOptions;
  private state: FocusState;
  private components: Map<string, FocusableComponent> = new Map();
  private focusStack: string[] = [];
  private onFocusChange?: (componentId: string | null) => void;

  constructor(options: FocusManagerOptions = {}) {
    this.options = {
      trapFocus: false,
      restoreFocus: true,
      autoFocus: false,
      ...options
    };

    this.state = {
      currentFocus: null,
      previousFocus: null,
      focusHistory: [],
      trapActive: false
    };
  }

  /**
   * Register a focusable component
   */
  register(component: FocusableComponent): void {
    this.components.set(component.id, component);
    
    if (this.options.autoFocus && this.state.currentFocus === null) {
      this.focus(component.id);
    }
  }

  /**
   * Unregister a component
   */
  unregister(componentId: string): void {
    if (this.state.currentFocus === componentId) {
      this.blur();
    }
    this.components.delete(componentId);
  }

  /**
   * Focus a specific component
   */
  focus(componentId: string): boolean {
    const component = this.components.get(componentId);
    if (!component || !component.canFocus()) {
      return false;
    }

    // Blur current component
    if (this.state.currentFocus) {
      const current = this.components.get(this.state.currentFocus);
      if (current) {
        current.blur();
      }
    }

    // Update state
    this.state.previousFocus = this.state.currentFocus;
    this.state.currentFocus = componentId;
    
    // Add to history
    if (componentId !== this.state.focusHistory[this.state.focusHistory.length - 1]) {
      this.state.focusHistory.push(componentId);
      // Limit history size
      if (this.state.focusHistory.length > 10) {
        this.state.focusHistory.shift();
      }
    }

    // Focus the component
    component.focus();

    // Notify listeners
    if (this.onFocusChange) {
      this.onFocusChange(componentId);
    }

    return true;
  }

  /**
   * Blur current component
   */
  blur(): void {
    if (this.state.currentFocus) {
      const component = this.components.get(this.state.currentFocus);
      if (component) {
        component.blur();
      }
      
      this.state.previousFocus = this.state.currentFocus;
      this.state.currentFocus = null;
      
      if (this.onFocusChange) {
        this.onFocusChange(null);
      }
    }
  }

  /**
   * Focus next component based on priority
   */
  focusNext(): boolean {
    const components = Array.from(this.components.values())
      .filter(c => c.canFocus())
      .sort((a, b) => a.priority - b.priority);

    if (components.length === 0) return false;

    const currentIndex = this.state.currentFocus 
      ? components.findIndex(c => c.id === this.state.currentFocus)
      : -1;

    const nextIndex = (currentIndex + 1) % components.length;
    return this.focus(components[nextIndex].id);
  }

  /**
   * Focus previous component based on priority
   */
  focusPrevious(): boolean {
    const components = Array.from(this.components.values())
      .filter(c => c.canFocus())
      .sort((a, b) => a.priority - b.priority);

    if (components.length === 0) return false;

    const currentIndex = this.state.currentFocus 
      ? components.findIndex(c => c.id === this.state.currentFocus)
      : 0;

    const prevIndex = currentIndex <= 0 ? components.length - 1 : currentIndex - 1;
    return this.focus(components[prevIndex].id);
  }

  /**
   * Restore previous focus
   */
  restorePrevious(): boolean {
    if (this.state.previousFocus && this.options.restoreFocus) {
      return this.focus(this.state.previousFocus);
    }
    return false;
  }

  /**
   * Push current focus to stack
   */
  pushFocus(): void {
    if (this.state.currentFocus) {
      this.focusStack.push(this.state.currentFocus);
    }
  }

  /**
   * Pop focus from stack
   */
  popFocus(): boolean {
    const previousId = this.focusStack.pop();
    if (previousId) {
      return this.focus(previousId);
    }
    return false;
  }

  /**
   * Enable focus trap
   */
  enableTrap(): void {
    this.state.trapActive = true;
  }

  /**
   * Disable focus trap
   */
  disableTrap(): void {
    this.state.trapActive = false;
  }

  /**
   * Check if focus is trapped
   */
  isTrapActive(): boolean {
    return this.state.trapActive;
  }

  /**
   * Get current focused component ID
   */
  getCurrentFocus(): string | null {
    return this.state.currentFocus;
  }

  /**
   * Get previous focused component ID
   */
  getPreviousFocus(): string | null {
    return this.state.previousFocus;
  }

  /**
   * Get all registered component IDs
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Check if component is focused
   */
  isFocused(componentId: string): boolean {
    return this.state.currentFocus === componentId;
  }

  /**
   * Set focus change callback
   */
  onFocusChangeCallback(callback: (componentId: string | null) => void): void {
    this.onFocusChange = callback;
  }

  /**
   * Get focus state
   */
  getState(): FocusState {
    return { ...this.state };
  }

  /**
   * Clear all registered components
   */
  clear(): void {
    this.components.clear();
    this.state.currentFocus = null;
    this.state.previousFocus = null;
    this.state.focusHistory = [];
    this.focusStack = [];
  }
}

export const focusManager = new FocusManager();
