/**
 * Selection State Manager
 * Manages selection states and cursor position tracking with persistence
 */

import { TextPosition, TextRange, SelectionState, SelectionEvent } from './text-selection.js';
import { ClipboardManager } from './clipboard-manager.js';

/**
 * Cursor state information
 */
export interface CursorState {
  /** Current cursor position */
  position: TextPosition;
  /** Whether cursor is visible */
  visible: boolean;
  /** Cursor blink state */
  blinking: boolean;
  /** Last movement time */
  lastMovement: number;
  /** Cursor movement velocity for smooth scrolling */
  velocity: { x: number; y: number };
  /** Whether cursor is at end of line */
  atEndOfLine: boolean;
  /** Preferred column for vertical movement */
  preferredColumn: number;
}

/**
 * Selection history entry
 */
export interface SelectionHistoryEntry {
  /** Entry ID */
  id: string;
  /** Selection range */
  range: TextRange;
  /** Selected text content */
  content: string;
  /** Creation timestamp */
  timestamp: number;
  /** Selection source */
  source: 'mouse' | 'keyboard' | 'api';
  /** Selection type */
  type: 'character' | 'word' | 'line';
  /** Duration of selection */
  duration: number;
}

/**
 * Selection state persistence data
 */
export interface SelectionPersistenceData {
  /** Current selection range */
  currentSelection: TextRange | null;
  /** Current cursor position */
  cursorPosition: TextPosition;
  /** Selection history */
  history: SelectionHistoryEntry[];
  /** Last update timestamp */
  lastUpdate: number;
  /** Session ID */
  sessionId: string;
}

/**
 * Selection state configuration
 */
export interface SelectionStateConfig {
  /** Enable state persistence */
  enablePersistence: boolean;
  /** Persistence storage path */
  persistencePath: string;
  /** Auto-save interval (ms) */
  autoSaveInterval: number;
  /** Maximum history entries */
  maxHistoryEntries: number;
  /** Enable cursor position tracking */
  enableCursorTracking: boolean;
  /** Cursor blink interval (ms) */
  cursorBlinkInterval: number;
  /** Enable selection analytics */
  enableAnalytics: boolean;
  /** Selection timeout for auto-clear (0 = disabled) */
  selectionTimeout: number;
  /** Debug state management */
  debug: boolean;
}

/**
 * Selection analytics data
 */
export interface SelectionAnalytics {
  /** Total selections made */
  totalSelections: number;
  /** Total characters selected */
  totalCharactersSelected: number;
  /** Average selection duration */
  averageSelectionDuration: number;
  /** Most common selection type */
  mostCommonType: 'character' | 'word' | 'line';
  /** Selection frequency by hour */
  frequencyByHour: Record<string, number>;
  /** Most selected content patterns */
  commonPatterns: { pattern: string; count: number }[];
}

/**
 * Default configuration
 */
const DEFAULT_STATE_CONFIG: SelectionStateConfig = {
  enablePersistence: true,
  persistencePath: '.plato/selection-state.json',
  autoSaveInterval: 5000, // 5 seconds
  maxHistoryEntries: 100,
  enableCursorTracking: true,
  cursorBlinkInterval: 500,
  enableAnalytics: false,
  selectionTimeout: 0,
  debug: false
};

/**
 * Selection state event types
 */
export interface SelectionStateEvent {
  type: 'stateChange' | 'cursorMove' | 'selectionStart' | 'selectionEnd' | 'historyAdd' | 'persistenceSave';
  timestamp: number;
  data: any;
}

/**
 * Selection state event handlers
 */
export type SelectionStateEventHandler = (event: SelectionStateEvent) => void | Promise<void>;

export interface SelectionStateEventHandlers {
  onStateChange?: SelectionStateEventHandler;
  onCursorMove?: SelectionStateEventHandler;
  onSelectionStart?: SelectionStateEventHandler;
  onSelectionEnd?: SelectionStateEventHandler;
  onHistoryAdd?: SelectionStateEventHandler;
  onPersistenceSave?: SelectionStateEventHandler;
}

/**
 * Selection State Manager
 * Comprehensive state management for selections and cursor positioning
 */
export class SelectionStateManager {
  private config: SelectionStateConfig;
  private clipboardManager: ClipboardManager;
  private currentSelection: TextRange | null = null;
  private selectionState: SelectionState;
  private cursorState: CursorState;
  private selectionHistory: SelectionHistoryEntry[] = [];
  private selectionAnalytics: SelectionAnalytics;
  private eventHandlers: SelectionStateEventHandlers = {};
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private cursorBlinkTimer: NodeJS.Timeout | null = null;
  private selectionTimeoutTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private lastPersistenceData: SelectionPersistenceData | null = null;
  private content: string[] = [];

  constructor(
    clipboardManager: ClipboardManager,
    config: Partial<SelectionStateConfig> = {}
  ) {
    this.config = { ...DEFAULT_STATE_CONFIG, ...config };
    this.clipboardManager = clipboardManager;
    this.sessionId = this.generateSessionId();
    this.selectionState = this.createInitialSelectionState();
    this.cursorState = this.createInitialCursorState();
    this.selectionAnalytics = this.createInitialAnalytics();

    this.setupAutoSave();
    this.setupCursorBlink();
    this.loadPersistedState();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create initial selection state
   */
  private createInitialSelectionState(): SelectionState {
    return {
      isActive: false,
      isVisible: false,
      startTime: 0,
      lastUpdate: Date.now(),
      mode: 'character'
    };
  }

  /**
   * Create initial cursor state
   */
  private createInitialCursorState(): CursorState {
    return {
      position: { line: 0, column: 0 },
      visible: true,
      blinking: true,
      lastMovement: Date.now(),
      velocity: { x: 0, y: 0 },
      atEndOfLine: false,
      preferredColumn: 0
    };
  }

  /**
   * Create initial analytics
   */
  private createInitialAnalytics(): SelectionAnalytics {
    return {
      totalSelections: 0,
      totalCharactersSelected: 0,
      averageSelectionDuration: 0,
      mostCommonType: 'character',
      frequencyByHour: {},
      commonPatterns: []
    };
  }

  /**
   * Setup auto-save functionality
   */
  private setupAutoSave(): void {
    if (!this.config.enablePersistence || this.config.autoSaveInterval <= 0) {
      return;
    }

    this.autoSaveTimer = setInterval(() => {
      this.saveState();
    }, this.config.autoSaveInterval);
  }

  /**
   * Setup cursor blinking
   */
  private setupCursorBlink(): void {
    if (!this.config.enableCursorTracking || this.config.cursorBlinkInterval <= 0) {
      return;
    }

    this.cursorBlinkTimer = setInterval(() => {
      if (this.cursorState.blinking) {
        this.cursorState.visible = !this.cursorState.visible;
        this.fireStateEvent('cursorMove', { visible: this.cursorState.visible });
      }
    }, this.config.cursorBlinkInterval);
  }

  /**
   * Update content for position validation
   */
  updateContent(content: string[]): void {
    this.content = [...content];
    
    // Validate and adjust cursor position if needed
    this.validateCursorPosition();
    
    // Validate current selection
    if (this.currentSelection && !this.isValidRange(this.currentSelection)) {
      this.clearSelection();
    }
  }

  /**
   * Set cursor position
   */
  setCursorPosition(position: TextPosition): void {
    const clampedPosition = this.clampPosition(position);
    
    // Calculate velocity for smooth movement animations
    const dx = clampedPosition.column - this.cursorState.position.column;
    const dy = clampedPosition.line - this.cursorState.position.line;
    const dt = Date.now() - this.cursorState.lastMovement;
    
    this.cursorState.velocity = {
      x: dt > 0 ? dx / dt : 0,
      y: dt > 0 ? dy / dt : 0
    };

    // Update cursor state
    this.cursorState = {
      ...this.cursorState,
      position: clampedPosition,
      lastMovement: Date.now(),
      atEndOfLine: this.isAtEndOfLine(clampedPosition),
      preferredColumn: clampedPosition.column,
      visible: true // Show cursor when moved
    };

    // Reset cursor blink
    if (this.cursorState.blinking) {
      this.cursorState.visible = true;
    }

    this.fireStateEvent('cursorMove', {
      position: clampedPosition,
      velocity: this.cursorState.velocity
    });

    if (this.config.debug) {
      console.debug(`[SelectionStateManager] Cursor moved to (${clampedPosition.line}, ${clampedPosition.column})`);
    }
  }

  /**
   * Get current cursor position
   */
  getCursorPosition(): TextPosition {
    return { ...this.cursorState.position };
  }

  /**
   * Get cursor state
   */
  getCursorState(): Readonly<CursorState> {
    return { ...this.cursorState };
  }

  /**
   * Start selection at cursor position
   */
  startSelection(
    position?: TextPosition,
    mode: SelectionState['mode'] = 'character',
    source: SelectionEvent['source'] = 'keyboard'
  ): void {
    const startPos = position || this.cursorState.position;
    const clampedPos = this.clampPosition(startPos);

    // Clear any existing selection timeout
    this.clearSelectionTimeout();

    // Update selection state
    this.selectionState = {
      isActive: true,
      isVisible: true,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      mode
    };

    // Set initial range
    this.currentSelection = {
      start: clampedPos,
      end: clampedPos
    };

    // Update cursor position to start
    this.setCursorPosition(clampedPos);

    this.fireStateEvent('selectionStart', {
      position: clampedPos,
      mode,
      source
    });

    if (this.config.debug) {
      console.debug(`[SelectionStateManager] Started ${mode} selection at (${clampedPos.line}, ${clampedPos.column})`);
    }
  }

  /**
   * Update selection to position
   */
  updateSelection(position: TextPosition, source: SelectionEvent['source'] = 'keyboard'): void {
    if (!this.selectionState.isActive || !this.currentSelection) {
      return;
    }

    const clampedPos = this.clampPosition(position);
    
    // Update selection range
    this.currentSelection = {
      ...this.currentSelection,
      end: clampedPos
    };

    // Update selection state
    this.selectionState = {
      ...this.selectionState,
      lastUpdate: Date.now()
    };

    // Update cursor position to end
    this.setCursorPosition(clampedPos);

    this.fireStateEvent('stateChange', {
      selection: this.currentSelection,
      cursor: clampedPos,
      source
    });
  }

  /**
   * End selection
   */
  endSelection(source: SelectionEvent['source'] = 'keyboard'): TextRange | null {
    if (!this.selectionState.isActive || !this.currentSelection) {
      return null;
    }

    const finalRange = { ...this.currentSelection };
    const duration = Date.now() - this.selectionState.startTime;

    // Add to history
    this.addToHistory(finalRange, this.selectionState.mode, source, duration);

    // Update selection state
    this.selectionState = {
      ...this.selectionState,
      isActive: false
    };

    // Start selection timeout if configured
    if (this.config.selectionTimeout > 0) {
      this.startSelectionTimeout();
    }

    this.fireStateEvent('selectionEnd', {
      range: finalRange,
      duration,
      source
    });

    if (this.config.debug) {
      const content = this.getSelectedContent(finalRange);
      console.debug(`[SelectionStateManager] Ended selection: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
    }

    return finalRange;
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    if (!this.currentSelection) {
      return;
    }

    this.currentSelection = null;
    this.selectionState = this.createInitialSelectionState();
    this.clearSelectionTimeout();

    this.fireStateEvent('stateChange', {
      selection: null,
      cleared: true
    });

    if (this.config.debug) {
      console.debug(`[SelectionStateManager] Cleared selection`);
    }
  }

  /**
   * Copy current selection to clipboard
   */
  async copySelection(): Promise<boolean> {
    if (!this.currentSelection) {
      return false;
    }

    const content = this.getSelectedContent(this.currentSelection);
    if (!content) {
      return false;
    }

    const result = await this.clipboardManager.copyText(content, 'selection');
    
    if (this.config.debug) {
      console.debug(`[SelectionStateManager] Copy selection result:`, result.success);
    }

    return result.success;
  }

  /**
   * Get selected content
   */
  private getSelectedContent(range: TextRange): string {
    const normalizedRange = this.normalizeRange(range);
    const lines: string[] = [];

    for (let lineNum = normalizedRange.start.line; lineNum <= normalizedRange.end.line; lineNum++) {
      if (lineNum >= this.content.length) break;

      const line = this.content[lineNum];
      let lineText = '';

      if (normalizedRange.start.line === normalizedRange.end.line) {
        // Single line selection
        lineText = line.substring(normalizedRange.start.column, normalizedRange.end.column);
      } else if (lineNum === normalizedRange.start.line) {
        // First line of multi-line selection
        lineText = line.substring(normalizedRange.start.column);
      } else if (lineNum === normalizedRange.end.line) {
        // Last line of multi-line selection
        lineText = line.substring(0, normalizedRange.end.column);
      } else {
        // Middle line of multi-line selection
        lineText = line;
      }

      lines.push(lineText);
    }

    return lines.join('\n');
  }

  /**
   * Add selection to history
   */
  private addToHistory(
    range: TextRange,
    type: SelectionState['mode'],
    source: SelectionEvent['source'],
    duration: number
  ): void {
    const content = this.getSelectedContent(range);
    
    const entry: SelectionHistoryEntry = {
      id: this.generateHistoryId(),
      range,
      content,
      timestamp: Date.now(),
      source,
      type,
      duration
    };

    // Add to beginning of history
    this.selectionHistory.unshift(entry);

    // Trim to max size
    if (this.selectionHistory.length > this.config.maxHistoryEntries) {
      this.selectionHistory.splice(this.config.maxHistoryEntries);
    }

    // Update analytics
    this.updateAnalytics(entry);

    this.fireStateEvent('historyAdd', { entry });
  }

  /**
   * Generate history entry ID
   */
  private generateHistoryId(): string {
    return `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update analytics
   */
  private updateAnalytics(entry: SelectionHistoryEntry): void {
    if (!this.config.enableAnalytics) {
      return;
    }

    this.selectionAnalytics.totalSelections++;
    this.selectionAnalytics.totalCharactersSelected += entry.content.length;
    
    // Update average duration
    const totalDuration = this.selectionAnalytics.averageSelectionDuration * 
                         (this.selectionAnalytics.totalSelections - 1) + entry.duration;
    this.selectionAnalytics.averageSelectionDuration = 
      totalDuration / this.selectionAnalytics.totalSelections;

    // Update frequency by hour
    const hour = new Date(entry.timestamp).getHours().toString();
    this.selectionAnalytics.frequencyByHour[hour] = 
      (this.selectionAnalytics.frequencyByHour[hour] || 0) + 1;

    // Update common patterns (simple word extraction)
    const words = entry.content.toLowerCase().match(/\w+/g) || [];
    for (const word of words) {
      if (word.length > 2) { // Only track meaningful words
        const existing = this.selectionAnalytics.commonPatterns.find(p => p.pattern === word);
        if (existing) {
          existing.count++;
        } else {
          this.selectionAnalytics.commonPatterns.push({ pattern: word, count: 1 });
        }
      }
    }

    // Sort patterns by count and limit
    this.selectionAnalytics.commonPatterns.sort((a, b) => b.count - a.count);
    if (this.selectionAnalytics.commonPatterns.length > 50) {
      this.selectionAnalytics.commonPatterns.splice(50);
    }
  }

  /**
   * Start selection timeout
   */
  private startSelectionTimeout(): void {
    this.clearSelectionTimeout();
    
    this.selectionTimeoutTimer = setTimeout(() => {
      this.clearSelection();
    }, this.config.selectionTimeout);
  }

  /**
   * Clear selection timeout
   */
  private clearSelectionTimeout(): void {
    if (this.selectionTimeoutTimer) {
      clearTimeout(this.selectionTimeoutTimer);
      this.selectionTimeoutTimer = null;
    }
  }

  /**
   * Validate and clamp position to content bounds
   */
  private clampPosition(position: TextPosition): TextPosition {
    if (this.content.length === 0) {
      return { line: 0, column: 0 };
    }

    const clampedLine = Math.max(0, Math.min(position.line, this.content.length - 1));
    const lineLength = this.content[clampedLine]?.length || 0;
    const clampedColumn = Math.max(0, Math.min(position.column, lineLength));

    return { line: clampedLine, column: clampedColumn };
  }

  /**
   * Validate cursor position
   */
  private validateCursorPosition(): void {
    const validPosition = this.clampPosition(this.cursorState.position);
    if (validPosition.line !== this.cursorState.position.line || 
        validPosition.column !== this.cursorState.position.column) {
      this.setCursorPosition(validPosition);
    }
  }

  /**
   * Check if position is at end of line
   */
  private isAtEndOfLine(position: TextPosition): boolean {
    if (position.line >= this.content.length) {
      return true;
    }
    return position.column >= this.content[position.line].length;
  }

  /**
   * Check if range is valid
   */
  private isValidRange(range: TextRange): boolean {
    return this.isValidPosition(range.start) && this.isValidPosition(range.end);
  }

  /**
   * Check if position is valid
   */
  private isValidPosition(position: TextPosition): boolean {
    if (position.line < 0 || position.line >= this.content.length) {
      return false;
    }
    if (position.column < 0 || position.column > this.content[position.line].length) {
      return false;
    }
    return true;
  }

  /**
   * Normalize range to ensure start comes before end
   */
  private normalizeRange(range: TextRange): TextRange {
    const { start, end } = range;
    
    if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
      return { start: end, end: start };
    }
    
    return range;
  }

  /**
   * Save state to persistence
   */
  private async saveState(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    const persistenceData: SelectionPersistenceData = {
      currentSelection: this.currentSelection,
      cursorPosition: this.cursorState.position,
      history: this.selectionHistory.slice(0, 20), // Save only recent history
      lastUpdate: Date.now(),
      sessionId: this.sessionId
    };

    // Only save if state changed
    if (this.lastPersistenceData && 
        JSON.stringify(persistenceData) === JSON.stringify(this.lastPersistenceData)) {
      return;
    }

    try {
      // In a real implementation, this would write to file system
      // For now, we'll store in memory
      this.lastPersistenceData = persistenceData;
      
      this.fireStateEvent('persistenceSave', { data: persistenceData });
      
      if (this.config.debug) {
        console.debug(`[SelectionStateManager] Saved state to persistence`);
      }
    } catch (error) {
      if (this.config.debug) {
        console.error(`[SelectionStateManager] Failed to save state:`, error);
      }
    }
  }

  /**
   * Load persisted state
   */
  private async loadPersistedState(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      // In a real implementation, this would read from file system
      // For now, we'll check if we have stored data
      if (this.lastPersistenceData) {
        const data = this.lastPersistenceData;
        
        this.currentSelection = data.currentSelection;
        this.cursorState.position = data.cursorPosition;
        this.selectionHistory = data.history || [];
        
        if (this.config.debug) {
          console.debug(`[SelectionStateManager] Loaded state from persistence`);
        }
      }
    } catch (error) {
      if (this.config.debug) {
        console.error(`[SelectionStateManager] Failed to load state:`, error);
      }
    }
  }

  /**
   * Fire state event
   */
  private fireStateEvent(type: SelectionStateEvent['type'], data: any): void {
    const event: SelectionStateEvent = {
      type,
      timestamp: Date.now(),
      data
    };

    // Call appropriate handler
    switch (type) {
      case 'stateChange':
        this.eventHandlers.onStateChange?.(event);
        break;
      case 'cursorMove':
        this.eventHandlers.onCursorMove?.(event);
        break;
      case 'selectionStart':
        this.eventHandlers.onSelectionStart?.(event);
        break;
      case 'selectionEnd':
        this.eventHandlers.onSelectionEnd?.(event);
        break;
      case 'historyAdd':
        this.eventHandlers.onHistoryAdd?.(event);
        break;
      case 'persistenceSave':
        this.eventHandlers.onPersistenceSave?.(event);
        break;
    }
  }

  /**
   * Get current selection
   */
  getCurrentSelection(): TextRange | null {
    return this.currentSelection ? { ...this.currentSelection } : null;
  }

  /**
   * Get selection state
   */
  getSelectionState(): Readonly<SelectionState> {
    return { ...this.selectionState };
  }

  /**
   * Get selection history
   */
  getSelectionHistory(): SelectionHistoryEntry[] {
    return [...this.selectionHistory];
  }

  /**
   * Get selection analytics
   */
  getSelectionAnalytics(): Readonly<SelectionAnalytics> {
    return { ...this.selectionAnalytics };
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<SelectionStateEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelectionStateConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart timers if intervals changed
    if (config.autoSaveInterval !== undefined) {
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
      this.setupAutoSave();
    }
    
    if (config.cursorBlinkInterval !== undefined) {
      if (this.cursorBlinkTimer) {
        clearInterval(this.cursorBlinkTimer);
        this.cursorBlinkTimer = null;
      }
      this.setupCursorBlink();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SelectionStateConfig {
    return { ...this.config };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      sessionId: this.sessionId,
      currentSelection: this.currentSelection,
      selectionState: this.selectionState,
      cursorState: this.cursorState,
      historyCount: this.selectionHistory.length,
      analytics: this.selectionAnalytics,
      hasTimers: {
        autoSave: this.autoSaveTimer !== null,
        cursorBlink: this.cursorBlinkTimer !== null,
        selectionTimeout: this.selectionTimeoutTimer !== null
      },
      contentLineCount: this.content.length
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Save final state
    this.saveState();
    
    // Clear timers
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    if (this.cursorBlinkTimer) {
      clearInterval(this.cursorBlinkTimer);
      this.cursorBlinkTimer = null;
    }
    
    this.clearSelectionTimeout();
    
    // Clear state
    this.currentSelection = null;
    this.selectionHistory = [];
    this.eventHandlers = {};
    this.content = [];
  }
}