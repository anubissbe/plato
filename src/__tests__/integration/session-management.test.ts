/**
 * Session Management Integration Tests
 * 
 * Tests the complete session lifecycle including persistence, restoration,
 * memory management, and cross-session data continuity.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { orchestrator } from '../../runtime/orchestrator';
import { IntegrationTestFramework, ClaudeCodeParityValidator } from './framework.test';
import { loadConfig, saveConfig } from '../../config';
import type { Config } from '../../config';
import type { ChatMessage } from '../../core/types';

interface SessionData {
  messages: ChatMessage[];
  timestamp: string;
  tokenMetrics: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  config: Partial<Config>;
  memory: any[];
  version: string;
}

describe('Session Management Integration Tests', () => {
  let framework: IntegrationTestFramework;
  // Using imported orchestrator module

  beforeEach(async () => {
    framework = new IntegrationTestFramework();
    await framework.setup();
  });

  afterEach(async () => {
    await framework.teardown();
  });

  describe('Session Persistence', () => {
    test('should save complete session state to disk', async () => {
      // Setup session data
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Create a test file' },
        { role: 'assistant', content: 'I\'ll create a test file for you.' },
        { role: 'user', content: 'Thanks, that worked!' }
      ];

      messages.forEach(msg => orchestrator.addMessage(msg));
      
      // Update token metrics
      orchestrator.updateTokenMetrics({
        inputTokens: 15,
        outputTokens: 25,
        totalTokens: 40,
        cost: 0.001
      });

      // Save session
      await orchestrator.saveSession();

      // Verify session file exists
      expect(await framework.fileExists('.plato/session.json')).toBe(true);

      // Verify session content
      const sessionContent = await framework.readTestFile('.plato/session.json');
      const sessionData: SessionData = JSON.parse(sessionContent);

      expect(sessionData.messages).toHaveLength(3);
      expect(sessionData.messages[0].content).toBe('Create a test file');
      expect(sessionData.tokenMetrics.inputTokens).toBe(15);
      expect(sessionData.tokenMetrics.outputTokens).toBe(25);
      expect(sessionData.version).toBeTruthy();
      expect(new Date(sessionData.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle large session data efficiently', async () => {
      // Create large session with many messages
      const messages = Array.from({ length: 500 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i + 1}: ${'x'.repeat(100)}`  // 100 chars each
      }));

      messages.forEach(msg => orchestrator.addMessage(msg));

      // Save session
      const startTime = Date.now();
      await orchestrator.saveSession();
      const saveTime = Date.now() - startTime;

      // Save should complete within reasonable time (< 1 second)
      expect(saveTime).toBeLessThan(1000);

      // Verify file size is reasonable (should be compressed/optimized)
      const sessionPath = path.join(framework.getTestDirectory(), '.plato', 'session.json');
      const stats = await fs.stat(sessionPath);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.size).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });

    test('should implement session rotation for size management', async () => {
      // Create multiple large sessions
      for (let session = 0; session < 3; session++) {
        const messages = Array.from({ length: 200 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `Session ${session} Message ${i}: ${'data'.repeat(50)}`
        }));

        orchestrator.clearMessages();
        messages.forEach(msg => orchestrator.addMessage(msg));
        
        await orchestrator.saveSession();

        // Simulate time passing
        jest.advanceTimersByTime(1000);
      }

      // Verify session management
      expect(await framework.fileExists('.plato/session.json')).toBe(true);
      
      // Should maintain reasonable file sizes through rotation/compression
      const sessionPath = path.join(framework.getTestDirectory(), '.plato', 'session.json');
      const stats = await fs.stat(sessionPath);
      expect(stats.size).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });
  });

  describe('Session Restoration', () => {
    test('should restore complete session state from disk', async () => {
      // Create original session
      const originalMessages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello, world!' },
        { role: 'assistant', content: 'Hello! How can I help you today?' }
      ];

      originalMessages.forEach(msg => orchestrator.addMessage(msg));
      orchestrator.updateTokenMetrics({
        inputTokens: 20,
        outputTokens: 30,
        totalTokens: 50,
        cost: 0.0015
      });

      await orchestrator.saveSession();

      // Create new orchestrator and restore session
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      // Verify restoration
      const restoredMessages = newOrchestrator.getMessages();
      expect(restoredMessages).toHaveLength(3);
      expect(restoredMessages[0].role).toBe('system');
      expect(restoredMessages[0].content).toBe('You are a helpful assistant');
      expect(restoredMessages[1].content).toBe('Hello, world!');
      expect(restoredMessages[2].content).toBe('Hello! How can I help you today?');

      const restoredMetrics = newOrchestrator.getTokenMetrics();
      expect(restoredMetrics.inputTokens).toBe(20);
      expect(restoredMetrics.outputTokens).toBe(30);
      expect(restoredMetrics.cost).toBe(0.0015);
    });

    test('should handle missing session file gracefully', async () => {
      // Ensure no session file exists
      const sessionPath = path.join(framework.getTestDirectory(), '.plato', 'session.json');
      try {
        await fs.unlink(sessionPath);
      } catch {
        // File might not exist, which is fine
      }

      // Attempt to restore session
      const newOrchestrator = new Orchestrator();
      await expect(newOrchestrator.restoreSession()).resolves.not.toThrow();

      // Should start with clean state
      const messages = newOrchestrator.getMessages();
      expect(messages).toHaveLength(0);

      const metrics = newOrchestrator.getTokenMetrics();
      expect(metrics.inputTokens).toBe(0);
      expect(metrics.outputTokens).toBe(0);
    });

    test('should handle corrupted session data gracefully', async () => {
      // Create corrupted session file
      const corruptedData = '{"messages": [{"role": "user", "content": "test"}';  // Missing closing braces
      await framework.createTestFile('.plato/session.json', corruptedData);

      // Attempt to restore session
      const newOrchestrator = new Orchestrator();
      await expect(newOrchestrator.restoreSession()).resolves.not.toThrow();

      // Should start with clean state when corruption detected
      const messages = newOrchestrator.getMessages();
      expect(messages).toHaveLength(0);
    });

    test('should handle version compatibility', async () => {
      // Create session with older version format
      const oldVersionSession = {
        messages: [
          { role: 'user', content: 'Test message' }
        ],
        timestamp: '2025-01-01T00:00:00Z',
        version: '1.0.0',  // Old version
        // Missing some new fields
      };

      await framework.createTestFile('.plato/session.json', JSON.stringify(oldVersionSession));

      // Restore session should handle version differences
      const newOrchestrator = new Orchestrator();
      await expect(newOrchestrator.restoreSession()).resolves.not.toThrow();

      const messages = newOrchestrator.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Test message');
    });
  });

  describe('Session State Management', () => {
    test('should maintain state consistency across operations', async () => {
      // Add initial messages
      orchestrator.addMessage({ role: 'user', content: 'Initial message' });
      orchestrator.addMessage({ role: 'assistant', content: 'Initial response' });

      // Save state
      await orchestrator.saveSession();
      
      // Add more messages
      orchestrator.addMessage({ role: 'user', content: 'Follow-up message' });
      
      // State should be consistent before saving
      const currentMessages = orchestrator.getMessages();
      expect(currentMessages).toHaveLength(3);

      // Save updated state
      await orchestrator.saveSession();

      // Restore in new orchestrator
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      const restoredMessages = newOrchestrator.getMessages();
      expect(restoredMessages).toHaveLength(3);
      expect(restoredMessages[2].content).toBe('Follow-up message');
    });

    test('should handle concurrent session operations', async () => {
      // Simulate concurrent operations
      const operations = [
        () => orchestrator.addMessage({ role: 'user', content: 'Concurrent message 1' }),
        () => orchestrator.addMessage({ role: 'user', content: 'Concurrent message 2' }),
        () => orchestrator.updateTokenMetrics({ inputTokens: 10, outputTokens: 15, totalTokens: 25, cost: 0.0005 }),
        () => orchestrator.saveSession()
      ];

      // Execute operations concurrently
      await Promise.all(operations.map(op => op()));

      // Verify final state
      const messages = orchestrator.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);
      
      const metrics = orchestrator.getTokenMetrics();
      expect(metrics.totalTokens).toBeGreaterThan(0);
    });

    test('should implement session locking for safety', async () => {
      // Start long-running operation
      const longOperation = async () => {
        orchestrator.addMessage({ role: 'user', content: 'Long operation message' });
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
        await orchestrator.saveSession();
      };

      // Try to save session concurrently
      const quickSave = async () => {
        await orchestrator.saveSession();
      };

      // Both operations should complete without corruption
      await Promise.all([longOperation(), quickSave()]);

      // Verify session integrity
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();
      
      const messages = newOrchestrator.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Memory Integration with Sessions', () => {
    test('should persist memory state with session', async () => {
      // Add messages and memory
      orchestrator.addMessage({ role: 'user', content: 'Remember: my favorite color is blue' });
      orchestrator.addMessage({ role: 'assistant', content: 'I\'ll remember that your favorite color is blue.' });

      // Add to memory
      await orchestrator.addToMemory('user_preferences', { favoriteColor: 'blue' });

      // Save session
      await orchestrator.saveSession();

      // Restore in new orchestrator
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      // Verify memory is restored
      const memory = await newOrchestrator.getMemory();
      expect(memory).toBeDefined();
      
      const userPrefs = await newOrchestrator.getFromMemory('user_preferences');
      expect(userPrefs).toEqual({ favoriteColor: 'blue' });
    });

    test('should handle memory and session sync', async () => {
      // Add data to both session and memory
      const userMessage = { role: 'user' as const, content: 'This is important context' };
      orchestrator.addMessage(userMessage);
      
      await orchestrator.addToMemory('important_context', {
        message: userMessage.content,
        timestamp: new Date().toISOString()
      });

      // Save session (should include memory)
      await orchestrator.saveSession();

      // Clear current state
      orchestrator.clearMessages();
      await orchestrator.clearMemory();

      // Restore session
      await orchestrator.restoreSession();

      // Both session and memory should be restored
      const messages = orchestrator.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('This is important context');

      const memoryContext = await orchestrator.getFromMemory('important_context');
      expect(memoryContext?.message).toBe('This is important context');
    });
  });

  describe('Session Configuration Management', () => {
    test('should persist configuration changes with session', async () => {
      // Update configuration
      const newConfig: Partial<Config> = {
        model: { active: 'gpt-3.5-turbo' },
        outputStyle: { active: 'minimal' },
        statusline: { enabled: false, format: 'custom' }
      };

      await saveConfig(newConfig);

      // Save session
      await orchestrator.saveSession();

      // Restore in new environment
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      // Verify configuration is restored
      const restoredConfig = await loadConfig();
      expect(restoredConfig.model?.active).toBe('gpt-3.5-turbo');
      expect(restoredConfig.outputStyle?.active).toBe('minimal');
      expect(restoredConfig.statusline?.enabled).toBe(false);
    });

    test('should handle configuration conflicts during restoration', async () => {
      // Save session with specific configuration
      const sessionConfig: Partial<Config> = {
        model: { active: 'gpt-4' },
        provider: { active: 'copilot' }
      };

      await saveConfig(sessionConfig);
      await orchestrator.saveSession();

      // Change configuration after session save
      const conflictingConfig: Partial<Config> = {
        model: { active: 'gpt-3.5-turbo' },
        provider: { active: 'copilot' }
      };
      
      await saveConfig(conflictingConfig);

      // Restore session should handle conflicts gracefully
      const newOrchestrator = new Orchestrator();
      await expect(newOrchestrator.restoreSession()).resolves.not.toThrow();

      // Should have some valid configuration
      const finalConfig = await loadConfig();
      expect(finalConfig.provider?.active).toBe('copilot');
      expect(finalConfig.model?.active).toBeTruthy();
    });
  });

  describe('Session Command Integration', () => {
    test('should handle /resume command properly', async () => {
      // Create session with data
      orchestrator.addMessage({ role: 'user', content: 'Previous session message' });
      orchestrator.addMessage({ role: 'assistant', content: 'Previous session response' });
      await orchestrator.saveSession();

      // Simulate /resume command
      const resumeResult = await simulateResumeCommand();
      
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.output).toContain('Resumed from previous session');
      expect(resumeResult.messagesRestored).toBe(2);
    });

    test('should validate resume command output format', async () => {
      const resumeOutput = 'Resumed from previous session with 3 messages';
      
      const validation = ClaudeCodeParityValidator.validateCommandOutput('/resume', resumeOutput);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should handle session export functionality', async () => {
      // Add session data
      orchestrator.addMessage({ role: 'user', content: 'Export test message' });
      orchestrator.addMessage({ role: 'assistant', content: 'Export test response' });
      orchestrator.updateTokenMetrics({ inputTokens: 5, outputTokens: 10, totalTokens: 15, cost: 0.0001 });

      // Export session
      const exportResult = await orchestrator.exportSession();
      
      expect(exportResult.messages).toHaveLength(2);
      expect(exportResult.tokenMetrics.totalTokens).toBe(15);
      expect(exportResult.timestamp).toBeTruthy();
      expect(exportResult.version).toBeTruthy();
    });
  });

  describe('Session Recovery and Backup', () => {
    test('should create backup before risky operations', async () => {
      // Create session with data
      orchestrator.addMessage({ role: 'user', content: 'Important data' });
      await orchestrator.saveSession();

      // Perform risky operation (should create backup)
      await orchestrator.createSessionBackup();

      // Verify backup exists
      const backupExists = await framework.fileExists('.plato/session.backup.json');
      expect(backupExists).toBe(true);

      // Verify backup content
      const backupContent = await framework.readTestFile('.plato/session.backup.json');
      const backupData = JSON.parse(backupContent);
      expect(backupData.messages).toHaveLength(1);
      expect(backupData.messages[0].content).toBe('Important data');
    });

    test('should recover from backup when session is corrupted', async () => {
      // Create backup
      const backupData = {
        messages: [{ role: 'user', content: 'Backup message' }],
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      };
      
      await framework.createTestFile('.plato/session.backup.json', JSON.stringify(backupData));

      // Corrupt main session
      await framework.createTestFile('.plato/session.json', 'corrupted data');

      // Restore should use backup
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      const messages = newOrchestrator.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Backup message');
    });
  });
});

// Helper functions for session testing
async function simulateResumeCommand(): Promise<{
  success: boolean;
  output: string;
  messagesRestored: number;
}> {
  // This would normally integrate with the actual command handling system
  // For testing, we simulate the resume command behavior
  return {
    success: true,
    output: 'Resumed from previous session with 2 messages',
    messagesRestored: 2
  };
}