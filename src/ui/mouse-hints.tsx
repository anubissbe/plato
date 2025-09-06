/**
 * Mouse Hints and Tooltips Component
 * Interactive UI hints and tooltips for mouse functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useStdin } from 'ink';
import type { MouseEvent, MouseCoordinates } from '../tui/mouse-types.js';
import type { MouseSettings } from '../config/mouse-settings.js';
import type { GuidanceMessage } from './mouse-guidance.js';

/**
 * Tooltip configuration
 */
interface TooltipConfig {
  /** Tooltip content */
  content: string;
  /** Position relative to trigger element */
  position: 'above' | 'below' | 'left' | 'right' | 'auto';
  /** Show delay in milliseconds */
  delay: number;
  /** Auto-hide timeout in milliseconds (0 = no auto-hide) */
  timeout: number;
  /** Maximum width in characters */
  maxWidth: number;
}

/**
 * Hint display configuration
 */
interface HintConfig {
  /** Hint text */
  text: string;
  /** Hint type affects styling */
  type: 'info' | 'warning' | 'success' | 'error';
  /** Hint position */
  position: MouseCoordinates;
  /** Duration to show hint (ms) */
  duration: number;
  /** Whether hint is dismissible */
  dismissible: boolean;
}

/**
 * Component props
 */
interface MouseHintsProps {
  /** Current mouse settings */
  settings: MouseSettings;
  /** Current mouse position */
  mousePosition?: MouseCoordinates;
  /** Active guidance messages */
  guidanceMessages?: GuidanceMessage[];
  /** Current UI bounds for positioning */
  uiBounds: {
    width: number;
    height: number;
  };
  /** Whether to show interactive hints */
  showHints: boolean;
  /** Callback when hint is dismissed */
  onHintDismiss?: (hintId: string) => void;
  /** Callback when tooltip is shown */
  onTooltipShow?: (tooltip: string) => void;
}

/**
 * Active hint state
 */
interface ActiveHint {
  id: string;
  config: HintConfig;
  startTime: number;
}

/**
 * Tooltip state
 */
interface TooltipState {
  visible: boolean;
  content: string;
  position: MouseCoordinates;
  config: TooltipConfig;
}

/**
 * Default tooltip configuration
 */
const DEFAULT_TOOLTIP_CONFIG: TooltipConfig = {
  content: '',
  position: 'auto',
  delay: 100,
  timeout: 0,
  maxWidth: 40,
};

/**
 * Mouse Hints Component
 */
export const MouseHints: React.FC<MouseHintsProps> = ({
  settings,
  mousePosition,
  guidanceMessages = [],
  uiBounds,
  showHints,
  onHintDismiss,
  onTooltipShow,
}) => {
  const [activeHints, setActiveHints] = useState<Map<string, ActiveHint>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  
  const hintTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const { stdin } = useStdin();

  // Handle mouse events for tooltips and hints
  useEffect(() => {
    if (!settings.enabled || !showHints) return;

    const handleMouseMove = (data: Buffer) => {
      // This would be integrated with the actual mouse event system
      // For now, we'll simulate based on mousePosition prop
      if (mousePosition) {
        updateHoverTarget(mousePosition);
      }
    };

    if (stdin) {
      stdin.on('data', handleMouseMove);
      return () => {
        stdin.off('data', handleMouseMove);
      };
    }
  }, [settings.enabled, showHints, mousePosition, stdin]);

  // Auto-hide hints based on duration
  useEffect(() => {
    const now = Date.now();
    const expiredHints: string[] = [];

    activeHints.forEach((hint, id) => {
      if (hint.config.duration > 0 && now - hint.startTime > hint.config.duration) {
        expiredHints.push(id);
      }
    });

    if (expiredHints.length > 0) {
      setActiveHints(prev => {
        const newMap = new Map(prev);
        expiredHints.forEach(id => {
          newMap.delete(id);
          const timeout = hintTimeouts.current.get(id);
          if (timeout) {
            clearTimeout(timeout);
            hintTimeouts.current.delete(id);
          }
        });
        return newMap;
      });
    }
  }, [activeHints]);

  // Convert guidance messages to hints
  useEffect(() => {
    if (!showHints || guidanceMessages.length === 0) return;

    guidanceMessages.forEach(message => {
      if (!activeHints.has(message.title)) {
        showHint({
          id: message.title,
          config: {
            text: `${message.title}: ${message.message}`,
            type: getHintTypeFromGuidance(message.type),
            position: getGuidancePosition(message, uiBounds),
            duration: message.priority === 'critical' ? 0 : 5000, // Critical messages don't auto-hide
            dismissible: message.dismissible ?? true,
          },
        });
      }
    });
  }, [guidanceMessages, showHints, activeHints, uiBounds]);

  /**
   * Show a new hint
   */
  const showHint = (hint: { id: string; config: HintConfig }) => {
    const activeHint: ActiveHint = {
      ...hint,
      startTime: Date.now(),
    };

    setActiveHints(prev => new Map(prev.set(hint.id, activeHint)));

    // Set auto-hide timeout if duration is specified
    if (hint.config.duration > 0) {
      const timeout = setTimeout(() => {
        dismissHint(hint.id);
      }, hint.config.duration);
      hintTimeouts.current.set(hint.id, timeout);
    }
  };

  /**
   * Dismiss a hint
   */
  const dismissHint = (hintId: string) => {
    setActiveHints(prev => {
      const newMap = new Map(prev);
      newMap.delete(hintId);
      return newMap;
    });

    const timeout = hintTimeouts.current.get(hintId);
    if (timeout) {
      clearTimeout(timeout);
      hintTimeouts.current.delete(hintId);
    }

    onHintDismiss?.(hintId);
  };

  /**
   * Show tooltip for current hover target
   */
  const showTooltip = (target: string, position: MouseCoordinates) => {
    const content = getTooltipContent(target);
    if (!content) return;

    // Clear existing tooltip timeout
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = null;
    }

    const config = { ...DEFAULT_TOOLTIP_CONFIG, content };
    const adjustedPosition = adjustTooltipPosition(position, config, uiBounds);

    // Show tooltip after delay
    tooltipTimeout.current = setTimeout(() => {
      setTooltip({
        visible: true,
        content,
        position: adjustedPosition,
        config,
      });
      onTooltipShow?.(content);

      // Auto-hide tooltip if timeout is set
      if (config.timeout > 0) {
        tooltipTimeout.current = setTimeout(() => {
          hideTooltip();
        }, config.timeout);
      }
    }, config.delay);
  };

  /**
   * Hide current tooltip
   */
  const hideTooltip = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = null;
    }
    setTooltip(null);
  };

  /**
   * Update hover target based on mouse position
   */
  const updateHoverTarget = (position: MouseCoordinates) => {
    const target = getUIElementAtPosition(position);
    
    if (target !== hoverTarget) {
      hideTooltip();
      setHoverTarget(target);
      
      if (target && settings.hoverDelay >= 0) {
        showTooltip(target, position);
      }
    }
  };

  /**
   * Dismiss welcome message
   */
  const dismissWelcome = () => {
    setShowWelcome(false);
    onHintDismiss?.('welcome');
  };

  // Don't render anything if mouse is disabled or hints are disabled
  if (!settings.enabled || !showHints) {
    return null;
  }

  return (
    <>
      {/* Welcome message */}
      {showWelcome && settings.enabled && (
        <Box
          position="absolute"
          top={1}
          right={1}
          width={Math.min(50, uiBounds.width - 4)}
          paddingX={1}
          borderStyle="round"
          borderColor="blue"
        >
          <Box flexDirection="column">
            <Text color="blue" bold>
              🖱️ Mouse Enabled
            </Text>
            <Text color="gray">
              Click, drag, and scroll in the interface.
            </Text>
            <Text color="gray" dimColor>
              Use /mouse help for options • Press Esc to dismiss
            </Text>
            <Box marginTop={1} justifyContent="flex-end">
              <Text color="yellow" dimColor>
                [Esc to dismiss]
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Active hints */}
      {Array.from(activeHints.values()).map((hint) => (
        <MouseHint
          key={hint.id}
          hint={hint}
          onDismiss={() => dismissHint(hint.id)}
          uiBounds={uiBounds}
        />
      ))}

      {/* Tooltip */}
      {tooltip && tooltip.visible && (
        <MouseTooltip
          tooltip={tooltip}
          onDismiss={hideTooltip}
        />
      )}
    </>
  );
};

/**
 * Individual hint component
 */
interface MouseHintProps {
  hint: ActiveHint;
  onDismiss: () => void;
  uiBounds: { width: number; height: number };
}

const MouseHint: React.FC<MouseHintProps> = ({ hint, onDismiss, uiBounds }) => {
  const typeColors = {
    info: 'blue',
    warning: 'yellow',
    success: 'green',
    error: 'red',
  } as const;

  const typeIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    error: '❌',
  } as const;

  const maxWidth = Math.min(60, uiBounds.width - 4);
  const position = {
    top: Math.max(0, Math.min(hint.config.position.y, uiBounds.height - 6)),
    left: Math.max(0, Math.min(hint.config.position.x, uiBounds.width - maxWidth)),
  };

  return (
    <Box
      position="absolute"
      top={position.top}
      left={position.left}
      width={maxWidth}
      paddingX={1}
      paddingY={1}
      borderStyle="round"
      borderColor={typeColors[hint.config.type]}
    >
      <Box flexDirection="column">
        <Box>
          <Text color={typeColors[hint.config.type]}>
            {typeIcons[hint.config.type]} 
          </Text>
          <Text color={typeColors[hint.config.type]} bold>
            {hint.config.text.split(':')[0]}
          </Text>
        </Box>
        <Text color="gray">
          {hint.config.text.split(':').slice(1).join(':').trim()}
        </Text>
        {hint.config.dismissible && (
          <Box marginTop={1} justifyContent="flex-end">
            <Text color="gray" dimColor>
              [Press Esc to dismiss]
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * Tooltip component
 */
interface MouseTooltipProps {
  tooltip: TooltipState;
  onDismiss: () => void;
}

const MouseTooltip: React.FC<MouseTooltipProps> = ({ tooltip, onDismiss }) => {
  return (
    <Box
      position="absolute"
      top={tooltip.position.y}
      left={tooltip.position.x}
      maxWidth={tooltip.config.maxWidth}
      paddingX={1}
      borderStyle="round"
      borderColor="gray"
      backgroundColor="black"
    >
      <Text color="white">
        {tooltip.content}
      </Text>
    </Box>
  );
};

/**
 * Helper functions
 */

/**
 * Convert guidance message type to hint type
 */
function getHintTypeFromGuidance(guidanceType: string): HintConfig['type'] {
  const typeMap: Record<string, HintConfig['type']> = {
    welcome: 'info',
    capability_warning: 'warning',
    feature_disabled: 'warning',
    usage_tip: 'info',
    troubleshooting: 'warning',
    performance_warning: 'warning',
    accessibility: 'info',
  };
  
  return typeMap[guidanceType] || 'info';
}

/**
 * Get position for guidance message
 */
function getGuidancePosition(
  message: GuidanceMessage,
  bounds: { width: number; height: number }
): MouseCoordinates {
  // Position based on message type
  const positions: Record<string, MouseCoordinates> = {
    welcome: { x: bounds.width - 52, y: 1 },
    capability_warning: { x: 2, y: bounds.height - 8 },
    performance_warning: { x: bounds.width - 52, y: bounds.height - 8 },
    troubleshooting: { x: 2, y: 2 },
    usage_tip: { x: Math.floor(bounds.width / 2) - 25, y: bounds.height - 6 },
    accessibility: { x: 2, y: bounds.height - 12 },
  };
  
  return positions[message.type] || { x: 2, y: 2 };
}

/**
 * Get tooltip content for UI element
 */
function getTooltipContent(target: string): string {
  const tooltips: Record<string, string> = {
    'chat-input': 'Type your message here. Press Enter to send.',
    'chat-output': 'Chat response area. Scroll to see more.',
    'status-bar': 'Current status and connection info.',
    'menu-button': 'Click to open menu options.',
    'scroll-area': 'Use mouse wheel to scroll content.',
    'selection': 'Selected text. Right-click for options.',
  };
  
  return tooltips[target] || '';
}

/**
 * Get UI element at given position (simplified)
 */
function getUIElementAtPosition(position: MouseCoordinates): string | null {
  // This would integrate with actual UI layout detection
  // For now, return based on position heuristics
  
  if (position.y < 5) return 'status-bar';
  if (position.y > 20) return 'chat-input';
  return 'chat-output';
}

/**
 * Adjust tooltip position to stay within bounds
 */
function adjustTooltipPosition(
  position: MouseCoordinates,
  config: TooltipConfig,
  bounds: { width: number; height: number }
): MouseCoordinates {
  let { x, y } = position;
  
  // Adjust for tooltip size
  const tooltipWidth = Math.min(config.maxWidth, 30);
  const tooltipHeight = 3; // Approximate height
  
  // Keep within horizontal bounds
  if (x + tooltipWidth > bounds.width) {
    x = bounds.width - tooltipWidth - 2;
  }
  if (x < 0) x = 2;
  
  // Keep within vertical bounds  
  if (y + tooltipHeight > bounds.height) {
    y = Math.max(0, y - tooltipHeight - 2); // Show above cursor
  }
  if (y < 0) y = 2;
  
  return { x, y };
}

export default MouseHints;
