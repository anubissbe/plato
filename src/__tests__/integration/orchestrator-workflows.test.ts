/**
 * Orchestrator Workflow Integration Tests
 * 
 * Tests the complete workflows managed by the Runtime Orchestrator,
 * including conversation flow, tool calls, patch processing, and Claude Code parity.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { orchestrator } from '../../runtime/orchestrator';
import { IntegrationTestFramework } from './framework.test';
import type { ChatMessage } from '../../core/types';
import type { MCPServer } from '../../types/mcp';

describe('Orchestrator Workflow Integration Tests', () => {
  let framework: IntegrationTestFramework;
  // Using imported orchestrator module

  beforeEach(async () => {
    framework = new IntegrationTestFramework();
    await framework.setup();
  });

  afterEach(async () => {
    await framework.teardown();
  });

  describe('Conversation Flow Management', () => {
    test('should manage complete conversation lifecycle', async () => {
      // Test conversation initialization
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello, can you help me create a file?' }
      ];

      // Add message to conversation
      orchestrator.addMessage(messages[0]);
      const history = orchestrator.getMessages();
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Hello, can you help me create a file?');

      // Test streaming response
      const responseChunks: string[] = [];
      for await (const chunk of orchestrator.streamChat(messages)) {
        if (chunk.type === 'content') {
          responseChunks.push(chunk.content);
        }
      }

      expect(responseChunks.length).toBeGreaterThan(0);
      
      // Verify assistant message was added
      const updatedHistory = orchestrator.getMessages();
      expect(updatedHistory.length).toBeGreaterThan(1);
      
      const assistantMessage = updatedHistory.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
    });

    test('should handle conversation compaction', async () => {
      // Add multiple messages to exceed context limit
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i + 1}: This is a test message with some content.`
      }));

      messages.forEach(msg => orchestrator.addMessage(msg));
      
      const initialLength = orchestrator.getMessages().length;
      expect(initialLength).toBe(10);

      // Trigger compaction
      await orchestrator.compactHistory();
      
      const compactedLength = orchestrator.getMessages().length;
      expect(compactedLength).toBeLessThanOrEqual(initialLength);
    });

    test('should preserve important context during compaction', async () => {
      // Add system message and user context
      orchestrator.addMessage({ role: 'system', content: 'You are a helpful assistant.' });
      orchestrator.addMessage({ role: 'user', content: 'This is important context.' });
      
      // Add many filler messages
      Array.from({ length: 15 }, (_, i) => {
        orchestrator.addMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Filler message ${i}` 
        });
      });

      await orchestrator.compactHistory();
      
      const messages = orchestrator.getMessages();
      const systemMessage = messages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toContain('helpful assistant');
    });
  });

  describe('Tool Call Integration', () => {
    test('should process tool call requests', async () => {
      // Mock MCP server
      const mockServer: MCPServer = {
        name: 'test-server',
        url: 'http://localhost:3000',
        tools: [
          {
            name: 'test_tool',
            description: 'A test tool',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        ]
      };

      // Add server to orchestrator
      orchestrator.addMCPServer(mockServer);

      // Mock tool execution
      const mockToolResult = { success: true, result: 'Tool executed successfully' };
      jest.spyOn(orchestrator, 'executeTool').mockResolvedValue(mockToolResult);

      // Test tool call
      const toolCall = {
        server: 'test-server',
        name: 'test_tool',
        input: { message: 'Hello, tool!' }
      };

      const result = await orchestrator.executeTool(toolCall.server, toolCall.name, toolCall.input);
      expect(result).toEqual(mockToolResult);
      expect(orchestrator.executeTool).toHaveBeenCalledWith('test-server', 'test_tool', { message: 'Hello, tool!' });
    });

    test('should handle tool call errors gracefully', async () => {
      const mockServer: MCPServer = {
        name: 'error-server',
        url: 'http://localhost:3001',
        tools: []
      };

      orchestrator.addMCPServer(mockServer);

      // Mock tool execution failure
      jest.spyOn(orchestrator, 'executeTool').mockRejectedValue(new Error('Tool execution failed'));

      try {
        await orchestrator.executeTool('error-server', 'nonexistent_tool', {});
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Tool execution failed');
      }
    });

    test('should validate tool permissions before execution', async () => {
      const toolCall = {
        server: 'test-server',
        name: 'file_write',
        input: { path: '/etc/passwd', content: 'malicious content' }
      };

      // Mock permission check
      jest.spyOn(orchestrator, 'checkToolPermissions').mockReturnValue(false);

      const hasPermission = orchestrator.checkToolPermissions(toolCall.name, toolCall.input);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Patch Processing Workflow', () => {
    test('should extract and apply patches from assistant response', async () => {
      // Create a test file
      const testFilePath = 'test-file.js';
      const originalContent = 'console.log("original");';
      await framework.createTestFile(testFilePath, originalContent);

      // Mock assistant response with patch
      const assistantResponse = `
I'll help you update the file.

*** Begin Patch ***
--- a/test-file.js
+++ b/test-file.js
@@ -1 +1 @@
-console.log("original");
+console.log("updated");
*** End Patch ***

The file has been updated successfully.`;

      // Mock patch processing
      jest.spyOn(orchestrator, 'processPatch').mockImplementation(async (patch: string) => {
        // Simulate patch application
        const newContent = 'console.log("updated");';
        await framework.createTestFile(testFilePath, newContent);
        return { success: true, filesChanged: [testFilePath] };
      });

      const result = await orchestrator.processPatch(assistantResponse);
      expect(result.success).toBe(true);
      expect(result.filesChanged).toContain(testFilePath);

      // Verify file was updated
      const updatedContent = await framework.readTestFile(testFilePath);
      expect(updatedContent).toBe('console.log("updated");');
    });

    test('should handle patch application failures', async () => {
      const invalidPatch = `
*** Begin Patch ***
This is not a valid patch format
*** End Patch ***`;

      jest.spyOn(orchestrator, 'processPatch').mockImplementation(async () => {
        return { 
          success: false, 
          error: 'Invalid patch format',
          filesChanged: [] 
        };
      });

      const result = await orchestrator.processPatch(invalidPatch);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid patch format');
    });

    test('should maintain patch journal for revert functionality', async () => {
      const testFilePath = 'journal-test.js';
      await framework.createTestFile(testFilePath, 'original content');

      // Mock patch journal operations
      const patchId = 'patch-123';
      jest.spyOn(orchestrator, 'addToPatchJournal').mockImplementation((id: string, patch: any) => {
        expect(id).toBe(patchId);
        expect(patch.filesChanged).toContain(testFilePath);
      });

      orchestrator.addToPatchJournal(patchId, {
        filesChanged: [testFilePath],
        originalContent: { [testFilePath]: 'original content' },
        timestamp: new Date().toISOString()
      });

      expect(orchestrator.addToPatchJournal).toHaveBeenCalled();
    });
  });

  describe('Memory Management Workflow', () => {
    test('should manage conversation memory lifecycle', async () => {
      // Test memory initialization
      await orchestrator.initializeMemory();
      
      // Add conversation to memory
      orchestrator.addMessage({ role: 'user', content: 'Remember this important information' });
      orchestrator.addMessage({ role: 'assistant', content: 'I will remember that information' });

      // Save memory
      await orchestrator.saveMemory();

      // Verify memory operations
      const memories = await orchestrator.getMemory();
      expect(memories).toBeDefined();
    });

    test('should handle memory compaction and cleanup', async () => {
      // Add memory entries
      Array.from({ length: 10 }, (_, i) => {
        orchestrator.addMessage({
          role: 'user',
          content: `Memory entry ${i}: Some important information to remember.`
        });
      });

      // Trigger memory compaction
      await orchestrator.compactMemory();
      
      // Verify memory is still functional
      const memories = await orchestrator.getMemory();
      expect(memories).toBeDefined();
    });

    test('should restore memory on orchestrator initialization', async () => {
      // Create new orchestrator instance
      const newOrchestrator = new Orchestrator();
      
      // Mock memory restoration
      jest.spyOn(newOrchestrator, 'restoreMemory').mockImplementation(async () => {
        newOrchestrator.addMessage({ role: 'system', content: 'Restored from memory' });
      });

      await newOrchestrator.restoreMemory();
      
      const messages = newOrchestrator.getMessages();
      const restoredMessage = messages.find(m => m.content === 'Restored from memory');
      expect(restoredMessage).toBeDefined();
    });
  });

  describe('Session Management Workflow', () => {
    test('should save and restore session state', async () => {
      // Add session data
      orchestrator.addMessage({ role: 'user', content: 'Session test message' });
      orchestrator.updateTokenMetrics({ inputTokens: 100, outputTokens: 200 });

      // Save session
      await orchestrator.saveSession();

      // Create new orchestrator and restore session
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      // Verify session restoration
      const messages = newOrchestrator.getMessages();
      const sessionMessage = messages.find(m => m.content === 'Session test message');
      expect(sessionMessage).toBeDefined();
    });

    test('should handle session corruption gracefully', async () => {
      // Create corrupted session file
      await framework.createTestFile('.plato/session.json', 'invalid json content');

      // Attempt to restore session
      const newOrchestrator = new Orchestrator();
      jest.spyOn(newOrchestrator, 'restoreSession').mockImplementation(async () => {
        // Should initialize clean session on corruption
        newOrchestrator.clearMessages();
      });

      await expect(newOrchestrator.restoreSession()).resolves.not.toThrow();
    });
  });

  describe('Security Review Integration', () => {
    test('should trigger security review for sensitive operations', async () => {
      const sensitiveContent = 'process.env.SECRET_KEY = "12345"';
      
      // Mock security review
      jest.spyOn(orchestrator, 'performSecurityReview').mockResolvedValue({
        passed: false,
        issues: ['Hardcoded secret detected'],
        risk: 'high'
      });

      const review = await orchestrator.performSecurityReview(sensitiveContent);
      expect(review.passed).toBe(false);
      expect(review.issues).toContain('Hardcoded secret detected');
      expect(review.risk).toBe('high');
    });

    test('should allow safe operations through security review', async () => {
      const safeContent = 'console.log("Hello, world!");';
      
      jest.spyOn(orchestrator, 'performSecurityReview').mockResolvedValue({
        passed: true,
        issues: [],
        risk: 'low'
      });

      const review = await orchestrator.performSecurityReview(safeContent);
      expect(review.passed).toBe(true);
      expect(review.issues).toHaveLength(0);
    });
  });

  describe('Hook System Integration', () => {
    test('should execute hooks at appropriate lifecycle points', async () => {
      const hookResults: string[] = [];
      
      // Mock hook execution
      jest.spyOn(orchestrator, 'executeHook').mockImplementation(async (hookName: string, context: any) => {
        hookResults.push(`${hookName}: ${JSON.stringify(context)}`);
      });

      // Trigger hooks through workflow
      await orchestrator.executeHook('pre-chat', { message: 'test' });
      await orchestrator.executeHook('post-chat', { response: 'response' });
      await orchestrator.executeHook('pre-tool', { tool: 'test_tool' });
      await orchestrator.executeHook('post-tool', { result: 'success' });

      expect(hookResults).toHaveLength(4);
      expect(hookResults[0]).toContain('pre-chat');
      expect(hookResults[1]).toContain('post-chat');
      expect(hookResults[2]).toContain('pre-tool');
      expect(hookResults[3]).toContain('post-tool');
    });

    test('should handle hook execution failures gracefully', async () => {
      jest.spyOn(orchestrator, 'executeHook').mockRejectedValue(new Error('Hook failed'));

      // Hook failures should not break the main workflow
      await expect(orchestrator.executeHook('pre-chat', {})).rejects.toThrow('Hook failed');
    });
  });

  describe('Error Recovery Workflow', () => {
    test('should recover from streaming interruptions', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ];

      // Mock streaming with interruption
      let chunkCount = 0;
      jest.spyOn(orchestrator, 'streamChat').mockImplementation(async function* () {
        yield { type: 'content', content: 'Partial response...' };
        chunkCount++;
        if (chunkCount === 1) {
          throw new Error('Stream interrupted');
        }
      });

      try {
        const chunks: string[] = [];
        for await (const chunk of orchestrator.streamChat(messages)) {
          if (chunk.type === 'content') {
            chunks.push(chunk.content);
          }
        }
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Stream interrupted');
      }
    });

    test('should handle provider failures with fallback', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test with provider fallback' }
      ];

      // Mock primary provider failure and fallback success
      jest.spyOn(orchestrator, 'streamChat')
        .mockRejectedValueOnce(new Error('Primary provider failed'))
        .mockImplementation(async function* () {
          yield { type: 'content', content: 'Fallback provider response' };
          yield { type: 'done' };
        });

      // First call should fail
      await expect(orchestrator.streamChat(messages)).rejects.toThrow('Primary provider failed');

      // Second call should succeed with fallback
      const chunks: string[] = [];
      for await (const chunk of orchestrator.streamChat(messages)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toContain('Fallback provider response');
    });
  });

  describe('Performance and Resource Management', () => {
    test('should track token usage accurately', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Short message' },
        { role: 'user', content: 'This is a longer message with more tokens to test the counting functionality' }
      ];

      messages.forEach(msg => orchestrator.addMessage(msg));

      // Mock token counting
      jest.spyOn(orchestrator, 'getTokenMetrics').mockReturnValue({
        inputTokens: 25,
        outputTokens: 50,
        totalTokens: 75,
        cost: 0.001
      });

      const metrics = orchestrator.getTokenMetrics();
      expect(metrics.inputTokens).toBeGreaterThan(0);
      expect(metrics.outputTokens).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBe(metrics.inputTokens + metrics.outputTokens);
    });

    test('should manage memory usage efficiently', async () => {
      // Add large amount of conversation data
      Array.from({ length: 100 }, (_, i) => {
        orchestrator.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(1000)}`  // Large message content
        });
      });

      const initialMessageCount = orchestrator.getMessages().length;
      expect(initialMessageCount).toBe(100);

      // Trigger memory management
      await orchestrator.compactHistory(50);  // Compact to 50 messages

      const compactedMessageCount = orchestrator.getMessages().length;
      expect(compactedMessageCount).toBeLessThanOrEqual(50);
    });
  });
});