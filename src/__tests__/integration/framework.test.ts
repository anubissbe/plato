/**
 * Integration Test Framework
 * 
 * This module provides the foundational framework for integration testing
 * in Plato V3, including test utilities, mock setups, and validation helpers.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { orchestrator } from '../../runtime/orchestrator';
import { loadConfig, saveConfig } from '../../config';
import type { Config } from '../../config';
import type { ChatMessage } from '../../core/types';

// Integration test utilities and fixtures
export class IntegrationTestFramework {
  private tempDir: string = '';
  private originalConfigPath: string = '';
  private testConfig: Config = {
    provider: { active: 'copilot' as const },
    model: { active: 'gpt-4' },
    outputStyle: { active: 'default' },
    permissions: {},
    statusline: { enabled: true, format: 'default' }
  };

  async setup(): Promise<void> {
    // Create temporary directory for test isolation
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plato-integration-test-'));
    
    // Set up test configuration
    process.env.PLATO_CONFIG_DIR = this.tempDir;
    process.env.PLATO_PROJECT_DIR = this.tempDir;
    
    // Initialize clean test environment
    await this.initializeTestEnvironment();
  }

  async teardown(): Promise<void> {
    // Clean up temporary directory
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up test directory:', error);
      }
    }

    // Clear environment variables
    delete process.env.PLATO_CONFIG_DIR;
    delete process.env.PLATO_PROJECT_DIR;
  }

  private async initializeTestEnvironment(): Promise<void> {
    // Create necessary directories
    const configDir = path.join(this.tempDir, '.plato');
    const memoryDir = path.join(configDir, 'memory');
    const commandsDir = path.join(configDir, 'commands');
    const stylesDir = path.join(configDir, 'styles');

    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.mkdir(stylesDir, { recursive: true });

    // Create test configuration
    await saveConfig(this.testConfig);

    // Create empty MCP servers configuration
    const mcpServersPath = path.join(configDir, 'mcp-servers.json');
    await fs.writeFile(mcpServersPath, JSON.stringify({}, null, 2));

    // Initialize git repository for patch testing
    const { execa } = await import('execa');
    try {
      await execa('git', ['init'], { cwd: this.tempDir });
      await execa('git', ['config', 'user.name', 'Test User'], { cwd: this.tempDir });
      await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: this.tempDir });
      
      // Create initial commit
      const readmePath = path.join(this.tempDir, 'README.md');
      await fs.writeFile(readmePath, '# Test Project\n');
      await execa('git', ['add', 'README.md'], { cwd: this.tempDir });
      await execa('git', ['commit', '-m', 'Initial commit'], { cwd: this.tempDir });
    } catch (error) {
      console.warn('Git initialization failed:', error);
    }
  }

  setupMockOrchestrator() {
    // Mock orchestrator methods for testing
    jest.spyOn(orchestrator, "respond").mockImplementation(async () => "Mock response for integration testing");
  }

  async createTestFile(relativePath: string, content: string): Promise<string> {
    const fullPath = path.join(this.tempDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  }

  async readTestFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.tempDir, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.tempDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getTestDirectory(): string {
    return this.tempDir;
  }

  async simulateUserInput(input: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      // This would simulate actual user input processing
      // For integration tests, we mock the input handling
      return {
        success: true,
        output: `Processed input: ${input}`
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Parity validation utilities
export class ClaudeCodeParityValidator {
  /**
   * Validates that output matches Claude Code format patterns
   */
  static validateCommandOutput(command: string, output: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    switch (command) {
      case '/help':
        if (!output.includes('Available commands:')) {
          issues.push('Help output should include "Available commands:" header');
        }
        if (!output.includes('/login')) {
          issues.push('Help should list /login command');
        }
        break;
        
      case '/status':
        if (!output.match(/status: provider=\w+ model=\w+/)) {
          issues.push('Status output should match format: "status: provider=X model=Y"');
        }
        break;
        
      case '/login':
        if (output.includes('success') && !output.includes('Successfully')) {
          issues.push('Login success should include "Successfully" message');
        }
        break;
        
      default:
        // Generic validation
        if (output.trim() === '') {
          issues.push('Command output should not be empty');
        }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Validates file operation output format
   */
  static validateFileOperationOutput(operation: string, filename: string, output: string): boolean {
    const patterns = {
      write: /📝 Writing .+\.\.\./,
      read: /Reading .+\.\.\./,
      delete: /Deleted .+/
    };

    const pattern = patterns[operation as keyof typeof patterns];
    return pattern ? pattern.test(output) : false;
  }

  /**
   * Validates error message format
   */
  static validateErrorFormat(output: string): boolean {
    return /❌ Error: .+/.test(output);
  }
}

// Integration test framework tests
describe('Integration Test Framework', () => {
  let framework: IntegrationTestFramework;

  beforeEach(async () => {
    framework = new IntegrationTestFramework();
    await framework.setup();
  });

  afterEach(async () => {
    await framework.teardown();
  });

  describe('Test Environment Setup', () => {
    test('should create isolated test environment', async () => {
      const testDir = framework.getTestDirectory();
      expect(testDir).toBeTruthy();
      
      // Verify .plato directory structure
      expect(await framework.fileExists('.plato/mcp-servers.json')).toBe(true);
      expect(await framework.fileExists('.plato/memory')).toBe(true);
      expect(await framework.fileExists('.plato/commands')).toBe(true);
      expect(await framework.fileExists('.plato/styles')).toBe(true);
    });

    test('should initialize git repository', async () => {
      const testDir = framework.getTestDirectory();
      expect(await framework.fileExists('.git')).toBe(true);
      expect(await framework.fileExists('README.md')).toBe(true);
    });

    test('should create test configuration', async () => {
      const config = await loadConfig();
      expect(config.provider?.active).toBe('copilot');
      expect(config.model?.active).toBe('gpt-4');
    });
  });

  describe('Test File Operations', () => {
    test('should create and read test files', async () => {
      const testContent = 'Hello, integration tests!';
      await framework.createTestFile('test.txt', testContent);
      
      const readContent = await framework.readTestFile('test.txt');
      expect(readContent).toBe(testContent);
    });

    test('should handle nested directory creation', async () => {
      await framework.createTestFile('nested/deep/file.js', 'console.log("test");');
      expect(await framework.fileExists('nested/deep/file.js')).toBe(true);
    });
  });

  describe('Mock Orchestrator', () => {
    test("should setup orchestrator module for testing", () => {
      framework.setupMockOrchestrator();
      expect(typeof orchestrator.respond).toBe("function");
    });
    test("should mock orchestrator response", async () => {
      framework.setupMockOrchestrator();
      const response = await orchestrator.respond("Test message");
      expect(response).toBe("Mock response for integration testing");
    });
  });

  describe('User Input Simulation', () => {
    test('should simulate user input processing', async () => {
      const result = await framework.simulateUserInput('/help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed input: /help');
    });
  });
});

// Claude Code Parity Validator tests
describe('Claude Code Parity Validator', () => {
  describe('Command Output Validation', () => {
    test('should validate help command output', () => {
      const validOutput = 'Available commands:\n/login - Login to GitHub Copilot\n/help - Show this help';
      const result = ClaudeCodeParityValidator.validateCommandOutput('/help', validOutput);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect invalid help output', () => {
      const invalidOutput = 'Command list:\n/login - Login';
      const result = ClaudeCodeParityValidator.validateCommandOutput('/help', invalidOutput);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Help output should include "Available commands:" header');
    });

    test('should validate status command output', () => {
      const validOutput = 'status: provider=copilot model=gpt-4 account=user@example.com';
      const result = ClaudeCodeParityValidator.validateCommandOutput('/status', validOutput);
      expect(result.isValid).toBe(true);
    });

    test('should validate login command output', () => {
      const validOutput = 'Successfully logged in to GitHub Copilot';
      const result = ClaudeCodeParityValidator.validateCommandOutput('/login', validOutput);
      expect(result.isValid).toBe(true);
    });
  });

  describe('File Operation Validation', () => {
    test('should validate write operation output', () => {
      const output = '📝 Writing test.js...';
      const isValid = ClaudeCodeParityValidator.validateFileOperationOutput('write', 'test.js', output);
      expect(isValid).toBe(true);
    });

    test('should validate error format', () => {
      const errorOutput = '❌ Error: File not found';
      const isValid = ClaudeCodeParityValidator.validateErrorFormat(errorOutput);
      expect(isValid).toBe(true);
    });

    test('should reject invalid error format', () => {
      const invalidError = 'Error: File not found';
      const isValid = ClaudeCodeParityValidator.validateErrorFormat(invalidError);
      expect(isValid).toBe(false);
    });
  });
});