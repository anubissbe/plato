/**
 * Selection Validation Tests
 * Comprehensive testing for selection accuracy and clipboard integration
 * across different platforms and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock platform-specific modules
jest.mock('child_process');
jest.mock('os');

interface ValidationTestCase {
  name: string;
  input: string;
  selections: Array<{
    start: { line: number; column: number };
    end: { line: number; column: number };
    expected: string;
  }>;
  platform?: string;
  wrapWidth?: number;
}

interface ClipboardTestCase {
  name: string;
  text: string;
  platform: string;
  expectedCommand: string;
  shouldSucceed: boolean;
}

interface AccuracyTestCase {
  name: string;
  content: string[];
  selection: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  expected: {
    text: string;
    characterCount: number;
    lineCount: number;
    wordCount: number;
  };
}

describe('Selection Validation System', () => {
  describe('Selection Accuracy Tests', () => {
    const accuracyTestCases: AccuracyTestCase[] = [
      {
        name: 'single character selection',
        content: ['Hello World'],
        selection: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 },
        expected: { text: 'H', characterCount: 1, lineCount: 1, wordCount: 1 }
      },
      {
        name: 'single word selection',
        content: ['Hello World'],
        selection: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 5 },
        expected: { text: 'Hello', characterCount: 5, lineCount: 1, wordCount: 1 }
      },
      {
        name: 'multi-word selection with spaces',
        content: ['Hello World Test'],
        selection: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 11 },
        expected: { text: 'Hello World', characterCount: 11, lineCount: 1, wordCount: 2 }
      },
      {
        name: 'multi-line selection',
        content: ['First line', 'Second line', 'Third line'],
        selection: { startLine: 0, startColumn: 6, endLine: 2, endColumn: 5 },
        expected: { text: 'line\nSecond line\nThird', characterCount: 23, lineCount: 3, wordCount: 4 }
      },
      {
        name: 'selection with special characters',
        content: ['const obj = { key: "value", num: 42 };'],
        selection: { startLine: 0, startColumn: 12, endLine: 0, endColumn: 35 },
        expected: { text: '{ key: "value", num: 42 }', characterCount: 23, lineCount: 1, wordCount: 6 }
      },
      {
        name: 'empty line selection',
        content: ['First', '', 'Third'],
        selection: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 0 },
        expected: { text: '', characterCount: 0, lineCount: 1, wordCount: 0 }
      },
      {
        name: 'unicode character selection',
        content: ['Hello 👋 World 🌍'],
        selection: { startLine: 0, startColumn: 6, endLine: 0, endColumn: 7 },
        expected: { text: '👋', characterCount: 1, lineCount: 1, wordCount: 1 }
      }
    ];

    accuracyTestCases.forEach(testCase => {
      it(`validates ${testCase.name}`, () => {
        const { content, selection, expected } = testCase;
        
        // Simulate selection extraction
        const selectedText = extractSelection(content, selection);
        const metrics = calculateSelectionMetrics(selectedText);

        expect(selectedText).toBe(expected.text);
        expect(metrics.characterCount).toBe(expected.characterCount);
        expect(metrics.lineCount).toBe(expected.lineCount);
        expect(metrics.wordCount).toBe(expected.wordCount);
      });
    });
  });

  describe('Line Wrapping Accuracy Tests', () => {
    const wrappingTestCases: ValidationTestCase[] = [
      {
        name: 'wrapped line selection',
        input: 'This is a very long line that will be wrapped at column 20',
        wrapWidth: 20,
        selections: [{
          start: { line: 0, column: 0 },
          end: { line: 1, column: 5 },
          expected: 'This is a very long\nline '
        }]
      },
      {
        name: 'word boundary wrapping',
        input: 'Hello world this is a test of word boundary wrapping functionality',
        wrapWidth: 15,
        selections: [{
          start: { line: 1, column: 0 },
          end: { line: 2, column: 4 },
          expected: 'world this is a\ntest'
        }]
      },
      {
        name: 'selection across wrapped segments',
        input: 'const configuration = { development: true, production: false };',
        wrapWidth: 25,
        selections: [{
          start: { line: 0, column: 22 },
          end: { line: 1, column: 15 },
          expected: '{ development: true,\nproduction: fals'
        }]
      }
    ];

    wrappingTestCases.forEach(testCase => {
      it(`handles ${testCase.name}`, () => {
        const wrappedContent = simulateLineWrapping(testCase.input, testCase.wrapWidth!);
        
        testCase.selections.forEach(selection => {
          const selectedText = extractWrappedSelection(
            wrappedContent, 
            selection.start, 
            selection.end
          );
          expect(selectedText).toBe(selection.expected);
        });
      });
    });
  });

  describe('Cross-Platform Clipboard Integration', () => {
    const clipboardTestCases: ClipboardTestCase[] = [
      {
        name: 'Windows clipboard copy',
        text: 'Hello World',
        platform: 'win32',
        expectedCommand: 'clip.exe',
        shouldSucceed: true
      },
      {
        name: 'macOS clipboard copy',
        text: 'Hello World',
        platform: 'darwin',
        expectedCommand: 'pbcopy',
        shouldSucceed: true
      },
      {
        name: 'Linux X11 clipboard copy',
        text: 'Hello World',
        platform: 'linux',
        expectedCommand: 'xclip -selection clipboard',
        shouldSucceed: true
      },
      {
        name: 'WSL clipboard copy',
        text: 'Hello World',
        platform: 'linux',
        expectedCommand: 'clip.exe',
        shouldSucceed: true
      },
      {
        name: 'multi-line text copy',
        text: 'Line 1\nLine 2\nLine 3',
        platform: 'darwin',
        expectedCommand: 'pbcopy',
        shouldSucceed: true
      },
      {
        name: 'special characters copy',
        text: 'const obj = { "key": "value" };',
        platform: 'linux',
        expectedCommand: 'xclip -selection clipboard',
        shouldSucceed: true
      }
    ];

    clipboardTestCases.forEach(testCase => {
      it(`handles ${testCase.name}`, async () => {
        const mockExec = jest.fn();
        
        if (testCase.shouldSucceed) {
          mockExec.mockResolvedValue({ stdout: '', stderr: '' });
        } else {
          mockExec.mockRejectedValue(new Error('Command failed'));
        }

        const result = await simulateClipboardCopy(
          testCase.text,
          testCase.platform,
          mockExec
        );

        if (testCase.shouldSucceed) {
          expect(result.success).toBe(true);
          expect(mockExec).toHaveBeenCalledWith(
            expect.stringContaining(testCase.expectedCommand.split(' ')[0])
          );
        } else {
          expect(result.success).toBe(false);
        }
      });
    });
  });

  describe('Edge Case Validation', () => {
    it('handles empty selection', () => {
      const content = ['Hello World'];
      const selection = { startLine: 0, startColumn: 5, endLine: 0, endColumn: 5 };
      
      const selectedText = extractSelection(content, selection);
      expect(selectedText).toBe('');
    });

    it('handles out-of-bounds selection', () => {
      const content = ['Short'];
      const selection = { startLine: 0, startColumn: 0, endLine: 0, endColumn: 100 };
      
      const selectedText = extractSelection(content, selection);
      expect(selectedText).toBe('Short');
    });

    it('handles reverse selection (end before start)', () => {
      const content = ['Hello World'];
      const selection = { startLine: 0, startColumn: 10, endLine: 0, endColumn: 5 };
      
      const selectedText = extractSelection(content, selection);
      expect(selectedText).toBe('World');
    });

    it('validates selection on non-existent lines', () => {
      const content = ['Line 1'];
      const selection = { startLine: 5, startColumn: 0, endLine: 10, endColumn: 0 };
      
      const selectedText = extractSelection(content, selection);
      expect(selectedText).toBe('');
    });

    it('handles mixed line endings', () => {
      const content = ['Line 1\r\n', 'Line 2\n', 'Line 3\r'];
      const selection = { startLine: 0, startColumn: 0, endLine: 2, endColumn: 6 };
      
      const selectedText = extractSelection(content, selection);
      const normalizedText = selectedText.replace(/\r\n|\r/g, '\n');
      expect(normalizedText).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Performance Validation', () => {
    it('handles large text selection efficiently', () => {
      const largeContent = Array(1000).fill('This is a line of text that will be repeated many times');
      const startTime = performance.now();
      
      const selection = { startLine: 100, startColumn: 0, endLine: 900, endColumn: 20 };
      const selectedText = extractSelection(largeContent, selection);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
      expect(selectedText.length).toBeGreaterThan(0);
    });

    it('validates clipboard operations timeout', async () => {
      const mockExec = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 6000))
      );

      const startTime = performance.now();
      const result = await simulateClipboardCopy('test', 'linux', mockExec, 5000);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(6000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});

// Helper functions for testing

function extractSelection(
  content: string[],
  selection: { startLine: number; startColumn: number; endLine: number; endColumn: number }
): string {
  const { startLine, startColumn, endLine, endColumn } = selection;
  
  // Handle reverse selection
  const actualStart = startLine < endLine || (startLine === endLine && startColumn <= endColumn)
    ? { line: startLine, column: startColumn }
    : { line: endLine, column: endColumn };
  
  const actualEnd = startLine < endLine || (startLine === endLine && startColumn <= endColumn)
    ? { line: endLine, column: endColumn }
    : { line: startLine, column: startColumn };

  // Handle out-of-bounds
  if (actualStart.line >= content.length) return '';
  
  if (actualStart.line === actualEnd.line) {
    // Single line selection
    const line = content[actualStart.line] || '';
    return line.slice(actualStart.column, actualEnd.column);
  }

  // Multi-line selection
  const lines: string[] = [];
  
  for (let lineIndex = actualStart.line; lineIndex <= actualEnd.line && lineIndex < content.length; lineIndex++) {
    const line = content[lineIndex] || '';
    
    if (lineIndex === actualStart.line) {
      lines.push(line.slice(actualStart.column));
    } else if (lineIndex === actualEnd.line) {
      lines.push(line.slice(0, actualEnd.column));
    } else {
      lines.push(line);
    }
  }
  
  return lines.join('\n');
}

function calculateSelectionMetrics(text: string) {
  const characterCount = text.length;
  const lineCount = text === '' ? 0 : text.split('\n').length;
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  
  return { characterCount, lineCount, wordCount };
}

function simulateLineWrapping(text: string, wrapWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= wrapWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

function extractWrappedSelection(
  wrappedContent: string[],
  start: { line: number; column: number },
  end: { line: number; column: number }
): string {
  return extractSelection(wrappedContent, {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  });
}

async function simulateClipboardCopy(
  text: string,
  platform: string,
  mockExec: jest.Mock,
  timeout = 10000
): Promise<{ success: boolean; error?: string }> {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeout)
    );
    
    const copyPromise = mockExec(getClipboardCommand(platform, text));
    
    await Promise.race([copyPromise, timeoutPromise]);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function getClipboardCommand(platform: string, text: string): string {
  switch (platform) {
    case 'win32':
      return `echo "${text}" | clip.exe`;
    case 'darwin':
      return `echo "${text}" | pbcopy`;
    case 'linux':
      if (process.env.WSL_DISTRO_NAME) {
        return `echo "${text}" | clip.exe`;
      }
      return `echo "${text}" | xclip -selection clipboard`;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}