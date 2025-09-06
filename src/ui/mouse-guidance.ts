/**
 * Mouse User Guidance System
 * Provides contextual help and capability detection for mouse features
 */

import type { MouseSettings, MouseCapabilities } from '../config/mouse-settings.js';
import type { MouseEvent } from '../tui/mouse-types.js';

/**
 * User guidance message types
 */
export type GuidanceType = 
  | 'welcome'
  | 'capability_warning'
  | 'feature_disabled'
  | 'usage_tip'
  | 'troubleshooting'
  | 'performance_warning'
  | 'accessibility';

/**
 * Guidance message interface
 */
export interface GuidanceMessage {
  type: GuidanceType;
  title: string;
  message: string;
  actions?: string[];
  dismissible?: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * User interaction context
 */
export interface InteractionContext {
  /** Recent mouse events */
  recentEvents: MouseEvent[];
  /** Time since last mouse activity */
  timeSinceLastActivity: number;
  /** Current UI focus area */
  focusArea?: string;
  /** User's demonstrated proficiency */
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced';
  /** Previously shown guidance messages */
  shownGuidance: Set<string>;
}

/**
 * Mouse guidance system options
 */
export interface MouseGuidanceOptions {
  /** Whether to show welcome messages */
  showWelcome: boolean;
  /** Whether to show capability warnings */
  showCapabilityWarnings: boolean;
  /** Whether to show usage tips */
  showUsageTips: boolean;
  /** Maximum number of guidance messages per session */
  maxMessagesPerSession: number;
  /** Minimum interval between guidance messages (ms) */
  guidanceInterval: number;
  /** Whether to adapt to user proficiency */
  adaptToProficiency: boolean;
}

/**
 * Default guidance options
 */
const DEFAULT_GUIDANCE_OPTIONS: MouseGuidanceOptions = {
  showWelcome: true,
  showCapabilityWarnings: true,
  showUsageTips: true,
  maxMessagesPerSession: 5,
  guidanceInterval: 30000, // 30 seconds
  adaptToProficiency: true,
};

/**
 * Mouse User Guidance System
 */
export class MouseUserGuidance {
  private readonly settings: MouseSettings;
  private readonly capabilities: MouseCapabilities;
  private readonly options: MouseGuidanceOptions;
  private readonly context: InteractionContext;
  private messagesShown: number = 0;
  private lastGuidanceTime: number = 0;

  constructor(
    settings: MouseSettings,
    capabilities: MouseCapabilities,
    options: Partial<MouseGuidanceOptions> = {}
  ) {
    this.settings = settings;
    this.capabilities = capabilities;
    this.options = { ...DEFAULT_GUIDANCE_OPTIONS, ...options };
    this.context = {
      recentEvents: [],
      timeSinceLastActivity: 0,
      proficiencyLevel: 'beginner',
      shownGuidance: new Set(),
    };
  }

  /**
   * Update interaction context with new mouse event
   */
  updateContext(event: MouseEvent): void {
    this.context.recentEvents.push(event);
    
    // Keep only recent events (last 10)
    if (this.context.recentEvents.length > 10) {
      this.context.recentEvents.shift();
    }
    
    // Update proficiency level based on usage patterns
    this.updateProficiencyLevel();
    
    // Reset activity timer
    this.context.timeSinceLastActivity = 0;
  }

  /**
   * Get contextual guidance messages
   */
  getGuidanceMessages(): GuidanceMessage[] {
    const messages: GuidanceMessage[] = [];
    
    // Check if we should show guidance
    if (!this.shouldShowGuidance()) {
      return messages;
    }
    
    // Welcome message for first-time users
    if (this.shouldShowWelcome()) {
      messages.push(this.createWelcomeMessage());
    }
    
    // Capability warnings
    if (this.options.showCapabilityWarnings) {
      messages.push(...this.getCapabilityWarnings());
    }
    
    // Usage tips based on context
    if (this.options.showUsageTips) {
      messages.push(...this.getUsageTips());
    }
    
    // Troubleshooting suggestions
    messages.push(...this.getTroubleshootingMessages());
    
    // Performance warnings
    messages.push(...this.getPerformanceWarnings());
    
    // Accessibility reminders
    messages.push(...this.getAccessibilityMessages());
    
    // Sort by priority and limit count
    return messages
      .sort((a, b) => this.getPriorityOrder(b.priority) - this.getPriorityOrder(a.priority))
      .slice(0, Math.min(3, this.options.maxMessagesPerSession - this.messagesShown));
  }

  /**
   * Get quick start guide for new users
   */
  getQuickStartGuide(): string {
    const guide = [
      '🖱️  Mouse Quick Start Guide',
      '',
      'Basic Features:',
    ];
    
    if (this.settings.clickToFocus) {
      guide.push('  • Click on any text or UI element to focus it');
    }
    
    if (this.settings.dragToSelect && this.capabilities.dragAndDrop) {
      guide.push('  • Drag to select text (like in a regular editor)');
    }
    
    if (this.settings.scrollSupport && this.capabilities.scrollWheel) {
      guide.push('  • Use scroll wheel to navigate through content');
    }
    
    if (this.settings.rightClickMenu && this.capabilities.rightClick) {
      guide.push('  • Right-click for context menu (limited support)');
    } else {
      guide.push('  • Right-click not available (use keyboard shortcuts)');
    }
    
    guide.push('', 'Tip: Use `/mouse help` for more configuration options');
    
    return guide.join('\n');
  }

  /**
   * Get feature-specific help
   */
  getFeatureHelp(feature: keyof MouseSettings): string {
    const helpText: Record<keyof MouseSettings, string> = {
      enabled: 'Enable/disable mouse support entirely. When disabled, all mouse input is ignored.',
      clickToFocus: 'Click on UI elements to focus them. Useful for navigating between input fields and buttons.',
      dragToSelect: 'Drag mouse to select text, similar to a regular text editor. Requires platform support.',
      rightClickMenu: 'Right-click to show context menu. Limited support in terminal environments.',
      scrollSupport: 'Use mouse scroll wheel to navigate through content. Works with chat history and long outputs.',
      doubleClickSpeed: 'Maximum time between clicks to register as double-click. Lower values require faster clicking.',
      dragThreshold: 'Minimum pixel distance to move before starting a drag operation. Higher values prevent accidental drags.',
      hoverDelay: 'Delay before showing hover tooltips and hints. Set to 0 to disable hover effects.',
      showCursor: 'Display mouse cursor in terminal. May not work in all terminal environments.',
      sensitivity: 'Mouse movement sensitivity multiplier. Higher values make mouse more responsive.',
    };
    
    let help = helpText[feature] || 'No help available for this setting.';
    
    // Add capability information
    const capabilityMap: Partial<Record<keyof MouseSettings, keyof MouseCapabilities>> = {
      rightClickMenu: 'rightClick',
      scrollSupport: 'scrollWheel',
      dragToSelect: 'dragAndDrop',
      hoverDelay: 'hover',
    };
    
    const capability = capabilityMap[feature];
    if (capability && !this.capabilities[capability]) {
      help += '\n\n⚠️  This feature is not supported on your current platform.';
    }
    
    return help;
  }

  /**
   * Get troubleshooting suggestions based on common issues
   */
  getTroubleshootingSuggestions(): string[] {
    const suggestions: string[] = [];
    
    // No mouse capability detected
    if (!this.capabilities.supported) {
      suggestions.push(
        'Mouse not working? Try:',
        '• Check if your terminal supports mouse input',
        '• Ensure you\'re not in a limited environment (CI, basic terminal)',
        '• Try a different terminal emulator (iTerm2, Windows Terminal, etc.)'
      );
    }
    
    // Performance issues
    if (this.context.recentEvents.length > 0) {
      const avgTimeBetweenEvents = this.calculateAverageEventInterval();
      if (avgTimeBetweenEvents < 16) { // Less than 60fps
        suggestions.push(
          'Mouse feels sluggish? Try:',
          '• Increase drag threshold to reduce sensitivity',
          '• Disable hover effects (set hoverDelay to 0)',
          '• Use a faster terminal emulator'
        );
      }
    }
    
    // Accessibility concerns
    if (this.settings.hoverDelay < 500) {
      suggestions.push(
        'For better accessibility:',
        '• Consider increasing hover delay to 500ms or more',
        '• Ensure all mouse functions have keyboard alternatives'
      );
    }
    
    return suggestions;
  }

  /**
   * Mark guidance as shown to avoid repetition
   */
  markGuidanceShown(guidanceId: string): void {
    this.context.shownGuidance.add(guidanceId);
    this.messagesShown++;
    this.lastGuidanceTime = Date.now();
  }

  /**
   * Reset guidance state (e.g., for new session)
   */
  resetGuidanceState(): void {
    this.context.shownGuidance.clear();
    this.messagesShown = 0;
    this.lastGuidanceTime = 0;
    this.context.recentEvents = [];
  }

  /**
   * Check if guidance should be shown based on current state
   */
  private shouldShowGuidance(): boolean {
    // Respect message limits
    if (this.messagesShown >= this.options.maxMessagesPerSession) {
      return false;
    }
    
    // Respect timing interval
    const now = Date.now();
    if (now - this.lastGuidanceTime < this.options.guidanceInterval) {
      return false;
    }
    
    // Don't show guidance if mouse is disabled
    if (!this.settings.enabled) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if welcome message should be shown
   */
  private shouldShowWelcome(): boolean {
    return this.options.showWelcome && 
           !this.context.shownGuidance.has('welcome') &&
           this.context.recentEvents.length === 0;
  }

  /**
   * Create welcome message
   */
  private createWelcomeMessage(): GuidanceMessage {
    return {
      type: 'welcome',
      title: 'Mouse Support Enabled',
      message: 'Mouse support is now active! You can click, drag, and scroll in the interface. Use `/mouse help` for more options.',
      actions: ['/mouse help', '/mouse status'],
      dismissible: true,
      priority: 'medium',
    };
  }

  /**
   * Get capability warning messages
   */
  private getCapabilityWarnings(): GuidanceMessage[] {
    const warnings: GuidanceMessage[] = [];
    
    if (this.settings.rightClickMenu && !this.capabilities.rightClick) {
      warnings.push({
        type: 'capability_warning',
        title: 'Right-Click Not Supported',
        message: 'Right-click context menu is enabled but not supported on this platform. Consider disabling it.',
        actions: ['/mouse config rightClickMenu false'],
        dismissible: true,
        priority: 'medium',
      });
    }
    
    if (this.settings.dragToSelect && !this.capabilities.dragAndDrop) {
      warnings.push({
        type: 'capability_warning',
        title: 'Drag Selection Not Supported',
        message: 'Drag-to-select is enabled but not supported on this platform.',
        actions: ['/mouse config dragToSelect false'],
        dismissible: true,
        priority: 'medium',
      });
    }
    
    return warnings.filter(w => !this.context.shownGuidance.has(w.title));
  }

  /**
   * Get contextual usage tips
   */
  private getUsageTips(): GuidanceMessage[] {
    const tips: GuidanceMessage[] = [];
    
    // Suggest enabling drag-to-select if user seems to be trying to select text
    if (!this.settings.dragToSelect && this.capabilities.dragAndDrop) {
      const dragEvents = this.context.recentEvents.filter(e => e.type === 'drag');
      if (dragEvents.length > 2) {
        tips.push({
          type: 'usage_tip',
          title: 'Enable Text Selection',
          message: 'It looks like you\'re trying to select text. Enable drag-to-select for easier text selection.',
          actions: ['/mouse config dragToSelect true'],
          dismissible: true,
          priority: 'low',
        });
      }
    }
    
    return tips.filter(t => !this.context.shownGuidance.has(t.title));
  }

  /**
   * Get troubleshooting messages
   */
  private getTroubleshootingMessages(): GuidanceMessage[] {
    const messages: GuidanceMessage[] = [];
    
    // No mouse events despite mouse being enabled
    if (this.settings.enabled && 
        this.context.recentEvents.length === 0 && 
        this.context.timeSinceLastActivity > 60000) {
      messages.push({
        type: 'troubleshooting',
        title: 'Mouse Not Responding',
        message: 'Mouse is enabled but no events detected. Check terminal mouse support.',
        actions: ['/mouse status --verbose'],
        dismissible: true,
        priority: 'medium',
      });
    }
    
    return messages.filter(m => !this.context.shownGuidance.has(m.title));
  }

  /**
   * Get performance warning messages
   */
  private getPerformanceWarnings(): GuidanceMessage[] {
    const warnings: GuidanceMessage[] = [];
    
    // Too many events in short time
    if (this.context.recentEvents.length >= 10) {
      const timeSpan = this.context.recentEvents[9].timestamp - this.context.recentEvents[0].timestamp;
      if (timeSpan < 1000) { // 10 events in less than 1 second
        warnings.push({
          type: 'performance_warning',
          title: 'High Mouse Activity',
          message: 'High mouse activity detected. Consider adjusting sensitivity or drag threshold.',
          actions: ['/mouse config sensitivity 0.5', '/mouse config dragThreshold 5'],
          dismissible: true,
          priority: 'low',
        });
      }
    }
    
    return warnings.filter(w => !this.context.shownGuidance.has(w.title));
  }

  /**
   * Get accessibility reminder messages
   */
  private getAccessibilityMessages(): GuidanceMessage[] {
    const messages: GuidanceMessage[] = [];
    
    // Remind about keyboard alternatives
    if (this.context.proficiencyLevel === 'beginner' && 
        this.context.recentEvents.length > 5) {
      messages.push({
        type: 'accessibility',
        title: 'Keyboard Alternatives',
        message: 'Remember that all mouse functions have keyboard alternatives for accessibility.',
        dismissible: true,
        priority: 'low',
      });
    }
    
    return messages.filter(m => !this.context.shownGuidance.has(m.title));
  }

  /**
   * Update user proficiency level based on usage patterns
   */
  private updateProficiencyLevel(): void {
    const eventTypes = new Set(this.context.recentEvents.map(e => e.type));
    
    if (eventTypes.size >= 3) {
      this.context.proficiencyLevel = 'advanced';
    } else if (this.context.recentEvents.length >= 5) {
      this.context.proficiencyLevel = 'intermediate';
    }
  }

  /**
   * Calculate average time between mouse events
   */
  private calculateAverageEventInterval(): number {
    if (this.context.recentEvents.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < this.context.recentEvents.length; i++) {
      intervals.push(
        this.context.recentEvents[i].timestamp - this.context.recentEvents[i - 1].timestamp
      );
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * Get priority order for sorting messages
   */
  private getPriorityOrder(priority: GuidanceMessage['priority']): number {
    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorities[priority] || 0;
  }
}

/**
 * Create mouse guidance instance with current settings
 */
export function createMouseGuidance(
  settings: MouseSettings,
  capabilities: MouseCapabilities,
  options?: Partial<MouseGuidanceOptions>
): MouseUserGuidance {
  return new MouseUserGuidance(settings, capabilities, options);
}
