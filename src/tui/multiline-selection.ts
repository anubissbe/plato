/**
 * Multi-line Selection Handler
 * Handles complex multi-line text selection with proper line wrapping logic
 */

import { TextPosition, TextRange } from './text-selection.js';

/**
 * Line wrapping configuration
 */
export interface LineWrapConfig {
  /** Terminal width for line wrapping */
  terminalWidth: number;
  /** Enable word wrapping */
  enableWordWrap: boolean;
  /** Wrap at character boundaries when word wrap fails */
  fallbackToCharWrap: boolean;
  /** Preserve indentation on wrapped lines */
  preserveIndentation: boolean;
  /** Indent wrapped lines by this amount */
  wrapIndent: number;
  /** Break long words that exceed line width */
  breakLongWords: boolean;
  /** Minimum word length to break */
  minWordBreakLength: number;
}

/**
 * Wrapped line information
 */
export interface WrappedLine {
  /** Original line number */
  originalLine: number;
  /** Wrapped line segment number (0-based) */
  segmentIndex: number;
  /** Start column in original line */
  startColumn: number;
  /** End column in original line */
  endColumn: number;
  /** Wrapped line content */
  content: string;
  /** Whether this segment is the last for the original line */
  isLastSegment: boolean;
  /** Indentation applied to this segment */
  indentation: string;
  /** Total wrapped lines for this original line */
  totalSegments: number;
}

/**
 * Selection span across wrapped lines
 */
export interface SelectionSpan {
  /** Start position in wrapped coordinates */
  wrappedStart: { wrappedLine: number; column: number };
  /** End position in wrapped coordinates */
  wrappedEnd: { wrappedLine: number; column: number };
  /** Original text coordinates */
  originalStart: TextPosition;
  /** Original text coordinates */
  originalEnd: TextPosition;
  /** All wrapped line segments affected */
  affectedSegments: WrappedLine[];
  /** Total character count */
  characterCount: number;
  /** Total wrapped lines spanned */
  wrappedLineCount: number;
}

/**
 * Line wrapping result
 */
export interface LineWrapResult {
  /** Wrapped line segments */
  wrappedLines: WrappedLine[];
  /** Mapping from original line to wrapped lines */
  lineMapping: Map<number, WrappedLine[]>;
  /** Total wrapped line count */
  totalWrappedLines: number;
  /** Original to wrapped position mapping */
  positionMapping: Map<string, { wrappedLine: number; column: number }>;
}

/**
 * Multi-line selection context
 */
export interface MultilineSelectionContext {
  /** Original content lines */
  originalContent: string[];
  /** Line wrapping configuration */
  wrapConfig: LineWrapConfig;
  /** Selection range in original coordinates */
  selection: TextRange;
  /** Viewport information */
  viewport?: {
    scrollTop: number;
    scrollLeft: number;
    visibleHeight: number;
    visibleWidth: number;
  };
}

/**
 * Default line wrap configuration
 */
const DEFAULT_WRAP_CONFIG: LineWrapConfig = {
  terminalWidth: 80,
  enableWordWrap: true,
  fallbackToCharWrap: true,
  preserveIndentation: true,
  wrapIndent: 2,
  breakLongWords: true,
  minWordBreakLength: 20
};

/**
 * Line Wrapping Engine
 * Handles complex line wrapping with various strategies
 */
export class LineWrapEngine {
  /**
   * Wrap content lines according to configuration
   */
  static wrapContent(content: string[], config: LineWrapConfig): LineWrapResult {
    const wrappedLines: WrappedLine[] = [];
    const lineMapping = new Map<number, WrappedLine[]>();
    const positionMapping = new Map<string, { wrappedLine: number; column: number }>();
    
    let currentWrappedLine = 0;

    for (let originalLine = 0; originalLine < content.length; originalLine++) {
      const line = content[originalLine];
      const segments = this.wrapLine(line, originalLine, config);
      
      // Add segments to wrapped lines
      for (const segment of segments) {
        wrappedLines.push(segment);
        
        // Update position mapping
        for (let col = segment.startColumn; col <= segment.endColumn; col++) {
          const key = `${originalLine},${col}`;
          positionMapping.set(key, {
            wrappedLine: currentWrappedLine,
            column: col - segment.startColumn + segment.indentation.length
          });
        }
        
        currentWrappedLine++;
      }
      
      lineMapping.set(originalLine, segments);
    }

    return {
      wrappedLines,
      lineMapping,
      totalWrappedLines: currentWrappedLine,
      positionMapping
    };
  }

  /**
   * Wrap a single line into segments
   */
  private static wrapLine(line: string, originalLine: number, config: LineWrapConfig): WrappedLine[] {
    if (line.length <= config.terminalWidth) {
      // Line fits in terminal width
      return [{
        originalLine,
        segmentIndex: 0,
        startColumn: 0,
        endColumn: line.length,
        content: line,
        isLastSegment: true,
        indentation: '',
        totalSegments: 1
      }];
    }

    const segments: WrappedLine[] = [];
    const indentation = this.extractIndentation(line);
    const effectiveWidth = config.terminalWidth - (config.preserveIndentation ? config.wrapIndent : 0);
    
    let remainingLine = line;
    let startColumn = 0;
    let segmentIndex = 0;

    while (remainingLine.length > 0) {
      const isFirstSegment = segmentIndex === 0;
      const currentWidth = isFirstSegment ? config.terminalWidth : effectiveWidth;
      const currentIndent = (!isFirstSegment && config.preserveIndentation) ? 
        ' '.repeat(config.wrapIndent) : 
        (isFirstSegment ? indentation : '');

      let segmentContent: string;
      let segmentLength: number;

      if (remainingLine.length <= currentWidth - currentIndent.length) {
        // Remaining content fits
        segmentContent = remainingLine;
        segmentLength = remainingLine.length;
        remainingLine = '';
      } else {
        // Need to wrap
        const result = this.findWrapPoint(
          remainingLine, 
          currentWidth - currentIndent.length, 
          config
        );
        
        segmentContent = remainingLine.substring(0, result.breakPoint);
        segmentLength = result.breakPoint;
        remainingLine = remainingLine.substring(result.breakPoint);
      }

      segments.push({
        originalLine,
        segmentIndex,
        startColumn,
        endColumn: startColumn + segmentLength,
        content: currentIndent + segmentContent,
        isLastSegment: remainingLine.length === 0,
        indentation: currentIndent,
        totalSegments: 0 // Will be set after all segments are processed
      });

      startColumn += segmentLength;
      segmentIndex++;
    }

    // Set total segments for all segments
    segments.forEach(segment => {
      segment.totalSegments = segments.length;
    });

    return segments;
  }

  /**
   * Find the best point to wrap a line
   */
  private static findWrapPoint(
    line: string, 
    maxWidth: number, 
    config: LineWrapConfig
  ): { breakPoint: number; type: 'word' | 'char' | 'hyphen' } {
    if (line.length <= maxWidth) {
      return { breakPoint: line.length, type: 'word' };
    }

    if (config.enableWordWrap) {
      // Try word wrapping first
      const wordBreak = this.findWordWrapPoint(line, maxWidth);
      if (wordBreak > 0) {
        return { breakPoint: wordBreak, type: 'word' };
      }

      // Try hyphenating long words
      if (config.breakLongWords) {
        const hyphenBreak = this.findHyphenationPoint(line, maxWidth, config.minWordBreakLength);
        if (hyphenBreak > 0) {
          return { breakPoint: hyphenBreak, type: 'hyphen' };
        }
      }
    }

    if (config.fallbackToCharWrap) {
      // Fallback to character wrapping
      return { breakPoint: maxWidth, type: 'char' };
    }

    // Force break at width
    return { breakPoint: maxWidth, type: 'char' };
  }

  /**
   * Find word boundary for wrapping
   */
  private static findWordWrapPoint(line: string, maxWidth: number): number {
    // Look for the last space within maxWidth
    for (let i = Math.min(maxWidth - 1, line.length - 1); i >= 0; i--) {
      if (/\s/.test(line[i])) {
        // Skip the space character
        return i + 1;
      }
    }
    
    return 0; // No suitable word boundary found
  }

  /**
   * Find hyphenation point for long words
   */
  private static findHyphenationPoint(line: string, maxWidth: number, minWordLength: number): number {
    // Simple hyphenation: break at maxWidth - 1 and add hyphen
    const breakPoint = maxWidth - 1;
    
    // Check if we're in the middle of a long word
    const beforeBreak = line.substring(0, breakPoint);
    const atBreak = line[breakPoint];
    
    // Only hyphenate if we're breaking a word longer than minWordLength
    if (atBreak && /\w/.test(atBreak) && beforeBreak.length >= minWordLength) {
      // Check if this is part of a continuous word
      const wordStart = beforeBreak.search(/\w+$/);
      if (wordStart >= 0 && beforeBreak.length - wordStart >= minWordLength) {
        return breakPoint;
      }
    }
    
    return 0; // No suitable hyphenation point
  }

  /**
   * Extract indentation from line
   */
  private static extractIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  /**
   * Convert original position to wrapped coordinates
   */
  static originalToWrapped(
    position: TextPosition, 
    wrapResult: LineWrapResult
  ): { wrappedLine: number; column: number } | null {
    const key = `${position.line},${position.column}`;
    return wrapResult.positionMapping.get(key) || null;
  }

  /**
   * Convert wrapped position to original coordinates
   */
  static wrappedToOriginal(
    wrappedLine: number, 
    column: number, 
    wrapResult: LineWrapResult
  ): TextPosition | null {
    if (wrappedLine >= wrapResult.wrappedLines.length) {
      return null;
    }

    const segment = wrapResult.wrappedLines[wrappedLine];
    const adjustedColumn = column - segment.indentation.length;
    
    if (adjustedColumn < 0 || adjustedColumn > segment.endColumn - segment.startColumn) {
      return null;
    }

    return {
      line: segment.originalLine,
      column: segment.startColumn + adjustedColumn
    };
  }
}

/**
 * Multi-line Selection Handler
 * Manages complex multi-line selections with line wrapping
 */
export class MultilineSelectionHandler {
  private wrapConfig: LineWrapConfig;
  private currentWrapResult: LineWrapResult | null = null;

  constructor(config: Partial<LineWrapConfig> = {}) {
    this.wrapConfig = { ...DEFAULT_WRAP_CONFIG, ...config };
  }

  /**
   * Update line wrap configuration
   */
  updateWrapConfig(config: Partial<LineWrapConfig>): void {
    this.wrapConfig = { ...this.wrapConfig, ...config };
    this.currentWrapResult = null; // Force re-wrap
  }

  /**
   * Process multi-line selection with line wrapping
   */
  processMultilineSelection(context: MultilineSelectionContext): SelectionSpan {
    // Update wrap result if needed
    if (!this.currentWrapResult) {
      this.currentWrapResult = LineWrapEngine.wrapContent(
        context.originalContent, 
        context.wrapConfig
      );
    }

    // Convert original selection to wrapped coordinates
    const wrappedStart = LineWrapEngine.originalToWrapped(
      context.selection.start, 
      this.currentWrapResult
    );
    
    const wrappedEnd = LineWrapEngine.originalToWrapped(
      context.selection.end, 
      this.currentWrapResult
    );

    if (!wrappedStart || !wrappedEnd) {
      throw new Error('Invalid selection range for wrapped content');
    }

    // Find affected segments
    const affectedSegments = this.findAffectedSegments(
      wrappedStart.wrappedLine,
      wrappedEnd.wrappedLine,
      this.currentWrapResult
    );

    // Calculate character count
    const characterCount = this.calculateSelectionCharacterCount(
      context.selection,
      context.originalContent
    );

    return {
      wrappedStart,
      wrappedEnd,
      originalStart: context.selection.start,
      originalEnd: context.selection.end,
      affectedSegments,
      characterCount,
      wrappedLineCount: wrappedEnd.wrappedLine - wrappedStart.wrappedLine + 1
    };
  }

  /**
   * Find segments affected by selection
   */
  private findAffectedSegments(
    startWrappedLine: number, 
    endWrappedLine: number, 
    wrapResult: LineWrapResult
  ): WrappedLine[] {
    const segments: WrappedLine[] = [];
    
    for (let line = startWrappedLine; line <= endWrappedLine; line++) {
      if (line < wrapResult.wrappedLines.length) {
        segments.push(wrapResult.wrappedLines[line]);
      }
    }
    
    return segments;
  }

  /**
   * Calculate character count for selection
   */
  private calculateSelectionCharacterCount(selection: TextRange, content: string[]): number {
    const normalizedRange = this.normalizeRange(selection);
    let count = 0;

    for (let line = normalizedRange.start.line; line <= normalizedRange.end.line; line++) {
      if (line >= content.length) break;

      const lineContent = content[line];
      let startCol, endCol;

      if (normalizedRange.start.line === normalizedRange.end.line) {
        // Single line
        startCol = normalizedRange.start.column;
        endCol = normalizedRange.end.column;
      } else if (line === normalizedRange.start.line) {
        // First line
        startCol = normalizedRange.start.column;
        endCol = lineContent.length;
        count += 1; // Add newline
      } else if (line === normalizedRange.end.line) {
        // Last line
        startCol = 0;
        endCol = normalizedRange.end.column;
      } else {
        // Middle line
        startCol = 0;
        endCol = lineContent.length;
        count += 1; // Add newline
      }

      count += Math.max(0, endCol - startCol);
    }

    return count;
  }

  /**
   * Extract selected content with proper line handling
   */
  extractSelectedContent(context: MultilineSelectionContext): string {
    const normalizedRange = this.normalizeRange(context.selection);
    const lines: string[] = [];

    for (let line = normalizedRange.start.line; line <= normalizedRange.end.line; line++) {
      if (line >= context.originalContent.length) break;

      const lineContent = context.originalContent[line];
      let startCol, endCol;

      if (normalizedRange.start.line === normalizedRange.end.line) {
        // Single line selection
        startCol = normalizedRange.start.column;
        endCol = normalizedRange.end.column;
      } else if (line === normalizedRange.start.line) {
        // First line of multi-line selection
        startCol = normalizedRange.start.column;
        endCol = lineContent.length;
      } else if (line === normalizedRange.end.line) {
        // Last line of multi-line selection
        startCol = 0;
        endCol = normalizedRange.end.column;
      } else {
        // Middle line of multi-line selection
        startCol = 0;
        endCol = lineContent.length;
      }

      const segmentText = lineContent.substring(startCol, endCol);
      lines.push(segmentText);
    }

    return lines.join('\n');
  }

  /**
   * Get wrapped line coordinates for original position
   */
  getWrappedCoordinates(
    originalPosition: TextPosition,
    content: string[]
  ): { wrappedLine: number; column: number } | null {
    if (!this.currentWrapResult) {
      this.currentWrapResult = LineWrapEngine.wrapContent(content, this.wrapConfig);
    }

    return LineWrapEngine.originalToWrapped(originalPosition, this.currentWrapResult);
  }

  /**
   * Get original coordinates from wrapped position
   */
  getOriginalCoordinates(
    wrappedLine: number,
    column: number,
    content: string[]
  ): TextPosition | null {
    if (!this.currentWrapResult) {
      this.currentWrapResult = LineWrapEngine.wrapContent(content, this.wrapConfig);
    }

    return LineWrapEngine.wrappedToOriginal(
      wrappedLine, 
      column, 
      this.currentWrapResult
    );
  }

  /**
   * Check if selection spans multiple visual lines (accounting for wrapping)
   */
  isMultilineVisual(selection: TextRange, content: string[]): boolean {
    const span = this.processMultilineSelection({
      originalContent: content,
      wrapConfig: this.wrapConfig,
      selection
    });

    return span.wrappedLineCount > 1;
  }

  /**
   * Get selection boundaries in wrapped coordinates
   */
  getWrappedSelectionBounds(
    selection: TextRange,
    content: string[]
  ): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    const span = this.processMultilineSelection({
      originalContent: content,
      wrapConfig: this.wrapConfig,
      selection
    });

    return {
      startLine: span.wrappedStart.wrappedLine,
      endLine: span.wrappedEnd.wrappedLine,
      startColumn: span.wrappedStart.column,
      endColumn: span.wrappedEnd.column
    };
  }

  /**
   * Split selection into line segments for rendering
   */
  getSelectionSegments(
    selection: TextRange,
    content: string[]
  ): Array<{
    wrappedLine: number;
    startColumn: number;
    endColumn: number;
    originalLine: number;
    content: string;
  }> {
    const span = this.processMultilineSelection({
      originalContent: content,
      wrapConfig: this.wrapConfig,
      selection
    });

    return span.affectedSegments.map((segment, index) => {
      const isFirst = index === 0;
      const isLast = index === span.affectedSegments.length - 1;
      
      let startCol = 0;
      let endCol = segment.content.length;
      
      if (isFirst) {
        startCol = span.wrappedStart.column;
      }
      
      if (isLast) {
        endCol = span.wrappedEnd.column;
      }

      return {
        wrappedLine: span.wrappedStart.wrappedLine + index,
        startColumn: startCol,
        endColumn: endCol,
        originalLine: segment.originalLine,
        content: segment.content.substring(startCol, endCol)
      };
    });
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
   * Get current wrap result
   */
  getCurrentWrapResult(): LineWrapResult | null {
    return this.currentWrapResult;
  }

  /**
   * Force re-wrap content
   */
  invalidateWrapCache(): void {
    this.currentWrapResult = null;
  }

  /**
   * Get configuration
   */
  getWrapConfig(): LineWrapConfig {
    return { ...this.wrapConfig };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      wrapConfig: this.wrapConfig,
      hasWrapResult: this.currentWrapResult !== null,
      totalWrappedLines: this.currentWrapResult?.totalWrappedLines || 0,
      lineMappingSize: this.currentWrapResult?.lineMapping.size || 0
    };
  }
}