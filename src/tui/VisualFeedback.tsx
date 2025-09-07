import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { StatusIndicators } from './VisualIndicators';

export interface KeyboardShortcutFeedbackProps {
  shortcut: string | null;
  duration?: number;
}

export const KeyboardShortcutFeedback: React.FC<KeyboardShortcutFeedbackProps> = ({
  shortcut,
  duration = 1500,
}) => {
  const [visible, setVisible] = useState(false);
  const [currentShortcut, setCurrentShortcut] = useState<string | null>(null);

  useEffect(() => {
    if (shortcut) {
      setCurrentShortcut(shortcut);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [shortcut, duration]);

  if (!visible || !currentShortcut) return null;

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan" bold>
        ⌨️ {currentShortcut}
      </Text>
    </Box>
  );
};

export interface ModeChangeIndicatorProps {
  mode: string;
  previousMode?: string;
  showTransition?: boolean;
}

export const ModeChangeIndicator: React.FC<ModeChangeIndicatorProps> = ({
  mode,
  previousMode,
  showTransition = true,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (showTransition && previousMode && previousMode !== mode) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mode, previousMode, showTransition]);

  const getModeColor = (modeName: string): string => {
    switch (modeName.toLowerCase()) {
      case 'normal':
        return 'green';
      case 'insert':
        return 'blue';
      case 'command':
        return 'yellow';
      case 'visual':
        return 'magenta';
      case 'search':
        return 'cyan';
      default:
        return 'white';
    }
  };

  const getModeIcon = (modeName: string): string => {
    switch (modeName.toLowerCase()) {
      case 'normal':
        return '📝';
      case 'insert':
        return '✏️';
      case 'command':
        return '⚡';
      case 'visual':
        return '👁️';
      case 'search':
        return '🔍';
      default:
        return '📋';
    }
  };

  return (
    <Box>
      {isTransitioning && previousMode && (
        <Text color="gray" strikethrough>
          {previousMode.toUpperCase()}
        </Text>
      )}
      <Box borderStyle="single" borderColor={getModeColor(mode)} paddingX={1}>
        <Text color={getModeColor(mode)} bold>
          {getModeIcon(mode)} {mode.toUpperCase()}
        </Text>
      </Box>
    </Box>
  );
};

export interface CommandExecutionFeedbackProps {
  command: string | null;
  status: 'pending' | 'executing' | 'success' | 'error' | null;
  message?: string;
}

export const CommandExecutionFeedback: React.FC<CommandExecutionFeedbackProps> = ({
  command,
  status,
  message,
}) => {
  if (!command || !status) return null;

  const getStatusIcon = (): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'executing':
        return '⚡';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'executing':
        return 'yellow';
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      default:
        return 'white';
    }
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {command}
        </Text>
      </Box>
      {message && (
        <Box marginLeft={2}>
          <Text dimColor>{message}</Text>
        </Box>
      )}
    </Box>
  );
};

export interface ConnectionStatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting';
  quality?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  showDetails?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  status,
  quality,
  showDetails = false,
}) => {
  const statusIndicators = new StatusIndicators();
  statusIndicators.setConnectionStatus(status);
  
  const getQualityBars = (): string => {
    switch (quality) {
      case 'excellent':
        return '████';
      case 'good':
        return '███░';
      case 'fair':
        return '██░░';
      case 'poor':
        return '█░░░';
      case 'critical':
        return '░░░░';
      default:
        return '░░░░';
    }
  };

  const getQualityColor = (): string => {
    switch (quality) {
      case 'excellent':
        return 'green';
      case 'good':
        return 'greenBright';
      case 'fair':
        return 'yellow';
      case 'poor':
        return 'red';
      case 'critical':
        return 'redBright';
      default:
        return 'gray';
    }
  };

  return (
    <Box>
      <Text>{statusIndicators.getConnectionIndicator()}</Text>
      {showDetails && (
        <>
          <Text> {statusIndicators.getConnectionLabel()}</Text>
          {quality && (
            <Text color={getQualityColor()}>
              {' '}[{getQualityBars()}]
            </Text>
          )}
        </>
      )}
    </Box>
  );
};

export interface NotificationBadgeProps {
  count: number;
  type?: 'info' | 'warning' | 'error' | 'success';
  max?: number;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  type = 'info',
  max = 99,
}) => {
  if (count === 0) return null;

  const getColor = (): string => {
    switch (type) {
      case 'error':
        return 'red';
      case 'warning':
        return 'yellow';
      case 'success':
        return 'green';
      case 'info':
      default:
        return 'blue';
    }
  };

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <Box>
      <Text backgroundColor={getColor()} color="white" bold>
        {' '}{displayCount}{' '}
      </Text>
    </Box>
  );
};

export interface ToolStatusIndicatorProps {
  toolName: string;
  status: 'idle' | 'running' | 'success' | 'error';
  progress?: number;
  message?: string;
}

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({
  toolName,
  status,
  progress,
  message,
}) => {
  const getIcon = (): string => {
    const toolIcons: Record<string, string> = {
      'search': '🔍',
      'edit': '✏️',
      'compile': '🔨',
      'test': '🧪',
      'deploy': '🚀',
      'analyze': '📊',
      'debug': '🐛',
    };
    return toolIcons[toolName.toLowerCase()] || '⚙️';
  };

  const getStatusIcon = (): string => {
    switch (status) {
      case 'idle':
        return '⏸️';
      case 'running':
        return '⚡';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'idle':
        return 'gray';
      case 'running':
        return 'yellow';
      case 'success':
        return 'green';
      case 'error':
        return 'red';
    }
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{getIcon()}</Text>
        <Text color={getStatusColor()}>
          {' '}{toolName} {getStatusIcon()}
        </Text>
        {progress !== undefined && status === 'running' && (
          <Text dimColor> {Math.floor(progress)}%</Text>
        )}
      </Box>
      {message && (
        <Box marginLeft={2}>
          <Text dimColor italic>{message}</Text>
        </Box>
      )}
    </Box>
  );
};

export interface InputModeFeedbackProps {
  mode: string;
  hint?: string;
  showKeyBindings?: boolean;
}

export const InputModeFeedback: React.FC<InputModeFeedbackProps> = ({
  mode,
  hint,
  showKeyBindings = false,
}) => {
  const getKeyBindings = (modeName: string): string[] => {
    switch (modeName.toLowerCase()) {
      case 'normal':
        return ['i: insert', 'v: visual', '/: search', ':: command'];
      case 'insert':
        return ['Esc: normal mode', 'Ctrl+W: delete word'];
      case 'visual':
        return ['Esc: normal mode', 'y: yank', 'd: delete'];
      case 'search':
        return ['Enter: search', 'Esc: cancel'];
      case 'command':
        return ['Enter: execute', 'Tab: complete', 'Esc: cancel'];
      default:
        return [];
    }
  };

  return (
    <Box flexDirection="column">
      <ModeChangeIndicator mode={mode} />
      {hint && (
        <Box marginTop={1}>
          <Text dimColor italic>{hint}</Text>
        </Box>
      )}
      {showKeyBindings && (
        <Box marginTop={1}>
          <Text dimColor>
            {getKeyBindings(mode).join(' | ')}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export interface ErrorFeedbackProps {
  error: string | null;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const ErrorFeedback: React.FC<ErrorFeedbackProps> = ({
  error,
  severity = 'error',
  dismissible = true,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [error]);

  if (!error || !visible) return null;

  const getIcon = (): string => {
    switch (severity) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🚨';
    }
  };

  const getColor = (): string => {
    switch (severity) {
      case 'info':
        return 'blue';
      case 'warning':
        return 'yellow';
      case 'error':
        return 'red';
      case 'critical':
        return 'redBright';
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <Box borderStyle="round" borderColor={getColor()} paddingX={1} flexDirection="column">
      <Box>
        <Text color={getColor()}>
          {getIcon()} {error}
        </Text>
      </Box>
      {dismissible && (
        <Box marginTop={1}>
          <Text dimColor italic>Press ESC to dismiss</Text>
        </Box>
      )}
    </Box>
  );
};