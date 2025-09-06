/**
 * Session Persistence Integration Tests for Advanced Context Management
 * Tests context state serialization, restoration, and integration with Plato's memory systems
 */

import { ContextPersistenceManager } from '../session-persistence.js';
import { SemanticIndex } from '../semantic-index.js';
import { FileRelevanceScorer } from '../relevance-scorer.js';
import { ContentSampler } from '../content-sampler.js';
import { MemoryManager } from '../../memory/manager.js';
import { MemoryEntry } from '../../memory/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

// Mock dependencies
jest.mock('../../memory/manager.js');
jest.mock('fs/promises');

describe('Session Persistence Integration', () => {
  let persistenceManager: ContextPersistenceManager;
  let mockMemoryManager: jest.Mocked<MemoryManager>;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `plato-test-${Date.now()}`);
    
    // Create mock MemoryManager
    mockMemoryManager = {
      addMemory: jest.fn().mockResolvedValue(undefined),
      getAllMemories: jest.fn().mockResolvedValue([]),
      searchMemories: jest.fn().mockResolvedValue([]),
      initialize: jest.fn().mockResolvedValue(undefined),
      clearAllMemories: jest.fn().mockResolvedValue(undefined),
      getMemoriesByType: jest.fn().mockResolvedValue([]),
      savePlatoFile: jest.fn().mockResolvedValue(undefined),
      getProjectContext: jest.fn().mockResolvedValue(''),
      updateProjectContext: jest.fn().mockResolvedValue(undefined),
      appendToPlatoFile: jest.fn().mockResolvedValue(undefined),
      saveSession: jest.fn().mockResolvedValue(undefined),
      restoreSession: jest.fn().mockResolvedValue(null),
      stopAutoSave: jest.fn(),
      getStatistics: jest.fn().mockResolvedValue({
        totalMemories: 0,
        byType: {},
        diskUsage: 0,
        oldestMemory: undefined,
        newestMemory: undefined
      }),
      exportMemories: jest.fn().mockResolvedValue(''),
      importMemories: jest.fn().mockResolvedValue(undefined),
      parsePlatoFile: jest.fn().mockReturnValue([])
    } as any;

    (MemoryManager as jest.Mock).mockImplementation(() => mockMemoryManager);

    persistenceManager = new ContextPersistenceManager({
      sessionPath: path.join(testDir, '.plato', 'session.json'),
      memoryPath: path.join(testDir, '.plato', 'memory')
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Context State Serialization', () => {
    test('should serialize context state with all components', async () => {
      const index = new SemanticIndex();
      const scorer = new FileRelevanceScorer(index);
      const sampler = new ContentSampler(index);

      // Add test data to index
      await index.addFile({
        path: '/test/file1.ts',
        symbols: [{ name: 'TestClass', type: 'class' as any, line: 1, exported: true }],
        imports: ['/test/file2.ts'],
        exports: ['TestClass'],
        hash: 'abc123',
        size: 1000,
        lastModified: new Date()
      });

      const contextState = {
        index,
        scorer,
        sampler,
        currentFiles: ['/test/file1.ts', '/test/file2.ts'],
        userPreferences: {
          maxFiles: 100,
          relevanceThreshold: 50
        },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 5
        }
      };

      const serialized = await persistenceManager.serializeContextState(contextState);

      expect(serialized).toHaveProperty('version');
      expect(serialized).toHaveProperty('timestamp');
      expect(serialized).toHaveProperty('index');
      expect(serialized).toHaveProperty('currentFiles');
      expect(serialized).toHaveProperty('userPreferences');
      expect(serialized).toHaveProperty('sessionMetadata');
      expect(serialized.currentFiles).toEqual(['/test/file1.ts', '/test/file2.ts']);
      expect(serialized.userPreferences.maxFiles).toBe(100);
    });

    test('should handle serialization of empty context state', async () => {
      const emptyState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: [],
        userPreferences: {},
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 0
        }
      };

      const serialized = await persistenceManager.serializeContextState(emptyState);

      expect(serialized.currentFiles).toEqual([]);
      expect(serialized.userPreferences).toEqual({});
      expect(serialized.sessionMetadata.totalQueries).toBe(0);
    });

    test('should include context configuration in serialization', async () => {
      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: [],
        userPreferences: {
          enableAutoRefresh: true,
          maxTokensPerFile: 2000,
          excludePatterns: ['*.test.ts', '*.spec.js']
        },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 0
        }
      };

      const serialized = await persistenceManager.serializeContextState(contextState);

      expect(serialized.userPreferences).toHaveProperty('enableAutoRefresh', true);
      expect(serialized.userPreferences).toHaveProperty('maxTokensPerFile', 2000);
      expect(serialized.userPreferences).toHaveProperty('excludePatterns');
      expect(serialized.userPreferences.excludePatterns).toEqual(['*.test.ts', '*.spec.js']);
    });
  });

  describe('Context State Deserialization', () => {
    test('should deserialize context state correctly', async () => {
      const serializedState = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        index: JSON.stringify({ files: new Map(), symbols: new Map(), imports: new Map(), lastUpdated: new Date() }),
        currentFiles: ['/test/file1.ts', '/test/file2.ts'],
        userPreferences: {
          maxFiles: 150,
          relevanceThreshold: 70
        },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 10
        }
      };

      const deserialized = await persistenceManager.deserializeContextState(serializedState);

      expect(deserialized).toHaveProperty('index');
      expect(deserialized).toHaveProperty('scorer');
      expect(deserialized).toHaveProperty('sampler');
      expect(deserialized.currentFiles).toEqual(['/test/file1.ts', '/test/file2.ts']);
      expect(deserialized.userPreferences.maxFiles).toBe(150);
      expect(deserialized.sessionMetadata.totalQueries).toBe(10);
    });

    test('should handle missing or corrupted serialized data', async () => {
      const corruptedState = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        index: 'invalid-json',
        currentFiles: [],
        userPreferences: undefined
      };

      const deserialized = await persistenceManager.deserializeContextState(corruptedState);

      // Should create new instances with defaults
      expect(deserialized).toHaveProperty('index');
      expect(deserialized).toHaveProperty('scorer');
      expect(deserialized).toHaveProperty('sampler');
      expect(deserialized.currentFiles).toEqual([]); // Default to empty array
      expect(deserialized.userPreferences).toEqual({}); // Default to empty object
    });

    test('should maintain version compatibility', async () => {
      const oldVersionState = {
        version: '0.9.0',
        timestamp: new Date().toISOString(),
        index: JSON.stringify({ files: new Map(), symbols: new Map() }),
        currentFiles: ['/test/old-file.ts']
      };

      const deserialized = await persistenceManager.deserializeContextState(oldVersionState);

      // Should handle older version gracefully
      expect(deserialized).toHaveProperty('index');
      expect(deserialized.currentFiles).toEqual(['/test/old-file.ts']);
    });
  });

  describe('Session.json Integration', () => {
    test('should save context state to session.json', async () => {
      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/session-file.ts'],
        userPreferences: { maxFiles: 200 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 3
        }
      };

      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await persistenceManager.saveToSession(contextState);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(path.join(testDir, '.plato', 'session.json')),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDir, '.plato', 'session.json'),
        expect.stringContaining('"/test/session-file.ts"'),
        'utf-8'
      );
    });

    test('should load context state from session.json', async () => {
      const mockSessionData = JSON.stringify({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        index: JSON.stringify({ files: new Map(), symbols: new Map(), imports: new Map() }),
        currentFiles: ['/test/loaded-file.ts'],
        userPreferences: { maxFiles: 300 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 7
        }
      });

      (fs.readFile as jest.Mock).mockResolvedValue(mockSessionData);

      const loaded = await persistenceManager.loadFromSession();

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(testDir, '.plato', 'session.json'),
        'utf-8'
      );
      expect(loaded).not.toBeNull();
      expect(loaded!.currentFiles).toEqual(['/test/loaded-file.ts']);
      expect(loaded!.userPreferences.maxFiles).toBe(300);
    });

    test('should handle missing session.json gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const loaded = await persistenceManager.loadFromSession();

      expect(loaded).toBeNull();
    });

    test('should merge session data with existing orchestrator data', async () => {
      const existingSessionData = {
        startTime: '2023-01-01T00:00:00.000Z',
        commands: ['help', 'status'],
        context: 'Previous context'
      };

      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/merge-file.ts'],
        userPreferences: { maxFiles: 100 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 5
        }
      };

      const merged = await persistenceManager.mergeWithExistingSession(contextState, existingSessionData);

      expect(merged).toHaveProperty('startTime', existingSessionData.startTime);
      expect(merged).toHaveProperty('commands', existingSessionData.commands);
      expect(merged).toHaveProperty('context', existingSessionData.context);
      expect(merged).toHaveProperty('contextManager');
      expect(merged.contextManager.currentFiles).toEqual(['/test/merge-file.ts']);
    });
  });

  describe('Memory Manager Integration', () => {
    test('should save context state to memory system', async () => {
      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/memory-file.ts'],
        userPreferences: { maxFiles: 250 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 8
        }
      };

      await persistenceManager.saveToMemory(contextState, 'test-session-context');

      expect(mockMemoryManager.addMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-session-context',
          type: 'context',
          content: expect.any(String),
          timestamp: expect.any(String),
          tags: ['context', 'session', 'persistent'],
          metadata: {
            priority: 'high'
          }
        })
      );
    });

    test('should load context state from memory system', async () => {
      const mockMemoryData = {
        currentFiles: ['/test/memory-loaded.ts'],
        userPreferences: { maxFiles: 400 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 12
        }
      };

      mockMemoryManager.getAllMemories.mockResolvedValue([{
        id: 'test-memory-context',
        type: 'context',
        content: JSON.stringify(mockMemoryData),
        timestamp: new Date().toISOString()
      }]);

      const loaded = await persistenceManager.loadFromMemory('test-memory-context');

      expect(mockMemoryManager.getAllMemories).toHaveBeenCalled();
      expect(loaded).not.toBeNull();
      expect(loaded!.currentFiles).toEqual(['/test/memory-loaded.ts']);
      expect(loaded!.userPreferences.maxFiles).toBe(400);
    });

    test('should create context history entries', async () => {
      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/history-file.ts'],
        userPreferences: { maxFiles: 100 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 3
        }
      };

      await persistenceManager.createHistorySnapshot(contextState, 'manual-save', 'User saved context');

      expect(mockMemoryManager.addMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^context-history-\d+$/),
          type: 'session',
          content: expect.any(String),
          timestamp: expect.any(String),
          tags: ['context', 'history', 'snapshot'],
          metadata: {
            priority: 'medium'
          }
        })
      );
    });

    test('should list context history entries', async () => {
      const mockHistoryEntries = [
        {
          id: 'context-history-1',
          type: 'session',
          content: JSON.stringify({ reason: 'test-save-1', description: 'First test save' }),
          tags: ['context', 'history'],
          timestamp: '2023-01-01T10:00:00Z'
        },
        {
          id: 'context-history-2', 
          type: 'session',
          content: JSON.stringify({ reason: 'test-save-2', description: 'Second test save' }),
          tags: ['context', 'history'],
          timestamp: '2023-01-01T11:00:00Z'
        }
      ];

      mockMemoryManager.getAllMemories.mockResolvedValue(mockHistoryEntries as any);

      const history = await persistenceManager.getContextHistory();

      expect(mockMemoryManager.getAllMemories).toHaveBeenCalled();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('context-history-2'); // Most recent first
      expect(history[1].id).toBe('context-history-1');
    });
  });

  describe('Smart Context Resumption', () => {
    test('should restore context state with intelligent merging', async () => {
      const savedState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/saved-file.ts'],
        userPreferences: { maxFiles: 200 },
        sessionMetadata: {
          startTime: '2023-01-01T10:00:00Z',
          lastActivity: '2023-01-01T11:00:00Z',
          totalQueries: 15
        }
      };

      const currentState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/current-file.ts'],
        userPreferences: { maxFiles: 150, newSetting: true },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 5
        }
      };

      const merged = await persistenceManager.smartResume(savedState, currentState);

      // Should merge intelligently
      expect(merged.currentFiles).toEqual(['/test/saved-file.ts', '/test/current-file.ts']);
      expect(merged.userPreferences).toEqual({
        maxFiles: 200, // Prefer saved value for existing settings
        newSetting: true // Keep new settings
      });
      expect(merged.sessionMetadata.totalQueries).toBe(20); // Sum of both
    });

    test('should handle file conflicts during resume', async () => {
      const savedState = {
        currentFiles: ['/test/shared.ts', '/test/saved-only.ts'],
        userPreferences: { maxFiles: 100 }
      };

      const currentState = {
        currentFiles: ['/test/shared.ts', '/test/current-only.ts'],
        userPreferences: { maxFiles: 200 }
      };

      const resolved = await persistenceManager.resolveFileConflicts(
        savedState.currentFiles,
        currentState.currentFiles,
        { preferSaved: false }
      );

      // Should deduplicate and merge
      expect(resolved).toEqual(['/test/shared.ts', '/test/current-only.ts', '/test/saved-only.ts']);
    });

    test('should validate restored context state', async () => {
      const validState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/valid-file.ts'],
        userPreferences: { maxFiles: 100 },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 5
        }
      };

      const isValid = await persistenceManager.validateContextState(validState);
      expect(isValid).toBe(true);

      const invalidState = {
        // Missing required properties
        currentFiles: 'invalid-type',
        userPreferences: null
      };

      const isInvalid = await persistenceManager.validateContextState(invalidState as any);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Export/Import Functionality', () => {
    test('should export context configuration', async () => {
      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/export-file.ts'],
        userPreferences: { 
          maxFiles: 300,
          enableAutoRefresh: true,
          excludePatterns: ['*.test.ts']
        },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 20
        }
      };

      const exported = await persistenceManager.exportConfiguration(contextState);

      expect(exported).toHaveProperty('version');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported).toHaveProperty('configuration');
      expect(exported.configuration).toHaveProperty('userPreferences');
      expect(exported.configuration).toHaveProperty('currentFiles');
      expect(exported.configuration.userPreferences.maxFiles).toBe(300);
    });

    test('should import context configuration', async () => {
      const importData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        configuration: {
          userPreferences: {
            maxFiles: 500,
            enableAutoRefresh: false,
            customSetting: 'test-value'
          },
          currentFiles: ['/test/import-file.ts']
        }
      };

      const imported = await persistenceManager.importConfiguration(importData);

      expect(imported).toHaveProperty('index');
      expect(imported).toHaveProperty('scorer');
      expect(imported).toHaveProperty('sampler');
      expect(imported.currentFiles).toEqual(['/test/import-file.ts']);
      expect(imported.userPreferences.maxFiles).toBe(500);
      expect(imported.userPreferences.customSetting).toBe('test-value');
    });

    test('should handle import validation errors', async () => {
      const invalidImportData = null;

      await expect(persistenceManager.importConfiguration(invalidImportData as any))
        .rejects
        .toThrow('Invalid import data format');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle disk I/O errors gracefully', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: [],
        userPreferences: {},
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 0
        }
      };

      await expect(persistenceManager.saveToSession(contextState))
        .rejects
        .toThrow('ENOSPC: no space left on device');

      // Should still attempt fallback to memory
      expect(mockMemoryManager.addMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'fallback-context-state',
          type: 'context',
          content: expect.any(String),
          timestamp: expect.any(String),
          tags: ['context', 'session', 'persistent'],
          metadata: {
            priority: 'high'
          }
        })
      );
    });

    test('should recover from corrupted session data', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('corrupted-json-data');

      const recovered = await persistenceManager.loadFromSession();

      // Should return null for corrupted data
      expect(recovered).toBeNull();
    });

    test('should provide fallback when memory system is unavailable', async () => {
      mockMemoryManager.addMemory.mockRejectedValue(new Error('Memory system unavailable'));

      const contextState = {
        index: new SemanticIndex(),
        scorer: new FileRelevanceScorer(new SemanticIndex()),
        sampler: new ContentSampler(new SemanticIndex()),
        currentFiles: ['/test/fallback.ts'],
        userPreferences: {},
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 0
        }
      };

      // Should not throw, but handle gracefully
      await expect(persistenceManager.saveToMemory(contextState, 'test-fallback'))
        .resolves
        .not.toThrow();
    });
  });
});