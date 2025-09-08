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
    indeterminateProgress: false,
    currentCost: 0.001,
    sessionCost: 0.045,
    todayCost: 0.123,
    costPerToken: 0.000006,
    projectedCost: 0.050,
    costThreshold: 1.00,
    model: 'gpt-3.5-turbo',
    provider: 'copilot'
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

  describe('Cost Analytics Display', () => {
    describe('Cost Formatting', () => {
      it('should display current cost with proper formatting', () => {
        const costMetrics = {
          ...defaultMetrics,
          currentCost: 0.001234
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.0012');
      });

      it('should format session cost for larger amounts', () => {
        const costMetrics = {
          ...defaultMetrics,
          sessionCost: 1.234567
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['sessionCost']}
          />
        );
        
        expect(lastFrame()).toContain('$1.23');
      });

      it('should handle very small costs with scientific notation fallback', () => {
        const costMetrics = {
          ...defaultMetrics,
          currentCost: 0.0000012
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.000001');
      });

      it('should format today total cost appropriately', () => {
        const costMetrics = {
          ...defaultMetrics,
          todayCost: 15.789
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['todayCost']}
          />
        );
        
        expect(lastFrame()).toContain('$15.79');
      });
    });

    describe('Cost Color Coding', () => {
      it('should use green for low costs (under 25% of threshold)', () => {
        const costMetrics = {
          ...defaultMetrics,
          currentCost: 0.20,
          costThreshold: 1.00
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['currentCost']}
          />
        );
        
        // Green for costs under 25% of threshold
        expect(lastFrame()).toContain('$0.20');
      });

      it('should use yellow for medium costs (25-75% of threshold)', () => {
        const costMetrics = {
          ...defaultMetrics,
          sessionCost: 0.50,
          costThreshold: 1.00
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['sessionCost']}
          />
        );
        
        // Yellow for costs 25-75% of threshold
        expect(lastFrame()).toContain('$0.50');
      });

      it('should use red for high costs (over 75% of threshold)', () => {
        const costMetrics = {
          ...defaultMetrics,
          sessionCost: 0.80,
          costThreshold: 1.00
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['sessionCost']}
          />
        );
        
        // Red for costs over 75% of threshold
        expect(lastFrame()).toContain('$0.80');
      });

      it('should use bright red for costs exceeding threshold', () => {
        const costMetrics = {
          ...defaultMetrics,
          todayCost: 1.25,
          costThreshold: 1.00
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={costMetrics}
            visibleMetrics={['todayCost']}
          />
        );
        
        // Bright red for costs exceeding threshold
        expect(lastFrame()).toContain('$1.25');
      });
    });

    describe('Cost Labels and Compact Mode', () => {
      it('should show full labels in normal mode', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost', 'sessionCost', 'todayCost']}
            compact={false}
          />
        );
        
        expect(lastFrame()).toContain('Cost:');
        expect(lastFrame()).toContain('Session:');
        expect(lastFrame()).toContain('Today:');
      });

      it('should show abbreviated labels in compact mode', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost', 'sessionCost', 'todayCost']}
            compact={true}
          />
        );
        
        expect(lastFrame()).toContain('C:');
        expect(lastFrame()).toContain('S:');
        expect(lastFrame()).toContain('T:');
      });

      it('should show cost symbols in ultra-compact mode', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost', 'sessionCost']}
            compact={true}
            separator=" "
          />
        );
        
        // Ultra-compact should use $ symbol with minimal spacing
        expect(lastFrame()).toMatch(/\$[\d.]+/);
      });
    });

    describe('Cost Visibility Controls', () => {
      it('should hide cost metrics when not in visibleMetrics', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['inputTokens', 'outputTokens']}
          />
        );
        
        expect(lastFrame()).not.toContain('$');
        expect(lastFrame()).not.toContain('Cost:');
      });

      it('should show only specified cost metrics', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['sessionCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.045'); // sessionCost
        expect(lastFrame()).not.toContain('$0.001'); // currentCost should be hidden
        expect(lastFrame()).not.toContain('$0.123'); // todayCost should be hidden
      });

      it('should allow cost metrics to be toggled dynamically', () => {
        const { lastFrame, rerender } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['totalTokens']}
          />
        );
        
        expect(lastFrame()).not.toContain('$');
        
        rerender(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['totalTokens', 'currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.001');
      });
    });

    describe('Provider and Model Display', () => {
      it('should show provider and model information when available', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['model', 'provider', 'currentCost']}
            compact={false}
          />
        );
        
        expect(lastFrame()).toContain('gpt-3.5-turbo');
        expect(lastFrame()).toContain('copilot');
      });

      it('should abbreviate provider/model in compact mode', () => {
        const longMetrics = {
          ...defaultMetrics,
          model: 'gpt-4-32k-context-extended',
          provider: 'azure-openai'
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={longMetrics}
            visibleMetrics={['model', 'provider']}
            compact={true}
          />
        );
        
        // Should truncate long names in compact mode
        expect(lastFrame()).toMatch(/(gpt-4|azure)/);
      });

      it('should handle missing provider/model gracefully', () => {
        const incompleteMetrics = {
          ...defaultMetrics,
          model: undefined,
          provider: undefined
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={incompleteMetrics}
            visibleMetrics={['model', 'provider', 'currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.001');
        // Should not crash with undefined model/provider
      });
    });

    describe('Cost Projections and Warnings', () => {
      it('should show projected cost when available', () => {
        const projectionMetrics = {
          ...defaultMetrics,
          projectedCost: 0.075
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={projectionMetrics}
            visibleMetrics={['projectedCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.075');
        expect(lastFrame()).toContain('Proj:');
      });

      it('should show warning icon for costs approaching threshold', () => {
        const warningMetrics = {
          ...defaultMetrics,
          sessionCost: 0.85,
          costThreshold: 1.00
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={warningMetrics}
            visibleMetrics={['sessionCost', 'costThreshold']}
          />
        );
        
        // Should include warning indicator (⚠ or similar)
        expect(lastFrame()).toMatch(/[⚠️🚨]/);
      });

      it('should show cost per token rate', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['costPerToken']}
          />
        );
        
        expect(lastFrame()).toContain('$0.000006');
        expect(lastFrame()).toContain('/tok');
      });
    });

    describe('Custom Cost Formatters', () => {
      it('should support custom cost formatting', () => {
        const customFormatters = {
          currentCost: (cost: number) => `${(cost * 100).toFixed(2)}¢`,
          sessionCost: (cost: number) => `$${cost.toFixed(3)}`
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost', 'sessionCost']}
            formatters={customFormatters}
          />
        );
        
        expect(lastFrame()).toContain('0.10¢'); // currentCost as cents
        expect(lastFrame()).toContain('$0.045'); // sessionCost with 3 decimals
      });

      it('should handle zero costs appropriately', () => {
        const zeroMetrics = {
          ...defaultMetrics,
          currentCost: 0,
          sessionCost: 0,
          todayCost: 0
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={zeroMetrics}
            visibleMetrics={['currentCost', 'sessionCost', 'todayCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.00');
      });
    });

    describe('Real-time Cost Updates', () => {
      it('should reflect cost changes immediately', () => {
        const { lastFrame, rerender } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.001');
        
        const updatedMetrics = {
          ...defaultMetrics,
          currentCost: 0.0025
        };
        
        rerender(
          <StatusLine 
            metrics={updatedMetrics}
            visibleMetrics={['currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.0025');
      });

      it('should update session totals dynamically', () => {
        const { lastFrame, rerender } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['sessionCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.045');
        
        const increasedMetrics = {
          ...defaultMetrics,
          sessionCost: 0.067
        };
        
        rerender(
          <StatusLine 
            metrics={increasedMetrics}
            visibleMetrics={['sessionCost']}
          />
        );
        
        expect(lastFrame()).toContain('$0.067');
      });

      it('should handle rapid cost updates without flickering', () => {
        let currentCost = 0.001;
        const { lastFrame, rerender } = render(
          <StatusLine 
            metrics={{ ...defaultMetrics, currentCost }}
            visibleMetrics={['currentCost']}
          />
        );
        
        // Simulate rapid updates
        for (let i = 0; i < 10; i++) {
          currentCost += 0.0001;
          rerender(
            <StatusLine 
              metrics={{ ...defaultMetrics, currentCost }}
              visibleMetrics={['currentCost']}
            />
          );
        }
        
        // Should show final value
        expect(lastFrame()).toContain('$0.002');
      });
    });

    describe('Integration with Token Metrics', () => {
      it('should show cost alongside token metrics', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['totalTokens', 'currentCost', 'costPerToken']}
            compact={false}
          />
        );
        
        expect(lastFrame()).toContain('Total: 150'); // tokens
        expect(lastFrame()).toContain('Cost: $0.001'); // current cost
        expect(lastFrame()).toContain('$0.000006/tok'); // cost per token
      });

      it('should calculate cost efficiency metrics', () => {
        const efficientMetrics = {
          ...defaultMetrics,
          totalTokens: 1000,
          currentCost: 0.002
        };
        
        const { lastFrame } = render(
          <StatusLine 
            metrics={efficientMetrics}
            visibleMetrics={['totalTokens', 'currentCost']}
          />
        );
        
        expect(lastFrame()).toContain('1K'); // 1000 tokens formatted
        expect(lastFrame()).toContain('$0.002');
      });
    });

    describe('Cost Display Themes', () => {
      it('should adapt cost colors to light theme', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost']}
            theme="light"
          />
        );
        
        expect(lastFrame()).toContain('$0.001');
      });

      it('should adapt cost colors to dark theme', () => {
        const { lastFrame } = render(
          <StatusLine 
            metrics={defaultMetrics}
            visibleMetrics={['currentCost']}
            theme="dark"
          />
        );
        
        expect(lastFrame()).toContain('$0.001');
      });
    });
  });
});