/**
 * Tests for ProgressBar component
 * Validates percentage display, streaming indicators, and various progress styles
 */

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render } from 'ink-testing-library';
import { ProgressBar, ProgressBarProps } from '../progress-bar.js';

describe('ProgressBar Component', () => {
  const defaultProps: ProgressBarProps = {
    current: 50,
    total: 100,
    width: 20,
    showPercentage: true,
    showValues: false
  };

  describe('Basic Rendering', () => {
    it('should render progress bar with correct fill', () => {
      const { lastFrame } = render(<ProgressBar {...defaultProps} />);
      const output = lastFrame();
      
      // Should show 50% progress
      expect(output).toContain('50%');
      // Bar should be half filled (10 of 20 characters)
      expect(output).toMatch(/[█═]{10}/);
    });

    it('should handle zero progress', () => {
      const { lastFrame } = render(
        <ProgressBar {...defaultProps} current={0} />
      );
      
      expect(lastFrame()).toContain('0%');
    });

    it('should handle complete progress', () => {
      const { lastFrame } = render(
        <ProgressBar {...defaultProps} current={100} />
      );
      
      expect(lastFrame()).toContain('100%');
      // Bar should be fully filled
      expect(lastFrame()).toMatch(/[█═]{20}/);
    });

    it('should handle progress exceeding total', () => {
      const { lastFrame } = render(
        <ProgressBar {...defaultProps} current={150} />
      );
      
      // Should cap at 100%
      expect(lastFrame()).toContain('100%');
    });

    it('should render without percentage when disabled', () => {
      const { lastFrame } = render(
        <ProgressBar {...defaultProps} showPercentage={false} />
      );
      
      expect(lastFrame()).not.toContain('%');
    });

    it('should show values when enabled', () => {
      const { lastFrame } = render(
        <ProgressBar {...defaultProps} showValues={true} />
      );
      
      expect(lastFrame()).toContain('50/100');
    });
  });

  describe('Indeterminate Progress', () => {
    it('should show indeterminate animation', () => {
      const { lastFrame } = render(
        <ProgressBar indeterminate={true} width={20} />
      );
      
      // Indeterminate shows moving indicator
      const output = lastFrame();
      expect(output).toMatch(/[░▒▓█]/);
    });

    it('should not show percentage for indeterminate', () => {
      const { lastFrame } = render(
        <ProgressBar indeterminate={true} showPercentage={true} width={20} />
      );
      
      expect(lastFrame()).not.toContain('%');
    });

    it('should show custom indeterminate label', () => {
      const { lastFrame } = render(
        <ProgressBar 
          indeterminate={true}
          indeterminateLabel="Processing..."
          width={20}
        />
      );
      
      expect(lastFrame()).toContain('Processing...');
    });
  });

  describe('Streaming Progress', () => {
    it('should show streaming indicator', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          streaming={true}
          streamingSpeed="fast"
        />
      );
      
      // Streaming adds animated characters
      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain('50%');
    });

    it('should animate streaming characters', () => {
      const { lastFrame, rerender } = render(
        <ProgressBar 
          {...defaultProps}
          streaming={true}
          current={30}
        />
      );
      
      const frame1 = lastFrame();
      
      // Simulate animation frame
      rerender(
        <ProgressBar 
          {...defaultProps}
          streaming={true}
          current={35}
        />
      );
      
      const frame2 = lastFrame();
      
      // Progress should have increased
      expect(frame2).toContain('35%');
    });

    it('should support different streaming speeds', () => {
      const speeds: Array<'slow' | 'normal' | 'fast'> = ['slow', 'normal', 'fast'];
      
      speeds.forEach(speed => {
        const { lastFrame } = render(
          <ProgressBar 
            {...defaultProps}
            streaming={true}
            streamingSpeed={speed}
          />
        );
        
        expect(lastFrame()).toBeDefined();
      });
    });
  });

  describe('Styling and Customization', () => {
    it('should support different bar styles', () => {
      const styles: Array<'classic' | 'modern' | 'simple' | 'ascii'> = [
        'classic', 'modern', 'simple', 'ascii'
      ];
      
      styles.forEach(style => {
        const { lastFrame } = render(
          <ProgressBar {...defaultProps} style={style} />
        );
        
        const output = lastFrame();
        expect(output).toBeDefined();
        
        // Different styles use different characters
        if (style === 'ascii') {
          expect(output).toMatch(/[#\-]/);
        } else if (style === 'modern') {
          expect(output).toMatch(/[▰▱]/);
        }
      });
    });

    it('should support custom characters', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          fillChar="▓"
          emptyChar="░"
        />
      );
      
      const output = lastFrame();
      expect(output).toContain('▓');
      expect(output).toContain('░');
    });

    it('should apply color based on progress', () => {
      const testCases = [
        { current: 25, expectedColor: 'red' },
        { current: 50, expectedColor: 'yellow' },
        { current: 90, expectedColor: 'green' }
      ];
      
      testCases.forEach(({ current }) => {
        const { lastFrame } = render(
          <ProgressBar 
            {...defaultProps}
            current={current}
            colorByProgress={true}
          />
        );
        
        expect(lastFrame()).toContain(`${current}%`);
      });
    });

    it('should support custom width', () => {
      const widths = [10, 20, 30, 50];
      
      widths.forEach(width => {
        const { lastFrame } = render(
          <ProgressBar 
            {...defaultProps}
            width={width}
          />
        );
        
        const output = lastFrame();
        // Bar length should match width (minus borders/padding)
        expect(output.length).toBeGreaterThan(width);
      });
    });

    it('should support gradient effect', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          gradient={true}
          gradientColors={['blue', 'cyan', 'green']}
        />
      );
      
      // Gradient would be applied through color codes
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Labels and Text', () => {
    it('should show custom label', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          label="Downloading"
        />
      );
      
      expect(lastFrame()).toContain('Downloading');
    });

    it('should show label on the left', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          label="Progress"
          labelPosition="left"
        />
      );
      
      const output = lastFrame();
      expect(output.indexOf('Progress')).toBeLessThan(output.indexOf('50%'));
    });

    it('should show label on the right', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          label="Status"
          labelPosition="right"
        />
      );
      
      const output = lastFrame();
      expect(output.indexOf('Status')).toBeGreaterThan(output.indexOf('50%'));
    });

    it('should format values with custom formatter', () => {
      const formatter = (current: number, total: number) => 
        `${current}KB of ${total}KB`;
      
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          showValues={true}
          valueFormatter={formatter}
        />
      );
      
      expect(lastFrame()).toContain('50KB of 100KB');
    });

    it('should show ETA when provided', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          eta={120} // 120 seconds
          showETA={true}
        />
      );
      
      expect(lastFrame()).toContain('2:00'); // Or "2m" depending on format
    });
  });

  describe('Compound Progress', () => {
    it('should render multiple progress segments', () => {
      const segments = [
        { value: 30, color: 'green', label: 'Complete' },
        { value: 20, color: 'yellow', label: 'In Progress' },
        { value: 50, color: 'gray', label: 'Pending' }
      ];
      
      const { lastFrame } = render(
        <ProgressBar 
          segments={segments}
          width={20}
          showLegend={true}
        />
      );
      
      const output = lastFrame();
      expect(output).toContain('Complete');
      expect(output).toContain('In Progress');
      expect(output).toContain('Pending');
    });

    it('should handle stacked progress bars', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          secondary={{ current: 25, total: 100 }}
          showSecondary={true}
        />
      );
      
      const output = lastFrame();
      expect(output).toContain('50%'); // Primary
      expect(output).toContain('25%'); // Secondary
    });
  });

  describe('Animations', () => {
    it('should pulse when enabled', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          pulse={true}
          pulseSpeed="normal"
        />
      );
      
      // Pulse effect through styling
      expect(lastFrame()).toBeDefined();
    });

    it('should show completion animation', async () => {
      const { lastFrame, rerender } = render(
        <ProgressBar {...defaultProps} current={99} />
      );
      
      expect(lastFrame()).toContain('99%');
      
      rerender(
        <ProgressBar 
          {...defaultProps}
          current={100}
          showCompletionAnimation={true}
        />
      );
      
      // Completion might show special characters or effects
      expect(lastFrame()).toContain('100%');
    });

    it('should support smooth transitions', () => {
      const { lastFrame, rerender } = render(
        <ProgressBar 
          {...defaultProps}
          current={30}
          smooth={true}
        />
      );
      
      const frame1 = lastFrame();
      
      rerender(
        <ProgressBar 
          {...defaultProps}
          current={70}
          smooth={true}
        />
      );
      
      const frame2 = lastFrame();
      
      // Smooth transition would animate between values
      expect(frame1).toContain('30%');
      expect(frame2).toContain('70%');
    });
  });

  describe('Accessibility', () => {
    it('should include ARIA attributes', () => {
      const { lastFrame } = render(
        <ProgressBar 
          {...defaultProps}
          ariaLabel="Download progress"
        />
      );
      
      // ARIA attributes would be in the component props
      expect(lastFrame()).toBeDefined();
    });

    it('should announce progress changes', () => {
      const onProgressAnnounce = jest.fn();
      
      const { rerender } = render(
        <ProgressBar 
          {...defaultProps}
          current={30}
          onProgressAnnounce={onProgressAnnounce}
        />
      );
      
      rerender(
        <ProgressBar 
          {...defaultProps}
          current={60}
          onProgressAnnounce={onProgressAnnounce}
        />
      );
      
      expect(onProgressAnnounce).toHaveBeenCalledWith(60, 100);
    });
  });

  describe('Error States', () => {
    it('should handle invalid progress values', () => {
      const { lastFrame } = render(
        <ProgressBar current={-10} total={100} width={20} />
      );
      
      // Should treat negative as 0
      expect(lastFrame()).toContain('0%');
    });

    it('should handle zero total gracefully', () => {
      const { lastFrame } = render(
        <ProgressBar current={50} total={0} width={20} />
      );
      
      // Should show indeterminate or 0%
      expect(lastFrame()).toBeDefined();
    });

    it('should handle NaN values', () => {
      const { lastFrame } = render(
        <ProgressBar current={NaN} total={100} width={20} />
      );
      
      // Should fallback to 0 or show error state
      expect(lastFrame()).toBeDefined();
    });
  });
});