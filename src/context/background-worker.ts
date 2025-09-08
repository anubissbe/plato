/**
 * Background Worker Script for Context Management Operations
 * Runs in separate thread to handle CPU-intensive tasks without blocking main thread
 */

import { parentPort, workerData } from 'worker_threads';
import { SemanticIndex, FileAnalyzer, SymbolExtractor } from './semantic-index.js';
import { FileRelevanceScorer } from './relevance-scorer.js';
import { ContentSampler } from './content-sampler.js';
import { BackgroundTaskType, TaskResult } from './background-processor.js';
import * as fs from 'fs/promises';

const workerId = workerData?.workerId || 0;

// Initialize worker components
let analyzer: FileAnalyzer;
let extractor: SymbolExtractor;
let index: SemanticIndex;

/**
 * Initialize worker
 */
function initializeWorker(): void {
  try {
    analyzer = new FileAnalyzer();
    extractor = new SymbolExtractor();
    index = new SemanticIndex();
    
    // Signal ready state
    parentPort?.postMessage({
      type: 'ready',
      workerId
    });
  } catch (error) {
    parentPort?.postMessage({
      type: 'initError',
      workerId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handle task execution
 */
async function handleTask(task: any): Promise<TaskResult> {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  try {
    let result: any;

    switch (task.type) {
      case BackgroundTaskType.FILE_ANALYSIS:
        result = await handleFileAnalysis(task.data);
        break;
        
      case BackgroundTaskType.BATCH_INDEXING:
        result = await handleBatchIndexing(task.data);
        break;
        
      case BackgroundTaskType.RELEVANCE_SCORING:
        result = await handleRelevanceScoring(task.data);
        break;
        
      case BackgroundTaskType.CONTENT_SAMPLING:
        result = await handleContentSampling(task.data);
        break;
        
      case BackgroundTaskType.INDEX_SERIALIZATION:
        result = await handleIndexSerialization(task.data);
        break;
        
      case BackgroundTaskType.SYMBOL_EXTRACTION:
        result = await handleSymbolExtraction(task.data);
        break;
        
      case BackgroundTaskType.IMPORT_GRAPH_BUILD:
        result = await handleImportGraphBuild(task.data);
        break;
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    const duration = performance.now() - startTime;
    const memoryUsed = process.memoryUsage().heapUsed - startMemory;

    return {
      taskId: task.id,
      success: true,
      result,
      duration,
      memory: memoryUsed
    };

  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      taskId: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration
    };
  }
}

/**
 * Analyze a single file
 */
async function handleFileAnalysis(data: { filePath: string }): Promise<any> {
  const { filePath } = data;
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileIndex = await analyzer.analyzeFile(filePath, content);
    
    return fileIndex;
  } catch (error) {
    throw new Error(`Failed to analyze file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build index for multiple files in batches
 */
async function handleBatchIndexing(data: { filePaths: string[]; batchSize: number }): Promise<{ index: string; stats: any }> {
  const { filePaths, batchSize = 50 } = data;
  const batchIndex = new SemanticIndex();
  const stats = {
    totalFiles: filePaths.length,
    processedFiles: 0,
    failedFiles: 0,
    totalSymbols: 0,
    processingTime: 0
  };

  const startTime = performance.now();

  // Process files in batches to manage memory
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    
    for (const filePath of batch) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileIndex = await analyzer.analyzeFile(filePath, content);
        
        await batchIndex.addFile(fileIndex);
        stats.processedFiles++;
        stats.totalSymbols += fileIndex.symbols.length;
        
        // Yield occasionally to prevent blocking
        if (stats.processedFiles % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
        
      } catch (error) {
        stats.failedFiles++;
        console.warn(`Worker ${workerId}: Failed to process ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // Force garbage collection between batches if available
    if (global.gc) {
      global.gc();
    }
  }

  stats.processingTime = performance.now() - startTime;

  return {
    index: batchIndex.serialize(),
    stats
  };
}

/**
 * Score file relevance
 */
async function handleRelevanceScoring(data: { filePaths: string[]; context: any }): Promise<any[]> {
  const { filePaths, context } = data;
  
  // Create temporary index for scoring
  const tempIndex = new SemanticIndex();
  const scorer = new FileRelevanceScorer(tempIndex);
  
  // Load files into temporary index (this could be optimized with caching)
  for (const filePath of filePaths.slice(0, 100)) { // Limit for performance
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileIndex = await analyzer.analyzeFile(filePath, content);
      await tempIndex.addFile(fileIndex);
    } catch (error) {
      // Skip files that can't be loaded
      continue;
    }
  }
  
  // Score all files
  const scores = filePaths.map(filePath => {
    try {
      return scorer.scoreFile(filePath, context);
    } catch (error) {
      return {
        file: filePath,
        score: 0,
        reasons: ['error'],
        confidence: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  return scores;
}

/**
 * Sample content from multiple files
 */
async function handleContentSampling(data: { files: Array<{ path: string; content: string }>; options: any }): Promise<any[]> {
  const { files, options } = data;
  
  // Create temporary index for sampling
  const tempIndex = new SemanticIndex();
  const sampler = new ContentSampler(tempIndex);
  
  // Add files to index
  for (const file of files) {
    try {
      const fileIndex = await analyzer.analyzeFile(file.path, file.content);
      await tempIndex.addFile(fileIndex);
    } catch (error) {
      console.warn(`Worker ${workerId}: Failed to index ${file.path} for sampling:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Sample each file
  const samples = files.map(file => {
    try {
      return sampler.sampleFile(file.path, file.content, options);
    } catch (error) {
      return {
        file: file.path,
        content: '',
        tokens: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  return samples;
}

/**
 * Serialize index data
 */
async function handleIndexSerialization(data: { indexData: any }): Promise<string> {
  const { indexData } = data;
  
  try {
    // Perform serialization with compression if data is large
    const serialized = JSON.stringify(indexData);
    
    // For very large data, could implement compression here
    if (serialized.length > 1024 * 1024) { // > 1MB
      console.log(`Worker ${workerId}: Serializing large index (${Math.round(serialized.length / 1024 / 1024)}MB)`);
    }
    
    return serialized;
  } catch (error) {
    throw new Error(`Serialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract symbols from multiple files
 */
async function handleSymbolExtraction(data: { files: Array<{ path: string; content: string }> }): Promise<any[]> {
  const { files } = data;
  
  const results = files.map(file => {
    try {
      const language = extractor.detectLanguage(file.path);
      const symbols = extractor.extractSymbols(file.content, language);
      
      return {
        filePath: file.path,
        language,
        symbols,
        symbolCount: symbols.length
      };
    } catch (error) {
      return {
        filePath: file.path,
        language: 'unknown',
        symbols: [],
        symbolCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  return results;
}

/**
 * Build import graph from file indexes
 */
async function handleImportGraphBuild(data: { fileIndexes: any[] }): Promise<any> {
  const { fileIndexes } = data;
  
  try {
    // Create temporary index
    const tempIndex = new SemanticIndex();
    
    // Add all files
    for (const fileIndex of fileIndexes) {
      await tempIndex.addFile(fileIndex);
    }
    
    // Build import graph
    const importGraph = tempIndex.buildImportGraph();
    
    // Convert Map to serializable format
    const serializedGraph = Object.fromEntries(
      Array.from(importGraph.entries()).map(([key, value]) => [key, value])
    );
    
    return {
      graph: serializedGraph,
      nodeCount: importGraph.size,
      edgeCount: Array.from(importGraph.values()).reduce((sum, node) => sum + node.imports.length, 0)
    };
  } catch (error) {
    throw new Error(`Import graph build failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Message handler
 */
function handleMessage(message: any): void {
  if (message.type === 'task') {
    handleTask(message.task)
      .then(result => {
        parentPort?.postMessage({
          type: 'taskComplete',
          result
        });
      })
      .catch(error => {
        parentPort?.postMessage({
          type: 'taskError',
          error: error instanceof Error ? error.message : String(error)
        });
      });
  }
}

/**
 * Error handler
 */
function handleError(error: Error): void {
  parentPort?.postMessage({
    type: 'error',
    workerId,
    error: error instanceof Error ? error.message : String(error)
  });
}

/**
 * Cleanup on exit
 */
function cleanup(): void {
  // Perform any necessary cleanup
  console.log(`Worker ${workerId} shutting down`);
}

// Initialize worker and set up event handlers
if (parentPort) {
  parentPort.on('message', handleMessage);
  process.on('uncaughtException', handleError);
  process.on('exit', cleanup);
  
  initializeWorker();
} else {
  console.error('Worker started without parent port');
  process.exit(1);
}