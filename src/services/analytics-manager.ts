/**
 * Analytics Manager Service
 * 
 * Manages cost metrics persistence, retrieval, and analytics operations
 * with performance optimization and data retention policies
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  CostMetric, 
  AnalyticsSummary, 
  AnalyticsManagerOptions, 
  AnalyticsQueryOptions,
  AnalyticsDataFile,
  AnalyticsIndex,
  ExportFormat,
  DateRange,
  ExpensiveSession,
  MetricValidationError,
  PerformanceMetrics,
  TypeGuards
} from './analytics-types.js';

/**
 * AnalyticsManager - Core analytics data management service
 * 
 * Handles persistence, retrieval, aggregation, and export of cost metrics
 * with performance optimization and automatic cleanup features
 */
export class AnalyticsManager {
  /**
   * Default configuration options
   */
  private static readonly DEFAULTS: Required<AnalyticsManagerOptions> = {
    dataDir: '.plato/analytics',
    autoSave: true,
    saveInterval: 30000, // 30 seconds
    retentionMonths: 6,
    batchSize: 100,
    enableCache: true,
    maxBatchWaitTime: 5000, // 5 seconds max wait
    intelligentBatching: true,
    targetBatchDuration: 50 // 50ms target for batch writes
  };

  private options: Required<AnalyticsManagerOptions>;
  private dataStore: Map<string, CostMetric[]>;
  private summaryCache: Map<string, { summary: AnalyticsSummary; timestamp: number }>;
  private indexCache: AnalyticsIndex | null;
  private autoSaveTimer?: NodeJS.Timeout;
  private pendingMetrics: CostMetric[];
  private initialized: boolean;
  private performanceStats: PerformanceMetrics;
  
  // Enhanced batching properties
  private batchTimer?: NodeJS.Timeout;
  private lastBatchFlush: number;
  private batchWriteStats: { totalWrites: number; totalTime: number; averageTime: number };
  private intelligentBatchSize: number;

  /**
   * Initialize the analytics manager
   */
  constructor(options: AnalyticsManagerOptions = {}) {
    this.options = { ...AnalyticsManager.DEFAULTS, ...options };
    this.dataStore = new Map();
    this.summaryCache = new Map();
    this.indexCache = null;
    this.pendingMetrics = [];
    this.initialized = false;
    this.performanceStats = {
      queryTime: 0,
      filesAccessed: 0,
      bytesRead: 0,
      cacheHitRate: 0,
      memoryUsage: 0
    };
    
    // Initialize enhanced batching properties
    this.lastBatchFlush = Date.now();
    this.batchWriteStats = { totalWrites: 0, totalTime: 0, averageTime: 0 };
    this.intelligentBatchSize = this.options.batchSize;
  }

  /**
   * Initialize the analytics manager - create directory structure and load index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure analytics directory exists
      await this.ensureDirectoryExists(this.options.dataDir);
      
      // Load existing index or create new one
      await this.loadOrCreateIndex();
      
      // Setup auto-save if enabled
      if (this.options.autoSave) {
        this.setupAutoSave();
      }
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize AnalyticsManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record a cost metric for analytics tracking
   */
  async recordMetric(metric: CostMetric): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate the metric
    this.validateMetric(metric);

    // Add to pending batch
    this.pendingMetrics.push(metric);

    // Intelligent batching decision
    await this.processBatchingLogic();
  }

  /**
   * Get metrics within a date range
   */
  async getMetrics(startDate: number, endDate: number, options?: AnalyticsQueryOptions): Promise<CostMetric[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Determine which files to load based on date range
      const filesToLoad = this.getFilesForDateRange(startDate, endDate);
      
      let allMetrics: CostMetric[] = [];
      this.performanceStats.filesAccessed = filesToLoad.length;

      // Load metrics from relevant files
      for (const fileName of filesToLoad) {
        const fileMetrics = await this.loadMetricsFromFile(fileName);
        allMetrics = allMetrics.concat(fileMetrics);
      }

      // Add any pending metrics that fall within the range
      const pendingInRange = this.pendingMetrics.filter(
        metric => new Date(metric.timestamp).getTime() >= startDate && new Date(metric.timestamp).getTime() <= endDate
      );
      allMetrics = allMetrics.concat(pendingInRange);

      // Filter metrics by date range and apply additional filters
      let filteredMetrics = allMetrics.filter(
        metric => new Date(metric.timestamp).getTime() >= startDate && new Date(metric.timestamp).getTime() <= endDate
      );

      // Apply additional query options
      if (options) {
        filteredMetrics = this.applyQueryFilters(filteredMetrics, options);
      }

      // Update performance stats
      this.performanceStats.queryTime = Date.now() - startTime;
      
      return filteredMetrics;
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate analytics summary for a specific period
   */
  async getSummary(period: 'day' | 'week' | 'month', date?: Date): Promise<AnalyticsSummary> {
    if (!this.initialized) {
      await this.initialize();
    }

    const targetDate = date || new Date();
    const cacheKey = `${period}-${targetDate.toISOString().split('T')[0]}`;

    // Check cache first
    if (this.options.enableCache) {
      const cached = this.summaryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minute cache
        this.performanceStats.cacheHitRate = 1;
        return cached.summary;
      }
    }

    // Calculate date range for the period
    const { startDate, endDate } = this.calculatePeriodRange(period, targetDate);
    
    // Get metrics for this period
    const metrics = await this.getMetrics(startDate, endDate);
    
    // Generate summary
    const summary = this.generateSummaryFromMetrics(metrics, period, startDate, endDate);

    // Cache the result
    if (this.options.enableCache) {
      this.summaryCache.set(cacheKey, { 
        summary, 
        timestamp: Date.now() 
      });
    }

    return summary;
  }

  /**
   * Export analytics data in the specified format
   */
  async exportData(format: ExportFormat, dateRange?: DateRange): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    // Default to last 30 days if no range specified
    const endDate = dateRange?.end ? new Date(dateRange.end).getTime() : Date.now();
    const startDate = dateRange?.start ? new Date(dateRange.start).getTime() : (endDate - (30 * 24 * 60 * 60 * 1000));

    // Get metrics for the range
    const metrics = await this.getMetrics(startDate, endDate);

    let exportData: string;
    
    if (format === 'csv') {
      exportData = this.generateCSVExport(metrics);
    } else {
      exportData = this.generateJSONExport(metrics, startDate, endDate);
    }

    // Ensure export completes within performance requirements
    const duration = Date.now() - startTime;
    if (duration > 2000) {
      console.warn(`Export took ${duration}ms - exceeds 2s performance requirement`);
    }

    return exportData;
  }

  /**
   * Clean up old data beyond retention period
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - this.options.retentionMonths);
    const cutoffMonth = cutoffDate.toISOString().substring(0, 7); // YYYY-MM format

    try {
      // Get all data files - properly handle directory read errors
      let files: string[];
      try {
        files = await fs.readdir(this.options.dataDir);
      } catch (error) {
        console.warn(`Failed to read analytics directory ${this.options.dataDir}:`, error);
        return; // Cannot perform cleanup if directory is not readable
      }

      const dataFiles = files.filter(file => file.endsWith('.json') && file !== 'analytics-index.json');

      // Find files older than cutoff
      const filesToDelete = dataFiles.filter(file => {
        const fileMonth = file.replace('.json', '');
        return fileMonth < cutoffMonth;
      });

      // Delete old files
      for (const file of filesToDelete) {
        const filePath = path.join(this.options.dataDir, file);
        await fs.unlink(filePath);
        console.log(`Cleaned up old analytics file: ${file}`);
      }

      // Update index after cleanup
      if (filesToDelete.length > 0) {
        await this.rebuildIndex();
      }
    } catch (error) {
      console.error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compact analytics data for storage optimization
   * Removes duplicate entries and optimizes data structure
   */
  async compact(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const files = await fs.readdir(this.options.dataDir);
      const dataFiles = files.filter(file => file.endsWith('.json') && file !== 'analytics-index.json');
      let totalSavings = 0;

      for (const fileName of dataFiles) {
        const filePath = path.join(this.options.dataDir, fileName);
        
        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const dataFile: AnalyticsDataFile = JSON.parse(fileContent);
          const originalSize = Buffer.byteLength(fileContent, 'utf8');
          
          // Remove duplicate metrics (same timestamp, sessionId, model)
          const uniqueMetrics = new Map<string, CostMetric>();
          for (const metric of dataFile.metrics) {
            const key = `${new Date(metric.timestamp).getTime()}-${metric.sessionId}-${metric.model}`;
            if (!uniqueMetrics.has(key)) {
              uniqueMetrics.set(key, metric);
            }
          }

          // Check if compaction would save space
          const compactedMetrics = Array.from(uniqueMetrics.values());
          if (compactedMetrics.length < dataFile.metrics.length) {
            // Update data file with compacted metrics
            dataFile.metrics = compactedMetrics;
            dataFile.metadata.count = compactedMetrics.length;
            dataFile.metadata.totalCost = compactedMetrics.reduce((sum, m) => sum + m.cost, 0);
            dataFile.metadata.updatedAt = Date.now();

            // Save compacted file
            const compactedContent = JSON.stringify(dataFile, null, 2);
            const compactedSize = Buffer.byteLength(compactedContent, 'utf8');
            const savings = originalSize - compactedSize;
            
            await fs.writeFile(filePath, compactedContent, 'utf-8');
            totalSavings += savings;
            
            console.log(`Compacted ${fileName}: removed ${dataFile.metrics.length - compactedMetrics.length} duplicates, saved ${savings} bytes`);
          }
        } catch (error) {
          console.warn(`Failed to compact file ${fileName}:`, error);
          continue;
        }
      }

      // Rebuild index after compaction
      if (totalSavings > 0) {
        await this.rebuildIndex();
        console.log(`Data compaction completed. Total space saved: ${totalSavings} bytes`);
      } else {
        console.log('No data compaction was needed');
      }
    } catch (error) {
      console.error(`Data compaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): PerformanceMetrics {
    return { ...this.performanceStats };
  }

  /**
   * Flush any pending metrics to storage
   */
  async flush(): Promise<void> {
    if (this.pendingMetrics.length > 0) {
      await this.flushPendingMetrics();
    }
  }

  /**
   * Shutdown the analytics manager - cleanup and save pending data
   */
  async shutdown(): Promise<void> {
    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Flush any pending metrics
    await this.flush();

    // Clear caches
    this.summaryCache.clear();
    this.dataStore.clear();
    
    this.initialized = false;
  }

  /**
   * Get current batch performance statistics
   */
  getBatchStats(): {
    pendingMetrics: number;
    intelligentBatchSize: number;
    averageWriteTime: number;
    totalWrites: number;
    timeSinceLastFlush: number;
  } {
    return {
      pendingMetrics: this.pendingMetrics.length,
      intelligentBatchSize: this.intelligentBatchSize,
      averageWriteTime: this.batchWriteStats.averageTime,
      totalWrites: this.batchWriteStats.totalWrites,
      timeSinceLastFlush: Date.now() - this.lastBatchFlush
    };
  }

  /**
   * Validate a cost metric before storing
   */
  private validateMetric(metric: CostMetric): void {
    if (!TypeGuards.isCostMetric(metric)) {
      throw new MetricValidationError(
        'Invalid cost metric format',
        'timestamp',
        metric
      );
    }

    // Additional business rule validations
    if (metric.cost < 0) {
      throw new MetricValidationError(
        'Cost cannot be negative',
        'cost',
        metric.cost
      );
    }

    if (new Date(metric.timestamp).getTime() > Date.now() + 60000) { // Allow 1 minute clock skew
      throw new MetricValidationError(
        'Timestamp cannot be in the future',
        'timestamp',
        metric.timestamp
      );
    }

    if (metric.sessionId.trim().length === 0) {
      throw new MetricValidationError(
        'Session ID cannot be empty',
        'sessionId',
        metric.sessionId
      );
    }
  }

  /**
   * Flush pending metrics to storage
   */
  private async flushPendingMetrics(): Promise<void> {
    if (this.pendingMetrics.length === 0) return;

    // Group metrics by month for efficient storage
    const metricsByMonth = new Map<string, CostMetric[]>();
    
    for (const metric of this.pendingMetrics) {
      const month = new Date(metric.timestamp).toISOString().substring(0, 7);
      const monthMetrics = metricsByMonth.get(month) || [];
      monthMetrics.push(metric);
      metricsByMonth.set(month, monthMetrics);
    }

    // Save each month's metrics
    for (const [month, metrics] of metricsByMonth) {
      await this.appendMetricsToFile(month, metrics);
    }

    // Clear pending metrics
    this.pendingMetrics = [];

    // Update index
    await this.updateIndex();
  }

  /**
   * Enhanced batching logic with intelligent optimization
   */
  private async processBatchingLogic(): Promise<void> {
    if (!this.options.autoSave) {
      // If auto-save is disabled, flush immediately
      await this.flushPendingMetrics();
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastFlush = currentTime - this.lastBatchFlush;
    
    // Determine optimal batch size based on performance stats
    if (this.options.intelligentBatching) {
      this.adjustIntelligentBatchSize();
    }

    // Decision matrix for when to flush:
    const shouldFlushImmediately = (
      // Batch is full based on intelligent size
      this.pendingMetrics.length >= this.intelligentBatchSize ||
      // Maximum wait time exceeded
      timeSinceLastFlush >= this.options.maxBatchWaitTime ||
      // Previous batch writes are taking too long (performance degradation)
      this.batchWriteStats.averageTime > this.options.targetBatchDuration * 2
    );

    if (shouldFlushImmediately) {
      await this.flushPendingMetricsWithStats();
    } else {
      // Set up timer for maximum wait time if not already set
      this.scheduleBatchFlush();
    }
  }

  /**
   * Adjust intelligent batch size based on performance metrics
   */
  private adjustIntelligentBatchSize(): void {
    if (this.batchWriteStats.totalWrites < 5) {
      // Not enough data yet, keep default
      return;
    }

    const avgTime = this.batchWriteStats.averageTime;
    const targetTime = this.options.targetBatchDuration;

    if (avgTime > targetTime * 1.5) {
      // Writes are taking too long, reduce batch size
      this.intelligentBatchSize = Math.max(10, Math.floor(this.intelligentBatchSize * 0.8));
    } else if (avgTime < targetTime * 0.5) {
      // Writes are very fast, increase batch size for efficiency
      this.intelligentBatchSize = Math.min(this.options.batchSize * 2, Math.floor(this.intelligentBatchSize * 1.2));
    }
  }

  /**
   * Schedule a batch flush after maximum wait time
   */
  private scheduleBatchFlush(): void {
    if (this.batchTimer) {
      return; // Timer already scheduled
    }

    const timeRemaining = this.options.maxBatchWaitTime - (Date.now() - this.lastBatchFlush);
    
    if (timeRemaining > 0) {
      this.batchTimer = setTimeout(async () => {
        this.batchTimer = undefined;
        if (this.pendingMetrics.length > 0) {
          await this.flushPendingMetricsWithStats();
        }
      }, timeRemaining);
    }
  }

  /**
   * Flush pending metrics and update performance stats
   */
  private async flushPendingMetricsWithStats(): Promise<void> {
    if (this.pendingMetrics.length === 0) return;

    const startTime = Date.now();
    
    // Clear the batch timer if it exists
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Execute the actual flush
    await this.flushPendingMetrics();
    
    // Update performance statistics
    const flushDuration = Date.now() - startTime;
    this.batchWriteStats.totalWrites++;
    this.batchWriteStats.totalTime += flushDuration;
    this.batchWriteStats.averageTime = this.batchWriteStats.totalTime / this.batchWriteStats.totalWrites;
    this.lastBatchFlush = Date.now();
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Load or create analytics index
   */
  private async loadOrCreateIndex(): Promise<void> {
    const indexPath = path.join(this.options.dataDir, 'analytics-index.json');
    
    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      this.indexCache = JSON.parse(indexData) as AnalyticsIndex;
      
      // Ensure metadata exists and is properly structured
      if (!this.indexCache.metadata) {
        this.indexCache.metadata = {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          totalMetrics: 0,
          totalCost: 0
        };
      }
      
      // Ensure files object exists
      if (!this.indexCache.files) {
        this.indexCache.files = {};
      }
    } catch {
      // Create new index if it doesn't exist
      this.indexCache = {
        version: '1.0.0',
        files: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          totalMetrics: 0,
          totalCost: 0
        }
      };
      await this.saveIndex();
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    if (!this.indexCache) return;

    const indexPath = path.join(this.options.dataDir, 'analytics-index.json');
    
    // Ensure metadata exists before trying to update it
    if (!this.indexCache.metadata) {
      this.indexCache.metadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalMetrics: 0,
        totalCost: 0
      };
    }
    
    this.indexCache.metadata.updatedAt = Date.now();
    
    await fs.writeFile(indexPath, JSON.stringify(this.indexCache, null, 2));
  }

  /**
   * Update index with new data
   */
  private async updateIndex(): Promise<void> {
    if (!this.indexCache) return;

    // Rebuild index from actual files
    await this.rebuildIndex();
  }

  /**
   * Rebuild index from existing data files
   */
  private async rebuildIndex(): Promise<void> {
    if (!this.indexCache) return;

    try {
      // Safely read directory contents with proper error handling
      let files: string[];
      try {
        files = await fs.readdir(this.options.dataDir);
      } catch (error) {
        console.warn(`Failed to read analytics directory ${this.options.dataDir}:`, error);
        return; // Cannot rebuild index if directory is not readable
      }

      // Ensure files is defined and filter safely
      const dataFiles = files.filter(file => file.endsWith('.json') && file !== 'analytics-index.json');

      // Reset index data
      this.indexCache.files = {};
      let totalMetrics = 0;
      let totalCost = 0;

      // Process each data file
      for (const fileName of dataFiles) {
        const filePath = path.join(this.options.dataDir, fileName);
        
        try {
          const stats = await fs.stat(filePath);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const dataFile: AnalyticsDataFile = JSON.parse(fileContent);
          
          // Ensure dataFile has proper structure
          if (!dataFile.metrics || !Array.isArray(dataFile.metrics)) {
            console.warn(`File ${fileName} has invalid metrics array, skipping`);
            continue;
          }
          
          if (!dataFile.metadata) {
            console.warn(`File ${fileName} missing metadata, skipping`);
            continue;
          }

          // Only process files with metrics
          if (dataFile.metrics.length > 0) {
            const month = fileName.replace('.json', '');
            this.indexCache.files[month] = {
              path: fileName,
              count: dataFile.metadata.count || dataFile.metrics.length,
              dateRange: [
                Math.min(...dataFile.metrics.map(m => new Date(m.timestamp).getTime())),
                Math.max(...dataFile.metrics.map(m => new Date(m.timestamp).getTime()))
              ],
              totalCost: dataFile.metadata.totalCost || dataFile.metrics.reduce((sum, m) => sum + m.cost, 0),
              lastModified: stats.mtime.getTime()
            };

            totalMetrics += dataFile.metadata.count || dataFile.metrics.length;
            totalCost += dataFile.metadata.totalCost || dataFile.metrics.reduce((sum, m) => sum + m.cost, 0);
          }
        } catch (error) {
          console.warn(`Failed to process file ${fileName}:`, error);
          continue;
        }
      }

      // Ensure metadata exists before updating
      if (!this.indexCache.metadata) {
        this.indexCache.metadata = {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          totalMetrics: 0,
          totalCost: 0
        };
      }

      // Update metadata
      this.indexCache.metadata.totalMetrics = totalMetrics;
      this.indexCache.metadata.totalCost = totalCost;
      
      await this.saveIndex();
    } catch (error) {
      console.error(`Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get files that contain data for a date range
   */
  private getFilesForDateRange(startDate: number, endDate: number): string[] {
    if (!this.indexCache || !this.indexCache.files) return [];

    const relevantFiles: string[] = [];

    for (const [month, fileInfo] of Object.entries(this.indexCache.files)) {
      const [fileStart, fileEnd] = fileInfo.dateRange;
      
      // Check if file overlaps with requested range
      if (fileStart <= endDate && fileEnd >= startDate) {
        relevantFiles.push(fileInfo.path);
      }
    }

    return relevantFiles;
  }

  /**
   * Load metrics from a specific file
   */
  private async loadMetricsFromFile(fileName: string): Promise<CostMetric[]> {
    const filePath = path.join(this.options.dataDir, fileName);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      this.performanceStats.bytesRead += fileContent.length;
      
      const dataFile: AnalyticsDataFile = JSON.parse(fileContent);
      return dataFile.metrics || [];
    } catch (error) {
      console.warn(`Failed to load metrics from ${fileName}:`, error);
      return [];
    }
  }

  /**
   * Append metrics to a month file
   */
  private async appendMetricsToFile(month: string, metrics: CostMetric[]): Promise<void> {
    const fileName = `${month}.json`;
    const filePath = path.join(this.options.dataDir, fileName);

    let existingData: AnalyticsDataFile;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      existingData = JSON.parse(content);
    } catch {
      // File doesn't exist, create new structure
      existingData = {
        version: '1.0.0',
        month,
        metrics: [],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          count: 0,
          totalCost: 0
        }
      };
    }

    // Ensure metrics array exists and add new metrics
    if (!existingData.metrics) {
      existingData.metrics = [];
    }
    if (!existingData.metadata) {
      existingData.metadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        count: 0,
        totalCost: 0
      };
    }
    existingData.metrics.push(...metrics);
    existingData.metadata.updatedAt = Date.now();
    existingData.metadata.count = existingData.metrics.length;
    existingData.metadata.totalCost = existingData.metrics.reduce((sum, m) => sum + m.cost, 0);

    // Save updated file
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
  }

  /**
   * Apply query filters to metrics
   */
  private applyQueryFilters(metrics: CostMetric[], options: AnalyticsQueryOptions): CostMetric[] {
    let filtered = metrics;

    // Apply filters
    if (options.sessionId) {
      filtered = filtered.filter(m => m.sessionId === options.sessionId);
    }
    if (options.model) {
      filtered = filtered.filter(m => m.model === options.model);
    }
    if (options.provider) {
      filtered = filtered.filter(m => m.provider === options.provider);
    }
    if (options.command) {
      filtered = filtered.filter(m => m.command === options.command);
    }

    // Apply sorting
    if (options.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        if (aVal === undefined || bVal === undefined) {
          return 0;
        }
        return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * order;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit) {
      return filtered.slice(offset, offset + limit);
    } else if (offset > 0) {
      return filtered.slice(offset);
    }

    return filtered;
  }

  /**
   * Calculate date range for a period
   */
  private calculatePeriodRange(period: 'day' | 'week' | 'month', date: Date): { startDate: number; endDate: number } {
    const start = new Date(date);
    const end = new Date(date);

    switch (period) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return {
      startDate: start.getTime(),
      endDate: end.getTime()
    };
  }

  /**
   * Generate summary from metrics
   */
  private generateSummaryFromMetrics(
    metrics: CostMetric[], 
    period: 'day' | 'week' | 'month', 
    startDate: number, 
    endDate: number
  ): AnalyticsSummary {
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const uniqueSessions = new Set(metrics.map(m => m.sessionId)).size;

    // Generate cost breakdown by model
    const costByModel: Record<string, number> = {};
    const costByProvider: Record<string, number> = {};
    
    for (const metric of metrics) {
      // Cost by model
      if (!costByModel[metric.model]) {
        costByModel[metric.model] = 0;
      }
      costByModel[metric.model] += metric.cost;
      
      // Cost by provider
      if (!costByProvider[metric.provider]) {
        costByProvider[metric.provider] = 0;
      }
      costByProvider[metric.provider] += metric.cost;
    }
    
    // Find most expensive session
    const sessionCosts: Record<string, number> = {};
    for (const metric of metrics) {
      if (!sessionCosts[metric.sessionId]) {
        sessionCosts[metric.sessionId] = 0;
      }
      sessionCosts[metric.sessionId] += metric.cost;
    }
    
    let mostExpensiveSession: ExpensiveSession | undefined;
    let maxCost = 0;
    for (const [sessionId, cost] of Object.entries(sessionCosts)) {
      if (cost > maxCost) {
        maxCost = cost;
        const sessionMetrics = metrics.filter(m => m.sessionId === sessionId);
        const tokens = sessionMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
        mostExpensiveSession = {
          sessionId,
          cost,
          tokens,
          timestamp: sessionMetrics[0].timestamp
        };
      }
    }

    return {
      dateRange: {
        start: new Date(startDate),
        end: new Date(endDate)
      },
      totalCost: Math.round(totalCost * 100) / 100, // Round to cents
      totalTokens,
      sessionCount: uniqueSessions,
      averageCostPerSession: uniqueSessions > 0 ? Math.round((totalCost / uniqueSessions) * 100) / 100 : 0,
      costByProvider,
      costByModel,
      mostExpensiveSession
    };
  }

  /**
   * Generate CSV export
   */
  private generateCSVExport(metrics: CostMetric[]): string {
    // Helper function to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Quote if contains comma, quote, newline, or starts/ends with whitespace
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str !== str.trim()) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'timestamp',
      'provider',
      'model',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'cost',
      'sessionId',
      'duration',
      'command'
    ];

    // Add metadata fields if present
    if (metrics.length > 0 && metrics[0].metadata) {
      const metadataKeys = Object.keys(metrics[0].metadata);
      headers.push(...metadataKeys);
    }

    const csvLines = [headers.join(',')];
    
    for (const metric of metrics) {
      const row = [
        metric.timestamp instanceof Date ? metric.timestamp.toISOString() : new Date(metric.timestamp).toISOString(),
        escapeCSV(metric.provider),
        escapeCSV(metric.model),
        metric.inputTokens.toString(),
        metric.outputTokens.toString(),
        (metric.totalTokens || metric.inputTokens + metric.outputTokens).toString(),
        metric.cost.toFixed(6),
        escapeCSV(metric.sessionId),
        (metric.duration || 0).toString(),
        escapeCSV(metric.command || '')
      ];
      
      // Add metadata values if present
      if (metric.metadata) {
        for (const key of Object.keys(metrics[0].metadata || {})) {
          row.push(escapeCSV(metric.metadata[key] || ''));
        }
      }
      
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Generate JSON export
   */
  private generateJSONExport(metrics: CostMetric[], startDate: number | Date, endDate: number | Date): string {
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + (m.totalTokens || m.inputTokens + m.outputTokens), 0);
    const totalInputTokens = metrics.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalOutputTokens = metrics.reduce((sum, m) => sum + m.outputTokens, 0);
    
    // Group by provider and model
    const providerStats: Record<string, { cost: number; tokens: number; count: number }> = {};
    const modelStats: Record<string, { cost: number; tokens: number; count: number }> = {};
    
    for (const metric of metrics) {
      // Provider stats
      if (!providerStats[metric.provider]) {
        providerStats[metric.provider] = { cost: 0, tokens: 0, count: 0 };
      }
      providerStats[metric.provider].cost += metric.cost;
      providerStats[metric.provider].tokens += metric.totalTokens || (metric.inputTokens + metric.outputTokens);
      providerStats[metric.provider].count++;
      
      // Model stats
      if (!modelStats[metric.model]) {
        modelStats[metric.model] = { cost: 0, tokens: 0, count: 0 };
      }
      modelStats[metric.model].cost += metric.cost;
      modelStats[metric.model].tokens += metric.totalTokens || (metric.inputTokens + metric.outputTokens);
      modelStats[metric.model].count++;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: {
        start: startDate instanceof Date ? startDate.toISOString() : new Date(startDate).toISOString(),
        end: endDate instanceof Date ? endDate.toISOString() : new Date(endDate).toISOString()
      },
      summary: {
        totalCost: Math.round(totalCost * 1000000) / 1000000, // Round to 6 decimal places
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        recordCount: metrics.length,
        avgCostPerRecord: metrics.length > 0 ? Math.round((totalCost / metrics.length) * 1000000) / 1000000 : 0,
        avgTokensPerRecord: metrics.length > 0 ? Math.round(totalTokens / metrics.length) : 0,
        providerBreakdown: providerStats,
        modelBreakdown: modelStats
      },
      metrics: metrics.map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : new Date(m.timestamp).toISOString()
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Setup auto-save timer
   */
  private setupAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingMetrics.length > 0) {
        try {
          await this.flushPendingMetrics();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, this.options.saveInterval);
  }
}