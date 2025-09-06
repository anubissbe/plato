/**
 * Efficient Caching Layer for Semantic Index Data
 * Provides multi-level caching with LRU eviction and persistent storage
 */

import { SemanticIndex } from './semantic-index.js';
import { FileIndex, SymbolReference, RelevanceScore } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  size: number;
}

export interface CacheOptions {
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  ttl?: number; // Time to live in milliseconds
  persistentStorage?: string; // Directory for persistent cache
  compressionEnabled?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

/**
 * LRU Cache with size-based eviction
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0,
    hitRate: 0
  };

  constructor(private options: CacheOptions = {}) {
    this.options = {
      maxSize: 50 * 1024 * 1024, // 50MB default
      maxEntries: 10000,
      ttl: 60 * 60 * 1000, // 1 hour default
      compressionEnabled: false,
      ...options
    };
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check TTL
    if (this.options.ttl && Date.now() - entry.timestamp > this.options.ttl) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    // Update access info
    entry.lastAccess = Date.now();
    entry.accessCount++;
    
    // Move to front of access order
    this.moveToFront(key);
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const size = this.calculateSize(value);
    const existing = this.cache.get(key);
    
    if (existing) {
      // Update existing entry
      this.stats.totalSize -= existing.size;
      existing.value = value;
      existing.size = size;
      existing.timestamp = Date.now();
      existing.lastAccess = Date.now();
      existing.accessCount++;
      this.stats.totalSize += size;
      this.moveToFront(key);
    } else {
      // Add new entry
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccess: Date.now(),
        size
      };
      
      this.cache.set(key, entry);
      this.accessOrder.unshift(key);
      this.stats.totalSize += size;
      this.stats.entryCount++;
      
      // Evict if necessary
      this.evictIfNecessary();
    }
    
    this.updateHitRate();
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.cache.delete(key);
    this.stats.totalSize -= entry.size;
    this.stats.entryCount--;
    
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    
    this.updateHitRate();
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.totalSize = 0;
    this.stats.entryCount = 0;
    this.updateHitRate();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key) && 
           (!this.options.ttl || Date.now() - this.cache.get(key)!.timestamp <= this.options.ttl);
  }

  private moveToFront(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.unshift(key);
  }

  private evictIfNecessary(): void {
    // Evict by size
    while (this.options.maxSize && this.stats.totalSize > this.options.maxSize) {
      this.evictLRU();
    }
    
    // Evict by count
    while (this.options.maxEntries && this.stats.entryCount > this.options.maxEntries) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder.pop()!;
    const entry = this.cache.get(lruKey);
    
    if (entry) {
      this.cache.delete(lruKey);
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
      this.stats.evictions++;
    }
  }

  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate: 2 bytes per character
    } catch {
      return 1000; // Fallback estimate
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Persistent cache with file system storage
 */
export class PersistentCache<T> {
  private memoryCache: LRUCache<T>;
  private cacheDir: string;
  private indexFile: string;
  private index: Map<string, { file: string; timestamp: number; size: number }> = new Map();

  constructor(private options: CacheOptions = {}) {
    this.memoryCache = new LRUCache<T>(options);
    this.cacheDir = options.persistentStorage || path.join(process.cwd(), '.plato', 'cache');
    this.indexFile = path.join(this.cacheDir, 'cache-index.json');
  }

  /**
   * Initialize persistent cache
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadIndex();
    } catch (error) {
      console.warn('Failed to initialize persistent cache:', error);
    }
  }

  /**
   * Get value from cache (memory first, then disk)
   */
  async get(key: string): Promise<T | undefined> {
    // Try memory cache first
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }
    
    // Try disk cache
    const diskValue = await this.getFromDisk(key);
    if (diskValue !== undefined) {
      // Warm memory cache
      this.memoryCache.set(key, diskValue);
      return diskValue;
    }
    
    return undefined;
  }

  /**
   * Set value in cache (memory and disk)
   */
  async set(key: string, value: T): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(key, value);
    
    // Set in disk cache
    await this.setToDisk(key, value);
  }

  /**
   * Delete from both memory and disk
   */
  async delete(key: string): Promise<boolean> {
    const memoryDeleted = this.memoryCache.delete(key);
    const diskDeleted = await this.deleteFromDisk(key);
    
    return memoryDeleted || diskDeleted;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      // Remove all cache files
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)).catch(() => {}))
      );
      
      this.index.clear();
      await this.saveIndex();
    } catch (error) {
      console.warn('Error clearing persistent cache:', error);
    }
  }

  /**
   * Get combined statistics
   */
  getStats(): CacheStats & { diskEntries: number } {
    const memoryStats = this.memoryCache.getStats();
    return {
      ...memoryStats,
      diskEntries: this.index.size
    };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<{ removed: number; size: number }> {
    const now = Date.now();
    const ttl = this.options.ttl || 60 * 60 * 1000;
    let removed = 0;
    let sizeFreed = 0;
    
    const expiredKeys: string[] = [];
    
    for (const [key, meta] of this.index) {
      if (now - meta.timestamp > ttl) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      const meta = this.index.get(key);
      if (meta) {
        try {
          await fs.unlink(path.join(this.cacheDir, meta.file));
          this.index.delete(key);
          removed++;
          sizeFreed += meta.size;
        } catch (error) {
          // File might already be deleted
        }
      }
    }
    
    if (removed > 0) {
      await this.saveIndex();
    }
    
    return { removed, size: sizeFreed };
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexFile, 'utf-8');
      const parsed = JSON.parse(indexData);
      
      this.index = new Map(Object.entries(parsed));
    } catch (error) {
      // Index file doesn't exist or is corrupted, start fresh
      this.index = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const indexData = Object.fromEntries(this.index);
      await fs.writeFile(this.indexFile, JSON.stringify(indexData, null, 2));
    } catch (error) {
      console.warn('Failed to save cache index:', error);
    }
  }

  private async getFromDisk(key: string): Promise<T | undefined> {
    const meta = this.index.get(key);
    if (!meta) return undefined;
    
    // Check TTL
    if (this.options.ttl && Date.now() - meta.timestamp > this.options.ttl) {
      await this.deleteFromDisk(key);
      return undefined;
    }
    
    try {
      const filePath = path.join(this.cacheDir, meta.file);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File corrupted or missing, remove from index
      this.index.delete(key);
      await this.saveIndex();
      return undefined;
    }
  }

  private async setToDisk(key: string, value: T): Promise<void> {
    try {
      const data = JSON.stringify(value);
      const hash = crypto.createHash('sha256').update(key).digest('hex');
      const fileName = `${hash.substring(0, 16)}.json`;
      const filePath = path.join(this.cacheDir, fileName);
      
      await fs.writeFile(filePath, data);
      
      this.index.set(key, {
        file: fileName,
        timestamp: Date.now(),
        size: data.length
      });
      
      await this.saveIndex();
    } catch (error) {
      console.warn(`Failed to cache ${key} to disk:`, error);
    }
  }

  private async deleteFromDisk(key: string): Promise<boolean> {
    const meta = this.index.get(key);
    if (!meta) return false;
    
    try {
      const filePath = path.join(this.cacheDir, meta.file);
      await fs.unlink(filePath);
      this.index.delete(key);
      await this.saveIndex();
      return true;
    } catch (error) {
      // File might not exist, but remove from index anyway
      this.index.delete(key);
      await this.saveIndex();
      return false;
    }
  }
}

/**
 * Semantic index cache manager
 */
export class SemanticIndexCache {
  private indexCache: PersistentCache<string>; // Serialized index data
  private fileCache: LRUCache<FileIndex>; // Individual file indexes
  private scoreCache: LRUCache<RelevanceScore[]>; // Relevance scores
  private symbolCache: LRUCache<SymbolReference[]>; // Symbol references

  constructor(options: CacheOptions = {}) {
    const baseOptions = {
      maxSize: 20 * 1024 * 1024, // 20MB per cache
      ttl: 4 * 60 * 60 * 1000, // 4 hours
      ...options
    };

    this.indexCache = new PersistentCache<string>({
      ...baseOptions,
      persistentStorage: path.join(options.persistentStorage || '.plato/cache', 'index')
    });

    this.fileCache = new LRUCache<FileIndex>({
      ...baseOptions,
      maxSize: 10 * 1024 * 1024 // 10MB
    });

    this.scoreCache = new LRUCache<RelevanceScore[]>({
      ...baseOptions,
      maxSize: 5 * 1024 * 1024, // 5MB
      ttl: 30 * 60 * 1000 // 30 minutes - scores may change more frequently
    });

    this.symbolCache = new LRUCache<SymbolReference[]>({
      ...baseOptions,
      maxSize: 10 * 1024 * 1024 // 10MB
    });
  }

  /**
   * Initialize all caches
   */
  async initialize(): Promise<void> {
    await this.indexCache.initialize();
  }

  /**
   * Cache serialized index data
   */
  async cacheIndex(key: string, index: SemanticIndex): Promise<void> {
    const serialized = index.serialize();
    await this.indexCache.set(key, serialized);
  }

  /**
   * Get cached index data
   */
  async getCachedIndex(key: string): Promise<SemanticIndex | undefined> {
    const serialized = await this.indexCache.get(key);
    if (!serialized) return undefined;
    
    try {
      return SemanticIndex.deserialize(serialized);
    } catch (error) {
      // Corrupted data, remove from cache
      await this.indexCache.delete(key);
      return undefined;
    }
  }

  /**
   * Cache individual file index
   */
  cacheFile(filePath: string, fileIndex: FileIndex): void {
    this.fileCache.set(filePath, fileIndex);
  }

  /**
   * Get cached file index
   */
  getCachedFile(filePath: string): FileIndex | undefined {
    return this.fileCache.get(filePath);
  }

  /**
   * Cache relevance scores
   */
  cacheScores(key: string, scores: RelevanceScore[]): void {
    this.scoreCache.set(key, scores);
  }

  /**
   * Get cached relevance scores
   */
  getCachedScores(key: string): RelevanceScore[] | undefined {
    return this.scoreCache.get(key);
  }

  /**
   * Cache symbol references
   */
  cacheSymbols(symbolName: string, references: SymbolReference[]): void {
    this.symbolCache.set(symbolName, references);
  }

  /**
   * Get cached symbol references
   */
  getCachedSymbols(symbolName: string): SymbolReference[] | undefined {
    return this.symbolCache.get(symbolName);
  }

  /**
   * Generate cache key for relevance scoring
   */
  generateScoreKey(currentFile: string, userQuery: string, fileSet: string[]): string {
    const data = JSON.stringify({ currentFile, userQuery, files: fileSet.sort() });
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    await this.indexCache.clear();
    this.fileCache.clear();
    this.scoreCache.clear();
    this.symbolCache.clear();
  }

  /**
   * Cleanup expired entries in all caches
   */
  async cleanup(): Promise<{ removed: number; size: number }> {
    const result = await this.indexCache.cleanup();
    
    // Memory caches clean themselves automatically via TTL
    
    return result;
  }

  /**
   * Get combined statistics
   */
  async getStats(): Promise<{
    index: CacheStats & { diskEntries: number };
    files: CacheStats;
    scores: CacheStats;
    symbols: CacheStats;
    totalMemorySize: number;
  }> {
    const indexStats = this.indexCache.getStats();
    const fileStats = this.fileCache.getStats();
    const scoreStats = this.scoreCache.getStats();
    const symbolStats = this.symbolCache.getStats();

    return {
      index: indexStats,
      files: fileStats,
      scores: scoreStats,
      symbols: symbolStats,
      totalMemorySize: fileStats.totalSize + scoreStats.totalSize + symbolStats.totalSize
    };
  }
}

/**
 * Cache-aware semantic index wrapper
 */
export class CachedSemanticIndex {
  private cache: SemanticIndexCache;

  constructor(
    private index: SemanticIndex,
    cacheOptions: CacheOptions = {}
  ) {
    this.cache = new SemanticIndexCache(cacheOptions);
  }

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    await this.cache.initialize();
  }

  /**
   * Add file with caching
   */
  async addFile(fileIndex: FileIndex): Promise<void> {
    await this.index.addFile(fileIndex);
    this.cache.cacheFile(fileIndex.path, fileIndex);
  }

  /**
   * Get file with caching
   */
  getFile(filePath: string): FileIndex | undefined {
    // Try cache first
    const cached = this.cache.getCachedFile(filePath);
    if (cached) return cached;
    
    // Get from index and cache
    const fileIndex = this.index.getFile(filePath);
    if (fileIndex) {
      this.cache.cacheFile(filePath, fileIndex);
    }
    
    return fileIndex;
  }

  /**
   * Get symbol references with caching
   */
  getSymbolReferences(symbolName: string): SymbolReference[] {
    // Try cache first
    const cached = this.cache.getCachedSymbols(symbolName);
    if (cached) return cached;
    
    // Get from index and cache
    const references = this.index.getSymbolReferences(symbolName);
    this.cache.cacheSymbols(symbolName, references);
    
    return references;
  }

  /**
   * Save index to cache
   */
  async saveToCache(key: string = 'default'): Promise<void> {
    await this.cache.cacheIndex(key, this.index);
  }

  /**
   * Load index from cache
   */
  async loadFromCache(key: string = 'default'): Promise<boolean> {
    const cached = await this.cache.getCachedIndex(key);
    if (!cached) return false;
    
    // Replace internal index data
    this.index = cached;
    return true;
  }

  /**
   * Get underlying index
   */
  getIndex(): SemanticIndex {
    return this.index;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.cache.clearAll();
  }
}