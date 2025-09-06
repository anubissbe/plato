/**
 * Selection Visual Renderer
 * Renders text selection with background highlighting using ANSI escape sequences
 */

import { TextRange, TextPosition, SelectionMetrics } from './text-selection.js';
import { RangeValidator } from './text-selection.js';

/**
 * Selection visual style configuration
 */
export interface SelectionStyle {
  /** Background color (ANSI color code or hex) */
  backgroundColor: string;
  /** Foreground color (ANSI color code or hex) */
  foregroundColor: string;
  /** Whether to invert colors */
  invert: boolean;
  /** Text decoration */
  textDecoration: 'none' | 'underline' | 'bold' | 'dim';
  /** Selection opacity/intensity */
  intensity: 'subtle' | 'normal' | 'strong';
  /** Animation type for active selections */
  animation: 'none' | 'blink' | 'pulse' | 'fade';
}

/**
 * Rendered selection segment
 */
export interface SelectionSegment {
  /** Line number */
  line: number;
  /** Start column */
  startColumn: number;
  /** End column */
  endColumn: number;
  /** Original text content */
  originalText: string;
  /** Rendered text with ANSI codes */
  renderedText: string;
  /** Start ANSI sequence */
  startSequence: string;
  /** End ANSI sequence */
  endSequence: string;
}

/**
 * Selection rendering context
 */
export interface SelectionRenderContext {
  /** Content to render */
  content: string[];
  /** Selection range */
  range: TextRange;
  /** Visual style */
  style: SelectionStyle;
  /** Terminal dimensions */
  terminalSize: { width: number; height: number };
  /** Viewport information */
  viewport?: {
    scrollTop: number;
    scrollLeft: number;
    visibleWidth: number;
    visibleHeight: number;
  };
  /** Whether to optimize rendering */
  optimize: boolean;
}

/**
 * Complete rendered selection
 */
export interface RenderedSelection {
  /** Selection segments by line */
  segments: SelectionSegment[];
  /** Total number of lines affected */
  lineCount: number;
  /** Total character count */
  characterCount: number;
  /** Bounding box */
  bounds: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  /** Render metadata */
  metadata: {
    renderTime: number;
    segmentCount: number;
    totalSequenceLength: number;
    hasAnimation: boolean;
  };
}

/**
 * ANSI color constants for selection rendering
 */
const ANSI_COLORS = {
  // Standard colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  
  // Bright background colors
  bgBrightBlack: '\x1b[100m',
  bgBrightRed: '\x1b[101m',
  bgBrightGreen: '\x1b[102m',
  bgBrightYellow: '\x1b[103m',
  bgBrightBlue: '\x1b[104m',
  bgBrightMagenta: '\x1b[105m',
  bgBrightCyan: '\x1b[106m',
  bgBrightWhite: '\x1b[107m',
  
  // Text styles
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m'
} as const;

/**
 * Default selection styles
 */
export const DEFAULT_SELECTION_STYLES = {
  default: {
    backgroundColor: '#4A90E2',
    foregroundColor: '#FFFFFF',
    invert: false,
    textDecoration: 'none',
    intensity: 'normal',
    animation: 'none'
  } as SelectionStyle,
  
  subtle: {
    backgroundColor: '#E8F4F8',
    foregroundColor: '#2C3E50',
    invert: false,
    textDecoration: 'none',
    intensity: 'subtle',
    animation: 'none'
  } as SelectionStyle,
  
  strong: {
    backgroundColor: '#2196F3',
    foregroundColor: '#FFFFFF',
    invert: false,
    textDecoration: 'bold',
    intensity: 'strong',
    animation: 'pulse'
  } as SelectionStyle,
  
  inverted: {
    backgroundColor: 'transparent',
    foregroundColor: 'inherit',
    invert: true,
    textDecoration: 'none',
    intensity: 'normal',
    animation: 'none'
  } as SelectionStyle
};

/**
 * Color conversion utilities
 */
export class ColorUtils {
  /**
   * Convert hex color to ANSI 256-color code
   */
  static hexToAnsi256(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return ANSI_COLORS.white;

    // Convert to 6x6x6 color cube
    const r = Math.round(rgb.r / 255 * 5);
    const g = Math.round(rgb.g / 255 * 5);
    const b = Math.round(rgb.b / 255 * 5);
    const colorCode = 16 + (36 * r) + (6 * g) + b;

    return `\x1b[38;5;${colorCode}m`;
  }

  /**
   * Convert hex color to ANSI background 256-color code
   */
  static hexToAnsiBg256(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return ANSI_COLORS.bgBlack;

    const r = Math.round(rgb.r / 255 * 5);
    const g = Math.round(rgb.g / 255 * 5);
    const b = Math.round(rgb.b / 255 * 5);
    const colorCode = 16 + (36 * r) + (6 * g) + b;

    return `\x1b[48;5;${colorCode}m`;
  }

  /**
   * Convert hex to RGB values
   */
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Get ANSI color from style
   */
  static getAnsiColor(color: string, isBackground: boolean = false): string {
    // Handle named colors
    if (color in ANSI_COLORS) {
      return ANSI_COLORS[color as keyof typeof ANSI_COLORS];
    }

    // Handle hex colors
    if (color.startsWith('#')) {
      return isBackground ? 
        this.hexToAnsiBg256(color) : 
        this.hexToAnsi256(color);
    }

    // Handle RGB values
    if (color.startsWith('rgb')) {
      return this.rgbToAnsi(color, isBackground);
    }

    // Handle special values
    if (color === 'transparent' || color === 'inherit') {
      return '';
    }

    // Default
    return isBackground ? ANSI_COLORS.bgBlack : ANSI_COLORS.white;
  }

  /**
   * Convert RGB string to ANSI
   */
  static rgbToAnsi(rgb: string, isBackground: boolean = false): string {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return isBackground ? ANSI_COLORS.bgBlack : ANSI_COLORS.white;

    const r = Math.round(parseInt(match[1]) / 255 * 5);
    const g = Math.round(parseInt(match[2]) / 255 * 5);
    const b = Math.round(parseInt(match[3]) / 255 * 5);
    const colorCode = 16 + (36 * r) + (6 * g) + b;

    return isBackground ? 
      `\x1b[48;5;${colorCode}m` : 
      `\x1b[38;5;${colorCode}m`;
  }
}

/**
 * Selection Visual Renderer
 * Renders text selections with background highlighting using ANSI codes
 */
export class SelectionRenderer {
  private renderCache = new Map<string, RenderedSelection>();
  private animationTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Render selection with visual highlighting
   */
  render(context: SelectionRenderContext): RenderedSelection {
    const startTime = performance.now();
    
    // Create cache key
    const cacheKey = this.createCacheKey(context);
    
    // Check cache first
    if (context.optimize && this.renderCache.has(cacheKey)) {
      return this.renderCache.get(cacheKey)!;
    }

    // Validate range
    const normalizedRange = RangeValidator.normalizeRange(context.range);
    if (!RangeValidator.isValidRange(normalizedRange, context.content)) {
      return this.createEmptySelection();
    }

    // Generate segments
    const segments = this.generateSelectionSegments(context, normalizedRange);
    
    // Calculate bounds
    const bounds = this.calculateBounds(normalizedRange);
    
    // Create result
    const result: RenderedSelection = {
      segments,
      lineCount: segments.length,
      characterCount: segments.reduce((sum, seg) => sum + seg.originalText.length, 0),
      bounds,
      metadata: {
        renderTime: performance.now() - startTime,
        segmentCount: segments.length,
        totalSequenceLength: segments.reduce((sum, seg) => sum + seg.startSequence.length + seg.endSequence.length, 0),
        hasAnimation: context.style.animation !== 'none'
      }
    };

    // Cache result if optimizing
    if (context.optimize) {
      this.renderCache.set(cacheKey, result);
    }

    // Start animation if needed
    if (result.metadata.hasAnimation) {
      this.startAnimation(cacheKey, context.style.animation);
    }

    return result;
  }

  /**
   * Generate selection segments for each affected line
   */
  private generateSelectionSegments(
    context: SelectionRenderContext,
    range: TextRange
  ): SelectionSegment[] {
    const segments: SelectionSegment[] = [];
    const { content, style } = context;
    
    // Generate ANSI sequences
    const { startSequence, endSequence } = this.generateAnsiSequences(style);

    for (let lineNum = range.start.line; lineNum <= range.end.line; lineNum++) {
      if (lineNum >= content.length) break;

      const line = content[lineNum];
      let startCol: number;
      let endCol: number;

      // Determine selection bounds for this line
      if (range.start.line === range.end.line) {
        // Single line selection
        startCol = range.start.column;
        endCol = range.end.column;
      } else if (lineNum === range.start.line) {
        // First line of multi-line selection
        startCol = range.start.column;
        endCol = line.length;
      } else if (lineNum === range.end.line) {
        // Last line of multi-line selection
        startCol = 0;
        endCol = range.end.column;
      } else {
        // Middle line of multi-line selection
        startCol = 0;
        endCol = line.length;
      }

      // Clamp to line bounds
      startCol = Math.max(0, Math.min(startCol, line.length));
      endCol = Math.max(startCol, Math.min(endCol, line.length));

      // Extract text
      const originalText = line.substring(startCol, endCol);
      const renderedText = startSequence + originalText + endSequence;

      segments.push({
        line: lineNum,
        startColumn: startCol,
        endColumn: endCol,
        originalText,
        renderedText,
        startSequence,
        endSequence
      });
    }

    return segments;
  }

  /**
   * Generate ANSI sequences for style
   */
  private generateAnsiSequences(style: SelectionStyle): {
    startSequence: string;
    endSequence: string;
  } {
    let startSequence = '';
    
    // Handle invert mode
    if (style.invert) {
      startSequence += ANSI_COLORS.reverse;
    } else {
      // Background color
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        startSequence += ColorUtils.getAnsiColor(style.backgroundColor, true);
      }
      
      // Foreground color
      if (style.foregroundColor && style.foregroundColor !== 'inherit') {
        startSequence += ColorUtils.getAnsiColor(style.foregroundColor, false);
      }
    }

    // Text decoration
    switch (style.textDecoration) {
      case 'bold':
        startSequence += ANSI_COLORS.bold;
        break;
      case 'underline':
        startSequence += ANSI_COLORS.underline;
        break;
      case 'dim':
        startSequence += ANSI_COLORS.dim;
        break;
    }

    // Intensity adjustments
    if (style.intensity === 'dim' || style.intensity === 'subtle') {
      startSequence += ANSI_COLORS.dim;
    } else if (style.intensity === 'strong') {
      startSequence += ANSI_COLORS.bold;
    }

    return {
      startSequence,
      endSequence: ANSI_COLORS.reset
    };
  }

  /**
   * Calculate selection bounds
   */
  private calculateBounds(range: TextRange): RenderedSelection['bounds'] {
    return {
      startLine: range.start.line,
      endLine: range.end.line,
      startColumn: range.start.column,
      endColumn: range.end.column
    };
  }

  /**
   * Create empty selection result
   */
  private createEmptySelection(): RenderedSelection {
    return {
      segments: [],
      lineCount: 0,
      characterCount: 0,
      bounds: {
        startLine: 0,
        endLine: 0,
        startColumn: 0,
        endColumn: 0
      },
      metadata: {
        renderTime: 0,
        segmentCount: 0,
        totalSequenceLength: 0,
        hasAnimation: false
      }
    };
  }

  /**
   * Apply rendered selection to content lines
   */
  applyToLines(content: string[], rendered: RenderedSelection): string[] {
    const result = [...content];
    
    for (const segment of rendered.segments) {
      if (segment.line < result.length) {
        const line = result[segment.line];
        const before = line.substring(0, segment.startColumn);
        const after = line.substring(segment.endColumn);
        result[segment.line] = before + segment.renderedText + after;
      }
    }
    
    return result;
  }

  /**
   * Render selection overlay for specific viewport
   */
  renderOverlay(
    context: SelectionRenderContext,
    viewportLines: string[]
  ): string[] {
    const rendered = this.render(context);
    
    // Filter segments to viewport
    const viewportTop = context.viewport?.scrollTop || 0;
    const viewportSegments = rendered.segments.filter(segment =>
      segment.line >= viewportTop &&
      segment.line < viewportTop + viewportLines.length
    );

    // Apply segments to viewport lines
    const result = [...viewportLines];
    for (const segment of viewportSegments) {
      const viewportLine = segment.line - viewportTop;
      if (viewportLine >= 0 && viewportLine < result.length) {
        const line = result[viewportLine];
        const before = line.substring(0, segment.startColumn);
        const after = line.substring(segment.endColumn);
        result[viewportLine] = before + segment.renderedText + after;
      }
    }

    return result;
  }

  /**
   * Create cache key for rendering context
   */
  private createCacheKey(context: SelectionRenderContext): string {
    const { range, style } = context;
    return `${range.start.line},${range.start.column}-${range.end.line},${range.end.column}-${style.backgroundColor}-${style.foregroundColor}-${style.intensity}-${style.animation}`;
  }

  /**
   * Start animation for selection
   */
  private startAnimation(cacheKey: string, animation: SelectionStyle['animation']): void {
    if (animation === 'none') return;

    // Clear existing animation
    this.stopAnimation(cacheKey);

    let intervalMs: number;
    switch (animation) {
      case 'blink':
        intervalMs = 500;
        break;
      case 'pulse':
        intervalMs = 800;
        break;
      case 'fade':
        intervalMs = 1000;
        break;
      default:
        return;
    }

    const timer = setInterval(() => {
      // Animation logic would trigger re-render with modified style
      // For now, just maintain the timer
    }, intervalMs);

    this.animationTimers.set(cacheKey, timer);
  }

  /**
   * Stop animation for selection
   */
  private stopAnimation(cacheKey: string): void {
    const timer = this.animationTimers.get(cacheKey);
    if (timer) {
      clearInterval(timer);
      this.animationTimers.delete(cacheKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.renderCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; animationsActive: number } {
    return {
      size: this.renderCache.size,
      animationsActive: this.animationTimers.size
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Stop all animations
    for (const [key, timer] of this.animationTimers) {
      clearInterval(timer);
    }
    this.animationTimers.clear();
    
    // Clear cache
    this.renderCache.clear();
  }
}

/**
 * Selection rendering utilities
 */
export class SelectionRenderUtils {
  /**
   * Create selection style from options
   */
  static createStyle(options: Partial<SelectionStyle> = {}): SelectionStyle {
    return {
      ...DEFAULT_SELECTION_STYLES.default,
      ...options
    };
  }

  /**
   * Get predefined style by name
   */
  static getStyle(name: keyof typeof DEFAULT_SELECTION_STYLES): SelectionStyle {
    return { ...DEFAULT_SELECTION_STYLES[name] };
  }

  /**
   * Merge multiple styles
   */
  static mergeStyles(...styles: Partial<SelectionStyle>[]): SelectionStyle {
    return styles.reduce(
      (merged, style) => ({ ...merged, ...style }),
      DEFAULT_SELECTION_STYLES.default
    );
  }

  /**
   * Create high contrast style for accessibility
   */
  static createHighContrastStyle(): SelectionStyle {
    return {
      backgroundColor: '#000000',
      foregroundColor: '#FFFFFF',
      invert: false,
      textDecoration: 'bold',
      intensity: 'strong',
      animation: 'none'
    };
  }

  /**
   * Create style based on theme
   */
  static createThemedStyle(isDark: boolean): SelectionStyle {
    if (isDark) {
      return {
        backgroundColor: '#4A90E2',
        foregroundColor: '#FFFFFF',
        invert: false,
        textDecoration: 'none',
        intensity: 'normal',
        animation: 'none'
      };
    } else {
      return {
        backgroundColor: '#E3F2FD',
        foregroundColor: '#1976D2',
        invert: false,
        textDecoration: 'none',
        intensity: 'normal',
        animation: 'none'
      };
    }
  }

  /**
   * Validate selection style
   */
  static validateStyle(style: SelectionStyle): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate colors
    if (style.backgroundColor && !this.isValidColor(style.backgroundColor)) {
      errors.push('Invalid background color format');
    }

    if (style.foregroundColor && !this.isValidColor(style.foregroundColor)) {
      errors.push('Invalid foreground color format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if color format is valid
   */
  private static isValidColor(color: string): boolean {
    // Check named colors
    if (color in ANSI_COLORS) return true;
    
    // Check hex colors
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) return true;
    
    // Check RGB colors
    if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) return true;
    
    // Check special values
    if (['transparent', 'inherit'].includes(color)) return true;
    
    return false;
  }
}