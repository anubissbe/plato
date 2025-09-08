/**
 * Lazy Loading Engine for Large Project Indexes
 * Provides on-demand loading and memory-efficient handling of large codebases
 */

import { SemanticIndex, FileAnalyzer } from './semantic-index.js';
import { FileIndex, SymbolReference, SymbolInfo } from './types.js';
import { SemanticIndexCache, CachedSemanticIndex } from './index-cache.js';
import { ChangeDetector } from './incremental-index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface LazyLoadingOptions {
  maxLoadedFiles?: number; // Maximum files to keep in memory
  preloadRadius?: number; // Number of related files to preload
  loadTimeoutMs?: number; // Timeout for individual file loads
  batchSize?: number; // Size of batches when loading multiple files
  priorityPatterns?: string[]; // File patterns to load with higher priority
  excludePatterns?: string[]; // File patterns to exclude from lazy loading
}

export interface LoadingStrategy {
  name: string;
  shouldLoad: (filePath: string, context: LoadingContext) => boolean;
  priority: number; // Higher priority loads first
}

export interface LoadingContext {
  currentFile?: string;
  recentFiles: string[];
  userQuery?: string;
  accessPattern: Map<string, number>; // File path -> access count
  lastAccess: Map<string, number>; // File path -> timestamp
}

export interface LoadBatch {
  files: string[];
  priority: number;
  estimatedSize: number;
  reason: string;
}

export interface LazyLoadStats {
  totalFiles: number;
  loadedFiles: number;
  pendingLoads: number;
  hitRate: number;
  averageLoadTime: number;
  memoryUsage: number;
  lastEvictionTime?: number;
}

/**
 * File loading priority queue
 */
export class LoadingQueue {
  private queue: Map<number, Set<string>> = new Map(); // priority -> file paths
  private pending: Set<string> = new Set();
  private priorities: Map<string, number> = new Map(); // file path -> priority

  /**
   * Add file to loading queue
   */
  enqueue(filePath: string, priority: number): void {
    if (this.pending.has(filePath)) {
      // Update priority if higher
      const currentPriority = this.priorities.get(filePath) || 0;
      if (priority <= currentPriority) return;
      
      // Remove from current priority queue
      const currentQueue = this.queue.get(currentPriority);
      currentQueue?.delete(filePath);
      if (currentQueue?.size === 0) {
        this.queue.delete(currentPriority);
      }
    }

    if (!this.queue.has(priority)) {
      this.queue.set(priority, new Set());
    }
    
    this.queue.get(priority)!.add(filePath);
    this.pending.add(filePath);
    this.priorities.set(filePath, priority);
  }

  /**
   * Get next batch of files to load
   */
  dequeue(batchSize: number = 10): string[] {
    const batch: string[] = [];
    const sortedPriorities = Array.from(this.queue.keys()).sort((a, b) => b - a);

    for (const priority of sortedPriorities) {
      const files = this.queue.get(priority)!;
      
      while (files.size > 0 && batch.length < batchSize) {
        const filePath = files.values().next().value;
        if (filePath) {
          files.delete(filePath);
          this.pending.delete(filePath);
          this.priorities.delete(filePath);
          batch.push(filePath);
        } else {
          break;
        }
      }
      
      if (files.size === 0) {
        this.queue.delete(priority);
      }
      
      if (batch.length >= batchSize) break;
    }

    return batch;
  }

  /**
   * Check if file is queued for loading
   */
  isPending(filePath: string): boolean {
    return this.pending.has(filePath);
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.pending.size;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.clear();
    this.pending.clear();
    this.priorities.clear();
  }
}

/**
 * Loading strategies for different scenarios
 */
export class LoadingStrategies {
  static readonly IMMEDIATE: LoadingStrategy = {
    name: 'immediate',
    shouldLoad: (filePath, context) => {
      return filePath === context.currentFile;
    },
    priority: 100
  };

  static readonly RECENTLY_ACCESSED: LoadingStrategy = {
    name: 'recently_accessed',
    shouldLoad: (filePath, context) => {
      return context.recentFiles.includes(filePath);
    },
    priority: 90
  };

  static readonly FREQUENTLY_ACCESSED: LoadingStrategy = {
    name: 'frequently_accessed',
    shouldLoad: (filePath, context) => {
      const accessCount = context.accessPattern.get(filePath) || 0;
      return accessCount > 5;
    },
    priority: 80
  };

  static readonly IMPORT_RELATED: LoadingStrategy = {
    name: 'import_related',
    shouldLoad: (filePath, context) => {
      // This would require index data to determine import relationships
      // For now, use simple heuristics
      if (!context.currentFile) return false;
      
      const currentDir = path.dirname(context.currentFile);
      const targetDir = path.dirname(filePath);
      
      // Same directory or parent/child relationship
      return currentDir === targetDir || 
             currentDir.startsWith(targetDir) || 
             targetDir.startsWith(currentDir);
    },
    priority: 70
  };

  static readonly PATTERN_PRIORITY: LoadingStrategy = {
    name: 'pattern_priority',
    shouldLoad: (filePath, context) => {
      // High priority patterns (types, configs, main entry points)
      const highPriorityPatterns = [
        /\.d\.ts$/,
        /types?\.(ts|js)$/,
        /config\.(ts|js)$/,
        /index\.(ts|js)$/,
        /main\.(ts|js)$/
      ];
      
      return highPriorityPatterns.some(pattern => pattern.test(filePath));
    },
    priority: 60
  };

  static readonly QUERY_MATCHING: LoadingStrategy = {
    name: 'query_matching',
    shouldLoad: (filePath, context) => {
      if (!context.userQuery) return false;
      
      const fileName = path.basename(filePath);
      const query = context.userQuery.toLowerCase();
      
      return fileName.toLowerCase().includes(query) ||
             filePath.toLowerCase().includes(query);
    },
    priority: 85
  };

  static getDefaultStrategies(): LoadingStrategy[] {
    return [
      this.IMMEDIATE,
      this.RECENTLY_ACCESSED,
      this.QUERY_MATCHING,
      this.FREQUENTLY_ACCESSED,
      this.IMPORT_RELATED,
      this.PATTERN_PRIORITY
    ];
  }
}

/**
 * Lazy loading file manager
 */
export class LazyFileManager {
  private loadedFiles: Map<string, FileIndex> = new Map();
  private loadingPromises: Map<string, Promise<FileIndex | null>> = new Map();
  private accessOrder: string[] = [];
  private analyzer: FileAnalyzer;
  private stats: LazyLoadStats = {
    totalFiles: 0,
    loadedFiles: 0,
    pendingLoads: 0,
    hitRate: 0,
    averageLoadTime: 0,
    memoryUsage: 0
  };

  constructor(
    private options: LazyLoadingOptions = {},
    private cache?: SemanticIndexCache
  ) {
    this.analyzer = new FileAnalyzer();
    this.options = {
      maxLoadedFiles: 1000,
      preloadRadius: 5,
      loadTimeoutMs: 5000,
      batchSize: 10,
      priorityPatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**'],
      ...options
    };
  }

  /**
   * Load file on demand
   */
  async loadFile(filePath: string): Promise<FileIndex | null> {
    // Check if already loaded
    if (this.loadedFiles.has(filePath)) {
      this.updateAccessOrder(filePath);
      return this.loadedFiles.get(filePath)!;
    }

    // Check if loading is in progress
    if (this.loadingPromises.has(filePath)) {
      return this.loadingPromises.get(filePath)!;
    }

    // Start loading
    const loadPromise = this.performLoad(filePath);
    this.loadingPromises.set(filePath, loadPromise);
    this.stats.pendingLoads++;

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(filePath);
      this.stats.pendingLoads--;

      if (result) {
        this.loadedFiles.set(filePath, result);
        this.updateAccessOrder(filePath);
        this.evictIfNecessary();
        this.updateStats();
      }

      return result;
    } catch (error) {
      this.loadingPromises.delete(filePath);
      this.stats.pendingLoads--;
      console.warn(`Failed to load file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load multiple files in batch
   */
  async loadBatch(filePaths: string[]): Promise<Map<string, FileIndex | null>> {
    const results = new Map<string, FileIndex | null>();
    const loadPromises = filePaths.map(async filePath => {
      const result = await this.loadFile(filePath);
      results.set(filePath, result);
      return { filePath, result };
    });

    await Promise.allSettled(loadPromises);
    return results;
  }

  /**
   * Preload files based on context
   */
  async preloadFiles(context: LoadingContext, strategies: LoadingStrategy[]): Promise<void> {
    const candidates = this.findCandidateFiles(context);
    const toLoad: Array<{ filePath: string; priority: number }> = [];

    for (const filePath of candidates) {
      if (this.loadedFiles.has(filePath) || this.loadingPromises.has(filePath)) {
        continue;
      }

      for (const strategy of strategies) {
        if (strategy.shouldLoad(filePath, context)) {
          toLoad.push({ filePath, priority: strategy.priority });
          break;
        }
      }
    }

    // Sort by priority and take top candidates
    toLoad.sort((a, b) => b.priority - a.priority);
    const priorityFiles = toLoad
      .slice(0, this.options.preloadRadius || 5)
      .map(item => item.filePath);

    // Load in background without waiting
    this.loadBatch(priorityFiles).catch(error => {
      console.warn('Error in preload operation:', error);
    });
  }

  /**
   * Get file if loaded, null if not loaded (no loading triggered)
   */
  getLoadedFile(filePath: string): FileIndex | null {
    const file = this.loadedFiles.get(filePath);
    if (file) {
      this.updateAccessOrder(filePath);
      return file;
    }
    return null;
  }

  /**
   * Check if file is loaded
   */
  isLoaded(filePath: string): boolean {
    return this.loadedFiles.has(filePath);
  }

  /**
   * Get loading statistics
   */
  getStats(): LazyLoadStats {
    return { ...this.stats };
  }

  /**
   * Clear loaded files
   */
  clear(): void {
    this.loadedFiles.clear();
    this.loadingPromises.clear();
    this.accessOrder = [];
    this.updateStats();
  }

  /**
   * Evict specific file from memory
   */
  evictFile(filePath: string): boolean {
    if (!this.loadedFiles.has(filePath)) return false;
    
    this.loadedFiles.delete(filePath);
    const index = this.accessOrder.indexOf(filePath);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    
    this.updateStats();
    return true;
  }

  /**
   * Force eviction of least recently used files
   */
  forceEviction(targetCount?: number): number {
    const target = targetCount || Math.floor((this.options.maxLoadedFiles || 1000) * 0.8);
    let evicted = 0;
    
    while (this.loadedFiles.size > target && this.accessOrder.length > 0) {
      const lruFile = this.accessOrder.pop()!;
      if (this.loadedFiles.delete(lruFile)) {
        evicted++;
      }
    }
    
    if (evicted > 0) {
      this.stats.lastEvictionTime = Date.now();
      this.updateStats();
    }
    
    return evicted;
  }

  private async performLoad(filePath: string): Promise<FileIndex | null> {
    const startTime = performance.now();
    
    try {
      // Try cache first
      if (this.cache) {
        const cached = this.cache.getCachedFile(filePath);
        if (cached) {
          const loadTime = performance.now() - startTime;
          this.updateLoadTime(loadTime);
          return cached;
        }
      }

      // Load from file system
      const content = await Promise.race([
        fs.readFile(filePath, 'utf-8'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Load timeout')), this.options.loadTimeoutMs)
        )
      ]);

      const fileIndex = await this.analyzer.analyzeFile(filePath, content);
      
      // Cache if available
      if (this.cache) {
        this.cache.cacheFile(filePath, fileIndex);
      }

      const loadTime = performance.now() - startTime;
      this.updateLoadTime(loadTime);

      return fileIndex;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      this.updateLoadTime(loadTime);
      throw error;
    }
  }

  private findCandidateFiles(context: LoadingContext): string[] {
    // This would typically scan the project directory
    // For now, return files from context
    const candidates: string[] = [];
    
    if (context.currentFile) {
      candidates.push(context.currentFile);
    }
    
    candidates.push(...context.recentFiles);
    
    // Add files from access pattern
    const frequentFiles = Array.from(context.accessPattern.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([file]) => file);
    
    candidates.push(...frequentFiles);
    
    return [...new Set(candidates)];
  }

  private updateAccessOrder(filePath: string): void {
    const index = this.accessOrder.indexOf(filePath);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.unshift(filePath);
  }

  private evictIfNecessary(): void {
    const maxFiles = this.options.maxLoadedFiles || 1000;
    
    while (this.loadedFiles.size > maxFiles) {
      const lruFile = this.accessOrder.pop();
      if (lruFile && this.loadedFiles.delete(lruFile)) {
        this.stats.lastEvictionTime = Date.now();
      }
    }
  }

  private updateLoadTime(loadTime: number): void {
    // Update running average
    const currentAvg = this.stats.averageLoadTime;
    const loadedCount = this.stats.loadedFiles;
    
    this.stats.averageLoadTime = (currentAvg * loadedCount + loadTime) / (loadedCount + 1);
  }

  private updateStats(): void {
    this.stats.loadedFiles = this.loadedFiles.size;
    this.stats.memoryUsage = Array.from(this.loadedFiles.values())
      .reduce((sum, file) => sum + (JSON.stringify(file).length * 2), 0);
    
    const total = this.stats.loadedFiles + this.stats.pendingLoads;
    this.stats.hitRate = total > 0 ? this.stats.loadedFiles / total : 0;
  }
}

/**
 * Lazy-loading semantic index
 */
export class LazySemanticIndex {
  private fileManager: LazyFileManager;
  private loadingQueue: LoadingQueue;
  private strategies: LoadingStrategy[];
  private context: LoadingContext;

  constructor(
    private baseIndex: SemanticIndex,
    options: LazyLoadingOptions = {},
    cache?: SemanticIndexCache
  ) {
    this.fileManager = new LazyFileManager(options, cache);
    this.loadingQueue = new LoadingQueue();
    this.strategies = LoadingStrategies.getDefaultStrategies();
    this.context = {
      recentFiles: [],
      accessPattern: new Map(),
      lastAccess: new Map()
    };
  }

  /**
   * Get file with lazy loading
   */
  async getFile(filePath: string): Promise<FileIndex | undefined> {
    // Update access tracking
    this.updateAccess(filePath);
    
    // Try to get already loaded file
    const loaded = this.fileManager.getLoadedFile(filePath);
    if (loaded) return loaded;
    
    // Check base index
    const baseFile = this.baseIndex.getFile(filePath);
    if (baseFile) return baseFile;
    
    // Load on demand
    const lazyLoaded = await this.fileManager.loadFile(filePath);
    if (lazyLoaded) {
      await this.baseIndex.addFile(lazyLoaded);
      return lazyLoaded;
    }
    
    return undefined;
  }

  /**
   * Get all files (only returns loaded files)
   */
  getAllFiles(): FileIndex[] {
    return this.baseIndex.getAllFiles();
  }

  /**
   * Search files with lazy loading of matches
   */
  async searchFiles(query: string, maxResults: number = 10): Promise<FileIndex[]> {
    this.context.userQuery = query;
    
    // Get all known files
    const allFiles = this.baseIndex.getAllFiles();
    const matches: FileIndex[] = [];
    
    // Find matches in already loaded files
    for (const file of allFiles) {
      if (this.matchesQuery(file, query)) {
        matches.push(file);
        if (matches.length >= maxResults) break;
      }
    }
    
    // If we need more matches, trigger lazy loading
    if (matches.length < maxResults) {
      await this.fileManager.preloadFiles(this.context, this.strategies);
    }
    
    return matches.slice(0, maxResults);
  }

  /**
   * Update loading context
   */
  updateContext(updates: Partial<LoadingContext>): void {
    Object.assign(this.context, updates);
    
    if (updates.currentFile) {
      this.updateAccess(updates.currentFile);
    }
    
    if (updates.recentFiles) {
      updates.recentFiles.forEach(file => this.updateAccess(file));
    }
  }

  /**
   * Preload files based on current context
   */
  async preloadContext(): Promise<void> {
    await this.fileManager.preloadFiles(this.context, this.strategies);
  }

  /**
   * Get loading statistics
   */
  getStats(): LazyLoadStats & { baseIndexSize: number } {
    const lazyStats = this.fileManager.getStats();
    return {
      ...lazyStats,
      baseIndexSize: this.baseIndex.getAllFiles().length
    };
  }

  /**
   * Clear lazy loading cache
   */
  clearLazyCache(): void {
    this.fileManager.clear();
    this.loadingQueue.clear();
  }

  /**
   * Force memory cleanup
   */
  forceCleanup(targetFiles?: number): number {
    return this.fileManager.forceEviction(targetFiles);
  }

  private updateAccess(filePath: string): void {
    const now = Date.now();
    const currentCount = this.context.accessPattern.get(filePath) || 0;
    
    this.context.accessPattern.set(filePath, currentCount + 1);
    this.context.lastAccess.set(filePath, now);
    
    // Update recent files
    const recent = this.context.recentFiles.filter(f => f !== filePath);
    recent.unshift(filePath);
    this.context.recentFiles = recent.slice(0, 10);
  }

  private matchesQuery(file: FileIndex, query: string): boolean {
    const queryLower = query.toLowerCase();
    
    // Check file path
    if (file.path.toLowerCase().includes(queryLower)) return true;
    
    // Check symbols
    return file.symbols.some(symbol => 
      symbol.name.toLowerCase().includes(queryLower)
    );
  }
}