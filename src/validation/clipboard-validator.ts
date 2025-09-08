/**
 * Cross-Platform Clipboard Validation
 * Real-world testing of clipboard functionality across platforms
 */

import { execSync } from 'child_process';
import { platform } from 'os';
import { ClipboardManager } from '../tui/clipboard-manager';

interface ValidationResult {
  platform: string;
  test: string;
  success: boolean;
  error?: string;
  executionTime: number;
  details: {
    textLength: number;
    hasNewlines: boolean;
    hasSpecialChars: boolean;
    method: string;
  };
}

interface PlatformInfo {
  os: string;
  isWSL: boolean;
  hasX11: boolean;
  hasWayland: boolean;
  availableCommands: string[];
}

export class ClipboardValidator {
  private clipboardManager: ClipboardManager;

  constructor() {
    this.clipboardManager = new ClipboardManager();
  }

  /**
   * Run comprehensive clipboard validation
   */
  async runValidation(): Promise<ValidationResult[]> {
    const platformInfo = await this.detectPlatformInfo();
    console.log('Platform Information:', platformInfo);

    const testCases = this.generateTestCases();
    const results: ValidationResult[] = [];

    for (const testCase of testCases) {
      console.log(`\nRunning test: ${testCase.name}`);
      const result = await this.runSingleTest(testCase, platformInfo);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ PASS - ${result.executionTime}ms`);
      } else {
        console.log(`❌ FAIL - ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Detect platform capabilities
   */
  private async detectPlatformInfo(): Promise<PlatformInfo> {
    const info: PlatformInfo = {
      os: platform(),
      isWSL: false,
      hasX11: false,
      hasWayland: false,
      availableCommands: []
    };

    // Detect WSL
    try {
      const wslInfo = execSync('grep -i microsoft /proc/version 2>/dev/null || echo ""', 
        { encoding: 'utf8' });
      info.isWSL = wslInfo.includes('microsoft') || !!process.env.WSL_DISTRO_NAME;
    } catch {
      // Not Linux or no /proc/version
    }

    // Check available commands
    const commandsToCheck = [
      'pbcopy', 'pbpaste',           // macOS
      'clip.exe', 'powershell.exe',  // Windows/WSL
      'xclip', 'xsel',               // Linux X11
      'wl-copy', 'wl-paste'          // Linux Wayland
    ];

    for (const cmd of commandsToCheck) {
      try {
        execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' });
        info.availableCommands.push(cmd);
      } catch {
        // Command not available
      }
    }

    // Check X11/Wayland
    info.hasX11 = !!process.env.DISPLAY || info.availableCommands.some(cmd => 
      ['xclip', 'xsel'].includes(cmd));
    info.hasWayland = !!process.env.WAYLAND_DISPLAY || info.availableCommands.some(cmd => 
      ['wl-copy', 'wl-paste'].includes(cmd));

    return info;
  }

  /**
   * Generate test cases for validation
   */
  private generateTestCases() {
    return [
      {
        name: 'Simple text',
        text: 'Hello World',
        expectedLength: 11,
        hasNewlines: false,
        hasSpecialChars: false
      },
      {
        name: 'Multi-line text',
        text: 'Line 1\nLine 2\nLine 3',
        expectedLength: 20,
        hasNewlines: true,
        hasSpecialChars: false
      },
      {
        name: 'Special characters',
        text: 'const obj = { "key": "value", num: 42 };',
        expectedLength: 38,
        hasNewlines: false,
        hasSpecialChars: true
      },
      {
        name: 'Unicode content',
        text: 'Hello 👋 World 🌍 Unicode 文字 Test',
        expectedLength: 31,
        hasNewlines: false,
        hasSpecialChars: true
      },
      {
        name: 'Large text block',
        text: 'Large text block\n'.repeat(100),
        expectedLength: 1700,
        hasNewlines: true,
        hasSpecialChars: false
      },
      {
        name: 'Empty string',
        text: '',
        expectedLength: 0,
        hasNewlines: false,
        hasSpecialChars: false
      },
      {
        name: 'Code snippet',
        text: `function validateSelection(text: string): boolean {
  if (!text) return false;
  return text.length > 0;
}`,
        expectedLength: 88,
        hasNewlines: true,
        hasSpecialChars: true
      }
    ];
  }

  /**
   * Run a single test case
   */
  private async runSingleTest(
    testCase: any, 
    platformInfo: PlatformInfo
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Test copy operation
      const copyResult = await this.clipboardManager.copyText(
        testCase.text, 
        'validation-test'
      );

      if (!copyResult.success) {
        return {
          platform: platformInfo.os,
          test: testCase.name,
          success: false,
          error: `Copy failed: ${copyResult.error}`,
          executionTime: Date.now() - startTime,
          details: {
            textLength: testCase.text.length,
            hasNewlines: testCase.hasNewlines,
            hasSpecialChars: testCase.hasSpecialChars,
            method: copyResult.method || 'unknown'
          }
        };
      }

      // Test paste operation (verify copy worked)
      const pasteResult = await this.clipboardManager.pasteText();
      
      if (!pasteResult.success) {
        return {
          platform: platformInfo.os,
          test: testCase.name,
          success: false,
          error: `Paste failed: ${pasteResult.error}`,
          executionTime: Date.now() - startTime,
          details: {
            textLength: testCase.text.length,
            hasNewlines: testCase.hasNewlines,
            hasSpecialChars: testCase.hasSpecialChars,
            method: copyResult.method
          }
        };
      }

      // Verify content matches
      const contentMatches = pasteResult.data === testCase.text;
      
      return {
        platform: platformInfo.os,
        test: testCase.name,
        success: contentMatches,
        error: contentMatches ? undefined : `Content mismatch: expected "${testCase.text}", got "${pasteResult.data}"`,
        executionTime: Date.now() - startTime,
        details: {
          textLength: testCase.text.length,
          hasNewlines: testCase.hasNewlines,
          hasSpecialChars: testCase.hasSpecialChars,
          method: copyResult.method
        }
      };

    } catch (error) {
      return {
        platform: platformInfo.os,
        test: testCase.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        details: {
          textLength: testCase.text.length,
          hasNewlines: testCase.hasNewlines,
          hasSpecialChars: testCase.hasSpecialChars,
          method: 'unknown'
        }
      };
    }
  }

  /**
   * Generate validation report
   */
  generateReport(results: ValidationResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    let report = `
# Clipboard Validation Report

## Summary
- **Platform**: ${results[0]?.platform || 'Unknown'}
- **Total Tests**: ${totalTests}
- **Passed**: ${passedTests}
- **Failed**: ${failedTests}
- **Pass Rate**: ${passRate}%

## Test Results

`;

    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const time = result.executionTime;
      
      report += `### ${result.test} ${status}\n`;
      report += `- **Execution Time**: ${time}ms\n`;
      report += `- **Text Length**: ${result.details.textLength}\n`;
      report += `- **Method**: ${result.details.method}\n`;
      report += `- **Has Newlines**: ${result.details.hasNewlines}\n`;
      report += `- **Has Special Chars**: ${result.details.hasSpecialChars}\n`;
      
      if (!result.success && result.error) {
        report += `- **Error**: ${result.error}\n`;
      }
      
      report += '\n';
    });

    report += `
## Performance Analysis

- **Average Execution Time**: ${(results.reduce((sum, r) => sum + r.executionTime, 0) / results.length).toFixed(1)}ms
- **Slowest Test**: ${Math.max(...results.map(r => r.executionTime))}ms
- **Fastest Test**: ${Math.min(...results.map(r => r.executionTime))}ms

## Recommendations

`;

    if (passRate === '100.0') {
      report += '- ✅ All clipboard operations working correctly\n';
      report += '- ✅ Platform integration is functioning properly\n';
    } else {
      report += '- ⚠️  Some clipboard operations are failing\n';
      report += '- 🔍 Review failed tests and platform-specific implementation\n';
      
      const failedResults = results.filter(r => !r.success);
      if (failedResults.length > 0) {
        report += `- 🐛 Common failure reasons: ${[...new Set(failedResults.map(r => r.error))].join(', ')}\n`;
      }
    }

    return report;
  }
}

// CLI interface for running validation
if (require.main === module) {
  async function main() {
    const validator = new ClipboardValidator();
    
    console.log('🧪 Starting clipboard validation...\n');
    
    try {
      const results = await validator.runValidation();
      const report = validator.generateReport(results);
      
      console.log('\n' + report);
      
      // Exit with error code if any tests failed
      const allPassed = results.every(r => r.success);
      process.exit(allPassed ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }
  
  main();
}