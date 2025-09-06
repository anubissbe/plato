#!/usr/bin/env npx tsx

/**
 * Text Selection Validation Runner
 * Comprehensive validation of the text selection system
 */

import { SelectionAccuracyValidator } from '../src/validation/selection-accuracy';
import { ClipboardValidator } from '../src/validation/clipboard-validator';

interface ValidationSuite {
  accuracy: boolean;
  clipboard: boolean;
  integration: boolean;
}

async function runValidationSuite(options: Partial<ValidationSuite> = {}): Promise<void> {
  const defaultOptions: ValidationSuite = {
    accuracy: true,
    clipboard: true,
    integration: true
  };
  
  const config = { ...defaultOptions, ...options };
  
  console.log('🚀 Starting Text Selection Validation Suite\n');
  console.log('Configuration:', config);
  console.log('='.repeat(50));
  
  let allTestsPassed = true;
  
  // Run accuracy validation
  if (config.accuracy) {
    console.log('\n📐 Running Selection Accuracy Validation...');
    try {
      const accuracyValidator = new SelectionAccuracyValidator();
      const accuracyResults = await accuracyValidator.runValidation();
      const accuracyReport = accuracyValidator.generateReport(accuracyResults);
      
      console.log(accuracyReport);
      
      const accuracyPassed = accuracyResults.every(r => r.passed);
      if (!accuracyPassed) {
        allTestsPassed = false;
        console.log('❌ Accuracy validation failed');
      } else {
        console.log('✅ Accuracy validation passed');
      }
    } catch (error) {
      console.error('❌ Accuracy validation error:', error);
      allTestsPassed = false;
    }
  }
  
  // Run clipboard validation
  if (config.clipboard) {
    console.log('\n📋 Running Clipboard Integration Validation...');
    try {
      const clipboardValidator = new ClipboardValidator();
      const clipboardResults = await clipboardValidator.runValidation();
      const clipboardReport = clipboardValidator.generateReport(clipboardResults);
      
      console.log(clipboardReport);
      
      const clipboardPassed = clipboardResults.every(r => r.success);
      if (!clipboardPassed) {
        allTestsPassed = false;
        console.log('❌ Clipboard validation failed');
      } else {
        console.log('✅ Clipboard validation passed');
      }
    } catch (error) {
      console.error('❌ Clipboard validation error:', error);
      allTestsPassed = false;
    }
  }
  
  // Run integration tests
  if (config.integration) {
    console.log('\n🔗 Running Integration Tests...');
    try {
      // Use Jest to run integration tests
      const { execSync } = await import('child_process');
      
      console.log('Running Jest integration tests...');
      execSync(
        'npx jest src/__tests__/selection-integration.test.ts --verbose',
        { stdio: 'inherit', cwd: process.cwd() }
      );
      
      console.log('✅ Integration tests passed');
    } catch (error) {
      console.error('❌ Integration tests failed:', error);
      allTestsPassed = false;
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 ALL VALIDATIONS PASSED!');
    console.log('✅ Text selection system is ready for production');
    process.exit(0);
  } else {
    console.log('⚠️  Some validations failed');
    console.log('🔍 Review the output above for details');
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): Partial<ValidationSuite> {
  const args = process.argv.slice(2);
  const options: Partial<ValidationSuite> = {};
  
  if (args.includes('--accuracy-only')) {
    options.accuracy = true;
    options.clipboard = false;
    options.integration = false;
  }
  
  if (args.includes('--clipboard-only')) {
    options.accuracy = false;
    options.clipboard = true;
    options.integration = false;
  }
  
  if (args.includes('--integration-only')) {
    options.accuracy = false;
    options.clipboard = false;
    options.integration = true;
  }
  
  if (args.includes('--no-accuracy')) {
    options.accuracy = false;
  }
  
  if (args.includes('--no-clipboard')) {
    options.clipboard = false;
  }
  
  if (args.includes('--no-integration')) {
    options.integration = false;
  }
  
  return options;
}

// Show help
function showHelp(): void {
  console.log(`
Text Selection Validation Runner

Usage: npx tsx scripts/validate-text-selection.ts [options]

Options:
  --accuracy-only      Run only accuracy validation
  --clipboard-only     Run only clipboard validation  
  --integration-only   Run only integration tests
  --no-accuracy        Skip accuracy validation
  --no-clipboard       Skip clipboard validation
  --no-integration     Skip integration tests
  --help              Show this help message

Examples:
  npx tsx scripts/validate-text-selection.ts                    # Run all validations
  npx tsx scripts/validate-text-selection.ts --accuracy-only    # Only test accuracy
  npx tsx scripts/validate-text-selection.ts --no-clipboard     # Skip clipboard tests
`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const options = parseArgs();
  runValidationSuite(options).catch(error => {
    console.error('❌ Validation suite failed:', error);
    process.exit(1);
  });
}

export { runValidationSuite };