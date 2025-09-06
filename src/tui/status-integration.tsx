/**
 * Status System Integration
 * Connects the status components with the existing TUI keyboard handler and orchestrator
 */

import React, { useContext, createContext, useCallback, useEffect, useState } from 'react';
import { EventEmitter } from 'events';
import { StatusManager, ConversationState, StatusMetrics } from './status-manager.js';
import { StatusLine } from './status-line.js';
import { ProgressBar } from './progress-bar.js';
import { Box } from 'ink';
import { loadStatusConfig, saveStatusConfig } from './status-config.js';

// Status context for sharing across components
interface StatusContextValue {
  statusManager: StatusManager;
  metrics: StatusMetrics;
  state: ConversationState;
  config: StatusConfig;
  updateConfig: (config: Partial<StatusConfig>) => void;
}

export interface StatusConfig {
  enabled: boolean;
  position: 'top' | 'bottom';
  showStatusLine: boolean;
  showProgressBar: boolean;
  compactMode: boolean;
  theme: 'light' | 'dark';
  updateInterval: number;
  visibleMetrics: Array<keyof StatusMetrics>;
  progressBarWidth: number;
  showStreamingProgress: boolean;
  showToolCallProgress: boolean;
  pulseOnUpdate: boolean;
  showSpinner: boolean;
}

const defaultConfig: StatusConfig = {
  enabled: true,
  position: 'bottom',
  showStatusLine: true,
  showProgressBar: true,
  compactMode: false,
  theme: 'dark',
  updateInterval: 500,
  visibleMetrics: ['totalTokens', 'responseTime', 'memoryUsageMB'],
  progressBarWidth: 30,
  showStreamingProgress: true,
  showToolCallProgress: true,
  pulseOnUpdate: false,
  showSpinner: true
};

const StatusContext = createContext<StatusContextValue | null>(null);

export const useStatus = () => {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error('useStatus must be used within StatusProvider');
  }
  return context;
};

interface StatusProviderProps {
  children: React.ReactNode;
  eventEmitter: EventEmitter;
  initialConfig?: Partial<StatusConfig>;
}

export const StatusProvider: React.FC<StatusProviderProps> = ({
  children,
  eventEmitter,
  initialConfig
}) => {
  const [config, setConfig] = useState<StatusConfig>(defaultConfig);
  
  // Load configuration from file on mount
  useEffect(() => {
    loadStatusConfig().then(loadedConfig => {
      setConfig({
        ...loadedConfig,
        ...initialConfig // Allow initialConfig to override file config
      });
    });
  }, [initialConfig]);
  
  const [statusManager] = useState(() => new StatusManager(eventEmitter));
  const [metrics, setMetrics] = useState<StatusMetrics>(statusManager.getMetrics());
  const [state, setState] = useState<ConversationState>(statusManager.getState());

  // Subscribe to status manager events
  useEffect(() => {
    const handleMetricsUpdate = (newMetrics: StatusMetrics) => {
      setMetrics(newMetrics);
    };

    const handleStateChange = ({ newState }: { newState: ConversationState }) => {
      setState(newState);
    };

    eventEmitter.on('status:metricsUpdate', handleMetricsUpdate);
    eventEmitter.on('status:stateChange', handleStateChange);

    return () => {
      eventEmitter.off('status:metricsUpdate', handleMetricsUpdate);
      eventEmitter.off('status:stateChange', handleStateChange);
      statusManager.destroy();
    };
  }, [statusManager, eventEmitter]);

  const updateConfig = useCallback((updates: Partial<StatusConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      // Save to file asynchronously
      saveStatusConfig(newConfig).catch(err => 
        console.error('Failed to save status config:', err)
      );
      return newConfig;
    });
  }, []);

  const value: StatusContextValue = {
    statusManager,
    metrics,
    state,
    config,
    updateConfig
  };

  return (
    <StatusContext.Provider value={value}>
      {children}
    </StatusContext.Provider>
  );
};

interface StatusDisplayProps {
  position?: 'top' | 'bottom';
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ position }) => {
  const { metrics, state, config } = useStatus();

  if (!config.enabled) {
    return null;
  }

  const actualPosition = position || config.position;

  return (
    <Box
      flexDirection="column"
      marginTop={actualPosition === 'top' ? 0 : 1}
      marginBottom={actualPosition === 'bottom' ? 0 : 1}
    >
      {config.showStatusLine && (
        <StatusLine
          metrics={metrics}
          state={state}
          compact={config.compactMode}
          position={actualPosition}
          theme={config.theme}
          showSpinner={config.showSpinner}
          pulseOnUpdate={config.pulseOnUpdate}
          visibleMetrics={config.visibleMetrics}
        />
      )}
      
      {config.showProgressBar && (
        state === 'streaming' && config.showStreamingProgress ? (
          <Box marginTop={1}>
            <ProgressBar
              current={metrics.charactersStreamed}
              total={metrics.charactersStreamed > 0 ? Math.max(metrics.charactersStreamed * 2, 1000) : 1000}
              width={config.progressBarWidth}
              showPercentage={true}
              streaming={true}
              label="Streaming"
              colorByProgress={true}
            />
          </Box>
        ) : state === 'processing' && config.showToolCallProgress && metrics.activeToolCall ? (
          <Box marginTop={1}>
            <ProgressBar
              indeterminate={true}
              indeterminateLabel={`Processing: ${metrics.activeToolCall}`}
              width={config.progressBarWidth}
            />
          </Box>
        ) : null
      )}
    </Box>
  );
};

// Hook for orchestrator integration
export const useOrchestratorIntegration = (statusManager: StatusManager) => {
  const handleResponseStart = useCallback(() => {
    statusManager.startStreaming();
  }, [statusManager]);

  const handleResponseChunk = useCallback((chunk: string) => {
    const currentChars = statusManager.getMetrics().charactersStreamed;
    // Estimate total based on typical response size
    const estimatedTotal = Math.max(currentChars * 2, 1000);
    statusManager.updateStreamProgress(currentChars + chunk.length, estimatedTotal);
  }, [statusManager]);

  const handleResponseEnd = useCallback((input: number, output: number) => {
    statusManager.updateTokens(input, output);
    statusManager.complete();
  }, [statusManager]);

  const handleToolCallStart = useCallback((tool: string, params: any) => {
    statusManager.startToolCall(tool, params);
  }, [statusManager]);

  const handleToolCallEnd = useCallback((tool: string, success: boolean, error?: string) => {
    statusManager.endToolCall(tool, { success, error });
  }, [statusManager]);

  const handleError = useCallback((error: string) => {
    statusManager.setError(error);
  }, [statusManager]);

  const handleTurnStart = useCallback((message: string) => {
    statusManager.startTurn('user', message);
  }, [statusManager]);

  const handleTurnEnd = useCallback((response: string) => {
    statusManager.endTurn('assistant', response);
  }, [statusManager]);

  return {
    handleResponseStart,
    handleResponseChunk,
    handleResponseEnd,
    handleToolCallStart,
    handleToolCallEnd,
    handleError,
    handleTurnStart,
    handleTurnEnd
  };
};

// Keyboard handler integration
export const StatusKeyboardHandlers = {
  'ctrl+s': (statusManager: StatusManager, updateConfig: (config: Partial<StatusConfig>) => void) => {
    // Toggle status display
    updateConfig(prev => ({ enabled: !prev.enabled }));
  },
  'ctrl+shift+s': (statusManager: StatusManager, updateConfig: (config: Partial<StatusConfig>) => void) => {
    // Toggle compact mode
    updateConfig(prev => ({ compactMode: !prev.compactMode }));
  },
  'ctrl+shift+p': (statusManager: StatusManager, updateConfig: (config: Partial<StatusConfig>) => void) => {
    // Toggle progress bar
    updateConfig(prev => ({ showProgressBar: !prev.showProgressBar }));
  },
  'ctrl+shift+m': (statusManager: StatusManager) => {
    // Clear metrics
    statusManager.clearHistory();
  }
};

// Export configuration helpers
export const loadStatusConfig = (): Partial<StatusConfig> => {
  try {
    const stored = localStorage.getItem('plato-status-config');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const saveStatusConfig = (config: StatusConfig): void => {
  try {
    localStorage.setItem('plato-status-config', JSON.stringify(config));
  } catch {
    // Ignore errors
  }
};

// Helper component for terminal size detection
export const useTerminalSize = () => {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24
      });
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  return size;
};

// Auto-compact mode based on terminal size
export const useAutoCompact = (threshold: number = 100) => {
  const { columns } = useTerminalSize();
  const { updateConfig } = useStatus();

  useEffect(() => {
    updateConfig({ compactMode: columns < threshold });
  }, [columns, threshold, updateConfig]);
};