/**
 * Visual Feedback System
 * Renders visual feedback for interactive components using ANSI terminal codes
 */

import { VisualFeedback, ComponentBounds } from './interactive-components.js';

/**
 * ANSI color codes
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
  
  // Reset
  reset: '\x1b[0m',
  
  // Text styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  strikethrough: '\x1b[9m'
} as const;

/**
 * Rendered visual feedback
 */
export interface RenderedFeedback {
  /** ANSI escape sequences to apply */
  startSequence: string;
  /** ANSI reset sequence */
  endSequence: string;
  /** Whether feedback affects background */
  affectsBackground: boolean;
  /** Whether feedback affects foreground */
  affectsForeground: boolean;
  /** Animation frame data if animated */
  animationFrames?: string[];
}

/**
 * Feedback rendering context
 */
export interface FeedbackContext {
  /** Component bounds */
  bounds: ComponentBounds;
  /** Current terminal cursor position */
  cursorPosition?: { x: number; y: number };
  /** Terminal dimensions */
  terminalSize: { width: number; height: number };
  /** Whether to optimize for performance */
  optimize: boolean;
}

/**
 * Visual Feedback Renderer
 * Converts visual feedback definitions into ANSI terminal sequences
 */
export class VisualFeedbackRenderer {
  private animationTimers = new Map<string, NodeJS.Timeout>();
  private feedbackCache = new Map<string, RenderedFeedback>();
  
  /**
   * Render visual feedback to ANSI sequences
   */
  render(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    const cacheKey = this.createCacheKey(feedback, context);
    
    // Check cache first
    if (this.feedbackCache.has(cacheKey)) {
      return this.feedbackCache.get(cacheKey)!;
    }

    let rendered: RenderedFeedback;

    switch (feedback.type) {
      case 'highlight':
        rendered = this.renderHighlight(feedback, context);
        break;
      case 'underline':
        rendered = this.renderUnderline(feedback, context);
        break;
      case 'color_change':
        rendered = this.renderColorChange(feedback, context);
        break;
      case 'border':
        rendered = this.renderBorder(feedback, context);
        break;
      case 'shadow':
        rendered = this.renderShadow(feedback, context);
        break;
      case 'invert':
        rendered = this.renderInvert(feedback, context);
        break;
      default:
        rendered = this.renderDefault(feedback, context);
    }

    // Add animation if specified
    if (feedback.animation && feedback.animation !== 'none') {
      rendered = this.addAnimation(rendered, feedback.animation, feedback.intensity);
    }

    // Cache the result
    this.feedbackCache.set(cacheKey, rendered);

    return rendered;
  }

  /**
   * Render highlight feedback
   */
  private renderHighlight(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    const color = this.parseColor(feedback.color || this.getDefaultColor(feedback.intensity, 'highlight'));
    const bgColor = this.colorToBackground(color);

    return {
      startSequence: bgColor,
      endSequence: ANSI_COLORS.reset,
      affectsBackground: true,
      affectsForeground: false
    };
  }

  /**
   * Render underline feedback
   */
  private renderUnderline(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    const color = this.parseColor(feedback.color || this.getDefaultColor(feedback.intensity, 'underline'));

    return {
      startSequence: ANSI_COLORS.underline + color,
      endSequence: ANSI_COLORS.reset,
      affectsBackground: false,
      affectsForeground: true
    };
  }

  /**
   * Render color change feedback
   */
  private renderColorChange(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    const color = this.parseColor(feedback.color || this.getDefaultColor(feedback.intensity, 'color'));

    return {
      startSequence: color,
      endSequence: ANSI_COLORS.reset,
      affectsBackground: false,
      affectsForeground: true
    };
  }

  /**
   * Render border feedback
   */
  private renderBorder(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    const color = this.parseColor(feedback.color || this.getDefaultColor(feedback.intensity, 'border'));
    
    // For terminal, we'll use background color to simulate border
    const bgColor = this.colorToBackground(color);

    return {
      startSequence: bgColor,
      endSequence: ANSI_COLORS.reset,
      affectsBackground: true,
      affectsForeground: false
    };
  }

  /**
   * Render shadow feedback
   */
  private renderShadow(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    // Shadow effect using dim background
    return {
      startSequence: ANSI_COLORS.dim + ANSI_COLORS.bgBrightBlack,
      endSequence: ANSI_COLORS.reset,
      affectsBackground: true,
      affectsForeground: true
    };
  }

  /**
   * Render invert feedback
   */
  private renderInvert(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    return {
      startSequence: ANSI_COLORS.reverse,
      endSequence: ANSI_COLORS.reset,
      affectsBackground: true,
      affectsForeground: true
    };
  }

  /**
   * Render default feedback
   */
  private renderDefault(feedback: VisualFeedback, context: FeedbackContext): RenderedFeedback {
    return this.renderHighlight(feedback, context);
  }

  /**
   * Add animation to rendered feedback
   */
  private addAnimation(
    rendered: RenderedFeedback, 
    animation: VisualFeedback['animation'], 
    intensity: VisualFeedback['intensity']
  ): RenderedFeedback {
    const frames: string[] = [];

    switch (animation) {
      case 'blink':
        frames.push(rendered.startSequence);
        frames.push(ANSI_COLORS.reset);
        break;
      case 'pulse':
        const baseColor = rendered.startSequence;
        const dimColor = ANSI_COLORS.dim + baseColor;
        frames.push(baseColor);
        frames.push(dimColor);
        frames.push(baseColor);
        break;
      case 'fade':
        // Create fade effect with different intensities
        frames.push(rendered.startSequence);
        frames.push(ANSI_COLORS.dim + rendered.startSequence);
        frames.push(ANSI_COLORS.reset);
        break;
      default:
        frames.push(rendered.startSequence);
    }

    return {
      ...rendered,
      animationFrames: frames
    };
  }

  /**
   * Parse color string to ANSI code
   */
  private parseColor(color: string): string {
    // Handle named colors
    if (color in ANSI_COLORS) {
      return ANSI_COLORS[color as keyof typeof ANSI_COLORS];
    }

    // Handle hex colors (convert to closest ANSI)
    if (color.startsWith('#')) {
      return this.hexToAnsi(color);
    }

    // Handle RGB values
    if (color.startsWith('rgb')) {
      return this.rgbToAnsi(color);
    }

    // Default to white
    return ANSI_COLORS.white;
  }

  /**
   * Convert hex color to closest ANSI color
   */
  private hexToAnsi(hex: string): string {
    // Simple conversion - could be enhanced with better color matching
    const rgb = this.hexToRgb(hex);
    if (!rgb) return ANSI_COLORS.white;

    // Convert to 8-bit color
    const r = Math.round(rgb.r / 255 * 5);
    const g = Math.round(rgb.g / 255 * 5);
    const b = Math.round(rgb.b / 255 * 5);
    const colorCode = 16 + (36 * r) + (6 * g) + b;

    return `\x1b[38;5;${colorCode}m`;
  }

  /**
   * Convert RGB string to ANSI color
   */
  private rgbToAnsi(rgb: string): string {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return ANSI_COLORS.white;

    const r = Math.round(parseInt(match[1]) / 255 * 5);
    const g = Math.round(parseInt(match[2]) / 255 * 5);
    const b = Math.round(parseInt(match[3]) / 255 * 5);
    const colorCode = 16 + (36 * r) + (6 * g) + b;

    return `\x1b[38;5;${colorCode}m`;
  }

  /**
   * Convert hex string to RGB values
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert foreground color to background color
   */
  private colorToBackground(foregroundColor: string): string {
    // Simple mapping - could be enhanced
    const mapping: Record<string, string> = {
      [ANSI_COLORS.black]: ANSI_COLORS.bgBlack,
      [ANSI_COLORS.red]: ANSI_COLORS.bgRed,
      [ANSI_COLORS.green]: ANSI_COLORS.bgGreen,
      [ANSI_COLORS.yellow]: ANSI_COLORS.bgYellow,
      [ANSI_COLORS.blue]: ANSI_COLORS.bgBlue,
      [ANSI_COLORS.magenta]: ANSI_COLORS.bgMagenta,
      [ANSI_COLORS.cyan]: ANSI_COLORS.bgCyan,
      [ANSI_COLORS.white]: ANSI_COLORS.bgWhite
    };

    return mapping[foregroundColor] || ANSI_COLORS.bgBrightBlack;
  }

  /**
   * Get default color for feedback type and intensity
   */
  private getDefaultColor(intensity: VisualFeedback['intensity'], type: string): string {
    const colorMap = {
      subtle: {
        highlight: ANSI_COLORS.brightBlack,
        underline: ANSI_COLORS.brightBlue,
        color: ANSI_COLORS.brightWhite,
        border: ANSI_COLORS.brightBlue
      },
      normal: {
        highlight: ANSI_COLORS.blue,
        underline: ANSI_COLORS.cyan,
        color: ANSI_COLORS.yellow,
        border: ANSI_COLORS.cyan
      },
      strong: {
        highlight: ANSI_COLORS.brightYellow,
        underline: ANSI_COLORS.brightCyan,
        color: ANSI_COLORS.brightRed,
        border: ANSI_COLORS.brightCyan
      }
    };

    return colorMap[intensity]?.[type as keyof typeof colorMap.subtle] || ANSI_COLORS.white;
  }

  /**
   * Create cache key for rendered feedback
   */
  private createCacheKey(feedback: VisualFeedback, context: FeedbackContext): string {
    return `${feedback.type}-${feedback.intensity}-${feedback.color || 'default'}-${feedback.animation || 'none'}`;
  }

  /**
   * Apply rendered feedback to text
   */
  applyToText(text: string, feedback: RenderedFeedback): string {
    if (feedback.animationFrames && feedback.animationFrames.length > 0) {
      // For now, just use the first frame - animation would need timer system
      return feedback.animationFrames[0] + text + feedback.endSequence;
    }

    return feedback.startSequence + text + feedback.endSequence;
  }

  /**
   * Create positioning sequence for terminal cursor
   */
  createPositionSequence(x: number, y: number): string {
    // ANSI cursor positioning (1-based coordinates)
    return `\x1b[${y + 1};${x + 1}H`;
  }

  /**
   * Create area fill sequence for highlighting bounds
   */
  createAreaFill(bounds: ComponentBounds, feedback: RenderedFeedback): string {
    let sequence = '';
    
    for (let y = 0; y < bounds.height; y++) {
      sequence += this.createPositionSequence(bounds.x, bounds.y + y);
      sequence += feedback.startSequence;
      sequence += ' '.repeat(bounds.width);
      sequence += feedback.endSequence;
    }
    
    return sequence;
  }

  /**
   * Start animation for component
   */
  startAnimation(
    componentId: string,
    feedback: RenderedFeedback,
    bounds: ComponentBounds,
    intervalMs = 500
  ): void {
    if (!feedback.animationFrames || feedback.animationFrames.length <= 1) {
      return;
    }

    // Clear existing animation
    this.stopAnimation(componentId);

    let frameIndex = 0;
    const timer = setInterval(() => {
      const frame = feedback.animationFrames![frameIndex];
      
      // Apply frame to component area
      const sequence = this.createAreaFill(bounds, {
        ...feedback,
        startSequence: frame
      });
      
      process.stdout.write(sequence);
      
      frameIndex = (frameIndex + 1) % feedback.animationFrames!.length;
    }, intervalMs);

    this.animationTimers.set(componentId, timer);
  }

  /**
   * Stop animation for component
   */
  stopAnimation(componentId: string): void {
    const timer = this.animationTimers.get(componentId);
    if (timer) {
      clearInterval(timer);
      this.animationTimers.delete(componentId);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.feedbackCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.feedbackCache.size,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Stop all animations
    for (const [componentId, timer] of this.animationTimers) {
      clearInterval(timer);
    }
    this.animationTimers.clear();
    
    // Clear cache
    this.feedbackCache.clear();
  }
}