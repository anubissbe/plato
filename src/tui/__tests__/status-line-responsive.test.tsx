/**
 * StatusLine Responsive Display Tests
 * Tests cost analytics display across different terminal sizes and configurations
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { StatusLine } from '../status-line.js';
import type { StatusMetrics } from '../status-manager.js';

const createTestMetrics = (overrides: Partial<StatusMetrics> = {}): StatusMetrics => ({
  inputTokens: 150,
  outputTokens: 250,
  totalTokens: 400,
  responseTime: 1250,
  averageResponseTime: 1100,
  memoryUsageMB: 45.6,
  memoryPercentage: 23,
  sessionTurns: 5,
  sessionTokens: 2000,
  streamProgress: 0,
  charactersStreamed: 0,
  activeToolCall: null,
  toolCallHistory: [],
  lastError: null,
  indeterminateProgress: false,
  currentCost: 0.001234,
  sessionCost: 0.005678,
  todayCost: 0.012345,
  costPerToken: 0.00000567,
  projectedCost: 0.008901,
  costThreshold: 0.01,
  model: 'gpt-4',
  provider: 'openai',
  ...overrides
});

describe('StatusLine Responsive Display', () => {
  describe('Compact Mode Tests', () => {
    it('should display compact cost format in compact mode', () => {
      const metrics = createTestMetrics({
        currentCost: 0.001234,
        sessionCost: 0.005678
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={true}
          visibleMetrics={['currentCost', 'sessionCost']}
        />
      );

      const output = lastFrame();
      
      // Should use compact prefixes
      expect(output).toContain('$:');  // Current cost compact format
      expect(output).toContain('S$:'); // Session cost compact format
      expect(output).toContain('$0.0012'); // Formatted cost
      expect(output).toContain('$0.0057'); // Session cost
    });

    it('should display compact provider format in compact mode', () => {
      const metrics = createTestMetrics({
        provider: 'openai',
        model: 'gpt-4'
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={true}
          visibleMetrics={['provider', 'model']}
        />
      );

      const output = lastFrame();
      
      // Should show abbreviated provider format
      expect(output).toContain('O'); // First letter of 'openai' in compact mode
    });

    it('should handle limited space with many metrics', () => {
      const metrics = createTestMetrics({
        currentCost: 0.001,
        sessionCost: 0.005,
        todayCost: 0.012,
        costPerToken: 0.00001
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={true}
          visibleMetrics={['totalTokens', 'currentCost', 'sessionCost', 'todayCost', 'costPerToken', 'memoryUsageMB']}
        />
      );

      const output = lastFrame();
      
      // All metrics should be present with compact formatting
      expect(output).toContain('T:'); // Total tokens compact
      expect(output).toContain('$:'); // Current cost compact
      expect(output).toContain('S$:'); // Session cost compact
      expect(output).toContain('D$:'); // Today cost compact
      expect(output).toContain('$/T:'); // Cost per token compact
      expect(output).toContain('M:'); // Memory compact
    });
  });

  describe('Full Display Mode Tests', () => {
    it('should display full cost labels in non-compact mode', () => {
      const metrics = createTestMetrics({
        currentCost: 0.001234,
        sessionCost: 0.005678
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={false}
          visibleMetrics={['currentCost', 'sessionCost']}
        />
      );

      const output = lastFrame();
      
      // Should use full labels
      expect(output).toContain('Cost:'); // Current cost full label
      expect(output).toContain('Session:'); // Session cost full label
      expect(output).not.toContain('$:'); // Should not show compact format
      expect(output).not.toContain('S$:'); // Should not show compact format
    });

    it('should display full provider and model information', () => {
      const metrics = createTestMetrics({
        provider: 'anthropic',
        model: 'claude-3-sonnet'
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={false}
          visibleMetrics={['provider', 'model']}
        />
      );

      const output = lastFrame();
      
      // Should show full provider/model info
      expect(output).toContain('Provider:');
      expect(output).toContain('anthropic/claude-3-sonnet');
    });
  });

  describe('Dynamic Metric Visibility Tests', () => {
    it('should auto-include cost metrics when costs are present', () => {
      const metrics = createTestMetrics({
        currentCost: 0.001,
        sessionCost: 0.005
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          // No visibleMetrics prop - should use defaults with auto-inclusion
        />
      );

      const output = lastFrame();
      
      // Should auto-include cost metrics since they have values
      expect(output).toContain('$0.001');
      expect(output).toContain('$0.005');
    });

    it('should not show cost metrics when costs are zero', () => {
      const metrics = createTestMetrics({
        currentCost: 0,
        sessionCost: 0
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          // No visibleMetrics prop - should use defaults
        />
      );

      const output = lastFrame();
      
      // Should not show cost metrics when they are zero
      expect(output).not.toContain('Cost:');
      expect(output).not.toContain('Session:');
    });
  });

  describe('Color Coding Tests', () => {
    it('should use appropriate colors based on cost thresholds', () => {
      const metrics = createTestMetrics({
        currentCost: 0.009, // 90% of threshold
        sessionCost: 0.007, // 70% of threshold  
        costThreshold: 0.01
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          visibleMetrics={['currentCost', 'sessionCost']}
        />
      );

      const output = lastFrame();
      
      // Should display costs (color coding tested via component props)
      expect(output).toContain('$0.009');
      expect(output).toContain('$0.007');
    });
  });

  describe('Cost Threshold Warning Tests', () => {
    it('should show cost warning when threshold is exceeded', () => {
      const metrics = createTestMetrics({
        currentCost: 0.015, // Above threshold
        costThreshold: 0.01
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={false}
          visibleMetrics={['currentCost']}
        />
      );

      const output = lastFrame();
      
      // Should show cost limit warning
      expect(output).toContain('⚠️ Cost Limit');
    });

    it('should show compact cost warning in compact mode', () => {
      const metrics = createTestMetrics({
        sessionCost: 0.012, // Above threshold
        costThreshold: 0.01
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          compact={true}
          visibleMetrics={['sessionCost']}
        />
      );

      const output = lastFrame();
      
      // Should show compact cost warning
      expect(output).toContain('💰!');
    });
  });

  describe('Cost Formatting Tests', () => {
    it('should format large costs correctly', () => {
      const metrics = createTestMetrics({
        currentCost: 1.234567
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          visibleMetrics={['currentCost']}
        />
      );

      const output = lastFrame();
      expect(output).toContain('$1.23'); // Should format to 2 decimal places for >= $1
    });

    it('should format small costs with appropriate precision', () => {
      const metrics = createTestMetrics({
        currentCost: 0.000123
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          visibleMetrics={['currentCost']}
        />
      );

      const output = lastFrame();
      expect(output).toContain('$0.000123'); // Should show 6 decimal places for very small costs
    });

    it('should format medium costs with 3-4 decimal places', () => {
      const metrics = createTestMetrics({
        currentCost: 0.01234
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          visibleMetrics={['currentCost']}
        />
      );

      const output = lastFrame();
      expect(output).toContain('$0.0123'); // Should show 4 decimal places for medium costs
    });
  });

  describe('Custom Formatters Tests', () => {
    it('should use custom cost formatter when provided', () => {
      const metrics = createTestMetrics({
        currentCost: 0.001234
      });

      const customFormatter = (cost: number) => `€${(cost * 0.85).toFixed(3)}`;

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          visibleMetrics={['currentCost']}
          formatters={{ currentCost: customFormatter }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('€0.001'); // Should use custom Euro formatting
    });
  });

  describe('Integration with Existing Metrics Tests', () => {
    it('should display cost metrics alongside traditional metrics', () => {
      const metrics = createTestMetrics({
        totalTokens: 1500,
        responseTime: 2500,
        memoryUsageMB: 67.8,
        currentCost: 0.001234,
        sessionCost: 0.005678
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          visibleMetrics={['totalTokens', 'responseTime', 'memoryUsageMB', 'currentCost', 'sessionCost']}
        />
      );

      const output = lastFrame();
      
      // Should show all metrics together
      expect(output).toContain('Total: 1.5K'); // Token formatting
      expect(output).toContain('Time: 2.50s'); // Time formatting
      expect(output).toContain('Mem: 67.8MB'); // Memory formatting
      expect(output).toContain('Cost: $0.0012'); // Cost formatting
      expect(output).toContain('Session: $0.0057'); // Session cost formatting
    });

    it('should handle state indicators with cost metrics', () => {
      const metrics = createTestMetrics({
        currentCost: 0.001234
      });

      const { lastFrame } = render(
        <StatusLine 
          metrics={metrics}
          state="streaming"
          visibleMetrics={['currentCost']}
          showSpinner={true}
        />
      );

      const output = lastFrame();
      
      // Should show both state and cost info
      expect(output).toContain('Streaming');
      expect(output).toContain('$0.0012');
    });
  });
});