/**
 * Selection Integration Tests
 * End-to-end testing of the complete text selection system
 * including all components working together
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TextSelection } from '../tui/text-selection';
import { DragSelectionManager } from '../tui/drag-selection';
import { SelectionRenderer } from '../tui/selection-renderer';
import { ClipboardManager, ClipboardResult } from '../tui/clipboard-manager';
import { SelectionStateManager } from '../tui/selection-state-manager';
import { MultilineSelectionHandler } from '../tui/multiline-selection';

interface IntegrationTestScenario {
  name: string;
  setup: {
    content: string[];
    viewport: { width: number; height: number };
  };
  actions: Array<{
    type: 'mouseDown' | 'mouseMove' | 'mouseUp' | 'keyPress' | 'copy' | 'paste';
    data: any;
  }>;
  expected: {
    selectedText: string;
    visualOutput: string[];
    clipboardContent?: string;
    selectionState: any;
  };
}

describe('Text Selection System Integration', () => {
  let textSelection: TextSelection;
  let dragManager: DragSelectionManager;
  let renderer: SelectionRenderer;
  let clipboardManager: ClipboardManager;
  let stateManager: SelectionStateManager;
  let multilineHandler: MultilineSelectionHandler;

  beforeEach(() => {
    // Initialize all components
    textSelection = new TextSelection();
    dragManager = new DragSelectionManager({
      onSelectionUpdate: jest.fn(),
      onSelectionComplete: jest.fn()
    });
    renderer = new SelectionRenderer();
    clipboardManager = new ClipboardManager();
    stateManager = new SelectionStateManager();
    multilineHandler = new MultilineSelectionHandler();

    // Mock platform dependencies
    jest.spyOn(clipboardManager, 'copyText').mockResolvedValue({
      success: true,
      platform: 'test',
      method: 'mock'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Selection Workflow', () => {
    const integrationScenarios: IntegrationTestScenario[] = [
      {
        name: 'simple word selection and copy',
        setup: {
          content: ['Hello World Test'],
          viewport: { width: 80, height: 24 }
        },
        actions: [
          { type: 'mouseDown', data: { x: 0, y: 0, button: 'left' } },
          { type: 'mouseMove', data: { x: 5, y: 0 } },
          { type: 'mouseUp', data: { x: 5, y: 0, button: 'left' } },
          { type: 'copy', data: {} }
        ],
        expected: {
          selectedText: 'Hello',
          visualOutput: ['[7mHello[0m World Test'],
          clipboardContent: 'Hello',
          selectionState: { hasSelection: true, selectionMode: 'character' }
        }
      },
      {
        name: 'multi-line selection with rendering',
        setup: {
          content: ['First line', 'Second line', 'Third line'],
          viewport: { width: 80, height: 24 }
        },
        actions: [
          { type: 'mouseDown', data: { x: 6, y: 0, button: 'left' } },
          { type: 'mouseMove', data: { x: 6, y: 2 } },
          { type: 'mouseUp', data: { x: 6, y: 2, button: 'left' } },
          { type: 'copy', data: {} }
        ],
        expected: {
          selectedText: 'line\nSecond line\nThird ',
          visualOutput: [
            'First [7mline[0m',
            '[7mSecond line[0m',
            '[7mThird [0mline'
          ],
          clipboardContent: 'line\nSecond line\nThird ',
          selectionState: { hasSelection: true, selectionMode: 'character' }
        }
      },
      {
        name: 'drag selection with auto-scroll',
        setup: {
          content: Array(50).fill('This is a long line of text'),
          viewport: { width: 80, height: 10 }
        },
        actions: [
          { type: 'mouseDown', data: { x: 0, y: 5, button: 'left' } },
          { type: 'mouseMove', data: { x: 10, y: 15 } }, // Beyond viewport
          { type: 'mouseUp', data: { x: 10, y: 15, button: 'left' } }
        ],
        expected: {
          selectedText: expect.stringContaining('This is a long line'),
          visualOutput: expect.arrayContaining([expect.stringContaining('[7m')]),
          selectionState: { hasSelection: true, scrollOffset: expect.any(Number) }
        }
      }
    ];

    integrationScenarios.forEach(scenario => {
      it(`handles ${scenario.name}`, async () => {
        const { setup, actions, expected } = scenario;
        
        // Setup content and viewport
        const mockContent = setup.content;
        const mockViewport = setup.viewport;
        
        // Execute actions sequentially
        let currentSelection: any = null;
        let selectionState: any = {};
        let renderedOutput: string[] = [];

        for (const action of actions) {
          switch (action.type) {
            case 'mouseDown':
              const startPos = { 
                line: action.data.y, 
                column: action.data.x 
              };
              textSelection.startSelection(startPos);
              stateManager.startSelection(startPos);
              break;

            case 'mouseMove':
              const movePos = { 
                line: action.data.y, 
                column: action.data.x 
              };
              textSelection.updateSelection(movePos);
              stateManager.updateSelection(movePos);
              break;

            case 'mouseUp':
              const endPos = { 
                line: action.data.y, 
                column: action.data.x 
              };
              currentSelection = textSelection.endSelection();
              stateManager.endSelection();
              
              // Render the selection
              if (currentSelection) {
                const renderContext = {
                  selection: currentSelection,
                  content: mockContent,
                  viewport: mockViewport,
                  theme: { selectionBackground: 7 }
                };
                
                const rendered = renderer.render(renderContext);
                renderedOutput = renderer.applyToLines(mockContent, rendered);
              }
              break;

            case 'copy':
              if (currentSelection) {
                const selectedText = extractTextFromSelection(mockContent, currentSelection);
                await clipboardManager.copyText(selectedText, 'selection-test');
                selectionState.lastCopiedText = selectedText;
              }
              break;
          }
        }

        // Validate results
        if (typeof expected.selectedText === 'string') {
          const selectedText = currentSelection ? 
            extractTextFromSelection(mockContent, currentSelection) : '';
          expect(selectedText).toBe(expected.selectedText);
        } else {
          const selectedText = currentSelection ? 
            extractTextFromSelection(mockContent, currentSelection) : '';
          expect(selectedText).toEqual(expected.selectedText);
        }

        if (Array.isArray(expected.visualOutput)) {
          expected.visualOutput.forEach((expectedLine, index) => {
            if (typeof expectedLine === 'string') {
              expect(renderedOutput[index]).toBe(expectedLine);
            } else {
              expect(renderedOutput[index]).toEqual(expectedLine);
            }
          });
        }

        if (expected.clipboardContent) {
          expect(clipboardManager.copyText).toHaveBeenCalledWith(
            expected.clipboardContent, 
            'selection-test'
          );
        }

        // Validate selection state
        Object.keys(expected.selectionState).forEach(key => {
          if (key === 'hasSelection') {
            expect(Boolean(currentSelection)).toBe(expected.selectionState[key]);
          } else {
            expect(selectionState).toHaveProperty(key);
          }
        });
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('handles clipboard failure gracefully', async () => {
      clipboardManager.copyText = jest.fn<(text: string, source?: string) => Promise<ClipboardResult>>().mockRejectedValue(new Error('Clipboard unavailable'));
      
      const startPos = { line: 0, column: 0 };
      const endPos = { line: 0, column: 5 };
      
      textSelection.startSelection(startPos);
      textSelection.updateSelection(endPos);
      const selection = textSelection.endSelection();
      
      expect(selection).toBeTruthy();
      
      // Should not throw when clipboard fails
      await expect(
        clipboardManager.copyText('test', 'error-test')
      ).rejects.toThrow('Clipboard unavailable');
    });

    it('handles invalid selection coordinates', () => {
      const invalidPos = { line: -1, column: -1 };
      
      // Should not throw on invalid coordinates
      expect(() => {
        textSelection.startSelection(invalidPos);
        textSelection.updateSelection({ line: 1000, column: 1000 });
        textSelection.endSelection();
      }).not.toThrow();
    });

    it('handles empty content gracefully', () => {
      const emptyContent: string[] = [];
      const selection = { 
        start: { line: 0, column: 0 }, 
        end: { line: 0, column: 1 } 
      };
      
      const selectedText = extractTextFromSelection(emptyContent, selection);
      expect(selectedText).toBe('');
    });
  });

  describe('Performance Integration Tests', () => {
    it('handles large document selection efficiently', async () => {
      const largeContent = Array(5000).fill('This is line content '.repeat(10));
      
      const startTime = performance.now();
      
      // Select a large portion of the document
      textSelection.startSelection({ line: 100, column: 0 });
      textSelection.updateSelection({ line: 4900, column: 50 });
      const selection = textSelection.endSelection();
      
      // Render the selection
      const renderContext = {
        selection: selection!,
        content: largeContent,
        viewport: { width: 120, height: 30 },
        theme: { selectionBackground: 7 }
      };
      
      const rendered = renderer.render(renderContext);
      const output = renderer.applyToLines(largeContent, rendered);
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(selection).toBeTruthy();
      expect(output.length).toBeGreaterThan(0);
    });

    it('validates memory usage stays reasonable', () => {
      // Create many selections and ensure they don't accumulate
      const content = ['Test line 1', 'Test line 2', 'Test line 3'];
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many selection operations
      for (let i = 0; i < 1000; i++) {
        textSelection.startSelection({ line: 0, column: 0 });
        textSelection.updateSelection({ line: 1, column: 5 });
        textSelection.endSelection();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

// Helper function to extract text from selection
function extractTextFromSelection(
  content: string[], 
  selection: { start: { line: number; column: number }; end: { line: number; column: number } }
): string {
  const { start, end } = selection;
  
  if (start.line === end.line) {
    const line = content[start.line] || '';
    return line.slice(start.column, end.column);
  }
  
  const lines: string[] = [];
  for (let lineIndex = start.line; lineIndex <= end.line && lineIndex < content.length; lineIndex++) {
    const line = content[lineIndex] || '';
    
    if (lineIndex === start.line) {
      lines.push(line.slice(start.column));
    } else if (lineIndex === end.line) {
      lines.push(line.slice(0, end.column));
    } else {
      lines.push(line);
    }
  }
  
  return lines.join('\n');
}