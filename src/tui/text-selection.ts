/**
 * Text Selection System
 * Character-level precision text selection with copy functionality and visual indicators
 */

/**
 * Text position in terminal coordinates
 */
export interface TextPosition {
  /** Line number (0-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
}

/**
 * Text range representing a selection
 */
export interface TextRange {
  /** Start position (inclusive) */
  start: TextPosition;
  /** End position (exclusive for character-level precision) */
  end: TextPosition;
}

/**
 * Selection state information
 */
export interface SelectionState {
  /** Whether selection is currently active */
  isActive: boolean;
  /** Whether selection is visible */
  isVisible: boolean;
  /** Start time of selection */
  startTime: number;
  /** Last update time */
  lastUpdate: number;
  /** Selection mode */
  mode: 'character' | 'word' | 'line';
}

/**
 * Selection metrics for analysis
 */
export interface SelectionMetrics {
  /** Number of characters selected */
  characterCount: number;
  /** Number of lines spanned */
  lineCount: number;
  /** Number of words selected */
  wordCount: number;
  /** Selection area bounds */
  bounds: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
  };
}

/**
 * Selection event information
 */
export interface SelectionEvent {
  /** Event type */
  type: 'start' | 'update' | 'end' | 'clear' | 'expand';
  /** Current selection range */
  range: TextRange | null;
  /** Selection metrics */
  metrics: SelectionMetrics | null;
  /** Timestamp */
  timestamp: number;
  /** Event source */
  source: 'mouse' | 'keyboard' | 'api';
}

/**
 * Selection configuration options
 */
export interface SelectionConfig {
  /** Enable text selection */
  enabled: boolean;
  /** Show visual selection indicators */
  showVisualIndicators: boolean;
  /** Allow word-level selection */
  allowWordSelection: boolean;
  /** Allow line-level selection */
  allowLineSelection: boolean;
  /** Enable copy to clipboard */
  enableClipboard: boolean;
  /** Selection timeout (0 = no timeout) */
  selectionTimeout: number;
  /** Debug selection events */
  debug: boolean;
}

/**
 * Default selection configuration
 */
const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  enabled: true,
  showVisualIndicators: true,
  allowWordSelection: true,
  allowLineSelection: true,
  enableClipboard: true,
  selectionTimeout: 0,
  debug: false
};

/**
 * Selection event handler types
 */
export type SelectionEventHandler = (event: SelectionEvent) => void | Promise<void>;

export interface SelectionEventHandlers {
  onSelectionStart?: SelectionEventHandler;
  onSelectionUpdate?: SelectionEventHandler;
  onSelectionEnd?: SelectionEventHandler;
  onSelectionClear?: SelectionEventHandler;
  onSelectionExpand?: SelectionEventHandler;
}

/**
 * Range validation utilities
 */
export class RangeValidator {
  /**
   * Check if position is valid within content bounds
   */
  static isValidPosition(position: TextPosition, content: string[]): boolean {
    if (position.line < 0 || position.line >= content.length) {
      return false;
    }
    
    if (position.column < 0 || position.column > content[position.line].length) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if range is valid within content bounds
   */
  static isValidRange(range: TextRange, content: string[]): boolean {
    return this.isValidPosition(range.start, content) && 
           this.isValidPosition(range.end, content);
  }

  /**
   * Clamp position to valid bounds
   */
  static clampPosition(position: TextPosition, content: string[]): TextPosition {
    if (content.length === 0) {
      return { line: 0, column: 0 };
    }

    const clampedLine = Math.max(0, Math.min(position.line, content.length - 1));
    const clampedColumn = Math.max(0, Math.min(position.column, content[clampedLine].length));
    
    return {
      line: clampedLine,
      column: clampedColumn
    };
  }

  /**
   * Normalize range to ensure start comes before end
   */
  static normalizeRange(range: TextRange): TextRange {
    const { start, end } = range;
    
    if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
      return { start: end, end: start };
    }
    
    return range;
  }

  /**
   * Check if two positions are equal
   */
  static isPositionEqual(pos1: TextPosition, pos2: TextPosition): boolean {
    return pos1.line === pos2.line && pos1.column === pos2.column;
  }

  /**
   * Check if two ranges are equal
   */
  static isRangeEqual(range1: TextRange, range2: TextRange): boolean {
    return this.isPositionEqual(range1.start, range2.start) && 
           this.isPositionEqual(range1.end, range2.end);
  }

  /**
   * Calculate distance between two positions
   */
  static calculateDistance(pos1: TextPosition, pos2: TextPosition): number {
    const lineDiff = Math.abs(pos2.line - pos1.line);
    const colDiff = Math.abs(pos2.column - pos1.column);
    return Math.sqrt(lineDiff * lineDiff + colDiff * colDiff);
  }
}

/**
 * Selection algorithms for text manipulation
 */
export class SelectionAlgorithms {
  /**
   * Expand selection to word boundaries
   */
  static expandToWord(position: TextPosition, content: string[]): TextRange {
    if (!RangeValidator.isValidPosition(position, content)) {
      return { start: position, end: position };
    }

    const line = content[position.line];
    const char = line[position.column];

    // If not on a word character, return single character selection
    if (!char || !/\w/.test(char)) {
      return { 
        start: position, 
        end: { line: position.line, column: position.column + 1 }
      };
    }

    // Find word boundaries
    let start = position.column;
    let end = position.column;

    // Expand backward to start of word
    while (start > 0 && /\w/.test(line[start - 1])) {
      start--;
    }

    // Expand forward to end of word
    while (end < line.length && /\w/.test(line[end])) {
      end++;
    }

    return {
      start: { line: position.line, column: start },
      end: { line: position.line, column: end }
    };
  }

  /**
   * Expand selection to line boundaries
   */
  static expandToLine(position: TextPosition, content: string[]): TextRange {
    if (!RangeValidator.isValidPosition(position, content)) {
      return { start: position, end: position };
    }

    return {
      start: { line: position.line, column: 0 },
      end: { line: position.line + 1, column: 0 }
    };
  }

  /**
   * Find next word position
   */
  static findNextWord(position: TextPosition, content: string[]): TextPosition {
    if (!RangeValidator.isValidPosition(position, content)) {
      return position;
    }

    let { line, column } = position;

    // Skip current word
    while (line < content.length && column < content[line].length && /\w/.test(content[line][column])) {
      column++;
    }

    // Skip whitespace
    while (line < content.length) {
      while (column < content[line].length && /\s/.test(content[line][column])) {
        column++;
      }

      if (column < content[line].length) {
        break; // Found next word
      }

      // Move to next line
      line++;
      column = 0;
    }

    return RangeValidator.clampPosition({ line, column }, content);
  }

  /**
   * Find previous word position
   */
  static findPreviousWord(position: TextPosition, content: string[]): TextPosition {
    if (!RangeValidator.isValidPosition(position, content)) {
      return position;
    }

    let { line, column } = position;

    // Move back one position to start search
    if (column > 0) {
      column--;
    } else if (line > 0) {
      line--;
      column = content[line].length - 1;
    } else {
      return position; // Already at start
    }

    // Skip whitespace
    while (line >= 0) {
      while (column >= 0 && /\s/.test(content[line][column])) {
        column--;
      }

      if (column >= 0) {
        break; // Found word
      }

      // Move to previous line
      line--;
      if (line >= 0) {
        column = content[line].length - 1;
      }
    }

    if (line < 0) {
      return { line: 0, column: 0 };
    }

    // Find start of word
    while (column > 0 && /\w/.test(content[line][column - 1])) {
      column--;
    }

    return { line, column };
  }

  /**
   * Get all lines affected by a selection range
   */
  static getAffectedLines(range: TextRange): number[] {
    const normalized = RangeValidator.normalizeRange(range);
    const lines: number[] = [];
    
    for (let line = normalized.start.line; line <= normalized.end.line; line++) {
      lines.push(line);
    }
    
    return lines;
  }

  /**
   * Check if position is within range
   */
  static isPositionInRange(position: TextPosition, range: TextRange): boolean {
    const normalized = RangeValidator.normalizeRange(range);
    
    if (position.line < normalized.start.line || position.line > normalized.end.line) {
      return false;
    }
    
    if (position.line === normalized.start.line && position.column < normalized.start.column) {
      return false;
    }
    
    if (position.line === normalized.end.line && position.column >= normalized.end.column) {
      return false;
    }
    
    return true;
  }
}

/**
 * Main TextSelection class
 * Handles character-level precision text selection with copy functionality
 */
export class TextSelection {
  private config: SelectionConfig;
  private content: string[] = [];
  private currentRange: TextRange | null = null;
  private selectionState: SelectionState;
  private eventHandlers: SelectionEventHandlers = {};
  private selectionTimeout: NodeJS.Timeout | null = null;

  constructor(content: string[] = [], config: Partial<SelectionConfig> = {}) {
    this.config = { ...DEFAULT_SELECTION_CONFIG, ...config };
    this.content = [...content];
    this.selectionState = this.createInitialState();
  }

  /**
   * Create initial selection state
   */
  private createInitialState(): SelectionState {
    return {
      isActive: false,
      isVisible: false,
      startTime: 0,
      lastUpdate: 0,
      mode: 'character'
    };
  }

  /**
   * Update content for selection
   */
  updateContent(content: string[]): void {
    this.content = [...content];
    
    // Validate current selection against new content
    if (this.currentRange && !RangeValidator.isValidRange(this.currentRange, this.content)) {
      this.clearSelection();
    }
  }

  /**
   * Start text selection at position
   */
  startSelection(position: TextPosition, mode: SelectionState['mode'] = 'character', source: SelectionEvent['source'] = 'mouse'): void {
    if (!this.config.enabled) {
      return;
    }

    // Validate and clamp position
    const clampedPosition = RangeValidator.clampPosition(position, this.content);
    
    // Set initial range based on mode
    let initialRange: TextRange;
    switch (mode) {
      case 'word':
        if (this.config.allowWordSelection) {
          initialRange = SelectionAlgorithms.expandToWord(clampedPosition, this.content);
        } else {
          initialRange = { start: clampedPosition, end: clampedPosition };
        }
        break;
      case 'line':
        if (this.config.allowLineSelection) {
          initialRange = SelectionAlgorithms.expandToLine(clampedPosition, this.content);
        } else {
          initialRange = { start: clampedPosition, end: clampedPosition };
        }
        break;
      default:
        initialRange = { start: clampedPosition, end: clampedPosition };
    }

    this.currentRange = initialRange;
    this.selectionState = {
      isActive: true,
      isVisible: this.config.showVisualIndicators,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      mode
    };

    // Clear any existing timeout
    this.clearSelectionTimeout();

    // Set new timeout if configured
    if (this.config.selectionTimeout > 0) {
      this.selectionTimeout = setTimeout(() => {
        this.clearSelection();
      }, this.config.selectionTimeout);
    }

    // Fire selection start event
    this.fireSelectionEvent('start', source);

    if (this.config.debug) {
      console.debug(`[TextSelection] Started ${mode} selection at (${clampedPosition.line}, ${clampedPosition.column})`);
    }
  }

  /**
   * Update selection to new position
   */
  updateSelection(position: TextPosition, source: SelectionEvent['source'] = 'mouse'): void {
    if (!this.config.enabled || !this.selectionState.isActive || !this.currentRange) {
      return;
    }

    // Validate and clamp position
    const clampedPosition = RangeValidator.clampPosition(position, this.content);
    
    // Update range based on selection mode
    let newRange: TextRange;
    switch (this.selectionState.mode) {
      case 'word':
        const wordRange = SelectionAlgorithms.expandToWord(clampedPosition, this.content);
        newRange = {
          start: this.currentRange.start,
          end: wordRange.end
        };
        break;
      case 'line':
        const lineRange = SelectionAlgorithms.expandToLine(clampedPosition, this.content);
        newRange = {
          start: this.currentRange.start,
          end: lineRange.end
        };
        break;
      default:
        newRange = {
          start: this.currentRange.start,
          end: clampedPosition
        };
    }

    // Only update if range actually changed
    if (!RangeValidator.isRangeEqual(this.currentRange, newRange)) {
      this.currentRange = newRange;
      this.selectionState.lastUpdate = Date.now();

      // Fire selection update event
      this.fireSelectionEvent('update', source);

      if (this.config.debug) {
        const metrics = this.getSelectionMetrics();
        console.debug(`[TextSelection] Updated selection: ${metrics?.characterCount} chars, ${metrics?.lineCount} lines`);
      }
    }
  }

  /**
   * End selection and finalize range
   */
  endSelection(source: SelectionEvent['source'] = 'mouse'): TextRange | null {
    if (!this.config.enabled || !this.selectionState.isActive) {
      return null;
    }

    const finalRange = this.currentRange;
    this.selectionState.isActive = false;
    this.clearSelectionTimeout();

    // Fire selection end event
    this.fireSelectionEvent('end', source);

    if (this.config.debug && finalRange) {
      const text = this.getSelectedText();
      console.debug(`[TextSelection] Ended selection: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }

    return finalRange;
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    if (!this.currentRange && !this.selectionState.isActive) {
      return;
    }

    this.currentRange = null;
    this.selectionState = this.createInitialState();
    this.clearSelectionTimeout();

    // Fire selection clear event
    this.fireSelectionEvent('clear', 'api');

    if (this.config.debug) {
      console.debug(`[TextSelection] Cleared selection`);
    }
  }

  /**
   * Expand current selection using algorithms
   */
  expandSelection(mode: 'word' | 'line', source: SelectionEvent['source'] = 'keyboard'): void {
    if (!this.config.enabled || !this.currentRange) {
      return;
    }

    let expandedRange: TextRange;
    const normalized = RangeValidator.normalizeRange(this.currentRange);

    switch (mode) {
      case 'word':
        if (!this.config.allowWordSelection) return;
        const startWordRange = SelectionAlgorithms.expandToWord(normalized.start, this.content);
        const endWordRange = SelectionAlgorithms.expandToWord(normalized.end, this.content);
        expandedRange = {
          start: startWordRange.start,
          end: endWordRange.end
        };
        break;
      case 'line':
        if (!this.config.allowLineSelection) return;
        const startLineRange = SelectionAlgorithms.expandToLine(normalized.start, this.content);
        const endLineRange = SelectionAlgorithms.expandToLine(normalized.end, this.content);
        expandedRange = {
          start: startLineRange.start,
          end: { line: normalized.end.line, column: this.content[normalized.end.line]?.length || 0 }
        };
        break;
      default:
        return;
    }

    this.currentRange = expandedRange;
    this.selectionState.mode = mode;
    this.selectionState.lastUpdate = Date.now();

    // Fire selection expand event
    this.fireSelectionEvent('expand', source);

    if (this.config.debug) {
      console.debug(`[TextSelection] Expanded selection to ${mode} boundaries`);
    }
  }

  /**
   * Get current selection range
   */
  getSelection(): TextRange | null {
    return this.currentRange ? { ...this.currentRange } : null;
  }

  /**
   * Get selected text content
   */
  getSelectedText(): string {
    if (!this.currentRange) {
      return '';
    }

    return this.extractTextFromRange(this.currentRange);
  }

  /**
   * Extract text from range
   */
  private extractTextFromRange(range: TextRange): string {
    const normalized = RangeValidator.normalizeRange(range);
    const lines: string[] = [];

    for (let lineNum = normalized.start.line; lineNum <= normalized.end.line; lineNum++) {
      if (lineNum >= this.content.length) break;

      const line = this.content[lineNum];
      let lineText = '';

      if (normalized.start.line === normalized.end.line) {
        // Single line selection
        lineText = line.substring(normalized.start.column, normalized.end.column);
      } else if (lineNum === normalized.start.line) {
        // First line of multi-line selection
        lineText = line.substring(normalized.start.column);
      } else if (lineNum === normalized.end.line) {
        // Last line of multi-line selection
        lineText = line.substring(0, normalized.end.column);
      } else {
        // Middle line of multi-line selection
        lineText = line;
      }

      lines.push(lineText);
    }

    return lines.join('\n');
  }

  /**
   * Get selection metrics
   */
  getSelectionMetrics(): SelectionMetrics | null {
    if (!this.currentRange) {
      return null;
    }

    const text = this.getSelectedText();
    const normalized = RangeValidator.normalizeRange(this.currentRange);
    
    return {
      characterCount: text.length,
      lineCount: normalized.end.line - normalized.start.line + 1,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      bounds: this.calculateSelectionBounds(normalized)
    };
  }

  /**
   * Calculate selection visual bounds
   */
  private calculateSelectionBounds(range: TextRange): SelectionMetrics['bounds'] {
    const normalized = RangeValidator.normalizeRange(range);
    
    return {
      startX: normalized.start.column,
      startY: normalized.start.line,
      endX: normalized.end.column,
      endY: normalized.end.line,
      width: normalized.end.line === normalized.start.line ? 
             normalized.end.column - normalized.start.column : -1,
      height: normalized.end.line - normalized.start.line + 1
    };
  }

  /**
   * Check if selection is active
   */
  isSelectionActive(): boolean {
    return this.selectionState.isActive;
  }

  /**
   * Check if selection is visible
   */
  isSelectionVisible(): boolean {
    return this.selectionState.isVisible && this.config.showVisualIndicators;
  }

  /**
   * Get current selection state
   */
  getSelectionState(): Readonly<SelectionState> {
    return { ...this.selectionState };
  }

  /**
   * Check if position is within current selection
   */
  isPositionSelected(position: TextPosition): boolean {
    if (!this.currentRange) {
      return false;
    }

    return SelectionAlgorithms.isPositionInRange(position, this.currentRange);
  }

  /**
   * Get lines affected by current selection
   */
  getAffectedLines(): number[] {
    if (!this.currentRange) {
      return [];
    }

    return SelectionAlgorithms.getAffectedLines(this.currentRange);
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<SelectionEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelectionConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update visual indicators if changed
    if (this.selectionState.isActive) {
      this.selectionState.isVisible = this.config.showVisualIndicators;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SelectionConfig {
    return { ...this.config };
  }

  /**
   * Fire selection event
   */
  private fireSelectionEvent(type: SelectionEvent['type'], source: SelectionEvent['source']): void {
    const event: SelectionEvent = {
      type,
      range: this.currentRange ? { ...this.currentRange } : null,
      metrics: this.getSelectionMetrics(),
      timestamp: Date.now(),
      source
    };

    // Call appropriate handler
    switch (type) {
      case 'start':
        this.eventHandlers.onSelectionStart?.(event);
        break;
      case 'update':
        this.eventHandlers.onSelectionUpdate?.(event);
        break;
      case 'end':
        this.eventHandlers.onSelectionEnd?.(event);
        break;
      case 'clear':
        this.eventHandlers.onSelectionClear?.(event);
        break;
      case 'expand':
        this.eventHandlers.onSelectionExpand?.(event);
        break;
    }
  }

  /**
   * Clear selection timeout
   */
  private clearSelectionTimeout(): void {
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
      this.selectionTimeout = null;
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      selectionState: this.selectionState,
      currentRange: this.currentRange,
      contentLineCount: this.content.length,
      hasTimeout: this.selectionTimeout !== null,
      eventHandlers: Object.keys(this.eventHandlers)
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearSelection();
    this.eventHandlers = {};
    this.content = [];
  }
}