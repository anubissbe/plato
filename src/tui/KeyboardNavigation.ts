/**
 * Keyboard Navigation support for TUI components
 */

export interface NavigationOptions {
  trapFocus?: boolean;
  autoFocus?: boolean;
  skipDisabled?: boolean;
  wrapAround?: boolean;
}

export interface NavigableElement {
  id: string;
  element?: any;
  disabled?: boolean;
  hidden?: boolean;
  tabIndex?: number;
}

export interface KeyboardNavigationState {
  currentIndex: number;
  elements: NavigableElement[];
  active: boolean;
}

export class KeyboardNavigation {
  private options: NavigationOptions;
  private state: KeyboardNavigationState;
  private onFocusChange?: (element: NavigableElement, index: number) => void;

  constructor(options: NavigationOptions = {}) {
    this.options = {
      trapFocus: true,
      autoFocus: false,
      skipDisabled: true,
      wrapAround: true,
      ...options
    };

    this.state = {
      currentIndex: -1,
      elements: [],
      active: false
    };
  }

  /**
   * Register navigable elements
   */
  setElements(elements: NavigableElement[]): void {
    this.state.elements = elements.filter(el => 
      !this.options.skipDisabled || !el.disabled
    );
    
    if (this.options.autoFocus && this.state.elements.length > 0) {
      this.focusFirst();
    }
  }

  /**
   * Handle keyboard navigation
   */
  handleKey(key: string): boolean {
    if (!this.state.active || this.state.elements.length === 0) {
      return false;
    }

    switch (key) {
      case 'ArrowDown':
      case 'Tab':
        this.focusNext();
        return true;
      
      case 'ArrowUp':
      case 'shift+tab':
        this.focusPrevious();
        return true;
      
      case 'Home':
        this.focusFirst();
        return true;
      
      case 'End':
        this.focusLast();
        return true;
      
      case 'Escape':
        this.deactivate();
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Focus next element
   */
  focusNext(): void {
    if (this.state.elements.length === 0) return;

    let nextIndex = this.state.currentIndex + 1;
    
    if (nextIndex >= this.state.elements.length) {
      nextIndex = this.options.wrapAround ? 0 : this.state.elements.length - 1;
    }

    this.focusIndex(nextIndex);
  }

  /**
   * Focus previous element
   */
  focusPrevious(): void {
    if (this.state.elements.length === 0) return;

    let prevIndex = this.state.currentIndex - 1;
    
    if (prevIndex < 0) {
      prevIndex = this.options.wrapAround ? this.state.elements.length - 1 : 0;
    }

    this.focusIndex(prevIndex);
  }

  /**
   * Focus first element
   */
  focusFirst(): void {
    if (this.state.elements.length > 0) {
      this.focusIndex(0);
    }
  }

  /**
   * Focus last element
   */
  focusLast(): void {
    if (this.state.elements.length > 0) {
      this.focusIndex(this.state.elements.length - 1);
    }
  }

  /**
   * Focus element at specific index
   */
  focusIndex(index: number): void {
    if (index < 0 || index >= this.state.elements.length) return;
    
    const element = this.state.elements[index];
    if (element.disabled || element.hidden) return;

    this.state.currentIndex = index;
    
    if (this.onFocusChange) {
      this.onFocusChange(element, index);
    }
  }

  /**
   * Activate navigation
   */
  activate(): void {
    this.state.active = true;
    if (this.options.autoFocus && this.state.currentIndex === -1) {
      this.focusFirst();
    }
  }

  /**
   * Deactivate navigation
   */
  deactivate(): void {
    this.state.active = false;
    this.state.currentIndex = -1;
  }

  /**
   * Set focus change callback
   */
  onFocusChangeCallback(callback: (element: NavigableElement, index: number) => void): void {
    this.onFocusChange = callback;
  }

  /**
   * Get current state
   */
  getState(): KeyboardNavigationState {
    return { ...this.state };
  }

  /**
   * Get current focused element
   */
  getCurrentElement(): NavigableElement | null {
    if (this.state.currentIndex === -1) return null;
    return this.state.elements[this.state.currentIndex] || null;
  }
}
