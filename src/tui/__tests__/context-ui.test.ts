import { handleContextCommand } from '../context-command.js';
import { FileRelevanceScorer } from '../../context/relevance-scorer.js';
import { ContentSampler } from '../../context/content-sampler.js';
import { SemanticIndex } from '../../context/semantic-index.js';
import { SymbolType } from '../../context/types.js';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../../context/relevance-scorer.js');
jest.mock('../../context/content-sampler.js');
jest.mock('../../context/semantic-index.js');
jest.mock('fs/promises');

describe('Context UI Integration', () => {
  let mockIndex: jest.Mocked<SemanticIndex>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock index
    mockIndex = {
      build: jest.fn().mockResolvedValue(undefined),
      getAllFiles: jest.fn().mockReturnValue([]),
      getSymbols: jest.fn().mockReturnValue([]),
      getFile: jest.fn().mockReturnValue(undefined),
      addFile: jest.fn().mockResolvedValue(undefined),
      removeFile: jest.fn(),
      updateFile: jest.fn().mockResolvedValue(undefined),
      serialize: jest.fn().mockReturnValue(''),
      deserialize: jest.fn(),
    } as any;

    // Mock the constructor  
    (SemanticIndex as any) = jest.fn().mockImplementation(() => mockIndex);
  });

  describe('Context Overview Display', () => {
    test('should calculate token usage and file count', async () => {
      const result = await handleContextCommand('', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/file1.ts', tokens: 1000, relevance: 85 },
          { path: '/test/file2.ts', tokens: 1500, relevance: 60 },
          { path: '/test/file3.ts', tokens: 500, relevance: 30 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.tokenUsage).toBe(3000);
      expect(result.data.fileCount).toBe(3);
    });

    test('should categorize files by relevance', async () => {
      const result = await handleContextCommand('', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/high1.ts', tokens: 1000, relevance: 85 },
          { path: '/test/high2.ts', tokens: 1000, relevance: 90 },
          { path: '/test/medium.ts', tokens: 1000, relevance: 60 },
          { path: '/test/low.ts', tokens: 1000, relevance: 20 },
        ],
      });

      expect(result.data.relevanceDistribution).toEqual({
        high: 2,
        medium: 1,
        low: 1,
      });
    });

    test('should provide budget breakdown', async () => {
      const result = await handleContextCommand('', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/file.ts', tokens: 2000, relevance: 70 },
        ],
      });

      expect(result.data.budgetBreakdown).toBeDefined();
      expect(result.data.budgetBreakdown.code).toBeGreaterThan(0);
      expect(result.data.budgetBreakdown.comments).toBeGreaterThan(0);
    });
  });

  describe('File Suggestion with Semantic Awareness', () => {
    test('should suggest files based on relevance scoring', async () => {
      mockIndex.getAllFiles.mockReturnValue([
        { path: '/test/main.ts', symbols: [], imports: [], exports: [], hash: '1', size: 1000 },
        { path: '/test/utils.ts', symbols: [], imports: [], exports: [], hash: '2', size: 500 },
      ]);

      // Mock FileRelevanceScorer
      const mockScoreFile = jest.fn()
        .mockReturnValueOnce({ score: 85, reasons: ['direct_reference'], confidence: 0.9 })
        .mockReturnValueOnce({ score: 45, reasons: ['import_chain'], confidence: 0.7 });
      
      (FileRelevanceScorer as jest.Mock).mockImplementation(() => ({
        scoreFile: mockScoreFile,
      }));

      const result = await handleContextCommand('suggest', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toHaveLength(2);
      expect(result.data.suggestions[0].score).toBe(85);
      expect(result.data.suggestions[1].score).toBe(45);
    });

    test('should limit suggestions to top 10 files', async () => {
      const files = Array.from({ length: 20 }, (_, i) => ({
        path: `/test/file${i}.ts`,
        symbols: [],
        imports: [],
        exports: [],
        hash: `${i}`,
        size: 1000,
      }));
      
      mockIndex.getAllFiles.mockReturnValue(files);

      const mockScoreFile = jest.fn().mockReturnValue({ 
        score: 50, 
        reasons: ['import_chain'], 
        confidence: 0.5 
      });
      
      (FileRelevanceScorer as jest.Mock).mockImplementation(() => ({
        scoreFile: mockScoreFile,
      }));

      const result = await handleContextCommand('suggest', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.data.suggestions).toHaveLength(10);
    });
  });

  describe('Interactive File Operations', () => {
    test('should add related files with import tracking', async () => {
      mockIndex.getAllFiles.mockReturnValue([
        { 
          path: '/test/main.ts', 
          symbols: [], 
          imports: ['/test/utils.ts', '/test/types.ts'], 
          exports: ['main'], 
          hash: '1', 
          size: 1000 
        },
        { 
          path: '/test/utils.ts', 
          symbols: [], 
          imports: [], 
          exports: ['helper'], 
          hash: '2', 
          size: 500 
        },
        { 
          path: '/test/types.ts', 
          symbols: [], 
          imports: [], 
          exports: ['Type1'], 
          hash: '3', 
          size: 300 
        },
      ]);
      
      // Mock getFile for specific lookups
      mockIndex.getFile.mockImplementation((path: string) => {
        const files = mockIndex.getAllFiles();
        return files.find((f: any) => f.path === path);
      });

      // Mock ContentSampler
      const mockSampleFile = jest.fn().mockReturnValue({
        file: '',
        content: 'sampled content',
        startLine: 1,
        endLine: 10,
        tokens: 500,
        reason: 'context sampling',
      });
      
      (ContentSampler as jest.Mock).mockImplementation(() => ({
        sampleFile: mockSampleFile,
      }));

      // Mock fs.readFile
      (fs.readFile as jest.Mock).mockResolvedValue('file content');

      const result = await handleContextCommand('add-related /test/main.ts', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.data.addedFiles).toContain('/test/utils.ts');
      expect(result.data.addedFiles).toContain('/test/types.ts');
    });

    test('should handle file not found in index', async () => {
      mockIndex.getAllFiles.mockReturnValue([]);
      mockIndex.getFile.mockReturnValue(undefined);

      const result = await handleContextCommand('add-related /test/missing.ts', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Context Optimization', () => {
    test('should suggest removing low-relevance files when over budget', async () => {
      const result = await handleContextCommand('optimize', {
        workingDirectory: '/test',
        tokenBudget: 5000,
        currentFiles: [
          { path: '/test/critical.ts', tokens: 2000, relevance: 90 },
          { path: '/test/important.ts', tokens: 2000, relevance: 70 },
          { path: '/test/optional.ts', tokens: 2000, relevance: 30 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.optimizations).toContainEqual(
        expect.stringContaining('Remove optional.ts')
      );
      expect(result.data.newTokenUsage).toBeLessThanOrEqual(5000);
    });

    test('should suggest sampling for medium-relevance files', async () => {
      const result = await handleContextCommand('optimize', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/file1.ts', tokens: 2000, relevance: 85 },
          { path: '/test/file2.ts', tokens: 2000, relevance: 60 },
          { path: '/test/file3.ts', tokens: 2000, relevance: 55 },
        ],
      });

      expect(result.data.optimizations).toContainEqual(
        expect.stringContaining('summary sampling')
      );
    });

    test('should identify test files for exclusion', async () => {
      const result = await handleContextCommand('optimize', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/main.ts', tokens: 2000, relevance: 85 },
          { path: '/test/main.test.ts', tokens: 1500, relevance: 40 },
          { path: '/test/utils.spec.ts', tokens: 1000, relevance: 35 },
        ],
      });

      expect(result.data.optimizations).toContainEqual(
        expect.stringContaining('test files')
      );
    });
  });

  describe('Semantic Search', () => {
    test('should search for symbols and files', async () => {
      mockIndex.getAllFiles.mockReturnValue([
        { 
          path: '/test/auth.ts', 
          symbols: [
            { name: 'authenticate', type: SymbolType.Function, line: 1, exported: true },
            { name: 'login', type: SymbolType.Function, line: 10, exported: false }
          ], 
          imports: [], 
          exports: [], 
          hash: '1', 
          size: 1000 
        },
        { 
          path: '/test/authenticate-user.ts', 
          symbols: [
            { name: 'User', type: SymbolType.Class, line: 1, exported: true }
          ], 
          imports: [], 
          exports: [], 
          hash: '2', 
          size: 500 
        },
      ]);

      const result = await handleContextCommand('search authenticate', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.data.query).toBe('authenticate');
      expect(result.data.results.length).toBeGreaterThan(0);
      
      // Should find both the file and symbol matches
      const fileMatch = result.data.results.find((r: any) => r.type === 'file');
      const symbolMatch = result.data.results.find((r: any) => r.type === 'function');
      
      expect(fileMatch).toBeDefined();
      expect(symbolMatch).toBeDefined();
    });

    test('should limit search results to 20', async () => {
      const manyFiles = Array.from({ length: 50 }, (_, i) => ({
        path: `/test/test-file-${i}.ts`,
        symbols: [{ name: `testSymbol${i}`, type: SymbolType.Function, line: 1, exported: true }],
        imports: [],
        exports: [],
        hash: `${i}`,
        size: 1000,
      }));
      
      mockIndex.getAllFiles.mockReturnValue(manyFiles);

      const result = await handleContextCommand('search test', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.data.results).toHaveLength(20);
      expect(result.data.totalMatches).toBeGreaterThan(20);
    });
  });

  describe('Context Export/Import', () => {
    test('should export context configuration to JSON', async () => {
      const mockWriteFile = fs.writeFile as jest.Mock;
      mockWriteFile.mockResolvedValue(undefined);

      const result = await handleContextCommand('export /tmp/context.json', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [
          { path: '/test/file1.ts', tokens: 1000, relevance: 85 },
          { path: '/test/file2.ts', tokens: 1500, relevance: 60 },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/context.json',
        expect.stringContaining('"version": "1.0"'),
        'utf-8'
      );
      
      const exportedData = JSON.parse(mockWriteFile.mock.calls[0][1]);
      expect(exportedData.files).toHaveLength(2);
      expect(exportedData.tokenBudget).toBe(10000);
    });

    test('should import context configuration from JSON', async () => {
      const mockReadFile = fs.readFile as jest.Mock;
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: '1.0',
        files: ['/test/file1.ts', '/test/file2.ts'],
        settings: { tokenBudget: 15000 },
      }));

      const result = await handleContextCommand('import /tmp/context.json', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.data.importedFiles).toHaveLength(2);
      expect(result.data.settings.tokenBudget).toBe(15000);
    });

    test('should handle import errors gracefully', async () => {
      const mockReadFile = fs.readFile as jest.Mock;
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await handleContextCommand('import /tmp/missing.json', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to import');
    });
  });

  describe('Error Handling', () => {
    test('should validate command arguments', async () => {
      const result1 = await handleContextCommand('add-related', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('File path required');

      const result2 = await handleContextCommand('search', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Search query required');

      const result3 = await handleContextCommand('export', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Export path required');
    });

    test('should handle unknown commands', async () => {
      const result = await handleContextCommand('unknown-command', {
        workingDirectory: '/test',
        tokenBudget: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    test('should handle optimize with no files', async () => {
      const result = await handleContextCommand('optimize', {
        workingDirectory: '/test',
        tokenBudget: 10000,
        currentFiles: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No files in context');
    });
  });
});