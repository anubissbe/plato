/**
 * Screen Reader Support for accessibility
 */

export interface ScreenReaderOptions {
  announceChanges?: boolean;
  verboseMode?: boolean;
  skipHidden?: boolean;
}

export interface AriaAttributes {
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  role?: string;
}

export class ScreenReaderSupport {
  private options: ScreenReaderOptions;
  private announcements: string[] = [];

  constructor(options: ScreenReaderOptions = {}) {
    this.options = {
      announceChanges: true,
      verboseMode: false,
      skipHidden: true,
      ...options
    };
  }

  /**
   * Announce a message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.options.announceChanges) return;
    
    this.announcements.push(message);
    // In a real implementation, this would create a live region element
    if (this.options.verboseMode) {
      console.log(`[Screen Reader]: ${message}`);
    }
  }

  /**
   * Get ARIA attributes for an element
   */
  getAriaAttributes(elementType: string, state?: Record<string, any>): AriaAttributes {
    const attrs: AriaAttributes = {};

    switch (elementType) {
      case 'button':
        attrs.role = 'button';
        if (state?.disabled) attrs['aria-hidden'] = true;
        break;
      case 'dialog':
        attrs.role = 'dialog';
        attrs['aria-live'] = 'polite';
        break;
      case 'status':
        attrs.role = 'status';
        attrs['aria-live'] = 'polite';
        break;
      default:
        break;
    }

    return attrs;
  }

  /**
   * Clear announcement queue
   */
  clearAnnouncements(): void {
    this.announcements = [];
  }

  /**
   * Get recent announcements
   */
  getAnnouncements(): string[] {
    return [...this.announcements];
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<ScreenReaderOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

export const screenReaderSupport = new ScreenReaderSupport();
