/**
 * Background Processing Engine for Non-blocking Context Operations
 * Handles long-running operations in background threads/workers to maintain UI responsiveness
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { SemanticIndex, FileAnalyzer } from './semantic-index.js';
import { FileRelevanceScorer } from './relevance-scorer.js';
import { ContentSampler } from './content-sampler.js';
import { FileIndex, RelevanceScore } from './types.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface BackgroundTask {
  id: string;
  type: string;
  priority: number;
  data: any;
  timestamp: number;
  timeout?: number;
}

export interface TaskResult<T = any> {
  taskId: string;
  success: boolean;
  result?: T;
  error?: string;
  duration: number;
  memory?: number;
}

export interface WorkerPoolOptions {
  maxWorkers?: number;
  taskTimeout?: number;
  workerScript?: string;
  workerOptions?: any;
}

export interface ProcessingStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  activeWorkers: number;
  queuedTasks: number;
  memoryUsage: number;
}

/**
 * Task types for background processing
 */
export enum BackgroundTaskType {
  FILE_ANALYSIS = 'file_analysis',
  BATCH_INDEXING = 'batch_indexing',
  RELEVANCE_SCORING = 'relevance_scoring',
  CONTENT_SAMPLING = 'content_sampling',
  INDEX_SERIALIZATION = 'index_serialization',
  SYMBOL_EXTRACTION = 'symbol_extraction',
  IMPORT_GRAPH_BUILD = 'import_graph_build'
}

/**
 * Worker pool for managing background tasks
 */
export class WorkerPool extends EventEmitter {
  private workers: Map<number, Worker> = new Map();
  private availableWorkers: Set<number> = new Set();
  private taskQueue: BackgroundTask[] = [];
  private activeTasks: Map<string, { workerId: number; startTime: number }> = new Map();
  private taskCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();
  private stats: ProcessingStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    activeWorkers: 0,
    queuedTasks: 0,
    memoryUsage: 0
  };
  private nextTaskId = 1;

  constructor(private options: WorkerPoolOptions = {}) {
    super();
    this.options = {
      maxWorkers: Math.max(2, Math.min(8, Math.floor(require('os').cpus().length * 0.75))),
      taskTimeout: 30000, // 30 seconds
      workerScript: path.join(__dirname, 'background-worker.js'),
      ...options
    };
  }

  /**
   * Initialize worker pool
   */
  async initialize(): Promise<void> {
    const workerCount = this.options.maxWorkers!;
    
    for (let i = 0; i < workerCount; i++) {
      await this.createWorker(i);
    }
    
    this.stats.activeWorkers = workerCount;
    this.emit('initialized', { workerCount });
  }

  /**
   * Submit task for background processing
   */
  async submitTask<T>(
    type: BackgroundTaskType | string,
    data: any,
    priority: number = 50,
    timeout?: number
  ): Promise<T> {
    const taskId = `task_${this.nextTaskId++}_${Date.now()}`;
    
    const task: BackgroundTask = {
      id: taskId,
      type,
      priority,
      data,
      timestamp: Date.now(),
      timeout: timeout || this.options.taskTimeout
    };

    return new Promise<T>((resolve, reject) => {
      this.taskCallbacks.set(taskId, { resolve, reject });
      this.enqueueTask(task);
    });
  }

  /**
   * Submit multiple tasks and wait for all to complete
   */
  async submitBatch<T>(tasks: Array<{
    type: BackgroundTaskType | string;
    data: any;
    priority?: number;
    timeout?: number;
  }>): Promise<T[]> {
    const promises = tasks.map(task => 
      this.submitTask<T>(task.type, task.data, task.priority, task.timeout)
    );
    
    return Promise.all(promises);
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    this.stats.queuedTasks = this.taskQueue.length;
    this.stats.memoryUsage = process.memoryUsage().heapUsed;
    return { ...this.stats };
  }

  /**
   * Shutdown worker pool
   */
  async shutdown(): Promise<void> {
    // Cancel pending tasks
    for (const [taskId, callbacks] of this.taskCallbacks) {
      callbacks.reject(new Error('Worker pool shutting down'));
    }
    this.taskCallbacks.clear();

    // Terminate workers
    const terminationPromises = Array.from(this.workers.values()).map(worker => 
      new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve()).catch(() => resolve());
      })
    );

    await Promise.allSettled(terminationPromises);
    
    this.workers.clear();
    this.availableWorkers.clear();
    this.taskQueue = [];
    this.activeTasks.clear();
    this.stats.activeWorkers = 0;
    
    this.emit('shutdown');
  }

  /**
   * Clear task queue
   */
  clearQueue(): number {
    const count = this.taskQueue.length;
    this.taskQueue = [];
    this.stats.queuedTasks = 0;
    return count;
  }

  private async createWorker(workerId: number): Promise<void> {
    try {
      const worker = new Worker(this.options.workerScript!, {
        ...this.options.workerOptions,
        workerData: { workerId }
      });

      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });

      worker.on('error', (error) => {
        this.handleWorkerError(workerId, error);
      });

      worker.on('exit', (code) => {
        this.handleWorkerExit(workerId, code);
      });

      this.workers.set(workerId, worker);
      this.availableWorkers.add(workerId);
      
    } catch (error) {
      console.error(`Failed to create worker ${workerId}:`, error);
      throw error;
    }
  }

  private enqueueTask(task: BackgroundTask): void {
    // Insert task in priority order
    let insertIndex = this.taskQueue.length;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
    this.stats.totalTasks++;
    
    this.processQueue();
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.size > 0) {
      const task = this.taskQueue.shift()!;
      const workerId = Array.from(this.availableWorkers)[0];
      
      this.assignTaskToWorker(task, workerId);
    }
  }

  private assignTaskToWorker(task: BackgroundTask, workerId: number): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    this.availableWorkers.delete(workerId);
    this.activeTasks.set(task.id, { workerId, startTime: Date.now() });

    // Set timeout
    const timeoutId = setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, task.timeout || this.options.taskTimeout!);

    worker.postMessage({
      type: 'task',
      task,
      timeoutId
    });

    this.emit('taskStarted', { taskId: task.id, workerId, type: task.type });
  }

  private handleWorkerMessage(workerId: number, message: any): void {
    if (message.type === 'taskComplete') {
      this.handleTaskComplete(workerId, message.result);
    } else if (message.type === 'taskError') {
      this.handleTaskError(workerId, message.error);
    }
  }

  private handleTaskComplete(workerId: number, result: TaskResult): void {
    const activeTask = this.findActiveTaskByWorker(workerId);
    if (!activeTask) return;

    const [taskId] = activeTask;
    const taskInfo = this.activeTasks.get(taskId)!;
    const duration = Date.now() - taskInfo.startTime;

    // Update statistics
    this.stats.completedTasks++;
    this.updateAverageExecutionTime(duration);

    // Resolve promise
    const callbacks = this.taskCallbacks.get(taskId);
    if (callbacks) {
      callbacks.resolve(result.result);
      this.taskCallbacks.delete(taskId);
    }

    // Clean up
    this.activeTasks.delete(taskId);
    this.availableWorkers.add(workerId);

    this.emit('taskCompleted', { taskId, workerId, duration, result: result.result });
    
    // Process next task
    this.processQueue();
  }

  private handleTaskError(workerId: number, error: string): void {
    const activeTask = this.findActiveTaskByWorker(workerId);
    if (!activeTask) return;

    const [taskId] = activeTask;
    this.stats.failedTasks++;

    // Reject promise
    const callbacks = this.taskCallbacks.get(taskId);
    if (callbacks) {
      callbacks.reject(new Error(error));
      this.taskCallbacks.delete(taskId);
    }

    // Clean up
    this.activeTasks.delete(taskId);
    this.availableWorkers.add(workerId);

    this.emit('taskFailed', { taskId, workerId, error });
    
    // Process next task
    this.processQueue();
  }

  private handleTaskTimeout(taskId: string): void {
    const taskInfo = this.activeTasks.get(taskId);
    if (!taskInfo) return;

    const { workerId } = taskInfo;
    this.stats.failedTasks++;

    // Reject promise
    const callbacks = this.taskCallbacks.get(taskId);
    if (callbacks) {
      callbacks.reject(new Error('Task timeout'));
      this.taskCallbacks.delete(taskId);
    }

    // Terminate and recreate worker
    this.recreateWorker(workerId);
    
    // Clean up
    this.activeTasks.delete(taskId);

    this.emit('taskTimeout', { taskId, workerId });
  }

  private handleWorkerError(workerId: number, error: Error): void {
    console.error(`Worker ${workerId} error:`, error);
    
    // Find and fail active task
    const activeTask = this.findActiveTaskByWorker(workerId);
    if (activeTask) {
      const [taskId] = activeTask;
      this.handleTaskError(workerId, error.message);
    }

    // Recreate worker
    this.recreateWorker(workerId);
  }

  private handleWorkerExit(workerId: number, code: number): void {
    console.warn(`Worker ${workerId} exited with code ${code}`);
    this.recreateWorker(workerId);
  }

  private async recreateWorker(workerId: number): Promise<void> {
    // Remove old worker
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.terminate().catch(() => {});
      this.workers.delete(workerId);
    }
    this.availableWorkers.delete(workerId);

    // Create new worker
    try {
      await this.createWorker(workerId);
      this.processQueue(); // Resume processing
    } catch (error) {
      console.error(`Failed to recreate worker ${workerId}:`, error);
      this.stats.activeWorkers--;
    }
  }

  private findActiveTaskByWorker(workerId: number): [string, { workerId: number; startTime: number }] | null {
    for (const [taskId, taskInfo] of this.activeTasks) {
      if (taskInfo.workerId === workerId) {
        return [taskId, taskInfo];
      }
    }
    return null;
  }

  private updateAverageExecutionTime(duration: number): void {
    const completed = this.stats.completedTasks;
    const currentAvg = this.stats.averageExecutionTime;
    
    this.stats.averageExecutionTime = (currentAvg * (completed - 1) + duration) / completed;
  }
}

/**
 * High-level background processor for context operations
 */
export class BackgroundContextProcessor extends EventEmitter {
  private workerPool: WorkerPool;
  private initialized = false;

  constructor(options: WorkerPoolOptions = {}) {
    super();
    this.workerPool = new WorkerPool(options);
    
    // Forward events
    this.workerPool.on('taskStarted', (data) => this.emit('taskStarted', data));
    this.workerPool.on('taskCompleted', (data) => this.emit('taskCompleted', data));
    this.workerPool.on('taskFailed', (data) => this.emit('taskFailed', data));
    this.workerPool.on('taskTimeout', (data) => this.emit('taskTimeout', data));
  }

  /**
   * Initialize background processor
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.workerPool.initialize();
    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Analyze files in background
   */
  async analyzeFilesAsync(filePaths: string[]): Promise<FileIndex[]> {
    this.ensureInitialized();
    
    const tasks = filePaths.map(filePath => ({
      type: BackgroundTaskType.FILE_ANALYSIS,
      data: { filePath },
      priority: 70
    }));

    return this.workerPool.submitBatch<FileIndex>(tasks);
  }

  /**
   * Build index in background
   */
  async buildIndexAsync(
    filePaths: string[], 
    batchSize: number = 50
  ): Promise<{ index: string; stats: any }> {
    this.ensureInitialized();

    return this.workerPool.submitTask<{ index: string; stats: any }>(
      BackgroundTaskType.BATCH_INDEXING,
      { filePaths, batchSize },
      90 // High priority
    );
  }

  /**
   * Score file relevance in background
   */
  async scoreRelevanceAsync(
    filePaths: string[],
    context: any
  ): Promise<RelevanceScore[]> {
    this.ensureInitialized();

    return this.workerPool.submitTask<RelevanceScore[]>(
      BackgroundTaskType.RELEVANCE_SCORING,
      { filePaths, context },
      60
    );
  }

  /**
   * Sample content in background
   */
  async sampleContentAsync(
    files: Array<{ path: string; content: string }>,
    options: any
  ): Promise<any[]> {
    this.ensureInitialized();

    return this.workerPool.submitTask<any[]>(
      BackgroundTaskType.CONTENT_SAMPLING,
      { files, options },
      50
    );
  }

  /**
   * Serialize index in background
   */
  async serializeIndexAsync(indexData: any): Promise<string> {
    this.ensureInitialized();

    return this.workerPool.submitTask<string>(
      BackgroundTaskType.INDEX_SERIALIZATION,
      { indexData },
      30
    );
  }

  /**
   * Extract symbols in background
   */
  async extractSymbolsAsync(
    files: Array<{ path: string; content: string }>
  ): Promise<any[]> {
    this.ensureInitialized();

    return this.workerPool.submitTask<any[]>(
      BackgroundTaskType.SYMBOL_EXTRACTION,
      { files },
      80
    );
  }

  /**
   * Build import graph in background
   */
  async buildImportGraphAsync(fileIndexes: FileIndex[]): Promise<any> {
    this.ensureInitialized();

    return this.workerPool.submitTask<any>(
      BackgroundTaskType.IMPORT_GRAPH_BUILD,
      { fileIndexes },
      40
    );
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return this.workerPool.getStats();
  }

  /**
   * Shutdown background processor
   */
  async shutdown(): Promise<void> {
    await this.workerPool.shutdown();
    this.initialized = false;
    this.emit('shutdown');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('BackgroundProcessor not initialized. Call initialize() first.');
    }
  }
}

/**
 * Background task scheduler for managing periodic operations
 */
export class TaskScheduler extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private processor: BackgroundContextProcessor;

  constructor(processor: BackgroundContextProcessor) {
    super();
    this.processor = processor;
  }

  /**
   * Schedule periodic index cleanup
   */
  scheduleIndexCleanup(intervalMs: number = 5 * 60 * 1000): void {
    this.schedule('indexCleanup', intervalMs, async () => {
      try {
        // This would clean up expired cache entries, compact data, etc.
        this.emit('cleanupStarted');
        
        // Placeholder for cleanup operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.emit('cleanupCompleted');
      } catch (error) {
        this.emit('cleanupFailed', error);
      }
    });
  }

  /**
   * Schedule periodic statistics collection
   */
  scheduleStatsCollection(intervalMs: number = 30 * 1000): void {
    this.schedule('statsCollection', intervalMs, () => {
      const stats = this.processor.getStats();
      this.emit('statsCollected', stats);
    });
  }

  /**
   * Schedule custom task
   */
  schedule(
    name: string, 
    intervalMs: number, 
    task: () => void | Promise<void>
  ): void {
    // Clear existing schedule
    this.unschedule(name);

    const interval = setInterval(async () => {
      try {
        await task();
      } catch (error) {
        this.emit('scheduledTaskError', { name, error });
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    this.emit('taskScheduled', { name, intervalMs });
  }

  /**
   * Unschedule task
   */
  unschedule(name: string): boolean {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
      this.emit('taskUnscheduled', { name });
      return true;
    }
    return false;
  }

  /**
   * Clear all scheduled tasks
   */
  clearAll(): void {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      this.emit('taskUnscheduled', { name });
    }
    this.intervals.clear();
  }

  /**
   * Get scheduled task names
   */
  getScheduledTasks(): string[] {
    return Array.from(this.intervals.keys());
  }
}