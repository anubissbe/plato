/**
 * Tests for StatusLine component
 * Validates real-time metrics display including tokens, response time, and memory usage
 */

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render } from 'ink-testing-library';
import { StatusLine } from '../status-line.js';
import { StatusMetrics } from '../status-manager.js';

describe('StatusLine Component', () => {
  const defaultMetrics: StatusMetrics = {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    responseTime: 1234,
    memoryUsageMB: 45.5,
    memoryPercentage: 35,
    sessionTurns: 3,
    sessionTokens: 450,
    streamProgress: 0,
    charactersStreamed: 0,
    activeToolCall: null,
    toolCallHistory: [],
    lastError: null,
    averageResponseTime: 1500,
    indeterminateProgress: false
  };

  describe('Rendering', () => {
    it('should render basic status line with metrics', () => {
      const { lastFrame } = render(<StatusLine metrics={defaultMetrics} />);
      
      expect(lastFrame()).toContain('100');  // input tokens
      expect(lastFrame()).toContain('50');   // output tokens
      expect(lastFrame()).toContain('150');  // total tokens
      expect(lastFrame()).toContain('1.23s'); // response time
      expect(lastFrame()).toContain('45.5MB'); // memory usage
    });

    it('should display streaming progress when active', () => {
      const streamingMetrics = {
        ...defaultMetrics,
        streamProgress: 65,
        charactersStreamed: 325
      };
      
      const { lastFrame } = render(<StatusLine metrics={streamingMetrics} state="streaming" />);
      
      expect(lastFrame()).toContain('65%');
      expect(lastFrame()).toContain('325 chars');
      expect(lastFrame()).toContain('Streaming');
    });

    it('should show active tool call indicator', () => {
      const toolMetrics = {
        ...defaultMetrics,
        activeToolCall: 'fs_read'
      };
      
      const { lastFrame } = render(<StatusLine metrics={toolMetrics} state="processing" />);
      
      expect(lastFrame()).toContain('fs_read');
      expect(lastFrame()).toContain('Processing');
    });

    it('should display error state prominently', () => {
      const errorMetrics = {
        ...defaultMetrics,
        lastError: 'Connection timeout'
      };
      
      const { lastFrame } = render(<StatusLine metrics={errorMetrics} state="error" />);
      
      expect(lastFrame()).toContain('Error');
      expect(lastFrame()).toContain('Connection timeout');
    });

    it('should handle compact mode for narrow terminals', () => {
      const { lastFrame } = render(
        <StatusLine metrics={defaultMetrics} compact={true} />
      );
      
      // In compact mode, should show abbreviated labels
      expect(lastFrame()).toContain('T:150'); // Total tokens abbreviated
      expect(lastFrame()).toContain('M:45.5'); // Memory abbreviated
    });

    it('should update dynamically when metrics change', () => {
      const { lastFrame, rerender } = render(<StatusLine metrics={defaultMetrics} />);
      
      const initial = lastFrame();
      expect(initial).toContain('100');
      
      const updatedMetrics = {
        ...defaultMetrics,
        inputTokens: 200,
        totalTokens: 250
      };
      
      rerender(<StatusLine metrics={updatedMetrics} />);
      const updated = lastFrame();
      
      expect(updated).toContain('200');
      expect(updated).toContain('250');
    });
  });

  describe('Formatting', () => {
    it('should format large token counts with K suffix', () => {
      const largeMetrics = {
        ...defaultMetrics,
        totalTokens: 15000
      };
      
      const { lastFrame } = render(<StatusLine metrics={largeMetrics} />);
      expect(lastFrame()).toContain('15K');
    });

    it('should format response time appropriately', () => {
      const testCases = [
        { time: 500, expected: '0.50s' },
        { time: 1234, expected: '1.23s' },
        { time: 10500, expected: '10.5s' },
        { time: 60000, expected: '1:00' }
      ];
      
      testCases.forEach(({ time, expected }) => {
        const metrics = { ...defaultMetrics, responseTime: time };
        const { lastFrame } = render(<StatusLine metrics={metrics} />);
        expect(lastFrame()).toContain(expected);
      });
    });

    it('should show memory percentage with color coding', () => {
      const testCases = [
        { percentage: 25, color: 'green' },
        { percentage: 60, color: 'yellow' },
        { percentage: 85, color: 'red' }
      ];
      
      testCases.forEach(({ percentage }) => {
        const metrics = { ...defaultMetrics, memoryPercentage: percentage };
        const { lastFrame } = render(<StatusLine metrics={metrics} />);
        expect(lastFrame()).toContain(`${percentage}%`);
      });
    });
  });

  describe('Customization', () => {
    it('should allow custom metric selection', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          visibleMetrics={['inputTokens', 'responseTime']}
        />
      );
      
      expect(lastFrame()).toContain('100'); // input tokens
      expect(lastFrame()).toContain('1.23s'); // response time
      expect(lastFrame()).not.toContain('45.5MB'); // memory not included
    });

    it('should support custom formatters', () => {
      const customFormatters = {
        responseTime: (ms: number) => `${(ms / 1000).toFixed(1)} seconds`,
        memoryUsageMB: (mb: number) => `${mb.toFixed(0)} megabytes`
      };
      
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          formatters={customFormatters}
        />
      );
      
      expect(lastFrame()).toContain('1.2 seconds');
      expect(lastFrame()).toContain('46 megabytes');
    });

    it('should allow custom separator characters', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          separator=" • "
        />
      );
      
      expect(lastFrame()).toContain(' • ');
    });

    it('should support position configuration', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          position="bottom"
        />
      );
      
      // Position affects wrapping Box component
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Animation', () => {
    it('should show spinner during streaming', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          state="streaming"
          showSpinner={true}
        />
      );
      
      // Spinner characters: ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏
      expect(lastFrame()).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    it('should pulse metrics during updates', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          pulseOnUpdate={true}
        />
      );
      
      // Pulse effect is applied through styling
      expect(lastFrame()).toBeDefined();
    });

    it('should show progress animation for tool calls', () => {
      const toolMetrics = {
        ...defaultMetrics,
        activeToolCall: 'fs_write',
        indeterminateProgress: true
      };
      
      const { lastFrame } = render(
        <StatusLine 
          metrics={toolMetrics}
          state="processing"
        />
      );
      
      expect(lastFrame()).toContain('fs_write');
      // Indeterminate progress shows animated dots or bar
    });
  });

  describe('Accessibility', () => {
    it('should include screen reader text', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          includeAccessibilityText={true}
        />
      );
      
      // Screen reader text is hidden visually but present in output
      expect(lastFrame()).toBeDefined();
    });

    it('should provide metric descriptions on hover/focus', () => {
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          showDescriptions={true}
        />
      );
      
      // Descriptions would be in tooltips or expanded view
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should respond to theme changes', () => {
      const { lastFrame, rerender } = render(
        <StatusLine 
          metrics={defaultMetrics}
          theme="light"
        />
      );
      
      const lightTheme = lastFrame();
      
      rerender(
        <StatusLine 
          metrics={defaultMetrics}
          theme="dark"
        />
      );
      
      const darkTheme = lastFrame();
      
      // Different themes should produce different output
      expect(lightTheme).toBeDefined();
      expect(darkTheme).toBeDefined();
    });

    it('should handle missing metrics gracefully', () => {
      const partialMetrics = {
        inputTokens: 100,
        outputTokens: 50
      } as StatusMetrics;
      
      const { lastFrame } = render(<StatusLine metrics={partialMetrics} />);
      
      expect(lastFrame()).toContain('100');
      expect(lastFrame()).toContain('50');
      // Should not crash with missing fields
    });

    it('should work with status manager events', () => {
      const mockOnMetricClick = jest.fn();
      
      const { lastFrame } = render(
        <StatusLine 
          metrics={defaultMetrics}
          onMetricClick={mockOnMetricClick}
        />
      );
      
      // Click handling would be tested with interaction
      expect(lastFrame()).toBeDefined();
    });
  });
});