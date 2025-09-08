/**
 * Tests for Analytics Export Functionality
 * Validates CSV and JSON export capabilities with date range selection
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AnalyticsManager } from '../analytics-manager.js';
import type { CostMetric, DateRange, ExportFormat } from '../analytics-types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');

describe('Analytics Export Functionality', () => {
  let analyticsManager: AnalyticsManager;
  const mockDataDir = '.plato/analytics';
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock file system operations
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.readFile as jest.Mock).mockResolvedValue('{}');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    
    analyticsManager = new AnalyticsManager(mockDataDir);
    await analyticsManager.initialize();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CSV Export', () => {
    const mockMetrics: CostMetric[] = [
      {
        timestamp: new Date('2025-01-15T10:00:00'),
        provider: 'github-copilot',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.045,
        sessionId: 'session-1',
        duration: 2500,
        metadata: { command: '/analyze' }
      },
      {
        timestamp: new Date('2025-01-15T11:00:00'),
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        cost: 0.006,
        sessionId: 'session-2',
        duration: 1500,
        metadata: { command: '/build' }
      }
    ];

    it('should export data to CSV format with headers', async () => {
      // Set up mock data
      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 2 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const csvData = await analyticsManager.exportData('csv');
      
      // Verify CSV structure
      const lines = csvData.split('\n');
      expect(lines[0]).toContain('timestamp,provider,model,inputTokens,outputTokens,totalTokens,cost,sessionId,duration');
      expect(lines[1]).toContain('2025-01-15T10:00:00');
      expect(lines[1]).toContain('github-copilot');
      expect(lines[1]).toContain('gpt-4');
      expect(lines[1]).toContain('0.045');
    });

    it('should handle empty data gracefully', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      
      const csvData = await analyticsManager.exportData('csv');
      
      const lines = csvData.split('\n');
      expect(lines[0]).toContain('timestamp,provider,model');
      expect(lines.length).toBe(2); // Header + empty line
    });

    it('should escape CSV special characters', async () => {
      const metricsWithSpecialChars: CostMetric[] = [{
        ...mockMetrics[0],
        model: 'gpt-4,turbo',
        metadata: { command: '/analyze "test"' }
      }];

      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: metricsWithSpecialChars,
        metadata: { count: 1 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const csvData = await analyticsManager.exportData('csv');
      
      expect(csvData).toContain('"gpt-4,turbo"'); // Quoted due to comma
    });

    it('should apply date range filtering', async () => {
      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 2 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const dateRange: DateRange = {
        start: new Date('2025-01-15T10:30:00'),
        end: new Date('2025-01-15T11:30:00')
      };

      const csvData = await analyticsManager.exportData('csv', dateRange);
      
      const lines = csvData.split('\n').filter(line => line.trim());
      expect(lines.length).toBe(2); // Header + 1 matching record
      expect(lines[1]).toContain('gpt-3.5-turbo'); // Only second metric matches range
    });

    it('should include metadata fields in CSV export', async () => {
      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 2 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const csvData = await analyticsManager.exportData('csv');
      
      expect(csvData).toContain('command'); // Metadata field should be included
      expect(csvData).toContain('/analyze');
      expect(csvData).toContain('/build');
    });
  });

  describe('JSON Export', () => {
    const mockMetrics: CostMetric[] = [
      {
        timestamp: new Date('2025-01-15T10:00:00'),
        provider: 'github-copilot',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.045,
        sessionId: 'session-1',
        duration: 2500
      }
    ];

    it('should export data to JSON format', async () => {
      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 1 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const jsonData = await analyticsManager.exportData('json');
      const parsed = JSON.parse(jsonData);
      
      expect(parsed).toHaveProperty('exportDate');
      expect(parsed).toHaveProperty('dateRange');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.metrics).toHaveLength(1);
      expect(parsed.metrics[0].model).toBe('gpt-4');
    });

    it('should include summary statistics in JSON export', async () => {
      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 1 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const jsonData = await analyticsManager.exportData('json');
      const parsed = JSON.parse(jsonData);
      
      expect(parsed.summary).toHaveProperty('totalCost');
      expect(parsed.summary).toHaveProperty('totalTokens');
      expect(parsed.summary).toHaveProperty('recordCount');
      expect(parsed.summary).toHaveProperty('avgCostPerRecord');
      expect(parsed.summary.totalCost).toBe(0.045);
      expect(parsed.summary.totalTokens).toBe(1500);
    });

    it('should apply date range filtering to JSON export', async () => {
      const multipleMetrics: CostMetric[] = [
        ...mockMetrics,
        {
          timestamp: new Date('2025-01-16T10:00:00'),
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          inputTokens: 500,
          outputTokens: 300,
          totalTokens: 800,
          cost: 0.002,
          sessionId: 'session-2',
          duration: 1000
        }
      ];

      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: multipleMetrics,
        metadata: { count: 2 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const dateRange: DateRange = {
        start: new Date('2025-01-16T00:00:00'),
        end: new Date('2025-01-16T23:59:59')
      };

      const jsonData = await analyticsManager.exportData('json', dateRange);
      const parsed = JSON.parse(jsonData);
      
      expect(parsed.metrics).toHaveLength(1);
      expect(parsed.metrics[0].model).toBe('gpt-3.5-turbo');
      expect(parsed.summary.totalCost).toBe(0.002);
    });

    it('should format JSON with proper indentation', async () => {
      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 1 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const jsonData = await analyticsManager.exportData('json');
      
      // Check for indentation (2 spaces)
      expect(jsonData).toContain('  "exportDate"');
      expect(jsonData).toContain('  "metrics"');
      
      // Verify it's valid JSON
      expect(() => JSON.parse(jsonData)).not.toThrow();
    });
  });

  describe('Export Format Validation', () => {
    it('should throw error for invalid export format', async () => {
      await expect(
        analyticsManager.exportData('xml' as ExportFormat)
      ).rejects.toThrow('Unsupported export format');
    });

    it('should validate date range parameters', async () => {
      const invalidDateRange: DateRange = {
        start: new Date('2025-01-20'),
        end: new Date('2025-01-10') // End before start
      };

      await expect(
        analyticsManager.exportData('csv', invalidDateRange)
      ).rejects.toThrow('Invalid date range');
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle large datasets efficiently', async () => {
      // Create 10,000 metrics
      const largeMetrics: CostMetric[] = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: new Date(`2025-01-${(i % 30) + 1}T10:00:00`),
        provider: i % 2 === 0 ? 'github-copilot' : 'openai',
        model: i % 2 === 0 ? 'gpt-4' : 'gpt-3.5-turbo',
        inputTokens: 1000 + i,
        outputTokens: 500 + i,
        totalTokens: 1500 + i * 2,
        cost: 0.001 * i,
        sessionId: `session-${i}`,
        duration: 1000 + i
      }));

      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: largeMetrics,
        metadata: { count: largeMetrics.length }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const startTime = Date.now();
      const csvData = await analyticsManager.exportData('csv');
      const endTime = Date.now();
      
      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      
      const lines = csvData.split('\n');
      expect(lines.length).toBe(10001); // Header + 10000 records
    });

    it('should support streaming for very large datasets', async () => {
      // This would be implemented with actual streaming support
      // For now, we test that the method exists and returns expected structure
      const mockMetrics = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(`2025-01-01T${i}:00:00`),
        provider: 'github-copilot',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.01,
        sessionId: `session-${i}`,
        duration: 1000
      }));

      const mockDataFile = {
        version: '1.0.0',
        month: '2025-01',
        metrics: mockMetrics,
        metadata: { count: 100 }
      };
      
      (fs.readdir as jest.Mock).mockResolvedValue(['2025-01.json']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockDataFile));

      const data = await analyticsManager.exportData('json');
      const parsed = JSON.parse(data);
      
      expect(parsed.metrics).toHaveLength(100);
      expect(parsed.summary.recordCount).toBe(100);
    });
  });
});