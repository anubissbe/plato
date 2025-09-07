/**
 * Input modes system for managing different input contexts
 */

export type InputMode = 'normal' | 'command' | 'search' | 'visual' | 'insert';

export interface InputModeDefinition {
  name: InputMode;
  displayName: string;
  indicator: string;
  description: string;
  keyBindings?: Map<string, () => void>;
  onEnter?: () => void;
  onExit?: () => void;
  onInput?: (input: string) => void;
  allowPassthrough?: boolean;
}

export class InputModeManager {
  private currentMode: InputMode = 'normal';
  private modes: Map<InputMode, InputModeDefinition> = new Map();
  private modeHistory: InputMode[] = [];
  private inputBuffer: string = '';
  private listeners: Set<(mode: InputMode, prevMode: InputMode) => void> = new Set();

  constructor() {
    this.initializeModes();
  }

  /**
   * Initialize default input modes
   */
  private initializeModes() {
    // Normal mode
    this.registerMode({
      name: 'normal',
      displayName: 'Normal',
      indicator: '',
      description: 'Normal input mode for typing messages',
      allowPassthrough: true,
      onEnter: () => {
        this.inputBuffer = '';
      },
    });

    // Command mode
    this.registerMode({
      name: 'command',
      displayName: 'Command',
      indicator: '⌘',
      description: 'Command palette mode for executing commands',
      allowPassthrough: false,
      onEnter: () => {
        this.inputBuffer = '';
      },
      onExit: () => {
        this.inputBuffer = '';
      },
      onInput: (input: string) => {
        // Filter commands based on input
        this.inputBuffer = input;
      },
    });

    // Search mode
    this.registerMode({
      name: 'search',
      displayName: 'Search',
      indicator: '🔍',
      description: 'Search mode for finding text in conversation',
      allowPassthrough: false,
      onEnter: () => {
        this.inputBuffer = '';
      },
      onExit: () => {
        this.inputBuffer = '';
      },
      onInput: (input: string) => {
        // Perform search based on input
        this.inputBuffer = input;
      },
    });

    // Visual mode (for text selection)
    this.registerMode({
      name: 'visual',
      displayName: 'Visual',
      indicator: '▒',
      description: 'Visual mode for selecting text',
      allowPassthrough: false,
      onEnter: () => {
        // Start text selection
      },
      onExit: () => {
        // Clear selection
      },
    });

    // Insert mode (for multi-line input)
    this.registerMode({
      name: 'insert',
      displayName: 'Insert',
      indicator: '✎',
      description: 'Insert mode for multi-line text input',
      allowPassthrough: true,
      onEnter: () => {
        this.inputBuffer = '';
      },
    });
  }

  /**
   * Register a new input mode
   */
  registerMode(mode: InputModeDefinition): void {
    this.modes.set(mode.name, mode);
  }

  /**
   * Switch to a different input mode
   */
  switchTo(mode: InputMode): boolean {
    if (!this.modes.has(mode)) {
      console.error(`Invalid input mode: ${mode}`);
      return false;
    }

    if (mode === this.currentMode) {
      return true;
    }

    const previousMode = this.currentMode;
    const previousModeDefinition = this.modes.get(previousMode);
    const newModeDefinition = this.modes.get(mode);

    // Call exit handler for previous mode
    if (previousModeDefinition?.onExit) {
      previousModeDefinition.onExit();
    }

    // Update mode
    this.currentMode = mode;
    this.modeHistory.push(previousMode);

    // Limit history size
    if (this.modeHistory.length > 10) {
      this.modeHistory.shift();
    }

    // Call enter handler for new mode
    if (newModeDefinition?.onEnter) {
      newModeDefinition.onEnter();
    }

    // Notify listeners
    this.notifyListeners(mode, previousMode);

    return true;
  }

  /**
   * Get current input mode
   */
  getCurrentMode(): InputMode {
    return this.currentMode;
  }

  /**
   * Get current mode definition
   */
  getCurrentModeDefinition(): InputModeDefinition | undefined {
    return this.modes.get(this.currentMode);
  }

  /**
   * Get mode indicator for display
   */
  getIndicator(): string {
    const mode = this.modes.get(this.currentMode);
    return mode?.indicator || '';
  }

  /**
   * Get display name for current mode
   */
  getDisplayName(): string {
    const mode = this.modes.get(this.currentMode);
    return mode?.displayName || 'Unknown';
  }

  /**
   * Handle input in current mode
   */
  handleInput(input: string): boolean {
    const mode = this.modes.get(this.currentMode);
    
    if (!mode) {
      return false;
    }

    // Call mode's input handler
    if (mode.onInput) {
      mode.onInput(input);
    }

    // Return whether input should be passed through
    return mode.allowPassthrough || false;
  }

  /**
   * Handle special key in current mode
   */
  handleSpecialKey(key: string): boolean {
    const mode = this.modes.get(this.currentMode);
    
    if (!mode || !mode.keyBindings) {
      return false;
    }

    const handler = mode.keyBindings.get(key);
    if (handler) {
      handler();
      return true;
    }

    return false;
  }

  /**
   * Switch to previous mode
   */
  switchToPrevious(): boolean {
    if (this.modeHistory.length === 0) {
      return this.switchTo('normal');
    }

    const previousMode = this.modeHistory.pop()!;
    return this.switchTo(previousMode);
  }

  /**
   * Reset to normal mode
   */
  reset(): void {
    this.switchTo('normal');
    this.modeHistory = [];
    this.inputBuffer = '';
  }

  /**
   * Get input buffer
   */
  getInputBuffer(): string {
    return this.inputBuffer;
  }

  /**
   * Set input buffer
   */
  setInputBuffer(buffer: string): void {
    this.inputBuffer = buffer;
  }

  /**
   * Clear input buffer
   */
  clearInputBuffer(): void {
    this.inputBuffer = '';
  }

  /**
   * Add mode change listener
   */
  addListener(listener: (mode: InputMode, prevMode: InputMode) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove mode change listener
   */
  removeListener(listener: (mode: InputMode, prevMode: InputMode) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of mode change
   */
  private notifyListeners(mode: InputMode, prevMode: InputMode): void {
    for (const listener of this.listeners) {
      try {
        listener(mode, prevMode);
      } catch (error) {
        console.error('Error in mode change listener:', error);
      }
    }
  }

  /**
   * Get all available modes
   */
  getAvailableModes(): InputModeDefinition[] {
    return Array.from(this.modes.values());
  }

  /**
   * Check if a mode exists
   */
  hasMode(mode: InputMode): boolean {
    return this.modes.has(mode);
  }

  /**
   * Get mode history
   */
  getModeHistory(): InputMode[] {
    return [...this.modeHistory];
  }

  /**
   * Check if in a specific mode
   */
  isInMode(mode: InputMode): boolean {
    return this.currentMode === mode;
  }

  /**
   * Toggle between two modes
   */
  toggle(mode1: InputMode, mode2: InputMode): boolean {
    if (this.currentMode === mode1) {
      return this.switchTo(mode2);
    } else if (this.currentMode === mode2) {
      return this.switchTo(mode1);
    } else {
      return this.switchTo(mode1);
    }
  }
}

// Export singleton instance
export const inputModes = new InputModeManager();