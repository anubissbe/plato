/**
 * StatusLine Component
 * Displays real-time metrics including tokens, response time, and memory usage
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { ConversationState, StatusMetrics } from './status-manager.js';

export interface StatusLineProps {
  metrics: StatusMetrics;
  state?: ConversationState;
  compact?: boolean;
  separator?: string;
  position?: 'top' | 'bottom';
  theme?: 'light' | 'dark';
  showSpinner?: boolean;
  pulseOnUpdate?: boolean;
  includeAccessibilityText?: boolean;
  showDescriptions?: boolean;
  visibleMetrics?: Array<keyof StatusMetrics>;
  formatters?: Partial<Record<keyof StatusMetrics, (value: any) => string>>;
  onMetricClick?: (metric: keyof StatusMetrics) => void;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const StatusLine: React.FC<StatusLineProps> = ({
  metrics,
  state = 'idle',
  compact = false,
  separator = ' │ ',
  position = 'bottom',
  theme = 'dark',
  showSpinner = false,
  pulseOnUpdate = false,
  includeAccessibilityText = false,
  showDescriptions = false,
  visibleMetrics,
  formatters = {},
  onMetricClick
}) => {
  const [spinnerFrame, setSpinnerFrame] = React.useState(0);
  const [pulse, setPulse] = React.useState(false);

  // Spinner animation
  React.useEffect(() => {
    if (showSpinner && (state === 'streaming' || state === 'processing')) {
      const timer = setInterval(() => {
        setSpinnerFrame((prev) => (prev + 1) % spinnerFrames.length);
      }, 80);
      return () => clearInterval(timer);
    }
  }, [showSpinner, state]);

  // Pulse effect
  React.useEffect(() => {
    if (pulseOnUpdate) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [metrics, pulseOnUpdate]);

  // Format functions
  const formatTokens = (count: number): string => {
    const formatter = formatters.totalTokens;
    if (formatter) return formatter(count);
    
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatTime = (ms: number): string => {
    const formatter = formatters.responseTime;
    if (formatter) return formatter(ms);
    
    if (ms >= 60000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatMemory = (mb: number): string => {
    const formatter = formatters.memoryUsageMB;
    if (formatter) return formatter(mb);
    
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(1)}MB`;
  };

  // Determine which metrics to show
  const metricsToShow = useMemo(() => {
    if (visibleMetrics) {
      return visibleMetrics;
    }
    
    // Default visible metrics
    return compact
      ? ['totalTokens', 'responseTime', 'memoryUsageMB']
      : ['inputTokens', 'outputTokens', 'totalTokens', 'responseTime', 'memoryUsageMB', 'memoryPercentage'];
  }, [visibleMetrics, compact]);

  // Build status segments
  const segments: React.ReactNode[] = [];

  // State indicator
  if (state !== 'idle') {
    const stateColors = {
      streaming: 'cyan',
      processing: 'yellow',
      error: 'red',
      waiting: 'gray',
      idle: 'gray'
    };
    
    const stateText = state.charAt(0).toUpperCase() + state.slice(1);
    const spinner = showSpinner && (state === 'streaming' || state === 'processing')
      ? spinnerFrames[spinnerFrame] + ' '
      : '';
    
    segments.push(
      <Text key="state" color={stateColors[state]} bold>
        {spinner}{stateText}
      </Text>
    );
  }

  // Streaming progress
  if (state === 'streaming' && metrics.streamProgress > 0) {
    segments.push(
      <Text key="stream" color="cyan">
        {compact ? '' : 'Stream: '}{metrics.streamProgress}% ({metrics.charactersStreamed} chars)
      </Text>
    );
  }

  // Active tool call
  if (metrics.activeToolCall) {
    segments.push(
      <Text key="tool" color="yellow">
        {compact ? '🔧' : 'Tool: '}{metrics.activeToolCall}
      </Text>
    );
  }

  // Token metrics
  if (metricsToShow.includes('inputTokens')) {
    segments.push(
      <Text key="input" color="green">
        {compact ? 'I:' : 'In: '}{formatTokens(metrics.inputTokens)}
      </Text>
    );
  }

  if (metricsToShow.includes('outputTokens')) {
    segments.push(
      <Text key="output" color="blue">
        {compact ? 'O:' : 'Out: '}{formatTokens(metrics.outputTokens)}
      </Text>
    );
  }

  if (metricsToShow.includes('totalTokens')) {
    segments.push(
      <Text key="total" color="magenta">
        {compact ? 'T:' : 'Total: '}{formatTokens(metrics.totalTokens)}
      </Text>
    );
  }

  // Response time
  if (metricsToShow.includes('responseTime') && metrics.responseTime > 0) {
    segments.push(
      <Text key="time" color="yellow">
        {compact ? '⏱' : 'Time: '}{formatTime(metrics.responseTime)}
      </Text>
    );
  }

  // Memory usage
  if (metricsToShow.includes('memoryUsageMB')) {
    const memoryColor = 
      metrics.memoryPercentage > 80 ? 'red' :
      metrics.memoryPercentage > 60 ? 'yellow' :
      'green';
    
    segments.push(
      <Text key="memory" color={memoryColor}>
        {compact ? 'M:' : 'Mem: '}{formatMemory(metrics.memoryUsageMB)}
      </Text>
    );
  }

  if (metricsToShow.includes('memoryPercentage') && !compact) {
    const memoryColor = 
      metrics.memoryPercentage > 80 ? 'red' :
      metrics.memoryPercentage > 60 ? 'yellow' :
      'green';
    
    segments.push(
      <Text key="memPercent" color={memoryColor}>
        ({metrics.memoryPercentage}%)
      </Text>
    );
  }

  // Error display
  if (metrics.lastError) {
    segments.push(
      <Text key="error" color="red" bold>
        Error: {metrics.lastError.substring(0, compact ? 20 : 50)}...
      </Text>
    );
  }

  // Accessibility text
  const accessibilityText = includeAccessibilityText ? (
    <Text dimColor>
      {`Status: ${state}, Tokens: ${metrics.totalTokens}, Response: ${formatTime(metrics.responseTime)}, Memory: ${formatMemory(metrics.memoryUsageMB)}`}
    </Text>
  ) : null;

  const borderColor = theme === 'dark' ? 'gray' : 'black';
  const bgColor = theme === 'dark' ? undefined : 'white';

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      borderStyle="single"
      borderColor={borderColor}
      backgroundColor={bgColor}
      marginTop={position === 'top' ? 0 : 1}
      marginBottom={position === 'bottom' ? 0 : 1}
      opacity={pulse ? 0.7 : 1}
    >
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Text dimColor>{separator}</Text>}
          {segment}
        </React.Fragment>
      ))}
      {accessibilityText}
    </Box>
  );
};