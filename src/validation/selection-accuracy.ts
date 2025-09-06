/**
 * Selection Accuracy Validation
 * Comprehensive testing of text selection precision and edge cases
 */

import { TextSelection } from '../tui/text-selection';
import { MultilineSelectionHandler } from '../tui/multiline-selection';
import { SelectionRenderer } from '../tui/selection-renderer';

interface AccuracyTestCase {
  name: string;
  content: string[];
  selections: Array<{
    start: { line: number; column: number };
    end: { line: number; column: number };
    expected: {
      text: string;
      characterCount: number;
      wordCount: number;
      lineCount: number;
    };
  }>;
}

interface ValidationMetrics {
  testName: string;
  selectionIndex: number;
  passed: boolean;
  actualText: string;
  expectedText: string;
  characterCountMatch: boolean;
  wordCountMatch: boolean;
  lineCountMatch: boolean;
  executionTime: number;
  errors: string[];
}

export class SelectionAccuracyValidator {
  private textSelection: TextSelection;
  private multilineHandler: MultilineSelectionHandler;
  private renderer: SelectionRenderer;

  constructor() {
    this.textSelection = new TextSelection();
    this.multilineHandler = new MultilineSelectionHandler();
    this.renderer = new SelectionRenderer();
  }

  /**
   * Run comprehensive accuracy validation
   */
  async runValidation(): Promise<ValidationMetrics[]> {
    const testCases = this.generateTestCases();
    const results: ValidationMetrics[] = [];

    console.log('🎯 Starting selection accuracy validation...\n');

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.name}`);
      
      for (let i = 0; i < testCase.selections.length; i++) {
        const selection = testCase.selections[i];
        const metrics = await this.validateSingleSelection(
          testCase, 
          selection, 
          i
        );
        results.push(metrics);
        
        if (metrics.passed) {
          console.log(`  ✅ Selection ${i + 1}: PASS`);
        } else {
          console.log(`  ❌ Selection ${i + 1}: FAIL - ${metrics.errors.join(', ')}`);
        }
      }
      console.log('');
    }

    return results;
  }

  /**
   * Generate comprehensive test cases
   */
  private generateTestCases(): AccuracyTestCase[] {
    return [
      {
        name: 'Basic single-line selections',
        content: ['Hello World Test'],
        selections: [
          {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 5 },
            expected: { text: 'Hello', characterCount: 5, wordCount: 1, lineCount: 1 }
          },
          {
            start: { line: 0, column: 6 },
            end: { line: 0, column: 11 },
            expected: { text: 'World', characterCount: 5, wordCount: 1, lineCount: 1 }
          },
          {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 17 },
            expected: { text: 'Hello World Test', characterCount: 16, wordCount: 3, lineCount: 1 }
          }
        ]
      },
      {
        name: 'Multi-line selections',
        content: [
          'First line of text',
          'Second line here',
          'Third and final line'
        ],
        selections: [
          {
            start: { line: 0, column: 6 },
            end: { line: 1, column: 6 },
            expected: { 
              text: 'line of text\nSecond', 
              characterCount: 19, 
              wordCount: 4, 
              lineCount: 2 
            }
          },
          {
            start: { line: 0, column: 0 },
            end: { line: 2, column: 20 },
            expected: { 
              text: 'First line of text\nSecond line here\nThird and final line', 
              characterCount: 54, 
              wordCount: 10, 
              lineCount: 3 
            }
          }
        ]
      },
      {
        name: 'Edge case selections',
        content: [
          '',
          'Single',
          '  Indented line  ',
          'Line with    multiple    spaces'
        ],
        selections: [
          {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
            expected: { text: '', characterCount: 0, wordCount: 0, lineCount: 1 }
          },
          {
            start: { line: 2, column: 2 },
            end: { line: 2, column: 15 },
            expected: { text: 'Indented line', characterCount: 13, wordCount: 2, lineCount: 1 }
          },
          {
            start: { line: 3, column: 9 },
            end: { line: 3, column: 21 },
            expected: { text: '    multiple', characterCount: 12, wordCount: 1, lineCount: 1 }
          }
        ]
      },
      {
        name: 'Code content selections',
        content: [
          'function calculateSum(a: number, b: number): number {',
          '  const result = a + b;',
          '  return result;',
          '}'
        ],
        selections: [
          {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 8 },
            expected: { text: 'function', characterCount: 8, wordCount: 1, lineCount: 1 }
          },
          {
            start: { line: 1, column: 2 },
            end: { line: 2, column: 8 },
            expected: { 
              text: 'const result = a + b;\n  return', 
              characterCount: 31, 
              wordCount: 6, 
              lineCount: 2 
            }
          }
        ]
      },
      {
        name: 'Unicode and special characters',
        content: [
          'Hello 👋 World 🌍',
          'Café résumé naïve',
          '中文 العربية русский'
        ],
        selections: [
          {
            start: { line: 0, column: 6 },
            end: { line: 0, column: 7 },
            expected: { text: '👋', characterCount: 1, wordCount: 1, lineCount: 1 }
          },
          {
            start: { line: 1, column: 0 },
            end: { line: 1, column: 4 },
            expected: { text: 'Café', characterCount: 4, wordCount: 1, lineCount: 1 }
          },
          {
            start: { line: 2, column: 0 },
            end: { line: 2, column: 2 },
            expected: { text: '中文', characterCount: 2, wordCount: 1, lineCount: 1 }
          }
        ]
      },
      {
        name: 'Boundary conditions',
        content: ['Short', 'Much longer line with many words'],
        selections: [
          {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 100 },
            expected: { text: 'Short', characterCount: 5, wordCount: 1, lineCount: 1 }
          },
          {
            start: { line: 10, column: 0 },
            end: { line: 15, column: 10 },
            expected: { text: '', characterCount: 0, wordCount: 0, lineCount: 1 }
          },
          {
            start: { line: 1, column: 5 },
            end: { line: 1, column: 5 },
            expected: { text: '', characterCount: 0, wordCount: 0, lineCount: 1 }
          }
        ]
      }
    ];
  }

  /**
   * Validate a single selection
   */
  private async validateSingleSelection(
    testCase: AccuracyTestCase,
    selection: any,
    index: number
  ): Promise<ValidationMetrics> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      // Perform selection
      this.textSelection.startSelection(selection.start);
      this.textSelection.updateSelection(selection.end);
      const result = this.textSelection.endSelection();

      if (!result) {
        return {
          testName: testCase.name,
          selectionIndex: index,
          passed: false,
          actualText: '',
          expectedText: selection.expected.text,
          characterCountMatch: false,
          wordCountMatch: false,
          lineCountMatch: false,
          executionTime: performance.now() - startTime,
          errors: ['Selection returned null']
        };
      }

      // Extract actual text
      const actualText = this.extractTextFromContent(testCase.content, result);
      
      // Calculate metrics
      const actualCharCount = actualText.length;
      const actualWordCount = this.countWords(actualText);
      const actualLineCount = this.countLines(actualText);

      // Validate results
      const textMatch = actualText === selection.expected.text;
      const charCountMatch = actualCharCount === selection.expected.characterCount;
      const wordCountMatch = actualWordCount === selection.expected.wordCount;
      const lineCountMatch = actualLineCount === selection.expected.lineCount;

      if (!textMatch) {
        errors.push(`Text mismatch: expected "${selection.expected.text}", got "${actualText}"`);
      }
      if (!charCountMatch) {
        errors.push(`Character count mismatch: expected ${selection.expected.characterCount}, got ${actualCharCount}`);
      }
      if (!wordCountMatch) {
        errors.push(`Word count mismatch: expected ${selection.expected.wordCount}, got ${actualWordCount}`);
      }
      if (!lineCountMatch) {
        errors.push(`Line count mismatch: expected ${selection.expected.lineCount}, got ${actualLineCount}`);
      }

      return {
        testName: testCase.name,
        selectionIndex: index,
        passed: textMatch && charCountMatch && wordCountMatch && lineCountMatch,
        actualText,
        expectedText: selection.expected.text,
        characterCountMatch: charCountMatch,
        wordCountMatch: wordCountMatch,
        lineCountMatch: lineCountMatch,
        executionTime: performance.now() - startTime,
        errors
      };

    } catch (error) {
      return {
        testName: testCase.name,
        selectionIndex: index,
        passed: false,
        actualText: '',
        expectedText: selection.expected.text,
        characterCountMatch: false,
        wordCountMatch: false,
        lineCountMatch: false,
        executionTime: performance.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Extract text from content based on selection result
   */
  private extractTextFromContent(
    content: string[], 
    selection: { start: { line: number; column: number }; end: { line: number; column: number } }
  ): string {
    const { start, end } = selection;
    
    // Handle out-of-bounds
    if (start.line >= content.length) return '';
    
    if (start.line === end.line) {
      // Single line selection
      const line = content[start.line] || '';
      return line.slice(start.column, Math.min(end.column, line.length));
    }

    // Multi-line selection
    const lines: string[] = [];
    
    for (let lineIndex = start.line; lineIndex <= end.line && lineIndex < content.length; lineIndex++) {
      const line = content[lineIndex] || '';
      
      if (lineIndex === start.line) {
        lines.push(line.slice(start.column));
      } else if (lineIndex === end.line) {
        lines.push(line.slice(0, Math.min(end.column, line.length)));
      } else {
        lines.push(line);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Count lines in text
   */
  private countLines(text: string): number {
    if (text === '') return 0;
    return text.split('\n').length;
  }

  /**
   * Generate validation report
   */
  generateReport(results: ValidationMetrics[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    let report = `
# Selection Accuracy Validation Report

## Summary
- **Total Tests**: ${totalTests}
- **Passed**: ${passedTests}
- **Failed**: ${failedTests}
- **Pass Rate**: ${passRate}%
- **Average Execution Time**: ${(results.reduce((sum, r) => sum + r.executionTime, 0) / results.length).toFixed(2)}ms

## Test Categories

`;

    // Group results by test name
    const groupedResults: { [key: string]: ValidationMetrics[] } = {};
    results.forEach(result => {
      if (!groupedResults[result.testName]) {
        groupedResults[result.testName] = [];
      }
      groupedResults[result.testName].push(result);
    });

    Object.entries(groupedResults).forEach(([testName, testResults]) => {
      const categoryPassed = testResults.filter(r => r.passed).length;
      const categoryTotal = testResults.length;
      const categoryRate = ((categoryPassed / categoryTotal) * 100).toFixed(1);
      
      report += `### ${testName} (${categoryRate}% pass rate)\n\n`;
      
      testResults.forEach((result, index) => {
        const status = result.passed ? '✅' : '❌';
        report += `- Selection ${index + 1} ${status}\n`;
        
        if (!result.passed) {
          report += `  - **Errors**: ${result.errors.join('; ')}\n`;
          report += `  - **Expected**: "${result.expectedText}"\n`;
          report += `  - **Actual**: "${result.actualText}"\n`;
        }
        
        report += `  - **Execution Time**: ${result.executionTime.toFixed(2)}ms\n`;
      });
      
      report += '\n';
    });

    report += `
## Performance Analysis

- **Fastest Test**: ${Math.min(...results.map(r => r.executionTime)).toFixed(2)}ms
- **Slowest Test**: ${Math.max(...results.map(r => r.executionTime)).toFixed(2)}ms

## Accuracy Metrics

- **Text Accuracy**: ${results.filter(r => r.actualText === r.expectedText).length}/${totalTests} (${((results.filter(r => r.actualText === r.expectedText).length / totalTests) * 100).toFixed(1)}%)
- **Character Count Accuracy**: ${results.filter(r => r.characterCountMatch).length}/${totalTests}
- **Word Count Accuracy**: ${results.filter(r => r.wordCountMatch).length}/${totalTests}
- **Line Count Accuracy**: ${results.filter(r => r.lineCountMatch).length}/${totalTests}

`;

    if (passRate === '100.0') {
      report += '## ✅ All tests passed! Selection accuracy is validated.\n';
    } else {
      report += '## ⚠️ Some tests failed. Review the failures above and adjust implementation.\n';
    }

    return report;
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const validator = new SelectionAccuracyValidator();
    
    try {
      const results = await validator.runValidation();
      const report = validator.generateReport(results);
      
      console.log('\n' + report);
      
      const allPassed = results.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Accuracy validation failed:', error);
      process.exit(1);
    }
  }
  
  main();
}