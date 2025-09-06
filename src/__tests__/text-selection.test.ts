/**
 * Text Selection Tests
 * Tests for character-level precision text selection with copy functionality
 */

describe('Text Selection System', () => {
  /**
   * Mock terminal content for testing
   */
  const mockTerminalContent = [
    'Welcome to Plato Terminal Interface',
    '>>> const greeting = "Hello World";',
    'console.log(greeting);',
    '',
    'Available commands:',
    '  /help - Show available commands',
    '  /quit - Exit application',
    'Type your message below:'
  ];

  /**
   * Mock terminal dimensions
   */
  const mockTerminal = {
    width: 80,
    height: 24,
    content: mockTerminalContent
  };

  /**
   * Text position interface for testing
   */
  interface TextPosition {
    line: number;
    column: number;
  }

  /**
   * Text range interface for testing
   */
  interface TextRange {
    start: TextPosition;
    end: TextPosition;
  }

  /**
   * Mock TextSelection class for testing
   */
  class MockTextSelection {
    private startPos: TextPosition | null = null;
    private endPos: TextPosition | null = null;
    private isActive = false;
    private content: string[] = [];

    constructor(content: string[] = []) {
      this.content = content;
    }

    startSelection(position: TextPosition): void {
      this.startPos = position;
      this.endPos = position;
      this.isActive = true;
    }

    updateSelection(position: TextPosition): void {
      if (this.isActive && this.startPos) {
        this.endPos = position;
      }
    }

    endSelection(): TextRange | null {
      if (!this.isActive || !this.startPos || !this.endPos) {
        return null;
      }

      this.isActive = false;
      return {
        start: this.startPos,
        end: this.endPos
      };
    }

    clearSelection(): void {
      this.startPos = null;
      this.endPos = null;
      this.isActive = false;
    }

    getSelection(): TextRange | null {
      if (!this.startPos || !this.endPos) {
        return null;
      }

      return {
        start: this.startPos,
        end: this.endPos
      };
    }

    isSelectionActive(): boolean {
      return this.isActive;
    }

    getSelectedText(): string {
      const range = this.getSelection();
      if (!range) return '';

      return this.extractTextFromRange(range);
    }

    private extractTextFromRange(range: TextRange): string {
      const { start, end } = this.normalizeRange(range);
      const lines: string[] = [];

      for (let lineNum = start.line; lineNum <= end.line; lineNum++) {
        if (lineNum >= this.content.length) break;

        const line = this.content[lineNum];
        let lineText = '';

        if (start.line === end.line) {
          // Single line selection
          lineText = line.substring(start.column, end.column);
        } else if (lineNum === start.line) {
          // First line of multi-line selection
          lineText = line.substring(start.column);
        } else if (lineNum === end.line) {
          // Last line of multi-line selection
          lineText = line.substring(0, end.column);
        } else {
          // Middle line of multi-line selection
          lineText = line;
        }

        lines.push(lineText);
      }

      return lines.join('\n');
    }

    private normalizeRange(range: TextRange): TextRange {
      const { start, end } = range;

      // Ensure start comes before end
      if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
        return { start: end, end: start };
      }

      return range;
    }

    calculateSelectionBounds(range: TextRange): {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      width: number;
      height: number;
    } {
      const normalized = this.normalizeRange(range);
      
      return {
        startX: normalized.start.column,
        startY: normalized.start.line,
        endX: normalized.end.column,
        endY: normalized.end.line,
        width: normalized.end.column - normalized.start.column,
        height: normalized.end.line - normalized.start.line + 1
      };
    }

    getSelectionMetrics(): {
      characterCount: number;
      lineCount: number;
      wordCount: number;
    } {
      const text = this.getSelectedText();
      
      return {
        characterCount: text.length,
        lineCount: text.split('\n').length,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0
      };
    }
  }

  describe('TextSelection Class', () => {
    let selection: MockTextSelection;

    beforeEach(() => {
      selection = new MockTextSelection(mockTerminalContent);
    });

    describe('Selection State Management', () => {
      test('starts with no active selection', () => {
        expect(selection.isSelectionActive()).toBe(false);
        expect(selection.getSelection()).toBeNull();
        expect(selection.getSelectedText()).toBe('');
      });

      test('activates selection when starting', () => {
        selection.startSelection({ line: 0, column: 5 });
        
        expect(selection.isSelectionActive()).toBe(true);
        expect(selection.getSelection()).toEqual({
          start: { line: 0, column: 5 },
          end: { line: 0, column: 5 }
        });
      });

      test('updates selection position during drag', () => {
        selection.startSelection({ line: 0, column: 5 });
        selection.updateSelection({ line: 0, column: 15 });
        
        expect(selection.getSelection()).toEqual({
          start: { line: 0, column: 5 },
          end: { line: 0, column: 15 }
        });
      });

      test('ends selection and returns final range', () => {
        selection.startSelection({ line: 0, column: 5 });
        selection.updateSelection({ line: 0, column: 15 });
        const result = selection.endSelection();
        
        expect(result).toEqual({
          start: { line: 0, column: 5 },
          end: { line: 0, column: 15 }
        });
        expect(selection.isSelectionActive()).toBe(false);
      });

      test('clears selection state', () => {
        selection.startSelection({ line: 0, column: 5 });
        selection.updateSelection({ line: 0, column: 15 });
        selection.clearSelection();
        
        expect(selection.isSelectionActive()).toBe(false);
        expect(selection.getSelection()).toBeNull();
        expect(selection.getSelectedText()).toBe('');
      });
    });

    describe('Text Extraction', () => {
      test('extracts single-line selection correctly', () => {
        selection.startSelection({ line: 0, column: 8 });
        selection.updateSelection({ line: 0, column: 13 });
        
        const selectedText = selection.getSelectedText();
        expect(selectedText).toBe('to Pl');
      });

      test('extracts multi-line selection correctly', () => {
        selection.startSelection({ line: 1, column: 4 });
        selection.updateSelection({ line: 2, column: 12 });
        
        const selectedText = selection.getSelectedText();
        const expected = 'const greeting = "Hello World";\nconsole.log(';
        expect(selectedText).toBe(expected);
      });

      test('extracts entire line when selecting from start to end', () => {
        selection.startSelection({ line: 1, column: 0 });
        selection.updateSelection({ line: 1, column: mockTerminalContent[1].length });
        
        const selectedText = selection.getSelectedText();
        expect(selectedText).toBe('>>> const greeting = "Hello World";');
      });

      test('handles empty lines in multi-line selection', () => {
        selection.startSelection({ line: 2, column: 5 });
        selection.updateSelection({ line: 4, column: 9 });
        
        const selectedText = selection.getSelectedText();
        const expected = 'ole.log(greeting);\n\nAvailable';
        expect(selectedText).toBe(expected);
      });

      test('handles backward selection (end before start)', () => {
        selection.startSelection({ line: 0, column: 15 });
        selection.updateSelection({ line: 0, column: 8 });
        
        const selectedText = selection.getSelectedText();
        expect(selectedText).toBe('to Plato');
      });

      test('handles multi-line backward selection', () => {
        selection.startSelection({ line: 2, column: 10 });
        selection.updateSelection({ line: 1, column: 8 });
        
        const selectedText = selection.getSelectedText();
        const expected = 'greeting = "Hello World";\nconsole.lo';
        expect(selectedText).toBe(expected);
      });
    });

    describe('Position and Range Calculations', () => {
      test('calculates selection bounds for single-line selection', () => {
        const range = {
          start: { line: 0, column: 8 },
          end: { line: 0, column: 15 }
        };
        
        const bounds = selection.calculateSelectionBounds(range);
        expect(bounds).toEqual({
          startX: 8,
          startY: 0,
          endX: 15,
          endY: 0,
          width: 7,
          height: 1
        });
      });

      test('calculates selection bounds for multi-line selection', () => {
        const range = {
          start: { line: 1, column: 4 },
          end: { line: 3, column: 0 }
        };
        
        const bounds = selection.calculateSelectionBounds(range);
        expect(bounds).toEqual({
          startX: 4,
          startY: 1,
          endX: 0,
          endY: 3,
          width: -4, // Negative width for multi-line
          height: 3
        });
      });

      test('normalizes backward ranges', () => {
        const range = {
          start: { line: 2, column: 10 },
          end: { line: 1, column: 5 }
        };
        
        const bounds = selection.calculateSelectionBounds(range);
        expect(bounds.startY).toBe(1); // Should be normalized
        expect(bounds.endY).toBe(2);
      });
    });

    describe('Selection Metrics', () => {
      test('calculates correct character count', () => {
        selection.startSelection({ line: 0, column: 0 });
        selection.updateSelection({ line: 0, column: 7 });
        
        const metrics = selection.getSelectionMetrics();
        expect(metrics.characterCount).toBe(7);
      });

      test('calculates correct line count for single line', () => {
        selection.startSelection({ line: 0, column: 0 });
        selection.updateSelection({ line: 0, column: 10 });
        
        const metrics = selection.getSelectionMetrics();
        expect(metrics.lineCount).toBe(1);
      });

      test('calculates correct line count for multi-line', () => {
        selection.startSelection({ line: 1, column: 0 });
        selection.updateSelection({ line: 3, column: 0 });
        
        const metrics = selection.getSelectionMetrics();
        expect(metrics.lineCount).toBe(3);
      });

      test('calculates correct word count', () => {
        selection.startSelection({ line: 0, column: 0 });
        selection.updateSelection({ line: 0, column: 35 }); // "Welcome to Plato Terminal Interface"
        
        const metrics = selection.getSelectionMetrics();
        expect(metrics.wordCount).toBe(5);
      });

      test('handles empty selection metrics', () => {
        const metrics = selection.getSelectionMetrics();
        expect(metrics.characterCount).toBe(0);
        expect(metrics.lineCount).toBe(1); // Empty string still has one line
        expect(metrics.wordCount).toBe(0);
      });
    });

    describe('Edge Cases and Boundary Conditions', () => {
      test('handles selection at line boundaries', () => {
        selection.startSelection({ line: 0, column: mockTerminalContent[0].length });
        selection.updateSelection({ line: 1, column: 0 });
        
        const selectedText = selection.getSelectedText();
        expect(selectedText).toBe('\n>>>'); // Should capture newline
      });

      test('handles selection beyond content bounds', () => {
        selection.startSelection({ line: 0, column: 0 });
        selection.updateSelection({ line: 100, column: 100 }); // Beyond content
        
        expect(() => selection.getSelectedText()).not.toThrow();
      });

      test('handles zero-length selection', () => {
        selection.startSelection({ line: 0, column: 5 });
        selection.updateSelection({ line: 0, column: 5 });
        
        const selectedText = selection.getSelectedText();
        expect(selectedText).toBe('');
      });

      test('handles selection on empty lines', () => {
        selection.startSelection({ line: 3, column: 0 }); // Empty line
        selection.updateSelection({ line: 3, column: 0 });
        
        const selectedText = selection.getSelectedText();
        expect(selectedText).toBe('');
      });

      test('handles cross-boundary multi-line selection', () => {
        selection.startSelection({ line: 2, column: 15 });
        selection.updateSelection({ line: 4, column: 5 });
        
        const selectedText = selection.getSelectedText();
        const expected = 'ting);\n\nAvail';
        expect(selectedText).toBe(expected);
      });
    });
  });

  describe('Selection Range Validation', () => {
    /**
     * Range validation utility for testing
     */
    class RangeValidator {
      static isValidPosition(position: TextPosition, content: string[]): boolean {
        if (position.line < 0 || position.line >= content.length) {
          return false;
        }
        
        if (position.column < 0 || position.column > content[position.line].length) {
          return false;
        }
        
        return true;
      }

      static isValidRange(range: TextRange, content: string[]): boolean {
        return this.isValidPosition(range.start, content) && 
               this.isValidPosition(range.end, content);
      }

      static clampPosition(position: TextPosition, content: string[]): TextPosition {
        const clampedLine = Math.max(0, Math.min(position.line, content.length - 1));
        const clampedColumn = Math.max(0, Math.min(position.column, content[clampedLine].length));
        
        return {
          line: clampedLine,
          column: clampedColumn
        };
      }

      static normalizeRange(range: TextRange): TextRange {
        const { start, end } = range;
        
        if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
          return { start: end, end: start };
        }
        
        return range;
      }
    }

    test('validates position within content bounds', () => {
      const validPos = { line: 1, column: 5 };
      const invalidLinePos = { line: 100, column: 5 };
      const invalidColumnPos = { line: 1, column: 1000 };
      
      expect(RangeValidator.isValidPosition(validPos, mockTerminalContent)).toBe(true);
      expect(RangeValidator.isValidPosition(invalidLinePos, mockTerminalContent)).toBe(false);
      expect(RangeValidator.isValidPosition(invalidColumnPos, mockTerminalContent)).toBe(false);
    });

    test('validates range within content bounds', () => {
      const validRange = {
        start: { line: 0, column: 0 },
        end: { line: 1, column: 10 }
      };
      
      const invalidRange = {
        start: { line: 0, column: 0 },
        end: { line: 100, column: 10 }
      };
      
      expect(RangeValidator.isValidRange(validRange, mockTerminalContent)).toBe(true);
      expect(RangeValidator.isValidRange(invalidRange, mockTerminalContent)).toBe(false);
    });

    test('clamps position to valid bounds', () => {
      const outOfBoundsPos = { line: 100, column: 1000 };
      const clampedPos = RangeValidator.clampPosition(outOfBoundsPos, mockTerminalContent);
      
      expect(clampedPos.line).toBe(mockTerminalContent.length - 1);
      expect(clampedPos.column).toBe(mockTerminalContent[mockTerminalContent.length - 1].length);
    });

    test('normalizes backward ranges', () => {
      const backwardRange = {
        start: { line: 2, column: 10 },
        end: { line: 1, column: 5 }
      };
      
      const normalized = RangeValidator.normalizeRange(backwardRange);
      expect(normalized.start).toEqual({ line: 1, column: 5 });
      expect(normalized.end).toEqual({ line: 2, column: 10 });
    });
  });

  describe('Selection Algorithms', () => {
    /**
     * Selection algorithm utilities
     */
    class SelectionAlgorithms {
      static expandToWord(position: TextPosition, content: string[]): TextRange {
        if (!RangeValidator.isValidPosition(position, content)) {
          return { start: position, end: position };
        }

        const line = content[position.line];
        const char = line[position.column];

        // If not on a word character, return single character selection
        if (!char || !/\w/.test(char)) {
          return { start: position, end: position };
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

      static expandToLine(position: TextPosition, content: string[]): TextRange {
        if (!RangeValidator.isValidPosition(position, content)) {
          return { start: position, end: position };
        }

        return {
          start: { line: position.line, column: 0 },
          end: { line: position.line, column: content[position.line].length }
        };
      }

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
    }

    test('expands selection to word boundaries', () => {
      const position = { line: 0, column: 10 }; // Middle of "Plato"
      const wordRange = SelectionAlgorithms.expandToWord(position, mockTerminalContent);
      
      expect(wordRange.start).toEqual({ line: 0, column: 8 });
      expect(wordRange.end).toEqual({ line: 0, column: 13 });
    });

    test('expands selection to full line', () => {
      const position = { line: 1, column: 15 };
      const lineRange = SelectionAlgorithms.expandToLine(position, mockTerminalContent);
      
      expect(lineRange.start).toEqual({ line: 1, column: 0 });
      expect(lineRange.end).toEqual({ line: 1, column: mockTerminalContent[1].length });
    });

    test('finds next word position', () => {
      const position = { line: 0, column: 8 }; // Start of "Plato"
      const nextWord = SelectionAlgorithms.findNextWord(position, mockTerminalContent);
      
      expect(nextWord.line).toBe(0);
      expect(nextWord.column).toBe(14); // Start of "Terminal"
    });

    test('finds previous word position', () => {
      const position = { line: 0, column: 14 }; // Start of "Terminal"
      const prevWord = SelectionAlgorithms.findPreviousWord(position, mockTerminalContent);
      
      expect(prevWord.line).toBe(0);
      expect(prevWord.column).toBe(8); // Start of "Plato"
    });

    test('handles word expansion on non-word characters', () => {
      const position = { line: 1, column: 0 }; // On ">" character
      const wordRange = SelectionAlgorithms.expandToWord(position, mockTerminalContent);
      
      expect(wordRange.start).toEqual(position);
      expect(wordRange.end).toEqual(position);
    });

    test('handles next word at end of content', () => {
      const lastLine = mockTerminalContent.length - 1;
      const position = { line: lastLine, column: mockTerminalContent[lastLine].length - 1 };
      const nextWord = SelectionAlgorithms.findNextWord(position, mockTerminalContent);
      
      expect(nextWord).toEqual(position); // Should stay at end
    });

    test('handles previous word at start of content', () => {
      const position = { line: 0, column: 0 };
      const prevWord = SelectionAlgorithms.findPreviousWord(position, mockTerminalContent);
      
      expect(prevWord).toEqual(position); // Should stay at start
    });
  });

  describe('Performance and Memory', () => {
    test('handles large text selection efficiently', () => {
      // Create large content
      const largeContent = Array(1000).fill(0).map((_, i) => 
        `Line ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
      );

      const selection = new MockTextSelection(largeContent);
      
      const startTime = performance.now();
      
      selection.startSelection({ line: 0, column: 0 });
      selection.updateSelection({ line: 999, column: largeContent[999].length });
      const selectedText = selection.getSelectedText();
      
      const endTime = performance.now();
      
      expect(selectedText.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });

    test('memory usage remains stable with repeated selections', () => {
      const selection = new MockTextSelection(mockTerminalContent);
      
      // Perform many selection operations
      for (let i = 0; i < 1000; i++) {
        selection.startSelection({ line: 0, column: 0 });
        selection.updateSelection({ line: 1, column: 10 });
        selection.getSelectedText();
        selection.clearSelection();
      }
      
      // Should not throw memory errors
      expect(selection.isSelectionActive()).toBe(false);
    });
  });
});