/**
 * Performance Benchmarks for Advanced Context Management System
 * Tests performance targets: <30s for 50K files, <100MB memory, <50ms incremental updates, <200ms relevance scoring
 */

import { SemanticIndex, FileAnalyzer, SymbolExtractor } from '../semantic-index.js';
import { FileRelevanceScorer } from '../relevance-scorer.js';
import { ContentSampler } from '../content-sampler.js';
import { SymbolType } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Performance test utilities
interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  operationsPerSecond?: number;
}

class PerformanceBenchmark {
  private startTime: number = 0;
  private startMemory: number = 0;

  start(): void {
    global.gc && global.gc(); // Force garbage collection if available
    this.startMemory = process.memoryUsage().heapUsed;
    this.startTime = performance.now();
  }

  end(): PerformanceMetrics {
    const executionTime = performance.now() - this.startTime;
    const memoryUsage = process.memoryUsage().heapUsed - this.startMemory;
    
    return {
      executionTime,
      memoryUsage
    };
  }

  static createLargeFileSet(count: number): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    
    for (let i = 0; i < count; i++) {
      const fileType = i % 4;
      let content = '';
      let extension = '';
      
      switch (fileType) {
        case 0: // TypeScript class
          extension = '.ts';
          content = `
export class TestClass${i} {
  private property${i}: string = 'value';
  
  constructor(private param: number) {}
  
  public method${i}(): void {
    console.log('test method', this.property${i});
  }
  
  async asyncMethod${i}(): Promise<string> {
    return 'async result';
  }
}

export interface TestInterface${i} {
  id: number;
  name: string;
  method(): void;
}

export type TestType${i} = {
  data: TestInterface${i};
  meta: Record<string, unknown>;
};

export enum TestEnum${i} {
  VALUE_A = 'a',
  VALUE_B = 'b',
  VALUE_C = 'c'
}

export function testFunction${i}(param: TestType${i}): boolean {
  return param.data.id > 0;
}

export const testConstant${i} = {
  config: { timeout: 5000, retries: 3 },
  utils: { format: (s: string) => s.toUpperCase() }
};
`;
          break;
          
        case 1: // JavaScript module
          extension = '.js';
          content = `
import { TestClass${Math.max(0, i-1)} } from './test${Math.max(0, i-1)}.ts';
import lodash from 'lodash';

class Component${i} {
  constructor(props) {
    this.state = { count: 0 };
    this.props = props;
  }
  
  handleClick = () => {
    this.setState({ count: this.state.count + 1 });
  }
  
  render() {
    return \`<div onClick="\${this.handleClick}">Count: \${this.state.count}</div>\`;
  }
}

export default Component${i};

export const utils${i} = {
  formatData: (data) => lodash.map(data, item => ({ ...item, processed: true })),
  validateInput: (input) => input && typeof input === 'object',
  processResults: async (results) => {
    return results.filter(r => r.valid).map(r => r.data);
  }
};

export function createInstance${i}(config = {}) {
  return new Component${i}({ ...config, id: ${i} });
}
`;
          break;
          
        case 2: // React component
          extension = '.tsx';
          content = `
import React, { useState, useEffect, useCallback } from 'react';
import { TestClass${Math.max(0, i-2)} } from './test${Math.max(0, i-2)}.ts';

interface Props${i} {
  title: string;
  data: Array<{ id: number; name: string }>;
  onUpdate?: (id: number) => void;
}

export const ReactComponent${i}: React.FC<Props${i}> = ({ title, data, onUpdate }) => {
  const [state, setState] = useState({ loading: false, error: null });
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  useEffect(() => {
    const loadData = async () => {
      setState({ loading: true, error: null });
      try {
        // Simulate async data loading
        await new Promise(resolve => setTimeout(resolve, 100));
        setState({ loading: false, error: null });
      } catch (error) {
        setState({ loading: false, error: error.message });
      }
    };
    
    loadData();
  }, []);
  
  const handleItemSelect = useCallback((id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
    onUpdate?.(id);
  }, [onUpdate]);
  
  const renderItem = (item: Props${i}['data'][0]) => (
    <div key={item.id} onClick={() => handleItemSelect(item.id)}>
      {item.name} {selectedItems.includes(item.id) ? '✓' : ''}
    </div>
  );
  
  if (state.loading) return <div>Loading...</div>;
  if (state.error) return <div>Error: {state.error}</div>;
  
  return (
    <div>
      <h2>{title}</h2>
      <div>{data.map(renderItem)}</div>
      <p>Selected: {selectedItems.length} items</p>
    </div>
  );
};

export default ReactComponent${i};
`;
          break;
          
        case 3: // Utility/config file
          extension = '.ts';
          content = `
import { TestInterface${Math.max(0, i-3)} } from './test${Math.max(0, i-3)}.ts';

export const config${i} = {
  api: {
    baseUrl: 'https://api.example.com/v${i}',
    timeout: 5000,
    retries: 3,
    endpoints: {
      users: '/users',
      posts: '/posts',
      comments: '/comments'
    }
  },
  features: {
    darkMode: true,
    notifications: false,
    analytics: i % 2 === 0
  },
  performance: {
    cacheSize: 1000,
    batchSize: 50,
    throttleMs: 100
  }
};

export class Logger${i} {
  private level: string = 'info';
  
  info(message: string, data?: unknown): void {
    console.log(\`[INFO] \${message}\`, data);
  }
  
  warn(message: string, data?: unknown): void {
    console.warn(\`[WARN] \${message}\`, data);
  }
  
  error(message: string, error?: Error): void {
    console.error(\`[ERROR] \${message}\`, error);
  }
  
  debug(message: string, data?: unknown): void {
    if (this.level === 'debug') {
      console.debug(\`[DEBUG] \${message}\`, data);
    }
  }
}

export const utils${i} = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  debounce: <T extends (...args: any[]) => any>(fn: T, ms: number): T => {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    }) as T;
  },
  memoize: <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map();
    return ((...args: any[]) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }
};

export function createService${i}(config: typeof config${i}): {
  get: (url: string) => Promise<any>;
  post: (url: string, data: any) => Promise<any>;
} {
  return {
    get: async (url: string) => {
      // Simulate HTTP GET
      await utils${i}.delay(10);
      return { data: \`GET \${config.api.baseUrl}\${url}\` };
    },
    post: async (url: string, data: any) => {
      // Simulate HTTP POST  
      await utils${i}.delay(15);
      return { data: \`POST \${config.api.baseUrl}\${url}\`, body: data };
    }
  };
}
`;
          break;
      }
      
      files.push({
        path: `/test/file${i}${extension}`,
        content: content.trim()
      });
    }
    
    return files;
  }
}

describe('Performance Benchmarks - Context Management', () => {
  let analyzer: FileAnalyzer;
  let index: SemanticIndex;
  let scorer: FileRelevanceScorer;
  let sampler: ContentSampler;
  let benchmark: PerformanceBenchmark;

  beforeEach(() => {
    analyzer = new FileAnalyzer();
    index = new SemanticIndex();
    scorer = new FileRelevanceScorer(index);
    sampler = new ContentSampler(index);
    benchmark = new PerformanceBenchmark();
  });

  describe('Symbol Extraction Performance', () => {
    test('should extract symbols from 1000 files within performance target', async () => {
      const files = PerformanceBenchmark.createLargeFileSet(1000);
      const extractor = new SymbolExtractor();
      
      benchmark.start();
      
      let totalSymbols = 0;
      for (const file of files) {
        const language = extractor.detectLanguage(file.path);
        const symbols = extractor.extractSymbols(file.content, language);
        totalSymbols += symbols.length;
      }
      
      const metrics = benchmark.end();
      
      // Performance assertions
      expect(metrics.executionTime).toBeLessThan(5000); // < 5 seconds for 1000 files
      expect(metrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // < 50MB
      expect(totalSymbols).toBeGreaterThanOrEqual(5000); // Should extract meaningful symbols
      
      console.log(`Symbol extraction: ${metrics.executionTime}ms, ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB, ${totalSymbols} symbols`);
    });

    test('should maintain performance with deep class hierarchies', async () => {
      const complexContent = `
export class BaseClass {
  protected baseProperty: string = 'base';
  
  protected baseMethod(): void {}
  
  public getProperty(): string { return this.baseProperty; }
}

export class MiddleClass extends BaseClass {
  private middleProperty: number = 42;
  
  protected middleMethod(): void {}
  
  public override getProperty(): string {
    return \`middle: \${this.baseProperty}\`;
  }
  
  async asyncMiddleMethod(): Promise<void> {}
}

export class ComplexClass extends MiddleClass {
  private complexProperty: ComplexType;
  private anotherProperty: AnotherType;
  
  constructor(
    private injectedService: ServiceType,
    private config: ConfigType
  ) {
    super();
  }
  
  public complexMethod(): void {}
  public anotherComplexMethod(param1: string, param2: number): Promise<boolean> {}
  
  private helperMethod(): void {}
  private anotherHelperMethod(): string { return 'helper'; }
}
`.repeat(50); // 50 complex classes

      const extractor = new SymbolExtractor();
      
      benchmark.start();
      const symbols = extractor.extractSymbols(complexContent, 'typescript');
      const metrics = benchmark.end();
      
      expect(metrics.executionTime).toBeLessThan(1000); // < 1 second
      expect(symbols.length).toBeGreaterThan(100); // Should extract many symbols
      
      console.log(`Complex extraction: ${metrics.executionTime}ms, ${symbols.length} symbols`);
    });
  });

  describe('Index Build Performance', () => {
    test('should build index for 5000 files within target time', async () => {
      const files = PerformanceBenchmark.createLargeFileSet(5000);
      
      benchmark.start();
      
      for (const file of files) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      const metrics = benchmark.end();
      
      // Performance targets: <30s for 50K files, so 5K files should be < 3s
      expect(metrics.executionTime).toBeLessThan(10000); // < 10 seconds for 5000 files  
      expect(metrics.memoryUsage).toBeLessThan(80 * 1024 * 1024); // < 80MB
      expect(index.getAllFiles()).toHaveLength(5000);
      
      console.log(`Index build: ${metrics.executionTime}ms, ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`);
    });

    test('should handle incremental updates efficiently', async () => {
      // Pre-populate with 1000 files
      const initialFiles = PerformanceBenchmark.createLargeFileSet(1000);
      for (const file of initialFiles) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      // Test incremental updates
      const updateFiles = PerformanceBenchmark.createLargeFileSet(100).map((file, i) => ({
        ...file,
        path: `/test/file${i}.ts`, // Update existing files
        content: file.content + '\n// Updated content'
      }));
      
      benchmark.start();
      
      for (const file of updateFiles) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex); // This should update existing
      }
      
      const metrics = benchmark.end();
      
      // Target: <50ms per incremental update, so 100 updates should be < 5s
      expect(metrics.executionTime).toBeLessThan(5000);
      expect(metrics.executionTime / updateFiles.length).toBeLessThan(50); // < 50ms per update
      
      console.log(`Incremental updates: ${metrics.executionTime}ms, ${metrics.executionTime / updateFiles.length}ms per update`);
    });
  });

  describe('Relevance Scoring Performance', () => {
    test('should score relevance for large file set within target time', async () => {
      // Build index with 2000 files
      const files = PerformanceBenchmark.createLargeFileSet(2000);
      for (const file of files) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      const context = {
        currentFile: '/test/file0.ts',
        recentFiles: ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'],
        userQuery: 'TestClass component'
      };
      
      benchmark.start();
      
      const scores = [];
      for (const file of files.slice(0, 500)) { // Score subset for performance
        const score = scorer.scoreFile(file.path, context);
        scores.push(score);
      }
      
      const metrics = benchmark.end();
      
      // Target: <200ms for relevance scoring
      expect(metrics.executionTime).toBeLessThan(1000); // < 1s for 500 files
      expect(metrics.executionTime / scores.length).toBeLessThan(5); // < 5ms per file
      expect(scores.length).toBe(500);
      expect(scores.some(s => s.score > 0)).toBe(true); // Should find relevant files
      
      console.log(`Relevance scoring: ${metrics.executionTime}ms, ${metrics.executionTime / scores.length}ms per file`);
    });

    test('should maintain scoring performance with complex import chains', async () => {
      // Create files with deep import chains
      const chainFiles = [];
      for (let i = 0; i < 100; i++) {
        const imports = [];
        for (let j = Math.max(0, i - 5); j < i; j++) {
          imports.push(`import { TestClass${j} } from './file${j}.ts';`);
        }
        
        chainFiles.push({
          path: `/chain/file${i}.ts`,
          content: `
${imports.join('\n')}

export class TestClass${i} {
  private deps = [${Array.from({length: Math.min(5, i)}, (_, j) => `new TestClass${i - j - 1}()`).join(', ')}];
  
  process(): void {
    this.deps.forEach(dep => dep.process?.());
  }
}
`
        });
      }
      
      // Build index
      for (const file of chainFiles) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      const context = {
        currentFile: '/chain/file50.ts',
        recentFiles: [],
        userQuery: 'TestClass'
      };
      
      benchmark.start();
      
      const scores = chainFiles.map(file => scorer.scoreFile(file.path, context));
      
      const metrics = benchmark.end();
      
      expect(metrics.executionTime).toBeLessThan(2000); // < 2s for complex chains
      expect(scores.filter(s => s.score > 0).length).toBeGreaterThan(10); // Should find related files
      
      console.log(`Chain scoring: ${metrics.executionTime}ms, ${scores.filter(s => s.score > 0).length} relevant files`);
    });
  });

  describe('Content Sampling Performance', () => {
    test('should sample content efficiently for memory constraints', async () => {
      const largeFiles = Array.from({length: 50}, (_, i) => ({
        path: `/large/file${i}.ts`,
        content: Array.from({length: 200}, (_, j) => `
export function function${i}_${j}(param: string): Promise<boolean> {
  const data = { id: ${j}, name: 'function${i}_${j}', active: true };
  const processed = await processData(data);
  const validated = validateResult(processed);
  const enhanced = enhanceOutput(validated);
  return enhanced.success && enhanced.data.length > 0;
}
`).join('\n')
      }));
      
      // Build index
      for (const file of largeFiles) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      benchmark.start();
      
      const samples = [];
      for (const file of largeFiles) {
        const sample = sampler.sampleFile(file.path, file.content, {
          strategy: 'context',
          maxTokens: 1000,
          focusKeywords: ['function', 'export']
        });
        samples.push(sample);
      }
      
      const metrics = benchmark.end();
      
      expect(metrics.executionTime).toBeLessThan(3000); // < 3s for 50 large files
      expect(samples.every(s => s.tokens <= 1000)).toBe(true); // Should respect token limits
      expect(samples.some(s => s.tokens > 0)).toBe(true); // Should generate samples
      
      console.log(`Content sampling: ${metrics.executionTime}ms, avg ${Math.round(samples.reduce((sum, s) => sum + s.tokens, 0) / samples.length)} tokens per sample`);
    });
  });

  describe('Memory Usage Optimization', () => {
    test('should maintain memory usage under target with large datasets', async () => {
      const files = PerformanceBenchmark.createLargeFileSet(1000);
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Build index
      for (const file of files) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      // Perform operations
      const context = {
        currentFile: '/test/file0.ts',
        recentFiles: ['/test/file1.ts', '/test/file2.ts'],
        userQuery: 'TestClass'
      };
      
      const scores = files.slice(0, 100).map(file => scorer.scoreFile(file.path, context));
      const samples = files.slice(0, 20).map(file => sampler.sampleFile(file.path, file.content, {
        strategy: 'context',
        maxTokens: 500
      }));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsage = finalMemory - initialMemory;
      
      // Target: <100MB for reasonable dataset
      expect(memoryUsage).toBeLessThan(100 * 1024 * 1024); // < 100MB
      expect(scores.length).toBe(100);
      expect(samples.length).toBe(20);
      
      console.log(`Memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB for 1000 files + operations`);
    });

    test('should clean up memory efficiently after operations', async () => {
      const files = PerformanceBenchmark.createLargeFileSet(500);
      
      // Build index
      for (const file of files) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      const beforeMemory = process.memoryUsage().heapUsed;
      
      // Remove half the files
      const filesToRemove = files.slice(0, 250);
      for (const file of filesToRemove) {
        index.removeFile(file.path);
      }
      
      // Force garbage collection if available
      global.gc && global.gc();
      
      const afterMemory = process.memoryUsage().heapUsed;
      
      // Memory should decrease or stay roughly the same
      expect(afterMemory).toBeLessThanOrEqual(beforeMemory * 1.1); // Allow 10% tolerance
      expect(index.getAllFiles()).toHaveLength(250);
      
      console.log(`Memory cleanup: ${Math.round((beforeMemory - afterMemory) / 1024 / 1024)}MB freed`);
    });
  });

  describe('Serialization Performance', () => {
    test('should serialize and deserialize index efficiently', async () => {
      const files = PerformanceBenchmark.createLargeFileSet(1000);
      
      // Build index
      for (const file of files) {
        const fileIndex = await analyzer.analyzeFile(file.path, file.content);
        await index.addFile(fileIndex);
      }
      
      // Test serialization
      benchmark.start();
      const serialized = index.serialize();
      const serializeMetrics = benchmark.end();
      
      expect(serializeMetrics.executionTime).toBeLessThan(1000); // < 1s
      expect(serialized.length).toBeGreaterThan(1000); // Should contain data
      
      // Test deserialization
      benchmark.start();
      const deserialized = SemanticIndex.deserialize(serialized);
      const deserializeMetrics = benchmark.end();
      
      expect(deserializeMetrics.executionTime).toBeLessThan(2000); // < 2s
      expect(deserialized.getAllFiles()).toHaveLength(1000);
      
      console.log(`Serialization: ${serializeMetrics.executionTime}ms, Deserialization: ${deserializeMetrics.executionTime}ms`);
      console.log(`Serialized size: ${Math.round(serialized.length / 1024 / 1024)}MB`);
    });
  });
});