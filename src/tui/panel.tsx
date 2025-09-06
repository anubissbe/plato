/**
 * Panel Component
 * Renders individual panels with borders, resize handles, and collapse controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useFocus } from 'ink';
import type { PanelType } from './layout-manager.js';

export interface PanelAction {
  key: string;
  label: string;
  handler: () => void;
}

export interface PanelProps {
  id: string;
  title: string;
  type?: PanelType;
  width: number;
  height?: number;
  visible: boolean;
  collapsed: boolean;
  focused: boolean;
  resizable?: boolean;
  collapsible?: boolean;
  scrollable?: boolean;
  statusBar?: string;
  actions?: PanelAction[];
  children: React.ReactNode;
  onResize?: (width: number) => void;
  onCollapse?: () => void;
  onExpand?: () => void;
  onFocus?: () => void;
}

// Box-drawing characters for borders
const BORDERS = {
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
    teeLeft: '├',
    teeRight: '┤',
    teeTop: '┬',
    teeBottom: '┴'
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    cross: '╬',
    teeLeft: '╠',
    teeRight: '╣',
    teeTop: '╦',
    teeBottom: '╩'
  }
};

export const Panel: React.FC<PanelProps> = ({
  id,
  title,
  type = 'conversation',
  width,
  height,
  visible,
  collapsed,
  focused,
  resizable = true,
  collapsible = true,
  scrollable = false,
  statusBar,
  actions = [],
  children,
  onResize,
  onCollapse,
  onExpand,
  onFocus
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<{ height: number }>({ height: 0 });
  
  // Use double borders for focused panels
  const border = focused ? BORDERS.double : BORDERS.single;
  const borderColor = focused ? 'cyan' : 'gray';
  
  // Handle keyboard input for focused panel
  useInput((input, key) => {
    if (!focused) return;
    
    // Panel-specific keyboard shortcuts
    if (key.ctrl) {
      if (input === 'w' && collapsible) {
        collapsed ? onExpand?.() : onCollapse?.();
      }
    }
    
    // Scrolling
    if (scrollable) {
      if (key.upArrow) {
        setScrollOffset(Math.max(0, scrollOffset - 1));
      } else if (key.downArrow) {
        const maxScroll = Math.max(0, contentHeight - (height || 20) + 2);
        setScrollOffset(Math.min(maxScroll, scrollOffset + 1));
      } else if (key.pageUp) {
        setScrollOffset(Math.max(0, scrollOffset - 10));
      } else if (key.pageDown) {
        const maxScroll = Math.max(0, contentHeight - (height || 20) + 2);
        setScrollOffset(Math.min(maxScroll, scrollOffset + 10));
      }
    }
  }, { isActive: focused });
  
  // Don't render if not visible
  if (!visible) {
    return null;
  }
  
  // Calculate actual dimensions
  const actualWidth = Math.max(10, width);
  const actualHeight = height || 20;
  const innerWidth = actualWidth - 2;
  const innerHeight = collapsed ? 1 : actualHeight - 3; // Account for borders and status
  
  // Build header with title and controls
  const renderHeader = () => {
    const collapseIndicator = collapsible ? (collapsed ? '[▼]' : '[▽]') : '';
    const titleText = `${collapseIndicator} ${title}`.substring(0, innerWidth - actions.length * 4 - 2);
    const actionsText = actions.map(a => a.label).join(' ');
    
    const padding = innerWidth - titleText.length - actionsText.length;
    const paddingStr = padding > 0 ? ' '.repeat(padding) : '';
    
    return (
      <Box>
        <Text color={borderColor}>{border.topLeft}</Text>
        <Text color={borderColor} bold={focused}>
          {titleText}
        </Text>
        <Text color={borderColor}>{paddingStr}</Text>
        <Text color="yellow">{actionsText}</Text>
        <Text color={borderColor}>{border.topRight}</Text>
      </Box>
    );
  };
  
  // Render panel content with borders
  const renderContent = () => {
    if (collapsed) {
      return null;
    }
    
    const lines = React.Children.toArray(children)
      .join('\n')
      .split('\n')
      .slice(scrollOffset, scrollOffset + innerHeight);
    
    return lines.map((line, index) => (
      <Box key={index}>
        <Text color={borderColor}>{border.vertical}</Text>
        <Box width={innerWidth} paddingX={1}>
          <Text>{String(line).substring(0, innerWidth - 2)}</Text>
        </Box>
        <Text color={borderColor}>{border.vertical}</Text>
      </Box>
    ));
  };
  
  // Render scroll indicators
  const renderScrollIndicators = () => {
    if (!scrollable || collapsed) return null;
    
    const hasScrollUp = scrollOffset > 0;
    const hasScrollDown = contentHeight > scrollOffset + innerHeight;
    
    return (
      <Box position="absolute" marginLeft={actualWidth - 3}>
        {hasScrollUp && (
          <Box marginTop={1}>
            <Text color="cyan">▲</Text>
          </Box>
        )}
        {hasScrollDown && (
          <Box marginTop={innerHeight - 1}>
            <Text color="cyan">▼</Text>
          </Box>
        )}
      </Box>
    );
  };
  
  // Render resize handle
  const renderResizeHandle = () => {
    if (!resizable || collapsed) return null;
    
    return (
      <Box position="absolute" marginLeft={actualWidth - 1}>
        {Array(innerHeight).fill(0).map((_, i) => (
          <Box key={i} marginTop={i + 1}>
            <Text color={focused ? 'cyan' : 'gray'}>║</Text>
          </Box>
        ))}
      </Box>
    );
  };
  
  // Render status bar
  const renderStatusBar = () => {
    if (!statusBar && !collapsed) {
      // Just bottom border
      return (
        <Box>
          <Text color={borderColor}>{border.bottomLeft}</Text>
          <Text color={borderColor}>{border.horizontal.repeat(innerWidth)}</Text>
          <Text color={borderColor}>{border.bottomRight}</Text>
        </Box>
      );
    }
    
    if (statusBar && !collapsed) {
      const statusText = statusBar.substring(0, innerWidth - 2);
      const padding = innerWidth - statusText.length;
      const paddingStr = padding > 0 ? border.horizontal.repeat(padding) : '';
      
      return (
        <Box>
          <Text color={borderColor}>{border.bottomLeft}</Text>
          <Text color="dim"> {statusText} </Text>
          <Text color={borderColor}>{paddingStr}</Text>
          <Text color={borderColor}>{border.bottomRight}</Text>
        </Box>
      );
    }
    
    // Collapsed - simple line
    return (
      <Box>
        <Text color={borderColor}>{border.bottomLeft}</Text>
        <Text color={borderColor}>{border.horizontal.repeat(innerWidth)}</Text>
        <Text color={borderColor}>{border.bottomRight}</Text>
      </Box>
    );
  };
  
  return (
    <Box
      flexDirection="column"
      width={actualWidth}
      height={collapsed ? 3 : actualHeight}
    >
      {renderHeader()}
      {!collapsed && (
        <Box flexDirection="column" height={innerHeight}>
          {renderContent()}
          {renderScrollIndicators()}
          {renderResizeHandle()}
        </Box>
      )}
      {renderStatusBar()}
    </Box>
  );
};