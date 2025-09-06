import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LoadingAnimations as LoadingAnimationManager, Animation } from './VisualIndicators';

export interface LoadingSpinnerProps {
  text?: string;
  color?: string;
  type?: 'spinner' | 'dots' | 'pulse';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = 'Loading',
  color = 'cyan',
  type = 'spinner',
}) => {
  const [frame, setFrame] = useState(0);
  const animationManager = new LoadingAnimationManager();
  
  let animation: Animation;
  switch (type) {
    case 'dots':
      animation = animationManager.getDots();
      break;
    case 'pulse':
      animation = animationManager.getPulse();
      break;
    default:
      animation = animationManager.getSpinner();
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % animation.frames.length);
    }, animation.interval);

    return () => clearInterval(timer);
  }, [animation]);

  return (
    <Box>
      <Text color={color}>
        {animation.frames[frame]} {text}
      </Text>
    </Box>
  );
};

export interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  showPercentage?: boolean;
  color?: string;
  bgColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  width = 20,
  showPercentage = true,
  color = 'green',
  bgColor = 'gray',
}) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  return (
    <Box>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color={bgColor}>{'░'.repeat(empty)}</Text>
      {showPercentage && (
        <Text> {Math.floor(percentage)}%</Text>
      )}
    </Box>
  );
};

export interface StreamingIndicatorProps {
  isStreaming: boolean;
  text?: string;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  isStreaming,
  text = 'Streaming',
}) => {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;

    const timer = setInterval(() => {
      setDots(prev => (prev + 1) % 4);
    }, 300);

    return () => clearInterval(timer);
  }, [isStreaming]);

  if (!isStreaming) return null;

  return (
    <Box>
      <Text color="yellow">
        ⚡ {text}{'.'.repeat(dots)}
      </Text>
    </Box>
  );
};

export interface PulseAnimationProps {
  active: boolean;
  children: React.ReactNode;
  interval?: number;
}

export const PulseAnimation: React.FC<PulseAnimationProps> = ({
  active,
  children,
  interval = 1000,
}) => {
  const [opacity, setOpacity] = useState(1);
  const [increasing, setIncreasing] = useState(false);

  useEffect(() => {
    if (!active) {
      setOpacity(1);
      return;
    }

    const timer = setInterval(() => {
      setOpacity(prev => {
        if (prev <= 0.3) {
          setIncreasing(true);
          return 0.3;
        }
        if (prev >= 1) {
          setIncreasing(false);
          return 1;
        }
        return increasing ? prev + 0.1 : prev - 0.1;
      });
    }, interval / 10);

    return () => clearInterval(timer);
  }, [active, interval, increasing]);

  return (
    <Box>
      <Text dimColor={opacity < 0.7}>
        {children}
      </Text>
    </Box>
  );
};

export interface TypewriterEffectProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  speed = 50,
  onComplete,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= text.length) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(prev => prev + text[currentIndex]);
      setCurrentIndex(prev => prev + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, speed, onComplete]);

  return <Text>{displayedText}</Text>;
};

export interface ActivityIndicatorProps {
  activities: Array<{ id: string; label: string }>;
  compact?: boolean;
}

export const ActivityIndicator: React.FC<ActivityIndicatorProps> = ({
  activities,
  compact = false,
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    if (activities.length === 0) return;

    const timer = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % frames.length);
    }, 80);

    return () => clearInterval(timer);
  }, [activities.length]);

  if (activities.length === 0) return null;

  if (compact) {
    return (
      <Box>
        <Text color="blue">
          {frames[animationFrame]} {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {activities.map(activity => (
        <Box key={activity.id}>
          <Text color="blue">{frames[animationFrame]} </Text>
          <Text>{activity.label}</Text>
        </Box>
      ))}
    </Box>
  );
};

export interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  format?: 'seconds' | 'mm:ss';
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  seconds: initialSeconds,
  onComplete,
  format = 'seconds',
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setSeconds(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds, onComplete]);

  const formatTime = (sec: number): string => {
    if (format === 'mm:ss') {
      const minutes = Math.floor(sec / 60);
      const remainingSeconds = sec % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${sec}s`;
  };

  return (
    <Text color={seconds <= 10 ? 'red' : seconds <= 30 ? 'yellow' : 'green'}>
      ⏱️ {formatTime(seconds)}
    </Text>
  );
};

export interface LoadingDotsProps {
  text?: string;
  maxDots?: number;
  interval?: number;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  text = 'Loading',
  maxDots = 3,
  interval = 500,
}) => {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => (prev + 1) % (maxDots + 1));
    }, interval);

    return () => clearInterval(timer);
  }, [maxDots, interval]);

  return (
    <Text>
      {text}{'.'.repeat(dots)}{' '.repeat(maxDots - dots)}
    </Text>
  );
};

export interface AnimatedEllipsisProps {
  prefix?: string;
  suffix?: string;
}

export const AnimatedEllipsis: React.FC<AnimatedEllipsisProps> = ({
  prefix = '',
  suffix = '',
}) => {
  const [frame, setFrame] = useState(0);
  const frames = ['.', '..', '...', '..'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 400);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text>
      {prefix}{frames[frame]}{suffix}
    </Text>
  );
};