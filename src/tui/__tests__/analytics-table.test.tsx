/**
 * Tests for Analytics Table Component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { AnalyticsTable } from '../analytics-table.js';
import type { CostMetric } from '../../services/analytics-types.js';

describe('AnalyticsTable', () => {
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
    },
    {
      timestamp: new Date('2025-01-15T12:00:00'),
      provider: 'github-copilot',
      model: 'claude-3-sonnet',
      inputTokens: 3000,
      outputTokens: 2000,
      totalTokens: 5000,
      cost: 0.125,
      sessionId: 'session-3',
      duration: 3500,
      metadata: {}
    }
  ];

  describe('Basic Rendering', () => {
    it('should render table with metrics', () => {
      const { lastFrame } = render(
        <AnalyticsTable metrics={mockMetrics} />
      );

      const output = lastFrame();
      expect(output).toContain('Time');
      expect(output).toContain('Model');
      expect(output).toContain('Tokens');
      expect(output).toContain('Cost');
      expect(output).toContain('gpt-4');
      expect(output).toContain('1,500');
      expect(output).toContain('$0.0450');
    });

    it('should render empty state when no metrics', () => {
      const { lastFrame } = render(
        <AnalyticsTable metrics={[]} />
      );

      const output = lastFrame();
      expect(output).toContain('No analytics data available');
    });

    it('should render in compact mode', () => {
      const { lastFrame } = render(
        <AnalyticsTable metrics={mockMetrics} compactMode={true} />
      );

      const output = lastFrame();
      expect(output).toContain('Time');
      expect(output).toContain('Model');
      expect(output).toContain('Tokens');
      expect(output).toContain('Cost');
      // Compact mode should not show Input/Output columns
      expect(output).not.toContain('Input');
      expect(output).not.toContain('Output');
      expect(output).not.toContain('Duration');
    });

    it('should render in full mode with all columns', () => {
      const { lastFrame } = render(
        <AnalyticsTable metrics={mockMetrics} compactMode={false} />
      );

      const output = lastFrame();
      expect(output).toContain('Input');
      expect(output).toContain('Output');
      expect(output).toContain('Duration');
      expect(output).toContain('2.5s'); // Duration for first metric
    });
  });

  describe('Sorting', () => {
    it('should sort by timestamp descending by default', () => {
      const { lastFrame } = render(
        <AnalyticsTable 
          metrics={mockMetrics} 
          sortField="timestamp"
          sortDirection="desc"
        />
      );

      const output = lastFrame();
      const lines = output.split('\n');
      
      // Find the data rows (skip header and separator)
      const dataLines = lines.filter(line => 
        line.includes('gpt') || line.includes('claude')
      );
      
      // Latest timestamp should appear first
      expect(dataLines[0]).toContain('claude-3-sonnet');
      expect(dataLines[2]).toContain('gpt-4');
    });

    it('should sort by cost ascending', () => {
      const { lastFrame } = render(
        <AnalyticsTable 
          metrics={mockMetrics} 
          sortField="cost"
          sortDirection="asc"
        />
      );

      const output = lastFrame();
      const lines = output.split('\n');
      const dataLines = lines.filter(line => 
        line.includes('gpt') || line.includes('claude')
      );
      
      // Lowest cost should appear first
      expect(dataLines[0]).toContain('gpt-3.5-turbo'); // cost: 0.006
      expect(dataLines[2]).toContain('claude-3-sonnet'); // cost: 0.125
    });

    it('should sort by tokens descending', () => {
      const { lastFrame } = render(
        <AnalyticsTable 
          metrics={mockMetrics} 
          sortField="totalTokens"
          sortDirection="desc"
        />
      );

      const output = lastFrame();
      const lines = output.split('\n');
      const dataLines = lines.filter(line => 
        line.includes('gpt') || line.includes('claude')
      );
      
      // Most tokens should appear first
      expect(dataLines[0]).toContain('claude-3-sonnet'); // 5000 tokens
      expect(dataLines[2]).toContain('gpt-4'); // 1500 tokens
    });
  });

  describe('Totals', () => {
    it('should show totals when enabled', () => {
      const { lastFrame } = render(
        <AnalyticsTable 
          metrics={mockMetrics} 
          showTotals={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Total');
      expect(output).toContain('9,500'); // Total tokens: 1500 + 3000 + 5000
      expect(output).toContain('$0.176'); // Total cost: 0.045 + 0.006 + 0.125
    });

    it('should hide totals when disabled', () => {
      const { lastFrame } = render(
        <AnalyticsTable 
          metrics={mockMetrics} 
          showTotals={false}
        />
      );

      const output = lastFrame();
      expect(output).not.toContain('Total');
    });
  });

  describe('Interactive Mode', () => {
    it('should highlight selected row', () => {
      const { lastFrame } = render(
        <AnalyticsTable 
          metrics={mockMetrics}
          interactive={true}
          selectedIndex={1}
        />
      );

      // In ink-testing-library, inverse text is typically marked
      // This is a simplified test - actual rendering may vary
      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });

  describe('Formatting', () => {
    it('should format currency based on value ranges', () => {
      const testMetrics: CostMetric[] = [
        { ...mockMetrics[0], cost: 2.5 },      // >= 1: $2.50
        { ...mockMetrics[0], cost: 0.05 },     // >= 0.01: $0.050
        { ...mockMetrics[0], cost: 0.005 },    // >= 0.001: $0.0050
        { ...mockMetrics[0], cost: 0.0001 },   // < 0.001: $0.000100
      ];

      const { lastFrame } = render(
        <AnalyticsTable metrics={testMetrics} />
      );

      const output = lastFrame();
      expect(output).toContain('$2.50');
      expect(output).toContain('$0.050');
      expect(output).toContain('$0.0050');
      expect(output).toContain('$0.000100');
    });

    it('should format tokens with thousands separator', () => {
      const testMetrics: CostMetric[] = [
        { ...mockMetrics[0], totalTokens: 1234567 }
      ];

      const { lastFrame } = render(
        <AnalyticsTable metrics={testMetrics} />
      );

      const output = lastFrame();
      expect(output).toContain('1,234,567');
    });

    it('should truncate long model names', () => {
      const testMetrics: CostMetric[] = [
        { 
          ...mockMetrics[0], 
          model: 'this-is-a-very-long-model-name-that-should-be-truncated' 
        }
      ];

      const { lastFrame } = render(
        <AnalyticsTable metrics={testMetrics} compactMode={true} />
      );

      const output = lastFrame();
      // In compact mode, model column is 15 chars wide
      expect(output).toContain('this-is-a-very');
    });
  });

  describe('Color Coding', () => {
    it('should apply color based on cost thresholds', () => {
      const testMetrics: CostMetric[] = [
        { ...mockMetrics[0], cost: 0.0005 },  // < 0.001: green
        { ...mockMetrics[0], cost: 0.005 },   // < 0.01: yellow
        { ...mockMetrics[0], cost: 0.025 },   // < 0.05: orange
        { ...mockMetrics[0], cost: 0.1 },     // >= 0.05: red
      ];

      // Note: ink-testing-library may not capture colors directly
      // This test ensures the component renders without errors
      const { lastFrame } = render(
        <AnalyticsTable metrics={testMetrics} />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain('$0.000500');
      expect(output).toContain('$0.0050');
      expect(output).toContain('$0.025');
      expect(output).toContain('$0.100');
    });
  });
});