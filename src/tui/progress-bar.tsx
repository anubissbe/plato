/**
 * ProgressBar Component
 * Displays progress with percentage, streaming indicators, and various styles
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export interface ProgressBarProps {
  current?: number;
  total?: number;
  width: number;
  showPercentage?: boolean;
  showValues?: boolean;
  indeterminate?: boolean;
  indeterminateLabel?: string;
  streaming?: boolean;
  streamingSpeed?: 'slow' | 'normal' | 'fast';
  style?: 'classic' | 'modern' | 'simple' | 'ascii';
  fillChar?: string;
  emptyChar?: string;
  colorByProgress?: boolean;
  gradient?: boolean;
  gradientColors?: string[];
  label?: string;
  labelPosition?: 'left' | 'right' | 'above' | 'below';
  valueFormatter?: (current: number, total: number) => string;
  eta?: number;
  showETA?: boolean;
  segments?: Array<{ value: number; color: string; label: string }>;
  showLegend?: boolean;
  secondary?: { current: number; total: number };
  showSecondary?: boolean;
  pulse?: boolean;
  pulseSpeed?: 'slow' | 'normal' | 'fast';
  showCompletionAnimation?: boolean;
  smooth?: boolean;
  ariaLabel?: string;
  onProgressAnnounce?: (current: number, total: number) => void;
}

// Bar style configurations
const barStyles = {
  classic: { fill: '█', empty: '░', start: '[', end: ']' },
  modern: { fill: '▰', empty: '▱', start: '⟨', end: '⟩' },
  simple: { fill: '=', empty: '-', start: '[', end: ']' },
  ascii: { fill: '#', empty: '-', start: '[', end: ']' }
};

// Indeterminate animation frames
const indeterminateFrames = [
  '░▒▓█▓▒░░░░',
  '░░▒▓█▓▒░░░',
  '░░░▒▓█▓▒░░',
  '░░░░▒▓█▓▒░',
  '░░░░░▒▓█▓▒',
  '▒░░░░░▒▓█▓',
  '▓▒░░░░░▒▓█',
  '█▓▒░░░░░▒▓',
  '▓█▓▒░░░░░▒',
  '▒▓█▓▒░░░░░'
];

// Streaming animation characters
const streamingChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current = 0,
  total = 100,
  width,
  showPercentage = false,
  showValues = false,
  indeterminate = false,
  indeterminateLabel = 'Processing...',
  streaming = false,
  streamingSpeed = 'normal',
  style = 'classic',
  fillChar,
  emptyChar,
  colorByProgress = false,
  gradient = false,
  gradientColors = ['blue', 'cyan', 'green'],
  label,
  labelPosition = 'left',
  valueFormatter,
  eta,
  showETA = false,
  segments,
  showLegend = false,
  secondary,
  showSecondary = false,
  pulse = false,
  pulseSpeed = 'normal',
  showCompletionAnimation = false,
  smooth = false,
  ariaLabel,
  onProgressAnnounce
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [streamingFrame, setStreamingFrame] = useState(0);
  const [displayCurrent, setDisplayCurrent] = useState(current);
  const [pulseOpacity, setPulseOpacity] = useState(1);
  const [completionAnimated, setCompletionAnimated] = useState(false);

  // Smooth transitions
  useEffect(() => {
    if (smooth && !indeterminate) {
      const diff = current - displayCurrent;
      const steps = Math.abs(diff) > 10 ? 10 : Math.abs(diff);
      const increment = diff / steps;
      
      let step = 0;
      const timer = setInterval(() => {
        if (step >= steps) {
          setDisplayCurrent(current);
          clearInterval(timer);
        } else {
          setDisplayCurrent(prev => prev + increment);
          step++;
        }
      }, 30);
      
      return () => clearInterval(timer);
    } else {
      setDisplayCurrent(current);
    }
  }, [current, smooth, indeterminate]);

  // Announce progress changes for accessibility
  useEffect(() => {
    if (onProgressAnnounce && !indeterminate) {
      onProgressAnnounce(current, total);
    }
  }, [current, total, onProgressAnnounce, indeterminate]);

  // Animation effects
  useEffect(() => {
    if (indeterminate || streaming) {
      const speeds = { slow: 200, normal: 100, fast: 50 };
      const speed = speeds[streamingSpeed || 'normal'];
      
      const timer = setInterval(() => {
        if (indeterminate) {
          setAnimationFrame(prev => (prev + 1) % indeterminateFrames.length);
        }
        if (streaming) {
          setStreamingFrame(prev => (prev + 1) % streamingChars.length);
        }
      }, speed);
      
      return () => clearInterval(timer);
    }
  }, [indeterminate, streaming, streamingSpeed]);

  // Pulse effect
  useEffect(() => {
    if (pulse) {
      const speeds = { slow: 1000, normal: 500, fast: 250 };
      const speed = speeds[pulseSpeed || 'normal'];
      
      const timer = setInterval(() => {
        setPulseOpacity(prev => prev === 1 ? 0.5 : 1);
      }, speed);
      
      return () => clearInterval(timer);
    }
  }, [pulse, pulseSpeed]);

  // Completion animation
  useEffect(() => {
    if (showCompletionAnimation && displayCurrent >= total && !completionAnimated) {
      setCompletionAnimated(true);
      // Could trigger additional visual effects here
    } else if (displayCurrent < total) {
      setCompletionAnimated(false);
    }
  }, [displayCurrent, total, showCompletionAnimation, completionAnimated]);

  // Calculate progress
  const percentage = useMemo(() => {
    if (indeterminate || total === 0) return 0;
    const pct = (displayCurrent / total) * 100;
    return Math.min(100, Math.max(0, pct));
  }, [displayCurrent, total, indeterminate]);

  // Determine bar color
  const getProgressColor = () => {
    if (colorByProgress) {
      if (percentage < 33) return 'red';
      if (percentage < 66) return 'yellow';
      return 'green';
    }
    return 'cyan';
  };

  // Format values
  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  const formatETA = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  // Build the bar
  const renderBar = () => {
    const barStyle = barStyles[style];
    const fill = fillChar || barStyle.fill;
    const empty = emptyChar || barStyle.empty;
    
    if (indeterminate) {
      // Indeterminate animation
      const frame = indeterminateFrames[animationFrame];
      const scaled = frame.repeat(Math.ceil(width / frame.length)).substring(0, width);
      return (
        <Text>
          {barStyle.start}{scaled}{barStyle.end}
        </Text>
      );
    }
    
    if (segments && segments.length > 0) {
      // Segmented bar
      let bar = '';
      let usedWidth = 0;
      
      segments.forEach(segment => {
        const segmentWidth = Math.floor((segment.value / 100) * width);
        bar += fill.repeat(segmentWidth);
        usedWidth += segmentWidth;
      });
      
      bar += empty.repeat(width - usedWidth);
      
      return (
        <Text>
          {barStyle.start}{bar}{barStyle.end}
        </Text>
      );
    }
    
    // Regular progress bar
    const filledWidth = Math.floor((percentage / 100) * width);
    const emptyWidth = width - filledWidth;
    
    let bar = fill.repeat(filledWidth);
    
    // Add streaming indicator
    if (streaming && filledWidth < width) {
      bar += streamingChars[streamingFrame];
      bar += empty.repeat(Math.max(0, emptyWidth - 1));
    } else {
      bar += empty.repeat(emptyWidth);
    }
    
    return (
      <Text color={getProgressColor()}>
        {barStyle.start}{bar}{barStyle.end}
      </Text>
    );
  };

  // Build the complete component
  const progressText = showPercentage && !indeterminate ? (
    <Text color={getProgressColor()} bold>
      {Math.round(percentage)}%
    </Text>
  ) : null;

  const valuesText = showValues && !indeterminate ? (
    <Text dimColor>
      {valueFormatter 
        ? valueFormatter(displayCurrent, total)
        : `${formatValue(displayCurrent)}/${formatValue(total)}`}
    </Text>
  ) : null;

  const etaText = showETA && eta ? (
    <Text dimColor>ETA: {formatETA(eta)}</Text>
  ) : null;

  const labelText = label ? (
    <Text bold>{label}</Text>
  ) : indeterminate && indeterminateLabel ? (
    <Text bold>{indeterminateLabel}</Text>
  ) : null;

  // Secondary progress bar
  const secondaryBar = showSecondary && secondary ? (
    <Box marginTop={-1}>
      <ProgressBar
        current={secondary.current}
        total={secondary.total}
        width={width}
        style="simple"
        showPercentage={true}
      />
    </Box>
  ) : null;

  // Legend for segments
  const legend = showLegend && segments ? (
    <Box flexDirection="row" marginTop={1}>
      {segments.map((segment, index) => (
        <Box key={index} marginRight={2}>
          <Text color={segment.color}>■ {segment.label}</Text>
        </Box>
      ))}
    </Box>
  ) : null;

  // Layout based on label position
  const content = (
    <Box flexDirection="row" gap={1}>
      {labelPosition === 'left' && labelText}
      {renderBar()}
      {progressText}
      {valuesText}
      {etaText}
      {labelPosition === 'right' && labelText}
    </Box>
  );

  return (
    <Box flexDirection="column">
      {labelPosition === 'above' && labelText}
      {content}
      {labelPosition === 'below' && labelText}
      {secondaryBar}
      {legend}
    </Box>
  );
};