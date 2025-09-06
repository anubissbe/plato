import { handleContextCommand } from '../context-command.js';
import { FileRelevanceScorer } from '../../context/relevance-scorer.js';
import { ContentSampler } from '../../context/content-sampler.js';
import { SemanticIndex } from '../../context/semantic-index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('../../context/relevance-scorer.js');
jest.mock('../../context/content-sampler.js');
jest.mock('../../context/semantic-index.js');
jest.mock('fs/promises');

describe('handleContextCommand', () => {
  let mockScorer: jest.Mocked<FileRelevanceScorer>;
  let mockSampler: jest.Mocked<ContentSampler>;
  let mockIndex: jest.Mocked<SemanticIndex>;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    mockScorer = new FileRelevanceScorer() as jest.Mocked<FileRelevanceScorer>;
    mockSampler = new ContentSampler() as jest.Mocked<ContentSampler>;
    mockIndex = new SemanticIndex('/test') as jest.Mocked<SemanticIndex>;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('basic commands', () => {
    test('should show context overview when no arguments', async () => {
      const result = await handleContextCommand('', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('show');
      expect(result.data).toHaveProperty('tokenUsage');
      expect(result.data).toHaveProperty('fileCount');
      expect(result.data).toHaveProperty('relevanceDistribution');
    });

    test('should handle suggest command', async () => {
      mockIndex.getFiles.mockReturnValue([
        { path: '/test/src/main.ts', symbols: [], imports: [], exports: [], hash: '123', size: 1000 },
        { path: '/test/src/utils.ts', symbols: [], imports: [], exports: [], hash: '456', size: 500 },
      ]);

      mockScorer.scoreFile.mockImplementation((file) => ({
        file,
        score: file.includes('main') ? 85 : 60,
        reasons: ['direct_reference'],
        confidence: 0.9,
      }));

      const result = await handleContextCommand('suggest', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('suggest');
      expect(result.data.suggestions).toHaveLength(2);
      expect(result.data.suggestions[0].score).toBe(85);
    });

    test('should handle add-related command', async () => {
      mockIndex.getFiles.mockReturnValue([
        { 
          path: '/test/src/main.ts', 
          symbols: [], 
          imports: ['/test/src/utils.ts'], 
          exports: [], 
          hash: '123', 
          size: 1000 
        },
        { 
          path: '/test/src/utils.ts', 
          symbols: [], 
          imports: [], 
          exports: ['helper'], 
          hash: '456', 
          size: 500 
        },
      ]);

      const result = await handleContextCommand('add-related /test/src/main.ts', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('add-related');
      expect(result.data.addedFiles).toContain('/test/src/utils.ts');
    });

    test('should handle optimize command', async () => {
      const result = await handleContextCommand('optimize', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/src/large.ts', tokens: 5000, relevance: 30 },
          { path: '/test/src/main.ts', tokens: 2000, relevance: 85 },
          { path: '/test/src/utils.ts', tokens: 3000, relevance: 60 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('optimize');
      expect(result.data.optimizations).toBeDefined();
      expect(result.data.tokensSaved).toBeGreaterThan(0);
    });

    test('should handle search command', async () => {
      mockIndex.searchSymbols = jest.fn().mockReturnValue([
        { file: '/test/src/auth.ts', symbol: 'authenticate', type: 'function' },
        { file: '/test/src/user.ts', symbol: 'User', type: 'class' },
      ]);

      const result = await handleContextCommand('search authentication', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('search');
      expect(result.data.results).toHaveLength(2);
      expect(mockIndex.searchSymbols).toHaveBeenCalledWith('authentication');
    });

    test('should handle export command', async () => {
      const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
      
      const result = await handleContextCommand('export /tmp/context.json', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/src/main.ts', tokens: 2000, relevance: 85 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('export');
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/context.json',
        expect.stringContaining('main.ts'),
        'utf-8'
      );
    });

    test('should handle import command', async () => {
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockResolvedValue(JSON.stringify({
        files: ['/test/src/main.ts', '/test/src/utils.ts'],
        settings: { tokenBudget: 15000 },
      }));

      const result = await handleContextCommand('import /tmp/context.json', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('import');
      expect(result.data.importedFiles).toHaveLength(2);
      expect(mockReadFile).toHaveBeenCalledWith('/tmp/context.json', 'utf-8');
    });
  });

  describe('error handling', () => {
    test('should handle invalid command gracefully', async () => {
      const result = await handleContextCommand('invalid-command', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    test('should handle missing file for add-related', async () => {
      const result = await handleContextCommand('add-related', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File path required');
    });

    test('should handle search with no query', async () => {
      const result = await handleContextCommand('search', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search query required');
    });

    test('should handle export without path', async () => {
      const result = await handleContextCommand('export', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Export path required');
    });

    test('should handle import errors', async () => {
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await handleContextCommand('import /tmp/missing.json', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to import');
    });
  });

  describe('integration with semantic features', () => {
    test('should use semantic index for relevance scoring', async () => {
      mockIndex.getFiles.mockReturnValue([
        { 
          path: '/test/src/main.ts', 
          symbols: [{ name: 'main', type: 'function', line: 1 }], 
          imports: [], 
          exports: [], 
          hash: '123', 
          size: 1000 
        },
      ]);

      await handleContextCommand('suggest', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(mockIndex.getFiles).toHaveBeenCalled();
      expect(mockScorer.scoreFile).toHaveBeenCalled();
    });

    test('should sample content based on token budget', async () => {
      mockSampler.sampleFile.mockReturnValue({
        file: '/test/src/main.ts',
        selections: [
          {
            startLine: 1,
            endLine: 10,
            type: 'function',
            relevanceScore: 85,
            content: 'function main() { ... }',
          },
        ],
        tokenCount: 500,
        completeness: 80,
      });

      const result = await handleContextCommand('add-related /test/src/main.ts', {
        workingDirectory: '/test',
        tokenBudget: 1000, // Low budget to trigger sampling
      });

      expect(mockSampler.sampleFile).toHaveBeenCalled();
      expect(result.data.samplingApplied).toBe(true);
    });

    test('should respect token budget constraints', async () => {
      const result = await handleContextCommand('optimize', {
        workingDirectory: '/test',
        tokenBudget: 5000,
        currentFiles: [
          { path: '/test/src/file1.ts', tokens: 2000, relevance: 85 },
          { path: '/test/src/file2.ts', tokens: 2000, relevance: 75 },
          { path: '/test/src/file3.ts', tokens: 2000, relevance: 60 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.optimizations).toContain('Remove file3.ts');
      expect(result.data.newTokenUsage).toBeLessThanOrEqual(5000);
    });
  });
});