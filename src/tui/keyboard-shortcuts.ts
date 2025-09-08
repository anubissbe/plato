/**
 * Keyboard shortcut system for managing and executing keyboard shortcuts
 */

export type KeyModifiers = {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

export type KeyBinding = {
  key: string;
  modifiers?: KeyModifiers;
  sequence?: string[];
};

export type ShortcutHandler = (event?: any) => void | Promise<void>;

export type ShortcutDefinition = {
  id: string;
  name: string;
  description?: string;
  binding: KeyBinding | KeyBinding[];
  handler: ShortcutHandler;
  category?: string;
  condition?: () => boolean;
  scope?: string;
  priority?: number;
};

export class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private sequenceBuffer: string[] = [];
  private sequenceTimeout: NodeJS.Timeout | null = null;
  private activeScope: string = 'global';
  private enabled: boolean = true;

  constructor() {
    this.registerDefaultShortcuts();
  }

  /**
   * Register default keyboard shortcuts
   */
  private registerDefaultShortcuts() {
    // Panel management
    this.register({
      id: 'focus-panel-1',
      name: 'Focus Panel 1',
      description: 'Focus on the first panel',
      binding: { key: '1', modifiers: { ctrl: true } },
      handler: () => this.focusPanel(1),
      category: 'Panel',
    });

    this.register({
      id: 'focus-panel-2',
      name: 'Focus Panel 2',
      description: 'Focus on the second panel',
      binding: { key: '2', modifiers: { ctrl: true } },
      handler: () => this.focusPanel(2),
      category: 'Panel',
    });

    this.register({
      id: 'focus-panel-3',
      name: 'Focus Panel 3',
      description: 'Focus on the third panel',
      binding: { key: '3', modifiers: { ctrl: true } },
      handler: () => this.focusPanel(3),
      category: 'Panel',
    });

    // Function keys
    this.register({
      id: 'help',
      name: 'Help',
      description: 'Show help overlay',
      binding: { key: 'F1' },
      handler: () => this.showHelp(),
      category: 'General',
    });

    this.register({
      id: 'command-palette',
      name: 'Command Palette',
      description: 'Open command palette',
      binding: [
        { key: 'F2' },
        { key: 'p', modifiers: { ctrl: true, shift: true } },
      ],
      handler: () => this.openCommandPalette(),
      category: 'General',
    });

    this.register({
      id: 'search',
      name: 'Search',
      description: 'Enter search mode',
      binding: [
        { key: 'F3' },
        { key: 'f', modifiers: { ctrl: true } },
      ],
      handler: () => this.enterSearchMode(),
      category: 'General',
    });

    // Alt combinations
    this.register({
      id: 'panel-navigation',
      name: 'Panel Navigation',
      description: 'Navigate between panels',
      binding: { key: 'p', modifiers: { alt: true } },
      handler: () => this.navigatePanels(),
      category: 'Panel',
    });

    this.register({
      id: 'quick-search',
      name: 'Quick Search',
      description: 'Quick search in conversation',
      binding: { key: 's', modifiers: { alt: true } },
      handler: () => this.quickSearch(),
      category: 'Search',
    });

    // Cost analytics shortcuts
    this.register({
      id: 'toggle-cost-analytics',
      name: 'Toggle Cost Analytics',
      description: 'Show/hide cost analytics in status line',
      binding: { key: 'c', modifiers: { alt: true } },
      handler: () => this.toggleCostAnalytics(),
      category: 'Cost Analytics',
    });

    this.register({
      id: 'toggle-detailed-cost',
      name: 'Toggle Detailed Cost Analytics',
      description: 'Show/hide detailed cost analytics with projections',
      binding: { key: 'c', modifiers: { alt: true, shift: true } },
      handler: () => this.toggleDetailedCostAnalytics(),
      category: 'Cost Analytics',
    });

    this.register({
      id: 'toggle-current-cost',
      name: 'Toggle Current Cost',
      description: 'Show/hide current cost display',
      binding: { key: '$', modifiers: { alt: true } },
      handler: () => this.toggleCurrentCost(),
      category: 'Cost Analytics',
    });
  }

  /**
   * Register a new keyboard shortcut
   */
  register(shortcut: ShortcutDefinition): void {
    // Validate shortcut
    if (!shortcut.id || !shortcut.binding || !shortcut.handler) {
      throw new Error('Invalid shortcut definition');
    }

    // Check for conflicts
    const bindingKeys = this.getBindingKeys(shortcut.binding);
    for (const key of bindingKeys) {
      const existing = this.findShortcutByKey(key);
      if (existing && existing.id !== shortcut.id) {
        console.warn(`Keyboard shortcut conflict: ${key} is already bound to ${existing.name}`);
      }
    }

    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Handle keyboard input
   */
  handleKeyPress(event: any): boolean {
    if (!this.enabled) return false;

    const keyString = this.eventToKeyString(event);
    
    // Check for sequence continuation
    if (this.sequenceBuffer.length > 0) {
      this.sequenceBuffer.push(keyString);
      const sequenceKey = this.sequenceBuffer.join(' ');
      
      const shortcut = this.findShortcutByKey(sequenceKey);
      if (shortcut) {
        this.executeShortcut(shortcut, event);
        this.clearSequence();
        return true;
      }
      
      // Check if this could be a partial sequence
      const isPartialSequence = this.isPartialSequence(sequenceKey);
      if (!isPartialSequence) {
        this.clearSequence();
      } else {
        this.resetSequenceTimeout();
      }
      
      return isPartialSequence;
    }

    // Check for direct shortcut match
    const shortcut = this.findShortcutByKey(keyString);
    if (shortcut) {
      // Check if this starts a sequence
      if (this.isSequenceStart(keyString)) {
        this.sequenceBuffer.push(keyString);
        this.resetSequenceTimeout();
        return true;
      }
      
      this.executeShortcut(shortcut, event);
      return true;
    }

    return false;
  }

  /**
   * Convert keyboard event to key string
   */
  private eventToKeyString(event: any): string {
    const parts: string[] = [];
    
    if (event.ctrl || event.ctrlKey) parts.push('Ctrl');
    if (event.alt || event.altKey) parts.push('Alt');
    if (event.shift || event.shiftKey) parts.push('Shift');
    if (event.meta || event.metaKey) parts.push('Meta');
    
    // Handle special keys
    let key = event.key || event.inputKey || '';
    
    // Normalize key names
    if (key.length === 1) {
      key = key.toUpperCase();
    } else {
      // Handle special key names
      const keyMap: Record<string, string> = {
        'escape': 'Escape',
        'enter': 'Enter',
        'return': 'Enter',
        'tab': 'Tab',
        'backspace': 'Backspace',
        'delete': 'Delete',
        'arrowup': 'ArrowUp',
        'arrowdown': 'ArrowDown',
        'arrowleft': 'ArrowLeft',
        'arrowright': 'ArrowRight',
        'pageup': 'PageUp',
        'pagedown': 'PageDown',
        'home': 'Home',
        'end': 'End',
        'f1': 'F1',
        'f2': 'F2',
        'f3': 'F3',
        'f4': 'F4',
        'f5': 'F5',
        'f6': 'F6',
        'f7': 'F7',
        'f8': 'F8',
        'f9': 'F9',
        'f10': 'F10',
        'f11': 'F11',
        'f12': 'F12',
      };
      
      key = keyMap[key.toLowerCase()] || key;
    }
    
    if (key) parts.push(key);
    
    return parts.join('+');
  }

  /**
   * Get binding keys for a shortcut
   */
  private getBindingKeys(binding: KeyBinding | KeyBinding[]): string[] {
    const bindings = Array.isArray(binding) ? binding : [binding];
    return bindings.map(b => {
      if (b.sequence) {
        return b.sequence.join(' ');
      }
      return this.bindingToKeyString(b);
    });
  }

  /**
   * Convert binding to key string
   */
  private bindingToKeyString(binding: KeyBinding): string {
    const parts: string[] = [];
    
    if (binding.modifiers?.ctrl) parts.push('Ctrl');
    if (binding.modifiers?.alt) parts.push('Alt');
    if (binding.modifiers?.shift) parts.push('Shift');
    if (binding.modifiers?.meta) parts.push('Meta');
    
    parts.push(binding.key);
    
    return parts.join('+');
  }

  /**
   * Find shortcut by key string
   */
  private findShortcutByKey(keyString: string): ShortcutDefinition | null {
    for (const shortcut of this.shortcuts.values()) {
      // Check scope
      if (shortcut.scope && shortcut.scope !== this.activeScope) {
        continue;
      }
      
      // Check condition
      if (shortcut.condition && !shortcut.condition()) {
        continue;
      }
      
      const bindingKeys = this.getBindingKeys(shortcut.binding);
      if (bindingKeys.includes(keyString)) {
        return shortcut;
      }
    }
    
    return null;
  }

  /**
   * Check if key string is a sequence start
   */
  private isSequenceStart(keyString: string): boolean {
    for (const shortcut of this.shortcuts.values()) {
      const bindingKeys = this.getBindingKeys(shortcut.binding);
      for (const key of bindingKeys) {
        if (key.includes(' ') && key.startsWith(keyString + ' ')) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if key string is a partial sequence
   */
  private isPartialSequence(keyString: string): boolean {
    for (const shortcut of this.shortcuts.values()) {
      const bindingKeys = this.getBindingKeys(shortcut.binding);
      for (const key of bindingKeys) {
        if (key.startsWith(keyString)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Execute a shortcut
   */
  private executeShortcut(shortcut: ShortcutDefinition, event?: any): void {
    try {
      // Prevent default behavior
      if (event?.preventDefault) {
        event.preventDefault();
      }
      
      // Execute handler
      const result = shortcut.handler(event);
      
      // Handle async handlers
      if (result instanceof Promise) {
        result.catch(error => {
          console.error(`Error executing shortcut ${shortcut.id}:`, error);
        });
      }
    } catch (error) {
      console.error(`Error executing shortcut ${shortcut.id}:`, error);
    }
  }

  /**
   * Clear sequence buffer
   */
  private clearSequence(): void {
    this.sequenceBuffer = [];
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
      this.sequenceTimeout = null;
    }
  }

  /**
   * Reset sequence timeout
   */
  private resetSequenceTimeout(): void {
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }
    
    this.sequenceTimeout = setTimeout(() => {
      this.clearSequence();
    }, 1000); // 1 second timeout for sequences
  }

  /**
   * Set active scope
   */
  setScope(scope: string): void {
    this.activeScope = scope;
  }

  /**
   * Enable/disable shortcut handling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get all shortcuts
   */
  getShortcuts(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: string): ShortcutDefinition[] {
    return this.getShortcuts().filter(s => s.category === category);
  }

  /**
   * Get shortcut by id
   */
  getShortcut(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.get(id);
  }

  // Placeholder handlers - to be connected to actual functionality
  private focusPanel(index: number): void {
    console.log(`Focus panel ${index}`);
  }

  private showHelp(): void {
    console.log('Show help overlay');
  }

  private openCommandPalette(): void {
    console.log('Open command palette');
  }

  private enterSearchMode(): void {
    console.log('Enter search mode');
  }

  private navigatePanels(): void {
    console.log('Navigate panels');
  }

  private quickSearch(): void {
    console.log('Quick search');
  }

  // Cost analytics handlers
  private async toggleCostAnalytics(): Promise<void> {
    try {
      const { toggleCostAnalytics } = await import('./status-config.js');
      const enabled = await toggleCostAnalytics();
      console.log(`Cost analytics ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle cost analytics:', error);
    }
  }

  private async toggleDetailedCostAnalytics(): Promise<void> {
    try {
      const { toggleDetailedCostAnalytics } = await import('./status-config.js');
      const enabled = await toggleDetailedCostAnalytics();
      console.log(`Detailed cost analytics ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle detailed cost analytics:', error);
    }
  }

  private async toggleCurrentCost(): Promise<void> {
    try {
      const { toggleCurrentCost } = await import('./status-config.js');
      const enabled = await toggleCurrentCost();
      console.log(`Current cost display ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle current cost:', error);
    }
  }
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcutManager();