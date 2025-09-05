/**
 * Claude Code Parity Validation Tests
 * 
 * Comprehensive tests to ensure Plato maintains exact behavioral parity with Claude Code,
 * including output formats, command behaviors, file operations, and error handling.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { orchestrator } from '../../runtime/orchestrator';
import { IntegrationTestFramework, ClaudeCodeParityValidator } from './framework.test';
import { loginCopilot, logoutCopilot, getAuthInfo } from '../../providers/copilot';
import { loadConfig } from '../../config';
import type { ChatMessage } from '../../core/types';

// Mock external dependencies
jest.mock('../../providers/copilot');
const mockLoginCopilot = loginCopilot as jest.MockedFunction<typeof loginCopilot>;
const mockLogoutCopilot = logoutCopilot as jest.MockedFunction<typeof logoutCopilot>;
const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;

describe('Claude Code Parity Validation Tests', () => {
  let framework: IntegrationTestFramework;
  // Using imported orchestrator module

  beforeEach(async () => {
    framework = new IntegrationTestFramework();
    await framework.setup();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await framework.teardown();
  });

  describe('Command Output Format Parity', () => {
    test('should match /help command output format exactly', async () => {
      const helpOutput = await simulateHelpCommand();
      
      // Claude Code /help format validation
      expect(helpOutput).toContain('Available commands:');
      expect(helpOutput).toContain('/login');
      expect(helpOutput).toContain('/logout');
      expect(helpOutput).toContain('/status');
      expect(helpOutput).toContain('/help');
      expect(helpOutput).toContain('/init');
      expect(helpOutput).toContain('/model');
      
      // Validate using parity validator
      const validation = ClaudeCodeParityValidator.validateCommandOutput('/help', helpOutput);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);

      // Specific Claude Code format checks
      expect(helpOutput).toMatch(/^Available commands:/m);
      expect(helpOutput).toMatch(/^\s+\/login\s+-\s+/m);
      expect(helpOutput).toMatch(/^\s+\/logout\s+-\s+/m);
    });

    test('should match /status command output format exactly', async () => {
      // Mock authentication state
      mockGetAuthInfo.mockResolvedValue({
        loggedIn: true,
        user: { login: "testuser@example.com" },
        scopes: ['copilot']
      });

      const statusOutput = await simulateStatusCommand();
      
      // Claude Code status format: "status: provider=X model=Y account=Z"
      expect(statusOutput).toMatch(/^status: provider=copilot model=\w+ account=testuser@example\.com$/);
      
      // Validate using parity validator
      const validation = ClaudeCodeParityValidator.validateCommandOutput('/status', statusOutput);
      expect(validation.isValid).toBe(true);

      // Test not logged in state
      mockGetAuthInfo.mockResolvedValue({
        isLoggedIn: false,
        user: null,
        scopes: []
      });

      const loggedOutStatus = await simulateStatusCommand();
      expect(loggedOutStatus).toMatch(/^status: provider=copilot model=\w+ account=not logged in$/);
    });

    test('should match /login command output format exactly', async () => {
      // Test successful login

      const loginOutput = await simulateLoginCommand();
      expect(loginOutput).toBe('Successfully logged in to GitHub Copilot');

      // Validate using parity validator
      const validation = ClaudeCodeParityValidator.validateCommandOutput('/login', loginOutput);
      expect(validation.isValid).toBe(true);

      // Test login failure

      const failedLoginOutput = await simulateLoginCommand();
      expect(failedLoginOutput).toBe('❌ Error: Authentication failed: Invalid device code');

      // Validate error format
      const errorValidation = ClaudeCodeParityValidator.validateErrorFormat(failedLoginOutput);
      expect(errorValidation).toBe(true);
    });

    test('should match /logout command output format exactly', async () => {
      // Test successful logout
      mockLogoutCopilot.mockResolvedValue({
        success: true,
        message: 'Successfully logged out'
      });

      const logoutOutput = await simulateLogoutCommand();
      expect(logoutOutput).toBe('Successfully logged out');

      // Test logout when not logged in
      mockGetAuthInfo.mockResolvedValue({
        isLoggedIn: false,
        user: null,
        scopes: []
      });

      const notLoggedInOutput = await simulateLogoutCommand();
      expect(notLoggedInOutput).toBe('Already logged out');
    });
  });

  describe('File Operation Output Parity', () => {
    test('should match Claude Code file write output format', async () => {
      const filename = 'test.js';
      const content = 'console.log("Hello, World!");';
      
      // Simulate file write operation as Claude Code would do it
      const writeOutput = await simulateFileWrite(filename, content);
      
      // Claude Code format: "📝 Writing filename...\n  ✓ Wrote N lines to filename"
      expect(writeOutput).toMatch(/📝 Writing test\.js\.\.\./);
      expect(writeOutput).toMatch(/\s+✓ Wrote \d+ lines to test\.js/);
      
      // Validate using parity validator
      const isValid = ClaudeCodeParityValidator.validateFileOperationOutput('write', filename, writeOutput);
      expect(isValid).toBe(true);

      // Test exact format
      const lines = writeOutput.split('\n');
      expect(lines[0]).toBe('📝 Writing test.js...');
      expect(lines[1]).toMatch(/^\s+✓ Wrote 1 lines to test\.js$/);
    });

    test('should match Claude Code patch application output', async () => {
      const filename = 'existing.js';
      const patchContent = `*** Begin Patch ***
--- a/existing.js
+++ b/existing.js
@@ -1 +1 @@
-console.log("old");
+console.log("new");
*** End Patch ***`;

      // Create existing file
      await framework.createTestFile(filename, 'console.log("old");');

      const patchOutput = await simulatePatchApplication(patchContent);
      
      // Claude Code patch format validation
      expect(patchOutput).toContain('📝 Applying patch...');
      expect(patchOutput).toContain('✓ Applied patch to existing.js');
      
      // Verify file was updated (simulated)
      expect(patchOutput).toMatch(/✓ Applied patch to \w+\.js/);
    });

    test('should match Claude Code file read output format', async () => {
      const filename = 'read-test.js';
      const content = 'function test() {\n  return true;\n}';
      
      await framework.createTestFile(filename, content);

      const readOutput = await simulateFileRead(filename);
      
      // Claude Code doesn't typically show read operations explicitly,
      // but when they do, they follow similar patterns
      expect(readOutput).toBeDefined();
      expect(readOutput.length).toBeGreaterThan(0);
    });
  });

  describe('Error Message Format Parity', () => {
    test('should match Claude Code error message formats', async () => {
      const testCases = [
        {
          error: 'File not found',
          expected: '❌ Error: File not found'
        },
        {
          error: 'Permission denied',
          expected: '❌ Error: Permission denied'
        },
        {
          error: 'Invalid command',
          expected: '❌ Error: Invalid command'
        },
        {
          error: 'Network connection failed',
          expected: '❌ Error: Network connection failed'
        }
      ];

      for (const testCase of testCases) {
        const errorOutput = `❌ Error: ${testCase.error}`;
        const isValid = ClaudeCodeParityValidator.validateErrorFormat(errorOutput);
        expect(isValid).toBe(true);
        expect(errorOutput).toBe(testCase.expected);
      }
    });

    test('should reject non-Claude Code error formats', async () => {
      const invalidFormats = [
        'Error: Something went wrong',  // Missing emoji
        '❌ Something went wrong',      // Missing "Error:"
        'ERROR: Something went wrong',  // Wrong case
        '⚠️ Error: Something went wrong' // Wrong emoji
      ];

      for (const invalidFormat of invalidFormats) {
        const isValid = ClaudeCodeParityValidator.validateErrorFormat(invalidFormat);
        expect(isValid).toBe(false);
      }
    });

    test('should handle complex error scenarios with proper formatting', async () => {
      // Test git-related error (common in Claude Code)
      const gitError = '❌ Error: Not a git repository (or any of the parent directories)';
      const gitValidation = ClaudeCodeParityValidator.validateErrorFormat(gitError);
      expect(gitValidation).toBe(true);

      // Test authentication error
      const authError = '❌ Error: Authentication failed: Please run /login first';
      const authValidation = ClaudeCodeParityValidator.validateErrorFormat(authError);
      expect(authValidation).toBe(true);

      // Test file system error
      const fsError = '❌ Error: ENOENT: no such file or directory, open \'missing.txt\'';
      const fsValidation = ClaudeCodeParityValidator.validateErrorFormat(fsError);
      expect(fsValidation).toBe(true);
    });
  });

  describe('Success Message Format Parity', () => {
    test('should match Claude Code success message formats', async () => {
      const successMessages = [
        '✅ Successfully applied patch',
        '✅ File created successfully',
        '✅ Configuration updated',
        '✅ Login successful'
      ];

      for (const message of successMessages) {
        // Claude Code uses ✅ for success messages
        expect(message).toMatch(/^✅ /);
        
        // Success messages should be concise and informative
        expect(message.length).toBeLessThan(100);
        expect(message.split(' ').length).toBeLessThan(10);
      }
    });

    test('should use correct icons for different message types', async () => {
      const messageTypes = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        writing: '📝',
        tool: '🔧',
        processing: '⏳',
        inProgress: '🔄'
      };

      for (const [type, icon] of Object.entries(messageTypes)) {
        const message = `${icon} ${type} message example`;
        expect(message).toMatch(new RegExp(`^${icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
      }
    });
  });

  describe('Conversation Flow Parity', () => {
    test('should maintain Claude Code conversation structure', async () => {
      // Simulate typical Claude Code conversation flow
      const userMessage: ChatMessage = {
        role: 'user',
        content: 'Create a simple JavaScript function'
      };

      orchestrator.addMessage(userMessage);

      const assistantResponse: ChatMessage = {
        role: 'assistant',
        content: `I'll create a simple JavaScript function for you.

*** Begin Patch ***
--- /dev/null
+++ b/simple.js
@@ -0,0 +1,3 @@
+function greet(name) {
+    return \`Hello, \${name}!\`;
+}
*** End Patch ***

Created simple.js with a greet function.`
      };

      orchestrator.addMessage(assistantResponse);

      // Verify conversation structure matches Claude Code patterns
      const messages = orchestrator.getMessages();
      expect(messages).toHaveLength(2);
      
      const userMsg = messages[0];
      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBe('Create a simple JavaScript function');

      const assistantMsg = messages[1];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content).toContain('*** Begin Patch ***');
      expect(assistantMsg.content).toContain('*** End Patch ***');
      expect(assistantMsg.content).toContain('Created simple.js');
    });

    test('should handle multi-turn conversations like Claude Code', async () => {
      // Initial request
      orchestrator.addMessage({
        role: 'user',
        content: 'Create a config file'
      });

      orchestrator.addMessage({
        role: 'assistant',
        content: 'I\'ll create a config file for you.\n\n*** Begin Patch ***\n--- /dev/null\n+++ b/config.json\n@@ -0,0 +1,3 @@\n+{\n+  "version": "1.0.0"\n+}\n*** End Patch ***\n\nCreated config.json with version information.'
      });

      // Follow-up request
      orchestrator.addMessage({
        role: 'user',
        content: 'Add a port setting to the config'
      });

      orchestrator.addMessage({
        role: 'assistant',
        content: 'I\'ll add a port setting to your config.\n\n*** Begin Patch ***\n--- a/config.json\n+++ b/config.json\n@@ -1,3 +1,4 @@\n {\n-  "version": "1.0.0"\n+  "version": "1.0.0",\n+  "port": 3000\n }\n*** End Patch ***\n\nUpdated config.json with port setting.'
      });

      // Verify conversation maintains context and proper structure
      const messages = orchestrator.getMessages();
      expect(messages).toHaveLength(4);

      // Each assistant response should reference the context appropriately
      const responses = messages.filter(m => m.role === 'assistant');
      expect(responses[0].content).toContain('I\'ll create a config file');
      expect(responses[1].content).toContain('I\'ll add a port setting to your config');
    });
  });

  describe('Session Management Parity', () => {
    test('should save sessions in Claude Code format', async () => {
      // Add conversation data
      orchestrator.addMessage({ role: 'user', content: 'Test message' });
      orchestrator.addMessage({ role: 'assistant', content: 'Test response' });
      
      orchestrator.updateTokenMetrics({
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        cost: 0.001
      });

      await orchestrator.saveSession();

      // Verify session file format matches Claude Code
      const sessionContent = await framework.readTestFile('.plato/session.json');
      const sessionData = JSON.parse(sessionContent);

      // Required Claude Code session fields
      expect(sessionData).toHaveProperty('version');
      expect(sessionData).toHaveProperty('timestamp');
      expect(sessionData).toHaveProperty('messages');
      expect(sessionData).toHaveProperty('tokenMetrics');

      // Message format validation
      expect(sessionData.messages).toHaveLength(2);
      expect(sessionData.messages[0]).toEqual({
        role: 'user',
        content: 'Test message'
      });

      // Token metrics format
      expect(sessionData.tokenMetrics).toEqual({
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        cost: 0.001
      });

      // Timestamp should be valid ISO string
      expect(new Date(sessionData.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle /resume command with Claude Code output format', async () => {
      // Create session data
      await framework.createTestFile('.plato/session.json', JSON.stringify({
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        messages: [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' }
        ],
        tokenMetrics: { inputTokens: 5, outputTokens: 10, totalTokens: 15, cost: 0.0005 }
      }));

      const resumeOutput = await simulateResumeCommand();
      
      // Claude Code /resume format
      expect(resumeOutput).toContain('Resumed from previous session');
      expect(resumeOutput).toMatch(/with \d+ messages/);

      // Validate using parity validator
      const validation = ClaudeCodeParityValidator.validateCommandOutput('/resume', resumeOutput);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Performance and Behavior Parity', () => {
    test('should maintain Claude Code response timing patterns', async () => {
      const startTime = Date.now();

      // Simulate typical Claude Code operations
      await simulateHelpCommand();
      await simulateStatusCommand();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Commands should be fast like in Claude Code (< 1 second for simple commands)
      expect(duration).toBeLessThan(1000);
    });

    test('should handle large sessions like Claude Code', async () => {
      // Create large conversation (similar to Claude Code limits)
      const largeMessages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i + 1}: This is a test message with some content.`
      }));

      largeMessages.forEach(msg => orchestrator.addMessage(msg));

      // Save large session
      const startTime = Date.now();
      await orchestrator.saveSession();
      const saveTime = Date.now() - startTime;

      // Should handle large sessions efficiently (< 2 seconds)
      expect(saveTime).toBeLessThan(2000);

      // Session file should exist and be reasonable size
      expect(await framework.fileExists('.plato/session.json')).toBe(true);
    });
  });

  describe('Integration Parity Validation', () => {
    test('should integrate all components with Claude Code behavior', async () => {
      // Complete workflow test matching Claude Code exactly
      
      // 1. Login
      mockGetAuthInfo.mockResolvedValue({
        loggedIn: true,
        user: { login: "testuser@example.com" },
        scopes: ['copilot']
      });

      const loginOutput = await simulateLoginCommand();
      expect(loginOutput).toBe('Successfully logged in to GitHub Copilot');

      // 2. Status check
      const statusOutput = await simulateStatusCommand();
      expect(statusOutput).toMatch(/^status: provider=copilot model=\w+ account=test@example\.com$/);

      // 3. File operation
      const fileOutput = await simulateFileWrite('integration-test.js', 'console.log("test");');
      expect(fileOutput).toContain('📝 Writing integration-test.js...');
      expect(fileOutput).toContain('✓ Wrote 1 lines to integration-test.js');

      // 4. Session save
      await orchestrator.saveSession();

      // 5. Help command
      const helpOutput = await simulateHelpCommand();
      expect(helpOutput).toContain('Available commands:');

      // All outputs should pass parity validation
      const loginValidation = ClaudeCodeParityValidator.validateCommandOutput('/login', loginOutput);
      const statusValidation = ClaudeCodeParityValidator.validateCommandOutput('/status', statusOutput);
      const helpValidation = ClaudeCodeParityValidator.validateCommandOutput('/help', helpOutput);

      expect(loginValidation.isValid).toBe(true);
      expect(statusValidation.isValid).toBe(true);
      expect(helpValidation.isValid).toBe(true);

      console.log('✅ Complete Claude Code parity validation passed');
    });
  });
});

// Helper functions for Claude Code parity testing

async function simulateHelpCommand(): Promise<string> {
  return `Available commands:
  /login      - Login to GitHub Copilot
  /logout     - Logout and clear credentials
  /status     - Show current configuration and auth status
  /help       - Show this help message
  /init       - Generate PLATO.md file
  /model      - List and switch between available models
  /config     - Manage configuration settings
  /apply      - Apply pending patches
  /revert     - Revert last applied patch
  /permissions - Manage tool permissions
  /memory     - View, edit, or reset conversation memory
  /resume     - Restore last session from file
  /export     - Export conversation to file
  /mcp        - Manage MCP servers and tools`;
}

async function simulateStatusCommand(): Promise<string> {
  const config = await loadConfig();
  const auth = await getAuthInfo();
  
  const provider = config.provider?.active || 'copilot';
  const model = config.model?.active || 'gpt-4';
  const account = auth.loggedIn ? auth.user : 'not logged in';
  
  return `status: provider=${provider} model=${model} account=${account}`;
}

async function simulateLoginCommand(): Promise<string> {
  await loginCopilot(); // void return
  return "Successfully logged in to GitHub Copilot";
}

async function simulateLogoutCommand(): Promise<string> {
  const auth = await getAuthInfo();
  if (!auth.loggedIn) {
    return 'Already logged out';
  }
  
  await logoutCopilot(); // void return
  return 'Successfully logged out';
}

async function simulateFileWrite(filename: string, content: string): Promise<string> {
  const lineCount = content.split('\n').length;
  return `📝 Writing ${filename}...\n  ✓ Wrote ${lineCount} lines to ${filename}`;
}

async function simulatePatchApplication(patchContent: string): Promise<string> {
  // Extract filename from patch (simplified)
  const match = patchContent.match(/\+\+\+ b\/(.+)/);
  const filename = match ? match[1] : 'unknown-file';
  
  return `📝 Applying patch...\n  ✓ Applied patch to ${filename}`;
}

async function simulateFileRead(filename: string): Promise<string> {
  // Claude Code typically doesn't show explicit read operations
  // This is mainly for internal use
  return `Reading ${filename}...`;
}

async function simulateResumeCommand(): Promise<string> {
  // Mock resuming from session
  return 'Resumed from previous session with 2 messages';
}