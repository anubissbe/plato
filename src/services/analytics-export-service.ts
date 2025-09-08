/**
 * Analytics Export Service
 * Handles export operations with validation, progress tracking, and file generation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { CostMetric, DateRange, ExportFormat } from './analytics-types.js';
import { EventEmitter } from 'events';

export interface ExportOptions {
  format: ExportFormat;
  dateRange?: DateRange;
  outputPath?: string;
  includeMetadata?: boolean;
  compress?: boolean;
}

export interface ExportProgress {
  stage: 'preparing' | 'fetching' | 'processing' | 'writing' | 'complete';
  current: number;
  total: number;
  percentage: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export class AnalyticsExportService extends EventEmitter {
  private exportInProgress = false;
  private currentExport?: AbortController;

  /**
   * Export analytics data with validation and progress tracking
   */
  async export(metrics: CostMetric[], options: ExportOptions): Promise<string> {
    if (this.exportInProgress) {
      throw new Error('Export already in progress');
    }

    this.exportInProgress = true;
    this.currentExport = new AbortController();
    
    try {
      // Validate export options
      this.validateExportOptions(options);
      
      // Emit initial progress
      this.emitProgress({
        stage: 'preparing',
        current: 0,
        total: metrics.length,
        percentage: 0,
        message: 'Preparing export...'
      });

      // Process metrics
      const processedData = await this.processMetrics(metrics, options);
      
      // Generate export file
      const filePath = await this.generateExportFile(processedData, options);
      
      // Emit completion
      this.emitProgress({
        stage: 'complete',
        current: metrics.length,
        total: metrics.length,
        percentage: 100,
        message: `Export complete: ${filePath}`
      });
      
      return filePath;
    } finally {
      this.exportInProgress = false;
      this.currentExport = undefined;
    }
  }

  /**
   * Cancel current export operation
   */
  cancelExport(): void {
    if (this.currentExport) {
      this.currentExport.abort();
      this.exportInProgress = false;
      this.currentExport = undefined;
      this.emit('export:cancelled');
    }
  }

  /**
   * Validate export options
   */
  private validateExportOptions(options: ExportOptions): void {
    // Validate export format
    const validFormats: ExportFormat[] = ['csv', 'json'];
    if (!validFormats.includes(options.format)) {
      throw new Error(`Invalid export format: ${options.format}. Valid formats: ${validFormats.join(', ')}`);
    }

    // Validate date range if provided
    if (options.dateRange) {
      if (!(options.dateRange.start instanceof Date) || !(options.dateRange.end instanceof Date)) {
        throw new Error('Date range must contain valid Date objects');
      }
      
      if (options.dateRange.end < options.dateRange.start) {
        throw new Error('Invalid date range: end date is before start date');
      }
      
      // Check if date range is not too large (e.g., more than 1 year)
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      const rangeMs = options.dateRange.end.getTime() - options.dateRange.start.getTime();
      if (rangeMs > oneYearMs) {
        throw new Error('Date range exceeds maximum allowed period (1 year)');
      }
    }

    // Validate output path if provided
    if (options.outputPath) {
      const dir = path.dirname(options.outputPath);
      const ext = path.extname(options.outputPath).toLowerCase();
      
      // Check extension matches format
      if (options.format === 'csv' && ext !== '.csv') {
        throw new Error('CSV exports must have .csv extension');
      }
      if (options.format === 'json' && ext !== '.json') {
        throw new Error('JSON exports must have .json extension');
      }
    }
  }

  /**
   * Process metrics for export
   */
  private async processMetrics(
    metrics: CostMetric[], 
    options: ExportOptions
  ): Promise<string> {
    const startTime = Date.now();
    const batchSize = 1000;
    let processed = 0;
    
    // Filter metrics by date range if provided
    let filteredMetrics = metrics;
    if (options.dateRange) {
      filteredMetrics = metrics.filter(m => {
        const metricDate = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
        return metricDate >= options.dateRange!.start && metricDate <= options.dateRange!.end;
      });
    }

    // Process in batches for large datasets
    const results: string[] = [];
    
    for (let i = 0; i < filteredMetrics.length; i += batchSize) {
      if (this.currentExport?.signal.aborted) {
        throw new Error('Export cancelled');
      }
      
      const batch = filteredMetrics.slice(i, Math.min(i + batchSize, filteredMetrics.length));
      const batchResult = options.format === 'csv' 
        ? this.generateCSVBatch(batch, i === 0)
        : this.generateJSONBatch(batch);
      
      results.push(batchResult);
      processed += batch.length;
      
      // Emit progress
      const percentage = Math.round((processed / filteredMetrics.length) * 100);
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = Math.round((filteredMetrics.length - processed) / rate);
      
      this.emitProgress({
        stage: 'processing',
        current: processed,
        total: filteredMetrics.length,
        percentage,
        message: `Processing metrics... (${processed}/${filteredMetrics.length})`,
        estimatedTimeRemaining: remaining * 1000
      });
      
      // Small delay to prevent blocking
      if (i + batchSize < filteredMetrics.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Combine results
    if (options.format === 'csv') {
      return results.join('\n');
    } else {
      // For JSON, we need to combine the batches properly
      const allMetrics = results.map(r => JSON.parse(r)).flat();
      return this.generateCompleteJSON(allMetrics, options.dateRange);
    }
  }

  /**
   * Generate CSV batch
   */
  private generateCSVBatch(metrics: CostMetric[], includeHeaders: boolean): string {
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    
    if (includeHeaders) {
      const headers = [
        'timestamp', 'provider', 'model', 'inputTokens', 'outputTokens',
        'totalTokens', 'cost', 'sessionId', 'duration', 'command'
      ];
      lines.push(headers.join(','));
    }
    
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
      lines.push(row.join(','));
    }
    
    return lines.join('\n');
  }

  /**
   * Generate JSON batch
   */
  private generateJSONBatch(metrics: CostMetric[]): string {
    return JSON.stringify(metrics);
  }

  /**
   * Generate complete JSON export
   */
  private generateCompleteJSON(metrics: CostMetric[], dateRange?: DateRange): string {
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + (m.totalTokens || m.inputTokens + m.outputTokens), 0);
    
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      dateRange: dateRange ? {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      } : null,
      summary: {
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        totalTokens,
        recordCount: metrics.length,
        avgCostPerRecord: metrics.length > 0 ? Math.round((totalCost / metrics.length) * 1000000) / 1000000 : 0
      },
      metrics
    }, null, 2);
  }

  /**
   * Generate export file
   */
  private async generateExportFile(data: string, options: ExportOptions): Promise<string> {
    this.emitProgress({
      stage: 'writing',
      current: 1,
      total: 1,
      percentage: 90,
      message: 'Writing file...'
    });

    // Determine file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFileName = `analytics-export-${timestamp}.${options.format}`;
    const filePath = options.outputPath || path.join('.plato', 'exports', defaultFileName);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, data, 'utf-8');
    
    // Optionally compress
    if (options.compress) {
      // Would implement compression here
      // For now, just return the uncompressed file
    }
    
    return filePath;
  }

  /**
   * Emit progress event
   */
  private emitProgress(progress: ExportProgress): void {
    this.emit('export:progress', progress);
  }
}

export default AnalyticsExportService;