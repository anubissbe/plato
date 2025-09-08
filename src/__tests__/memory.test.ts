import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { MemoryManager } from '../memory/manager';
import { MemoryEntry, MemoryStore } from '../memory/types';

// Mock fs for controlled testing
jest.mock('fs/promises');

describe('Memory System', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const testMemoryDir = '.plato/memory';
  const testPlatoFile = 'PLATO.md';
  
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('MemoryManager', () => {
    describe('initialization', () => {
      test('should create memory directory if it does not exist', async () => {
        mockFs.access.mockRejectedValue(new Error('ENOENT'));
        mockFs.mkdir.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          testMemoryDir,
          { recursive: true }
        );
      });

      test('should load PLATO.md on startup if it exists', async () => {
        const platoContent = `# PLATO.md

## Project Context
This is a test project.

## Commands
- build: npm run build
- test: npm test`;
        
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readFile.mockResolvedValue(platoContent);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        expect(mockFs.readFile).toHaveBeenCalledWith(testPlatoFile, 'utf8');
        const context = await manager.getProjectContext();
        expect(context).toContain('test project');
      });

      test('should handle missing PLATO.md gracefully', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        const context = await manager.getProjectContext();
        expect(context).toBe('');
      });
    });

    describe('memory persistence', () => {
      test('should save memory entries to disk', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        const entry: MemoryEntry = {
          id: 'test-123',
          type: 'context',
          content: 'Test memory content',
          timestamp: new Date().toISOString(),
        };
        
        await manager.addMemory(entry);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('.plato/memory/test-123.json'),
          expect.stringContaining('Test memory content'),
          'utf8'
        );
      });

      test('should load memory entries from disk', async () => {
        const memoryEntries = ['memory-1.json', 'memory-2.json'] as any;
        
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue(memoryEntries);
        mockFs.readFile.mockImplementation(((path: any) => {
          if (path.includes('memory-1')) {
            return Promise.resolve(JSON.stringify({
              id: 'memory-1',
              type: 'context',
              content: 'First memory',
              timestamp: '2025-01-01T00:00:00Z',
            }));
          }
          if (path.includes('memory-2')) {
            return Promise.resolve(JSON.stringify({
              id: 'memory-2',
              type: 'command',
              content: 'Second memory',
              timestamp: '2025-01-02T00:00:00Z',
            }));
          }
          return Promise.reject(new Error('File not found'));
        }) as any);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        const memories = await manager.getAllMemories();
        expect(memories).toHaveLength(2);
        expect(memories[0].content).toBe('First memory');
        expect(memories[1].content).toBe('Second memory');
      });

      test('should limit memory entries to prevent overflow', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue([]);
        mockFs.unlink.mockResolvedValue(undefined);
        
        const manager = new MemoryManager({ maxEntries: 3 });
        await manager.initialize();
        
        // Add 4 memories (exceeds limit)
        for (let i = 0; i < 4; i++) {
          await manager.addMemory({
            id: `memory-${i}`,
            type: 'context',
            content: `Memory ${i}`,
            timestamp: new Date(2025, 0, i + 1).toISOString(),
          });
        }
        
        // Should delete oldest memory
        expect(mockFs.unlink).toHaveBeenCalled();
      });
    });

    describe('memory management', () => {
      test('should clear all memories', async () => {
        const memoryFiles = ['memory-1.json', 'memory-2.json'] as any;
        
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue(memoryFiles);
        mockFs.unlink.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        await manager.clearAllMemories();
        
        expect(mockFs.unlink).toHaveBeenCalledTimes(2);
      });

      test('should search memories by content', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        
        // Pre-populate the memory store with test data
        const manager = new MemoryManager();
        await manager.initialize();
        
        // Directly add memories to test search functionality
        await manager.addMemory({
          id: 'memory-1',
          type: 'context',
          content: 'Testing React components',
          timestamp: '2025-01-01T00:00:00Z'
        });
        await manager.addMemory({
          id: 'memory-2',
          type: 'command',
          content: 'Running build scripts',
          timestamp: '2025-01-02T00:00:00Z'
        });
        
        const results = await manager.searchMemories('React');
        expect(results).toHaveLength(1);
        expect(results[0].content).toContain('React');
      });

      test('should get memories by type', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue([]); // No existing memories
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        // Directly add memories to test type filtering
        await manager.addMemory({
          id: 'memory-1',
          type: 'context',
          content: 'Context memory',
          timestamp: '2025-01-01T00:00:00Z'
        });
        await manager.addMemory({
          id: 'memory-2',
          type: 'command',
          content: 'Command memory',
          timestamp: '2025-01-02T00:00:00Z'
        });
        
        const contextMemories = await manager.getMemoriesByType('context');
        expect(contextMemories).toHaveLength(1);
        expect(contextMemories[0].type).toBe('context');
      });
    });

    describe('PLATO.md integration', () => {
      test('should save PLATO.md file', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        const content = `# Project Documentation

## Overview
Test project documentation.

## Commands
- test: npm test`;
        
        await manager.savePlatoFile(content);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          testPlatoFile,
          content,
          'utf8'
        );
      });

      test('should update project context from PLATO.md', async () => {
        const initialContent = '# Initial Content';
        const updatedContent = '# Updated Content\n\nNew project information.';
        
        mockFs.readFile.mockResolvedValueOnce(initialContent);
        mockFs.writeFile.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        await manager.updateProjectContext(updatedContent);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          testPlatoFile,
          expect.stringContaining('Updated Content'),
          'utf8'
        );
        
        const context = await manager.getProjectContext();
        expect(context).toContain('Updated Content');
      });

      test('should append to PLATO.md', async () => {
        const existingContent = '# PLATO.md\n\n## Existing Section';
        const appendContent = '\n## New Section\n\nNew content here.';
        
        mockFs.readFile.mockResolvedValue(existingContent);
        mockFs.writeFile.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        await manager.appendToPlatoFile(appendContent);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          testPlatoFile,
          existingContent + appendContent,
          'utf8'
        );
      });
    });

    describe('auto-load on startup', () => {
      test('should auto-load memories on startup', async () => {
        const memoryFiles = ['memory-1.json'] as any;
        
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue(memoryFiles);
        mockFs.readFile.mockImplementation(((path: any) => {
          if (path === testPlatoFile) {
            return Promise.resolve('# PLATO.md\n\nProject context');
          }
          return Promise.resolve(JSON.stringify({
            id: 'memory-1',
            type: 'startup',
            content: 'Auto-loaded memory',
            timestamp: '2025-01-01T00:00:00Z',
          }));
        }) as any);
        
        const manager = new MemoryManager({ autoLoad: true });
        await manager.initialize();
        
        const memories = await manager.getAllMemories();
        expect(memories).toHaveLength(1);
        expect(memories[0].content).toBe('Auto-loaded memory');
        
        const context = await manager.getProjectContext();
        expect(context).toContain('Project context');
      });
    });

    describe('session persistence', () => {
      test('should save session state', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        const sessionData = {
          startTime: new Date().toISOString(),
          commands: ['/help', '/status'],
          context: 'Current working context',
        };
        
        await manager.saveSession(sessionData);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('.plato/memory/session.json'),
          expect.stringContaining('commands'),
          'utf8'
        );
      });

      test('should restore session state', async () => {
        const sessionData = {
          startTime: '2025-01-01T00:00:00Z',
          commands: ['/help', '/status'],
          context: 'Restored context',
        };
        
        mockFs.readFile.mockResolvedValue(JSON.stringify(sessionData));
        
        const manager = new MemoryManager();
        await manager.initialize();
        
        const session = await manager.restoreSession();
        expect(session).toEqual(sessionData);
      });
    });
  });

  describe('cost metadata integration', () => {
    test('should save memory entries with cost metadata', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      const entry: MemoryEntry = {
        id: 'test-with-cost-123',
        type: 'transcript',
        content: 'User: Hello\nAssistant: Hi there!',
        timestamp: new Date().toISOString(),
        costMetadata: {
          cost: 0.002,
          inputTokens: 100,
          outputTokens: 50,
          model: 'gpt-3.5-turbo',
          provider: 'copilot',
          sessionId: 'session-123',
          command: '/chat',
          duration: 1500
        }
      };
      
      await manager.addMemory(entry);
      
      // Verify the file was written with cost metadata
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.plato/memory/test-with-cost-123.json'),
        expect.stringContaining('"cost":0.002'),
        'utf8'
      );
      
      // Verify the content includes all cost metadata fields
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls.find((call: any[]) => 
        call[0].includes('test-with-cost-123.json')
      );
      expect(writeCall).toBeDefined();
      const writtenContent = JSON.parse(writeCall![1] as string);
      expect(writtenContent.costMetadata).toEqual(entry.costMetadata);
    });

    test('should update memory cost metadata for existing entries', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'existing-memory',
        type: 'context',
        content: 'Test memory',
        timestamp: '2025-01-01T00:00:00Z'
      }));
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      // Add memory without cost metadata initially
      await manager.addMemory({
        id: 'existing-memory',
        type: 'context',
        content: 'Test memory',
        timestamp: '2025-01-01T00:00:00Z'
      });
      
      const costMetadata = {
        cost: 0.001,
        inputTokens: 75,
        outputTokens: 25,
        model: 'gpt-4',
        provider: 'copilot' as const,
        sessionId: 'session-456'
      };
      
      // Update with cost metadata
      await manager.updateMemoryCostMetadata('existing-memory', costMetadata);
      
      // Verify the file was updated with cost metadata
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.plato/memory/existing-memory.json'),
        expect.stringContaining('"cost":0.001'),
        'utf8'
      );
    });

    test('should calculate total costs for date range', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      // Add multiple memories with cost metadata
      const baseDate = new Date('2025-01-15T00:00:00Z');
      const memories = [
        {
          id: 'memory-1',
          type: 'transcript' as const,
          content: 'First interaction',
          timestamp: new Date(baseDate.getTime() + 1000).toISOString(),
          costMetadata: {
            cost: 0.001,
            inputTokens: 50,
            outputTokens: 25,
            model: 'gpt-3.5-turbo',
            provider: 'copilot' as const,
            sessionId: 'session-1'
          }
        },
        {
          id: 'memory-2',
          type: 'transcript' as const,
          content: 'Second interaction',
          timestamp: new Date(baseDate.getTime() + 2000).toISOString(),
          costMetadata: {
            cost: 0.002,
            inputTokens: 100,
            outputTokens: 50,
            model: 'gpt-4',
            provider: 'copilot' as const,
            sessionId: 'session-1'
          }
        },
        {
          id: 'memory-3',
          type: 'transcript' as const,
          content: 'Third interaction (outside range)',
          timestamp: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days later
          costMetadata: {
            cost: 0.003,
            inputTokens: 150,
            outputTokens: 75,
            model: 'gpt-4',
            provider: 'copilot' as const,
            sessionId: 'session-2'
          }
        }
      ];
      
      for (const memory of memories) {
        await manager.addMemory(memory);
      }
      
      // Calculate costs for first day only
      const startDate = new Date('2025-01-15T00:00:00Z');
      const endDate = new Date('2025-01-15T23:59:59Z');
      
      const costSummary = await manager.getTotalCostForPeriod(startDate, endDate);
      
      // Should only include first two memories (same day)
      expect(costSummary.totalCost).toBe(0.003); // 0.001 + 0.002
      expect(costSummary.totalInputTokens).toBe(150); // 50 + 100
      expect(costSummary.totalOutputTokens).toBe(75); // 25 + 50
      expect(costSummary.interactionCount).toBe(2);
      expect(costSummary.modelBreakdown).toEqual({
        'gpt-3.5-turbo': { cost: 0.001, tokens: 75, interactions: 1 },
        'gpt-4': { cost: 0.002, tokens: 150, interactions: 1 }
      });
    });

    test('should get memories with cost metadata for specific session', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      // Add memories for different sessions
      const memories = [
        {
          id: 'session-a-memory-1',
          type: 'transcript' as const,
          content: 'Session A interaction 1',
          timestamp: new Date().toISOString(),
          costMetadata: {
            cost: 0.001,
            inputTokens: 50,
            outputTokens: 25,
            model: 'gpt-3.5-turbo',
            provider: 'copilot' as const,
            sessionId: 'session-a'
          }
        },
        {
          id: 'session-a-memory-2',
          type: 'transcript' as const,
          content: 'Session A interaction 2',
          timestamp: new Date().toISOString(),
          costMetadata: {
            cost: 0.002,
            inputTokens: 100,
            outputTokens: 50,
            model: 'gpt-3.5-turbo',
            provider: 'copilot' as const,
            sessionId: 'session-a'
          }
        },
        {
          id: 'session-b-memory-1',
          type: 'transcript' as const,
          content: 'Session B interaction 1',
          timestamp: new Date().toISOString(),
          costMetadata: {
            cost: 0.003,
            inputTokens: 150,
            outputTokens: 75,
            model: 'gpt-4',
            provider: 'copilot' as const,
            sessionId: 'session-b'
          }
        }
      ];
      
      for (const memory of memories) {
        await manager.addMemory(memory);
      }
      
      const sessionAMemories = await manager.getSessionMemoriesWithCost('session-a');
      expect(sessionAMemories).toHaveLength(2);
      expect(sessionAMemories.every(m => m.costMetadata?.sessionId === 'session-a')).toBe(true);
      
      const sessionBMemories = await manager.getSessionMemoriesWithCost('session-b');
      expect(sessionBMemories).toHaveLength(1);
      expect(sessionBMemories[0].costMetadata?.sessionId).toBe('session-b');
    });

    test('should update and retrieve session cost analytics', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      const sessionId = 'test-session-analytics';
      const costData = {
        totalCost: 0.045,
        totalInputTokens: 2000,
        totalOutputTokens: 1000,
        interactionCount: 5,
        modelBreakdown: {
          'gpt-3.5-turbo': { cost: 0.025, tokens: 2000, interactions: 3 },
          'gpt-4': { cost: 0.020, tokens: 1000, interactions: 2 }
        }
      };
      
      await manager.updateSessionCostAnalytics(sessionId, costData);
      
      const retrievedAnalytics = await manager.getSessionCostAnalytics(sessionId);
      
      expect(retrievedAnalytics).toBeDefined();
      expect(retrievedAnalytics!.totalCost).toBe(0.045);
      expect(retrievedAnalytics!.totalInputTokens).toBe(2000);
      expect(retrievedAnalytics!.totalOutputTokens).toBe(1000);
      expect(retrievedAnalytics!.interactionCount).toBe(5);
      expect(retrievedAnalytics!.sessionId).toBe(sessionId);
      expect(retrievedAnalytics!.avgCostPerInteraction).toBe(0.009); // 0.045 / 5
      expect(retrievedAnalytics!.modelBreakdown).toEqual(costData.modelBreakdown);
      expect(retrievedAnalytics!.lastCostUpdate).toBeDefined();
      
      // Verify session was saved to disk
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.plato/memory/session.json'),
        expect.stringContaining(sessionId),
        'utf8'
      );
    });

    test('should calculate session analytics from memory entries when no session data exists', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      const sessionId = 'session-from-memories';
      
      // Add some memory entries for this session
      const memories = [
        {
          id: 'mem-1',
          type: 'transcript' as const,
          content: 'First interaction',
          timestamp: new Date().toISOString(),
          costMetadata: {
            cost: 0.001,
            inputTokens: 50,
            outputTokens: 25,
            model: 'gpt-3.5-turbo',
            provider: 'copilot' as const,
            sessionId
          }
        },
        {
          id: 'mem-2',
          type: 'transcript' as const,
          content: 'Second interaction',
          timestamp: new Date().toISOString(),
          costMetadata: {
            cost: 0.002,
            inputTokens: 100,
            outputTokens: 50,
            model: 'gpt-4',
            provider: 'copilot' as const,
            sessionId
          }
        }
      ];
      
      for (const memory of memories) {
        await manager.addMemory(memory);
      }
      
      // Get analytics calculated from memory entries
      const analytics = await manager.getSessionCostAnalytics(sessionId);
      
      expect(analytics).toBeDefined();
      expect(analytics!.totalCost).toBe(0.003); // 0.001 + 0.002
      expect(analytics!.totalInputTokens).toBe(150); // 50 + 100
      expect(analytics!.totalOutputTokens).toBe(75); // 25 + 50
      expect(analytics!.interactionCount).toBe(2);
      expect(analytics!.sessionId).toBe(sessionId);
      expect(analytics!.avgCostPerInteraction).toBe(0.0015); // 0.003 / 2
      expect(analytics!.modelBreakdown).toEqual({
        'gpt-3.5-turbo': { cost: 0.001, tokens: 75, interactions: 1 },
        'gpt-4': { cost: 0.002, tokens: 150, interactions: 1 }
      });
    });

    test('should handle session with no cost data gracefully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      const analytics = await manager.getSessionCostAnalytics('non-existent-session');
      expect(analytics).toBeNull();
    });
  });
});