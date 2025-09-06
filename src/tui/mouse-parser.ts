/**
 * ANSI Mouse Protocol Parser
 * Comprehensive parsing for SGR, UTF-8, and urxvt mouse protocols
 */

import {
  MouseEvent,
  MouseEventType,
  MouseButton,
  MouseCoordinates,
  TerminalCoordinates,
  MouseModifiers,
  MouseProtocolError,
  MouseEventTarget
} from './mouse-types.js';

/**
 * Button code mapping for different protocols
 */
const BUTTON_CODES = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
  SCROLL_UP: 64,
  SCROLL_DOWN: 65
} as const;

/**
 * Modifier bit flags
 */
const MODIFIER_FLAGS = {
  SHIFT: 4,
  ALT: 8,
  CTRL: 16,
  MOTION: 32,
  WHEEL: 64
} as const;

export class MouseProtocolParser {
  private readonly debugMode: boolean;

  constructor(debug = false) {
    this.debugMode = debug;
  }

  /**
   * Parse any supported mouse protocol sequence
   */
  parseMouseSequence(sequence: string): MouseEvent | null {
    try {
      // Try SGR format first (preferred)
      const sgrEvent = this.parseSGRSequence(sequence);
      if (sgrEvent) return sgrEvent;

      // Try UTF-8 format
      const utf8Event = this.parseUTF8Sequence(sequence);
      if (utf8Event) return utf8Event;

      // Try urxvt format
      const urxvtEvent = this.parseUrxvtSequence(sequence);
      if (urxvtEvent) return urxvtEvent;

      // Try legacy format
      const legacyEvent = this.parseLegacySequence(sequence);
      if (legacyEvent) return legacyEvent;

      if (this.debugMode) {
        console.debug(`[MouseParser] Unknown sequence: ${this.escapeSequence(sequence)}`);
      }

      return null;
    } catch (error) {
      throw new MouseProtocolError(
        `Failed to parse mouse sequence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sequence
      );
    }
  }

  /**
   * Parse SGR (Select Graphic Rendition) format: ESC[<b;x;yM or ESC[<b;x;ym
   * This is the preferred modern format
   */
  private parseSGRSequence(sequence: string): MouseEvent | null {
    // Match: ESC[<button;x;y[Mm]
    const match = sequence.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (!match) return null;

    const [, buttonStr, xStr, yStr, action] = match;
    const buttonCode = parseInt(buttonStr, 10);
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);

    if (isNaN(buttonCode) || isNaN(x) || isNaN(y)) {
      throw new MouseProtocolError(`Invalid SGR coordinates: ${buttonStr}, ${xStr}, ${yStr}`, sequence);
    }

    const coordinates = this.mapCoordinates({ x, y });
    const button = this.parseButton(buttonCode);
    const modifiers = this.parseModifiers(buttonCode);
    const type = this.detectEventType(buttonCode, action, sequence);

    return {
      type,
      coordinates,
      button,
      modifiers,
      timestamp: Date.now(),
      rawSequence: sequence
    };
  }

  /**
   * Parse UTF-8 format: ESC[M<button><x+32><y+32>
   * Characters are encoded with +32 offset
   */
  private parseUTF8Sequence(sequence: string): MouseEvent | null {
    // Match: ESC[M followed by exactly 3 characters
    const match = sequence.match(/\x1b\[M([\s\S])([\s\S])([\s\S])/);
    if (!match) return null;

    const [, buttonChar, xChar, yChar] = match;
    
    const buttonCode = buttonChar.charCodeAt(0) - 32;
    const x = xChar.charCodeAt(0) - 32;
    const y = yChar.charCodeAt(0) - 32;

    // Validate decoded values
    if (buttonCode < 0 || x < 1 || y < 1 || x > 223 || y > 223) {
      if (this.debugMode) {
        console.debug(`[MouseParser] Invalid UTF-8 values: button=${buttonCode}, x=${x}, y=${y}`);
      }
      return null;
    }

    const coordinates = this.mapCoordinates({ x, y });
    const button = this.parseButton(buttonCode);
    const modifiers = this.parseModifiers(buttonCode);
    const type = this.detectEventType(buttonCode, 'M', sequence);

    return {
      type,
      coordinates,
      button,
      modifiers,
      timestamp: Date.now(),
      rawSequence: sequence
    };
  }

  /**
   * Parse urxvt format: ESC[b;x;yM
   * Similar to SGR but without the < prefix
   */
  private parseUrxvtSequence(sequence: string): MouseEvent | null {
    // Match: ESC[button;x;yM (without <)
    const match = sequence.match(/\x1b\[(\d+);(\d+);(\d+)M/);
    if (!match) return null;

    const [, buttonStr, xStr, yStr] = match;
    const buttonCode = parseInt(buttonStr, 10);
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);

    if (isNaN(buttonCode) || isNaN(x) || isNaN(y)) {
      throw new MouseProtocolError(`Invalid urxvt coordinates: ${buttonStr}, ${xStr}, ${yStr}`, sequence);
    }

    const coordinates = this.mapCoordinates({ x, y });
    const button = this.parseButton(buttonCode);
    const modifiers = this.parseModifiers(buttonCode);
    const type = this.detectEventType(buttonCode, 'M', sequence);

    return {
      type,
      coordinates,
      button,
      modifiers,
      timestamp: Date.now(),
      rawSequence: sequence
    };
  }

  /**
   * Parse legacy format: ESC[M<button><x+32><y+32>
   * Fallback for very old terminals
   */
  private parseLegacySequence(sequence: string): MouseEvent | null {
    // This is the same as UTF-8 for our purposes
    return this.parseUTF8Sequence(sequence);
  }

  /**
   * Convert 1-based terminal coordinates to 0-based application coordinates
   */
  mapCoordinates(terminalCoords: TerminalCoordinates): MouseCoordinates {
    return {
      x: Math.max(0, terminalCoords.x - 1),
      y: Math.max(0, terminalCoords.y - 1)
    };
  }

  /**
   * Parse button code into button type
   */
  private parseButton(buttonCode: number): MouseButton {
    // Handle scroll wheel events (button codes 64-67)
    if (buttonCode & MODIFIER_FLAGS.WHEEL) {
      return (buttonCode & 1) ? 'scroll_down' : 'scroll_up';
    }

    // Handle regular buttons (masked to get base button)
    const baseButton = buttonCode & 3;
    switch (baseButton) {
      case BUTTON_CODES.LEFT:
        return 'left';
      case BUTTON_CODES.MIDDLE:
        return 'middle';
      case BUTTON_CODES.RIGHT:
        return 'right';
      default:
        return 'left';
    }
  }

  /**
   * Parse modifier flags from button code
   */
  private parseModifiers(buttonCode: number): MouseModifiers {
    return {
      shift: !!(buttonCode & MODIFIER_FLAGS.SHIFT),
      alt: !!(buttonCode & MODIFIER_FLAGS.ALT),
      ctrl: !!(buttonCode & MODIFIER_FLAGS.CTRL),
      meta: false // Meta key not supported in most terminal mouse protocols
    };
  }

  /**
   * Detect event type from button code and action
   */
  private detectEventType(buttonCode: number, action: string, sequence: string): MouseEventType {
    // Scroll wheel events
    if (buttonCode & MODIFIER_FLAGS.WHEEL) {
      return 'scroll';
    }

    // Motion events (button 3 or motion flag)
    if ((buttonCode & 3) === 3 || (buttonCode & MODIFIER_FLAGS.MOTION)) {
      return 'move';
    }

    // SGR format: 'M' = press, 'm' = release
    if (sequence.includes('<')) {
      return action === 'M' ? 'click' : 'drag_end';
    }

    // For other formats, we primarily detect clicks
    return 'click';
  }

  /**
   * Escape sequence for debugging display
   */
  private escapeSequence(sequence: string): string {
    return sequence
      .replace(/\x1b/g, '\\x1b')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => 
        `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
      );
  }

  /**
   * Validate if sequence looks like a mouse sequence
   */
  isMouseSequence(sequence: string): boolean {
    // SGR format
    if (sequence.match(/\x1b\[<\d+;\d+;\d+[Mm]/)) return true;
    
    // UTF-8/Legacy format
    if (sequence.match(/\x1b\[M[\s\S]{3}/)) return true;
    
    // urxvt format
    if (sequence.match(/\x1b\[\d+;\d+;\d+M/)) return true;
    
    // Focus events
    if (sequence.match(/\x1b\[\?1004[hl]/)) return true;
    
    return false;
  }

  /**
   * Extract multiple mouse events from a combined sequence
   */
  extractMultipleEvents(data: string): MouseEvent[] {
    const events: MouseEvent[] = [];
    let remaining = data;

    while (remaining.length > 0) {
      // Try to find next mouse sequence
      const sgrMatch = remaining.match(/\x1b\[<\d+;\d+;\d+[Mm]/);
      const utf8Match = remaining.match(/\x1b\[M[\s\S]{3}/);
      const urxvtMatch = remaining.match(/\x1b\[\d+;\d+;\d+M/);

      let match = null;
      let matchLength = 0;

      // Find the earliest match
      if (sgrMatch && (!match || sgrMatch.index! < match.index!)) {
        match = sgrMatch;
        matchLength = match[0].length;
      }
      if (utf8Match && (!match || utf8Match.index! < match.index!)) {
        match = utf8Match;
        matchLength = match[0].length;
      }
      if (urxvtMatch && (!match || urxvtMatch.index! < match.index!)) {
        match = urxvtMatch;
        matchLength = match[0].length;
      }

      if (!match) break;

      // Parse the found sequence
      const sequence = match[0];
      const event = this.parseMouseSequence(sequence);
      if (event) {
        events.push(event);
      }

      // Move past this sequence
      remaining = remaining.substring((match.index || 0) + matchLength);
    }

    return events;
  }
}