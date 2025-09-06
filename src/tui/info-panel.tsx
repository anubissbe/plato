/**
 * InfoPanel Component
 * Displays context information, memory view, and tool output
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from './panel.js';

export interface InfoPanelProps {
  width: number;
  height?: number;
  visible: boolean;
  collapsed: boolean;
  focused: boolean;
  memoryEntries?: Array<{ key: string; value: string; timestamp?: Date }>;
  contextFiles?: string[];
  toolOutput?: string;
  metrics?: {
    tokens?: number;
    responseTime?: number;
    memoryUsage?: number;
  };
  onCollapse?: () => void;
  onExpand?: () => void;
  onFocus?: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  width,
  height,
  visible,
  collapsed,
  focused,
  memoryEntries = [],
  contextFiles = [],
  toolOutput,
  metrics,
  onCollapse,
  onExpand,
  onFocus
}) => {
  const renderContent = () => {
    return (
      <Box flexDirection="column" gap={1}>
        {/* Context Files Section */}
        {contextFiles.length > 0 && (
          <Box flexDirection="column">
            <Text color="cyan" bold>📁 Context Files</Text>
            {contextFiles.slice(0, 5).map((file, i) => (
              <Text key={i} color="gray"> • {file}</Text>
            ))}
            {contextFiles.length > 5 && (
              <Text color="dim"> ... and {contextFiles.length - 5} more</Text>
            )}
          </Box>
        )}
        
        {/* Memory Section */}
        {memoryEntries.length > 0 && (
          <Box flexDirection="column">
            <Text color="green" bold>🧠 Memory</Text>
            {memoryEntries.slice(0, 3).map((entry, i) => (
              <Box key={i} flexDirection="column">
                <Text color="yellow"> {entry.key}:</Text>
                <Text color="gray">  {entry.value.substring(0, 50)}...</Text>
              </Box>
            ))}
          </Box>
        )}
        
        {/* Tool Output Section */}
        {toolOutput && (
          <Box flexDirection="column">
            <Text color="magenta" bold>🔧 Tool Output</Text>
            <Text color="gray">{toolOutput.substring(0, 200)}</Text>
          </Box>
        )}
        
        {/* Metrics Section */}
        {metrics && (
          <Box flexDirection="column">
            <Text color="blue" bold>📊 Metrics</Text>
            {metrics.tokens && <Text color="gray"> Tokens: {metrics.tokens}</Text>}
            {metrics.responseTime && <Text color="gray"> Response: {metrics.responseTime}ms</Text>}
            {metrics.memoryUsage && <Text color="gray"> Memory: {metrics.memoryUsage}MB</Text>}
          </Box>
        )}
      </Box>
    );
  };
  
  const statusBar = metrics 
    ? `T:${metrics.tokens || 0} | ${metrics.responseTime || 0}ms`
    : undefined;
  
  return (
    <Panel
      id="info"
      title="Information"
      type="info"
      width={width}
      height={height}
      visible={visible}
      collapsed={collapsed}
      focused={focused}
      resizable={true}
      collapsible={true}
      scrollable={true}
      statusBar={statusBar}
      actions={[
        { key: 'refresh', label: '⟳', handler: () => {} },
        { key: 'clear', label: '✕', handler: () => {} }
      ]}
      onCollapse={onCollapse}
      onExpand={onExpand}
      onFocus={onFocus}
    >
      {renderContent()}
    </Panel>
  );
};