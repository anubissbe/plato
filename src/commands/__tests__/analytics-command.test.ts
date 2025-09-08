/**
 * Tests for Analytics Command Handlers
 * Validates /analytics command functionality and subcommands
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AnalyticsCommand } from '../analytics-command.js';
import { AnalyticsManager } from '../../services/analytics-manager.js';
import type { CostMetric, AnalyticsSummary } from '../../services/analytics-types.js';

// Mock the analytics manager
jest.mock('../../services/analytics-manager.js');

describe('Analytics Command System', () => {
  let analyticsCommand: AnalyticsCommand;
  let mockAnalyticsManager: jest.Mocked<AnalyticsManager>;
  let mockSetLines: jest.Mock;
  let mockOrchestrator: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock analytics manager
    mockAnalyticsManager = {
      getMetrics: jest.fn(),
      getSummary: jest.fn(),
      exportData: jest.fn(),
      resetData: jest.fn(),
      cleanup: jest.fn(),
      recordMetric: jest.fn(),
      initialize: jest.fn(),
    } as any;

    // Mock setLines function for output
    mockSetLines = jest.fn();
    
    // Mock orchestrator
    mockOrchestrator = {
      analyticsManager: mockAnalyticsManager
    };

    // Create analytics command instance
    analyticsCommand = new AnalyticsCommand(mockOrchestrator, mockSetLines);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Command Structure', () => {
    it('should have correct command name', () => {
      expect(analyticsCommand.name).toBe('/analytics');
    });

    it('should have a summary description', () => {
      expect(analyticsCommand.summary).toBeTruthy();
      expect(analyticsCommand.summary).toContain('analytics');
    });

    it('should support subcommands', () => {
      expect(analyticsCommand.subcommands).toBeDefined();
      expect(analyticsCommand.subcommands).toContain('summary');
      expect(analyticsCommand.subcommands).toContain('history');
      expect(analyticsCommand.subcommands).toContain('export');
      expect(analyticsCommand.subcommands).toContain('reset');
    });
  });

  describe('Summary Subcommand', () => {
    it('should display analytics summary with default date range', async () => {
      const mockSummary: AnalyticsSummary = {
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        },
        totalCost: 1.234,
        totalTokens: 50000,
        sessionCount: 10,
        averageCostPerSession: 0.1234,
        costByProvider: {
          'github-copilot': 0.8,
          'openai': 0.434
        },
        costByModel: {
          'gpt-4': 0.434,
          'claude-3-sonnet': 0.8
        },
        mostExpensiveSession: {
          sessionId: 'test-123',
          cost: 0.5,
          tokens: 10000,
          timestamp: new Date('2025-01-15')
        }
      };

      mockAnalyticsManager.getSummary.mockResolvedValue(mockSummary);

      await analyticsCommand.execute('summary');

      expect(mockAnalyticsManager.getSummary).toHaveBeenCalledWith('day');
      expect(mockSetLines).toHaveBeenCalled();
      
      // Check output contains key information
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('Analytics Summary');
      expect(outputText).toContain('$1.23');
      expect(outputText).toContain('50,000');
    });

    it('should support different time ranges', async () => {
      const mockSummary: AnalyticsSummary = {
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        },
        totalCost: 5.678,
        totalTokens: 150000,
        sessionCount: 30,
        averageCostPerSession: 0.189,
        costByProvider: {},
        costByModel: {}
      };

      mockAnalyticsManager.getSummary.mockResolvedValue(mockSummary);

      await analyticsCommand.execute('summary week');
      expect(mockAnalyticsManager.getSummary).toHaveBeenCalledWith('week');

      await analyticsCommand.execute('summary month');
      expect(mockAnalyticsManager.getSummary).toHaveBeenCalledWith('month');

      await analyticsCommand.execute('summary all');
      expect(mockAnalyticsManager.getSummary).toHaveBeenCalledWith('all');
    });
  });

  describe('History Subcommand', () => {
    it('should display metrics history', async () => {
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
          metadata: {}
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
          metadata: {}
        }
      ];

      mockAnalyticsManager.getMetrics.mockResolvedValue(mockMetrics);

      await analyticsCommand.execute('history');

      expect(mockAnalyticsManager.getMetrics).toHaveBeenCalled();
      expect(mockSetLines).toHaveBeenCalled();
      
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('Analytics History');
      expect(outputText).toContain('gpt-4');
      expect(outputText).toContain('$0.045');
    });

    it('should support filtering by date range', async () => {
      mockAnalyticsManager.getMetrics.mockResolvedValue([]);

      await analyticsCommand.execute('history --from 2025-01-01 --to 2025-01-31');

      expect(mockAnalyticsManager.getMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: {
            start: expect.any(Date),
            end: expect.any(Date)
          }
        })
      );
    });

    it('should support filtering by model', async () => {
      mockAnalyticsManager.getMetrics.mockResolvedValue([]);

      await analyticsCommand.execute('history --model gpt-4');

      expect(mockAnalyticsManager.getMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4'
        })
      );
    });

    it('should support pagination', async () => {
      const manyMetrics = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(`2025-01-${(i % 30) + 1}T10:00:00`),
        provider: 'github-copilot',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.045,
        sessionId: `session-${i}`,
        duration: 2500,
        metadata: {}
      }));

      mockAnalyticsManager.getMetrics.mockResolvedValue(manyMetrics);

      await analyticsCommand.execute('history --limit 10');

      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('Showing 10 of 100');
    });
  });

  describe('Export Subcommand', () => {
    it('should export data in JSON format', async () => {
      const mockData = [
        {
          timestamp: new Date('2025-01-15'),
          provider: 'github-copilot',
          model: 'gpt-4',
          cost: 0.5,
          totalTokens: 10000
        }
      ];

      mockAnalyticsManager.exportData.mockResolvedValue(JSON.stringify(mockData, null, 2));

      await analyticsCommand.execute('export json analytics.json');

      expect(mockAnalyticsManager.exportData).toHaveBeenCalledWith('json', expect.any(Object));
      expect(mockSetLines).toHaveBeenCalled();
      
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('exported');
      expect(outputText).toContain('analytics.json');
    });

    it('should export data in CSV format', async () => {
      const mockCsv = 'timestamp,provider,model,cost,tokens\n2025-01-15,github-copilot,gpt-4,0.5,10000';
      
      mockAnalyticsManager.exportData.mockResolvedValue(mockCsv);

      await analyticsCommand.execute('export csv analytics.csv');

      expect(mockAnalyticsManager.exportData).toHaveBeenCalledWith('csv', expect.any(Object));
      expect(mockSetLines).toHaveBeenCalled();
      
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('exported');
      expect(outputText).toContain('analytics.csv');
    });

    it('should support date range filtering for export', async () => {
      mockAnalyticsManager.exportData.mockResolvedValue('[]');

      await analyticsCommand.execute('export json data.json --from 2025-01-01 --to 2025-01-31');

      expect(mockAnalyticsManager.exportData).toHaveBeenCalledWith(
        'json',
        expect.objectContaining({
          dateRange: {
            start: expect.any(Date),
            end: expect.any(Date)
          }
        })
      );
    });
  });

  describe('Reset Subcommand', () => {
    it('should require confirmation before resetting', async () => {
      await analyticsCommand.execute('reset');

      // Should show confirmation prompt
      expect(mockSetLines).toHaveBeenCalled();
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('confirm');
      
      // Should NOT reset without confirmation
      expect(mockAnalyticsManager.resetData).not.toHaveBeenCalled();
    });

    it('should reset data with --force flag', async () => {
      mockAnalyticsManager.resetData.mockResolvedValue(undefined);

      await analyticsCommand.execute('reset --force');

      expect(mockAnalyticsManager.resetData).toHaveBeenCalled();
      expect(mockSetLines).toHaveBeenCalled();
      
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('reset');
      expect(outputText).toContain('successful');
    });

    it('should allow resetting specific date range', async () => {
      mockAnalyticsManager.resetData.mockResolvedValue(undefined);

      await analyticsCommand.execute('reset --from 2025-01-01 --to 2025-01-31 --force');

      expect(mockAnalyticsManager.resetData).toHaveBeenCalledWith({
        start: expect.any(Date),
        end: expect.any(Date)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle analytics manager errors gracefully', async () => {
      mockAnalyticsManager.getSummary.mockRejectedValue(new Error('Database error'));

      await analyticsCommand.execute('summary');

      expect(mockSetLines).toHaveBeenCalled();
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('Error');
      expect(outputText).toContain('Database error');
    });

    it('should show help for invalid subcommands', async () => {
      await analyticsCommand.execute('invalid');

      expect(mockSetLines).toHaveBeenCalled();
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('Available subcommands');
      expect(outputText).toContain('summary');
      expect(outputText).toContain('history');
      expect(outputText).toContain('export');
      expect(outputText).toContain('reset');
    });

    it('should show help when no subcommand provided', async () => {
      await analyticsCommand.execute('');

      expect(mockSetLines).toHaveBeenCalled();
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      expect(outputText).toContain('Analytics');
      expect(outputText).toContain('Usage');
    });
  });

  describe('Table Display', () => {
    it('should format data in table view for history', async () => {
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

      mockAnalyticsManager.getMetrics.mockResolvedValue(mockMetrics);

      await analyticsCommand.execute('history --format table');

      expect(mockSetLines).toHaveBeenCalled();
      const output = mockSetLines.mock.calls[0][0]();
      const outputText = output.join('\n');
      
      // Check for table formatting
      expect(outputText).toContain('│'); // Table borders
      expect(outputText).toContain('Time');
      expect(outputText).toContain('Model');
      expect(outputText).toContain('Tokens');
      expect(outputText).toContain('Cost');
    });
  });
});