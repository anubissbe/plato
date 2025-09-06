/**
 * Incremental Indexing Engine for Advanced Context Management
 * Provides efficient change detection and incremental updates to avoid full rebuilds
 */

import { SemanticIndex, FileAnalyzer } from './semantic-index.js';
import { FileIndex } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface FileChangeInfo {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  previousHash?: string;
  newHash?: string;
  timestamp: Date;
}

export interface IncrementalUpdateResult {
  processed: number;
  skipped: number;
  errors: string[];
  duration: number;
  changedFiles: FileChangeInfo[];
}

export interface IncrementalIndexOptions {
  batchSize?: number;
  maxConcurrent?: number;
  enableWatcher?: boolean;
  watchPatterns?: string[];
  ignorePatterns?: string[];
}

/**
 * File system watcher for detecting changes
 */
export class FileSystemWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private changeBuffer: Map<string, FileChangeInfo> = new Map();
  private debounceTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceMs: number = 100;

  constructor(private onChanges: (changes: FileChangeInfo[]) => void) {}

  /**
   * Watch a directory for changes
   */
  async watchDirectory(
    directory: string, 
    patterns: string[] = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
    ignorePatterns: string[] = ['**/node_modules/**', '**/dist/**', '**/.git/**']
  ): Promise<void> {
    try {
      const watcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        const fullPath = path.join(directory, filename);
        
        // Check if file matches patterns
        if (!this.matchesPatterns(fullPath, patterns) || this.matchesPatterns(fullPath, ignorePatterns)) {
          return;
        }
        
        this.handleFileChange(fullPath, eventType);
      });
      
      this.watchers.set(directory, watcher);
    } catch (error) {
      console.warn(`Failed to watch directory ${directory}:`, error);
    }
  }

  /**
   * Stop watching a directory
   */
  stopWatching(directory: string): void {
    const watcher = this.watchers.get(directory);
    if (watcher) {
      watcher.close();
      this.watchers.delete(directory);
    }
  }

  /**
   * Stop all watchers
   */
  stopAll(): void {
    for (const [directory, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    
    // Clear any pending timeouts
    for (const timeout of this.debounceTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimeouts.clear();
  }

  private handleFileChange(filePath: string, eventType: string): void {
    // Debounce rapid changes
    const existing = this.debounceTimeouts.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    
    this.debounceTimeouts.set(filePath, setTimeout(async () => {
      try {
        const stats = await fs.stat(filePath).catch(() => null);
        const changeType: FileChangeInfo['type'] = stats ? 
          (this.changeBuffer.has(filePath) ? 'modified' : 'created') : 
          'deleted';
        
        const change: FileChangeInfo = {
          path: filePath,
          type: changeType,
          timestamp: new Date()
        };
        
        if (stats && changeType !== 'deleted') {
          const content = await fs.readFile(filePath, 'utf-8');
          change.newHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
        }
        
        this.changeBuffer.set(filePath, change);
        this.debounceTimeouts.delete(filePath);
        
        // Flush changes after brief delay to allow batching
        setTimeout(() => this.flushChanges(), 50);
      } catch (error) {
        console.warn(`Error processing file change for ${filePath}:`, error);
        this.debounceTimeouts.delete(filePath);
      }
    }, this.debounceMs));
  }

  private flushChanges(): void {
    if (this.changeBuffer.size === 0) return;
    
    const changes = Array.from(this.changeBuffer.values());
    this.changeBuffer.clear();
    this.onChanges(changes);
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = this.globToRegex(pattern);
      return regex.test(filePath);
    });
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(escaped);
  }
}

/**
 * Change detection utilities
 */
export class ChangeDetector {
  /**
   * Calculate file hash for change detection
   */
  static async calculateFileHash(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect changes in a directory
   */
  static async detectChanges(
    directory: string,
    currentIndex: SemanticIndex,
    patterns: string[] = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']
  ): Promise<FileChangeInfo[]> {
    const changes: FileChangeInfo[] = [];
    const existingFiles = new Set(currentIndex.getAllFiles().map(f => f.path));
    
    try {
      const files = await this.findFiles(directory, patterns);
      
      for (const filePath of files) {
        const currentHash = await this.calculateFileHash(filePath);
        if (!currentHash) continue;
        
        const existingFile = currentIndex.getFile(filePath);
        
        if (!existingFile) {
          // New file
          changes.push({
            path: filePath,
            type: 'created',
            newHash: currentHash,
            timestamp: new Date()
          });
        } else if (existingFile.hash !== currentHash) {
          // Modified file
          changes.push({
            path: filePath,
            type: 'modified',
            previousHash: existingFile.hash,
            newHash: currentHash,
            timestamp: new Date()
          });
        }
        
        existingFiles.delete(filePath);
      }
      
      // Deleted files
      for (const deletedPath of existingFiles) {
        changes.push({
          path: deletedPath,
          type: 'deleted',
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.warn(`Error detecting changes in ${directory}:`, error);
    }
    
    return changes;
  }

  private static async findFiles(directory: string, patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    const scan = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common ignored directories
            if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            // Check if file matches patterns
            if (patterns.some(pattern => {
              const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
              return new RegExp(regex).test(fullPath);
            })) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await scan(directory);
    return files;
  }
}

/**
 * Incremental indexing engine
 */
export class IncrementalIndexer {
  private analyzer: FileAnalyzer;
  private watcher?: FileSystemWatcher;
  private pendingChanges: Map<string, FileChangeInfo> = new Map();
  private updateInProgress: boolean = false;
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(
    private index: SemanticIndex,
    private options: IncrementalIndexOptions = {}
  ) {
    this.analyzer = new FileAnalyzer();
    
    if (options.enableWatcher) {
      this.watcher = new FileSystemWatcher((changes) => this.handleChanges(changes));
    }
  }

  /**
   * Start watching directories for changes
   */
  async startWatching(directories: string[]): Promise<void> {
    if (!this.watcher) return;
    
    for (const directory of directories) {
      await this.watcher.watchDirectory(
        directory,
        this.options.watchPatterns || ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
        this.options.ignorePatterns || ['**/node_modules/**', '**/dist/**', '**/.git/**']
      );
    }
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    this.watcher?.stopAll();
  }

  /**
   * Perform incremental update based on detected changes
   */
  async updateIndex(changes: FileChangeInfo[]): Promise<IncrementalUpdateResult> {
    return this.queueUpdate(async () => {
      const startTime = performance.now();
      const result: IncrementalUpdateResult = {
        processed: 0,
        skipped: 0,
        errors: [],
        duration: 0,
        changedFiles: changes
      };

      const batchSize = this.options.batchSize || 50;
      const maxConcurrent = this.options.maxConcurrent || 5;

      // Process changes in batches
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        await this.processBatch(batch, result, maxConcurrent);
      }

      result.duration = performance.now() - startTime;
      return result;
    });
  }

  /**
   * Detect and apply changes in a directory
   */
  async syncDirectory(directory: string): Promise<IncrementalUpdateResult> {
    const changes = await ChangeDetector.detectChanges(
      directory,
      this.index,
      this.options.watchPatterns
    );
    
    return this.updateIndex(changes);
  }

  /**
   * Force full rebuild of index
   */
  async rebuildIndex(directories: string[]): Promise<IncrementalUpdateResult> {
    const changes: FileChangeInfo[] = [];
    
    // Clear existing index
    const existingFiles = this.index.getAllFiles();
    for (const file of existingFiles) {
      this.index.removeFile(file.path);
    }
    
    // Find all files and mark as created
    for (const directory of directories) {
      const files = await ChangeDetector.findFiles(directory, this.options.watchPatterns || ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']);
      for (const filePath of files) {
        const hash = await ChangeDetector.calculateFileHash(filePath);
        if (hash) {
          changes.push({
            path: filePath,
            type: 'created',
            newHash: hash,
            timestamp: new Date()
          });
        }
      }
    }
    
    return this.updateIndex(changes);
  }

  /**
   * Get incremental update statistics
   */
  getStats(): {
    totalFiles: number;
    lastUpdated: Date | null;
    pendingChanges: number;
    updateInProgress: boolean;
  } {
    return {
      totalFiles: this.index.getAllFiles().length,
      lastUpdated: this.index.getAllFiles().length > 0 ? 
        Math.max(...this.index.getAllFiles().map(f => f.lastModified?.getTime() || 0)) as any : null,
      pendingChanges: this.pendingChanges.size,
      updateInProgress: this.updateInProgress
    };
  }

  private async queueUpdate<T>(updateFn: () => Promise<T>): Promise<T> {
    this.updateQueue = this.updateQueue.then(async () => {
      this.updateInProgress = true;
      try {
        return await updateFn();
      } finally {
        this.updateInProgress = false;
      }
    });
    
    return this.updateQueue as Promise<T>;
  }

  private async processBatch(
    changes: FileChangeInfo[], 
    result: IncrementalUpdateResult, 
    maxConcurrent: number
  ): Promise<void> {
    const semaphore = new Array(maxConcurrent).fill(Promise.resolve());
    let semaphoreIndex = 0;

    const processChange = async (change: FileChangeInfo): Promise<void> => {
      try {
        switch (change.type) {
          case 'created':
          case 'modified':
            const content = await fs.readFile(change.path, 'utf-8');
            const fileIndex = await this.analyzer.analyzeFile(change.path, content);
            await this.index.addFile(fileIndex);
            result.processed++;
            break;
            
          case 'deleted':
            this.index.removeFile(change.path);
            result.processed++;
            break;
        }
      } catch (error) {
        result.errors.push(`Error processing ${change.path}: ${error.message}`);
      }
    };

    // Process changes with concurrency limit
    const promises = changes.map(async (change) => {
      const currentIndex = semaphoreIndex;
      semaphoreIndex = (semaphoreIndex + 1) % maxConcurrent;
      
      await semaphore[currentIndex];
      const promise = processChange(change);
      semaphore[currentIndex] = promise.catch(() => {}); // Don't let errors break the semaphore
      return promise;
    });

    await Promise.all(promises);
  }

  private handleChanges(changes: FileChangeInfo[]): void {
    // Buffer changes to avoid excessive updates
    for (const change of changes) {
      this.pendingChanges.set(change.path, change);
    }
    
    // Debounced update
    setTimeout(() => {
      if (this.pendingChanges.size > 0) {
        const changesToProcess = Array.from(this.pendingChanges.values());
        this.pendingChanges.clear();
        
        this.updateIndex(changesToProcess).catch(error => {
          console.error('Error in incremental update:', error);
        });
      }
    }, 1000); // 1 second debounce
  }
}

/**
 * Utility for managing incremental index lifecycle
 */
export class IndexManager {
  private indexer: IncrementalIndexer;
  
  constructor(
    private index: SemanticIndex,
    private options: IncrementalIndexOptions = {}
  ) {
    this.indexer = new IncrementalIndexer(index, options);
  }

  /**
   * Initialize index for directories
   */
  async initialize(directories: string[]): Promise<IncrementalUpdateResult> {
    // Check if index is empty or needs rebuild
    const existingFiles = this.index.getAllFiles();
    if (existingFiles.length === 0) {
      return this.indexer.rebuildIndex(directories);
    }
    
    // Sync existing index
    const results = await Promise.all(
      directories.map(dir => this.indexer.syncDirectory(dir))
    );
    
    // Combine results
    return {
      processed: results.reduce((sum, r) => sum + r.processed, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      errors: results.flatMap(r => r.errors),
      duration: Math.max(...results.map(r => r.duration)),
      changedFiles: results.flatMap(r => r.changedFiles)
    };
  }

  /**
   * Start watching for changes
   */
  async startWatching(directories: string[]): Promise<void> {
    await this.indexer.startWatching(directories);
  }

  /**
   * Stop watching and cleanup
   */
  async shutdown(): Promise<void> {
    this.indexer.stopWatching();
  }

  /**
   * Get manager statistics
   */
  getStats() {
    return this.indexer.getStats();
  }
}