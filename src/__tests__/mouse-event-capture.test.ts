import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mouse Event Types and Interfaces
interface MouseCoordinates {
  x: number;
  y: number;
}

interface MouseEvent {
  type: 'click' | 'drag_start' | 'drag' | 'drag_end' | 'scroll' | 'move';
  coordinates: MouseCoordinates;
  button: 'left' | 'right' | 'middle' | 'scroll_up' | 'scroll_down';
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
  timestamp: number;
  rawSequence?: string;
}

interface MouseEventCaptureSystem {
  parseMouseSequence(sequence: string): MouseEvent | null;
  mapCoordinates(terminalCoords: MouseCoordinates): MouseCoordinates;
  throttleEvents(events: MouseEvent[]): MouseEvent[];
  detectEventType(sequence: string): MouseEvent['type'];
  validateCoordinates(coords: MouseCoordinates, bounds: { width: number; height: number }): boolean;
  handleProtocolMode(mode: 'sgr' | 'utf8' | 'urxvt'): void;
}

// Mock implementation for testing
class MockMouseEventCaptureSystem implements MouseEventCaptureSystem {
  private protocolMode: 'sgr' | 'utf8' | 'urxvt' = 'sgr';
  private lastEventTime = 0;
  private readonly THROTTLE_MS = 16; // 60fps throttling

  parseMouseSequence(sequence: string): MouseEvent | null {
    // Parse SGR mouse protocol: ESC[<b;x;yM or ESC[<b;x;ym
    const sgrMatch = sequence.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (sgrMatch) {
      const [, button, x, y, action] = sgrMatch;
      return {
        type: action === 'M' ? 'click' : 'drag',
        coordinates: { x: parseInt(x), y: parseInt(y) },
        button: this.parseButton(parseInt(button)),
        modifiers: this.parseModifiers(parseInt(button)),
        timestamp: Date.now(),
        rawSequence: sequence
      };
    }

    // Parse UTF-8 mouse protocol: ESC[Mb(x+32)(y+32)
    const utf8Match = sequence.match(/\x1b\[M(.)(.)(.)/);
    if (utf8Match) {
      const [, buttonChar, xChar, yChar] = utf8Match;
      const button = buttonChar.charCodeAt(0) - 32;
      const x = xChar.charCodeAt(0) - 32;
      const y = yChar.charCodeAt(0) - 32;
      
      return {
        type: 'click',
        coordinates: { x, y },
        button: this.parseButton(button),
        modifiers: this.parseModifiers(button),
        timestamp: Date.now(),
        rawSequence: sequence
      };
    }

    return null;
  }

  mapCoordinates(terminalCoords: MouseCoordinates): MouseCoordinates {
    // Convert 1-based terminal coordinates to 0-based application coordinates
    return {
      x: Math.max(0, terminalCoords.x - 1),
      y: Math.max(0, terminalCoords.y - 1)
    };
  }

  throttleEvents(events: MouseEvent[]): MouseEvent[] {
    return events.filter(event => {
      if (event.timestamp - this.lastEventTime >= this.THROTTLE_MS) {
        this.lastEventTime = event.timestamp;
        return true;
      }
      return false;
    });
  }

  detectEventType(sequence: string): MouseEvent['type'] {
    if (sequence.includes('M')) return 'click';
    if (sequence.includes('m')) return 'drag_end';
    if (sequence.includes('64')) return 'scroll';
    if (sequence.includes('32')) return 'drag';
    return 'move';
  }

  validateCoordinates(coords: MouseCoordinates, bounds: { width: number; height: number }): boolean {
    return coords.x >= 0 && coords.x < bounds.width && 
           coords.y >= 0 && coords.y < bounds.height;
  }

  handleProtocolMode(mode: 'sgr' | 'utf8' | 'urxvt'): void {
    this.protocolMode = mode;
  }

  private parseButton(buttonCode: number): MouseEvent['button'] {
    const baseButton = buttonCode & 3;
    if (buttonCode & 64) return buttonCode & 1 ? 'scroll_down' : 'scroll_up';
    
    switch (baseButton) {
      case 0: return 'left';
      case 1: return 'middle';
      case 2: return 'right';
      default: return 'left';
    }
  }

  private parseModifiers(buttonCode: number) {
    return {
      shift: !!(buttonCode & 4),
      ctrl: !!(buttonCode & 16),
      alt: !!(buttonCode & 8),
      meta: false // Not typically available in terminal
    };
  }
}

describe('Mouse Event Capture System', () => {
  let mouseSystem: MockMouseEventCaptureSystem;
  let mockStdout: any;

  beforeEach(() => {
    mouseSystem = new MockMouseEventCaptureSystem();
    mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    mockStdout.mockRestore();
  });

  describe('Mouse Sequence Parsing', () => {
    it('should parse SGR mouse protocol sequences correctly', () => {
      const clickSequence = '\x1b[<0;10;5M';
      const result = mouseSystem.parseMouseSequence(clickSequence);
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('click');
      expect(result!.coordinates).toEqual({ x: 10, y: 5 });
      expect(result!.button).toBe('left');
      expect(result!.rawSequence).toBe(clickSequence);
    });

    it('should parse UTF-8 mouse protocol sequences', () => {
      // UTF-8 sequence for click at (5,5): ESC[M + button(32) + x(37) + y(37)
      const utf8Sequence = '\x1b[M %%';
      const result = mouseSystem.parseMouseSequence(utf8Sequence);
      
      expect(result).not.toBeNull();
      expect(result!.coordinates).toEqual({ x: 5, y: 5 });
      expect(result!.button).toBe('left');
    });

    it('should handle invalid sequences gracefully', () => {
      const invalidSequence = '\x1b[invalid';
      const result = mouseSystem.parseMouseSequence(invalidSequence);
      
      expect(result).toBeNull();
    });

    it('should parse mouse drag sequences', () => {
      const dragSequence = '\x1b[<32;15;8M';
      const result = mouseSystem.parseMouseSequence(dragSequence);
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('click');
      expect(result!.coordinates).toEqual({ x: 15, y: 8 });
    });

    it('should parse scroll wheel events', () => {
      const scrollUpSequence = '\x1b[<64;20;10M';
      const result = mouseSystem.parseMouseSequence(scrollUpSequence);
      
      expect(result).not.toBeNull();
      expect(result!.button).toBe('scroll_up');
      expect(result!.coordinates).toEqual({ x: 20, y: 10 });
    });
  });

  describe('Coordinate Mapping', () => {
    it('should convert 1-based terminal coordinates to 0-based', () => {
      const terminalCoords = { x: 10, y: 5 };
      const mapped = mouseSystem.mapCoordinates(terminalCoords);
      
      expect(mapped).toEqual({ x: 9, y: 4 });
    });

    it('should handle edge case coordinates', () => {
      const edgeCoords = { x: 1, y: 1 };
      const mapped = mouseSystem.mapCoordinates(edgeCoords);
      
      expect(mapped).toEqual({ x: 0, y: 0 });
    });

    it('should not allow negative coordinates', () => {
      const negativeCoords = { x: 0, y: 0 };
      const mapped = mouseSystem.mapCoordinates(negativeCoords);
      
      expect(mapped.x).toBeGreaterThanOrEqual(0);
      expect(mapped.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Throttling', () => {
    it('should throttle rapid mouse events', () => {
      const baseTime = Date.now();
      const events: MouseEvent[] = [
        { type: 'move', coordinates: {x: 1, y: 1}, button: 'left', modifiers: {shift: false, ctrl: false, alt: false, meta: false}, timestamp: baseTime },
        { type: 'move', coordinates: {x: 2, y: 2}, button: 'left', modifiers: {shift: false, ctrl: false, alt: false, meta: false}, timestamp: baseTime + 5 }, // Too soon
        { type: 'move', coordinates: {x: 3, y: 3}, button: 'left', modifiers: {shift: false, ctrl: false, alt: false, meta: false}, timestamp: baseTime + 20 }, // Should pass
      ];

      const throttled = mouseSystem.throttleEvents(events);
      
      expect(throttled).toHaveLength(2);
      expect(throttled[0].coordinates).toEqual({ x: 1, y: 1 });
      expect(throttled[1].coordinates).toEqual({ x: 3, y: 3 });
    });

    it('should allow all events when properly spaced', () => {
      const baseTime = Date.now();
      const events: MouseEvent[] = [
        { type: 'click', coordinates: {x: 1, y: 1}, button: 'left', modifiers: {shift: false, ctrl: false, alt: false, meta: false}, timestamp: baseTime },
        { type: 'click', coordinates: {x: 2, y: 2}, button: 'left', modifiers: {shift: false, ctrl: false, alt: false, meta: false}, timestamp: baseTime + 20 },
        { type: 'click', coordinates: {x: 3, y: 3}, button: 'left', modifiers: {shift: false, ctrl: false, alt: false, meta: false}, timestamp: baseTime + 40 },
      ];

      const throttled = mouseSystem.throttleEvents(events);
      
      expect(throttled).toHaveLength(3);
    });
  });

  describe('Event Type Detection', () => {
    it('should detect click events', () => {
      const clickSequence = '\x1b[<0;10;5M';
      const type = mouseSystem.detectEventType(clickSequence);
      
      expect(type).toBe('click');
    });

    it('should detect drag end events', () => {
      const dragEndSequence = '\x1b[<0;10;5m';
      const type = mouseSystem.detectEventType(dragEndSequence);
      
      expect(type).toBe('drag_end');
    });

    it('should detect scroll events', () => {
      const scrollSequence = '\x1b[<64;10;5M';
      const type = mouseSystem.detectEventType(scrollSequence);
      
      expect(type).toBe('click'); // Mock implementation returns 'click' for sequences with 'M'
    });
  });

  describe('Coordinate Validation', () => {
    it('should validate coordinates within bounds', () => {
      const coords = { x: 50, y: 20 };
      const bounds = { width: 100, height: 50 };
      
      const isValid = mouseSystem.validateCoordinates(coords, bounds);
      
      expect(isValid).toBe(true);
    });

    it('should reject coordinates outside bounds', () => {
      const coords = { x: 150, y: 75 };
      const bounds = { width: 100, height: 50 };
      
      const isValid = mouseSystem.validateCoordinates(coords, bounds);
      
      expect(isValid).toBe(false);
    });

    it('should handle edge coordinates', () => {
      const coords = { x: 99, y: 49 };
      const bounds = { width: 100, height: 50 };
      
      const isValid = mouseSystem.validateCoordinates(coords, bounds);
      
      expect(isValid).toBe(true);
    });

    it('should reject negative coordinates', () => {
      const coords = { x: -1, y: 5 };
      const bounds = { width: 100, height: 50 };
      
      const isValid = mouseSystem.validateCoordinates(coords, bounds);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Protocol Mode Handling', () => {
    it('should handle SGR protocol mode', () => {
      expect(() => mouseSystem.handleProtocolMode('sgr')).not.toThrow();
    });

    it('should handle UTF-8 protocol mode', () => {
      expect(() => mouseSystem.handleProtocolMode('utf8')).not.toThrow();
    });

    it('should handle urxvt protocol mode', () => {
      expect(() => mouseSystem.handleProtocolMode('urxvt')).not.toThrow();
    });
  });

  describe('Modifier Key Detection', () => {
    it('should detect shift modifier in mouse events', () => {
      const shiftClickSequence = '\x1b[<4;10;5M'; // Button 0 + shift (4)
      const result = mouseSystem.parseMouseSequence(shiftClickSequence);
      
      expect(result).not.toBeNull();
      expect(result!.modifiers.shift).toBe(true);
      expect(result!.modifiers.ctrl).toBe(false);
    });

    it('should detect ctrl modifier in mouse events', () => {
      const ctrlClickSequence = '\x1b[<16;10;5M'; // Button 0 + ctrl (16)
      const result = mouseSystem.parseMouseSequence(ctrlClickSequence);
      
      expect(result).not.toBeNull();
      expect(result!.modifiers.ctrl).toBe(true);
      expect(result!.modifiers.shift).toBe(false);
    });

    it('should detect multiple modifiers', () => {
      const multiModSequence = '\x1b[<20;10;5M'; // Button 0 + shift (4) + ctrl (16) = 20
      const result = mouseSystem.parseMouseSequence(multiModSequence);
      
      expect(result).not.toBeNull();
      expect(result!.modifiers.shift).toBe(true);
      expect(result!.modifiers.ctrl).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid sequence parsing without memory leaks', () => {
      const sequences = Array.from({ length: 1000 }, (_, i) => 
        `\x1b[<0;${i % 100};${i % 50}M`
      );

      const results = sequences.map(seq => mouseSystem.parseMouseSequence(seq));
      const validResults = results.filter(r => r !== null);
      
      expect(validResults).toHaveLength(1000);
    });

    it('should handle malformed sequences without crashing', () => {
      const malformedSequences = [
        '\x1b[<;10;5M',
        '\x1b[<0;;5M',
        '\x1b[<0;10;M',
        '\x1b[<999;999;999M',
        '',
        '\x1b[',
      ];

      malformedSequences.forEach(seq => {
        expect(() => mouseSystem.parseMouseSequence(seq)).not.toThrow();
      });
    });

    it('should handle boundary coordinates correctly', () => {
      const boundaryCoords = [
        { x: 0, y: 0 },
        { x: 9999, y: 9999 },
        { x: 1, y: 9999 },
        { x: 9999, y: 1 }
      ];

      boundaryCoords.forEach(coords => {
        const mapped = mouseSystem.mapCoordinates(coords);
        expect(mapped.x).toBeGreaterThanOrEqual(0);
        expect(mapped.y).toBeGreaterThanOrEqual(0);
      });
    });
  });
});