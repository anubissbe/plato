/**
 * Interactive Analytics Table Component
 * Displays cost metrics in a formatted table with interactive features
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import type { CostMetric, AnalyticsQueryOptions } from '../services/analytics-types.js';

export interface AnalyticsTableProps {
  metrics: CostMetric[];
  options?: AnalyticsQueryOptions;
  interactive?: boolean;
  onRowSelect?: (metric: CostMetric) => void;
  onSort?: (field: keyof CostMetric) => void;
  sortField?: keyof CostMetric;
  sortDirection?: 'asc' | 'desc';
  selectedIndex?: number;
  compactMode?: boolean;
  showTotals?: boolean;
}

interface ColumnDefinition {
  key: keyof CostMetric | 'index';
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: any, metric?: CostMetric) => string;
  color?: (value: any, metric?: CostMetric) => string;
}

/**
 * Format currency values with appropriate precision
 */
const formatCurrency = (value: number): string => {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  if (value >= 0.001) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
};

/**
 * Format token counts with thousands separators
 */
const formatTokens = (value: number): string => {
  return value.toLocaleString();
};

/**
 * Format timestamps to readable format
 */
const formatTimestamp = (value: Date): string => {
  const date = new Date(value);
  const time = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  const day = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit' 
  });
  return `${day} ${time}`;
};

/**
 * Format duration in milliseconds to seconds
 */
const formatDuration = (value?: number): string => {
  if (!value) return '-';
  return `${(value / 1000).toFixed(1)}s`;
};

/**
 * Get color based on cost threshold
 */
const getCostColor = (cost: number): string => {
  if (cost < 0.001) return 'green';
  if (cost < 0.01) return 'yellow';
  if (cost < 0.05) return 'orange';
  return 'red';
};

/**
 * Interactive Analytics Table Component
 */
export const AnalyticsTable: React.FC<AnalyticsTableProps> = ({
  metrics,
  options,
  interactive = false,
  onRowSelect,
  onSort,
  sortField = 'timestamp',
  sortDirection = 'desc',
  selectedIndex = -1,
  compactMode = false,
  showTotals = true
}) => {
  // Define columns based on compact mode
  const columns: ColumnDefinition[] = useMemo(() => {
    const baseColumns: ColumnDefinition[] = [
      {
        key: 'index',
        label: '#',
        width: 4,
        align: 'right',
        format: (value) => String(value)
      },
      {
        key: 'timestamp',
        label: 'Time',
        width: compactMode ? 12 : 16,
        align: 'left',
        format: formatTimestamp
      },
      {
        key: 'model',
        label: 'Model',
        width: compactMode ? 15 : 20,
        align: 'left',
        format: (value) => value.substring(0, compactMode ? 15 : 20)
      },
      {
        key: 'totalTokens',
        label: 'Tokens',
        width: 10,
        align: 'right',
        format: formatTokens
      },
      {
        key: 'cost',
        label: 'Cost',
        width: 12,
        align: 'right',
        format: formatCurrency,
        color: getCostColor
      }
    ];

    // Add additional columns in non-compact mode
    if (!compactMode) {
      baseColumns.push(
        {
          key: 'inputTokens',
          label: 'Input',
          width: 10,
          align: 'right',
          format: formatTokens
        },
        {
          key: 'outputTokens',
          label: 'Output',
          width: 10,
          align: 'right',
          format: formatTokens
        },
        {
          key: 'duration',
          label: 'Duration',
          width: 10,
          align: 'right',
          format: formatDuration
        }
      );
    }

    return baseColumns;
  }, [compactMode]);

  // Sort metrics if needed
  const sortedMetrics = useMemo(() => {
    if (!sortField) return metrics;

    const sorted = [...metrics].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === undefined || bValue === undefined) return 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      return 0;
    });

    return sorted;
  }, [metrics, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!showTotals || metrics.length === 0) return null;

    return {
      totalTokens: metrics.reduce((sum, m) => sum + m.totalTokens, 0),
      inputTokens: metrics.reduce((sum, m) => sum + m.inputTokens, 0),
      outputTokens: metrics.reduce((sum, m) => sum + m.outputTokens, 0),
      totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
      avgCost: metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length,
      totalDuration: metrics.reduce((sum, m) => sum + (m.duration || 0), 0)
    };
  }, [metrics, showTotals]);

  // Render header row
  const renderHeader = () => (
    <Box>
      {columns.map((col, idx) => (
        <Box key={col.key} width={col.width} marginRight={1}>
          <Text 
            bold 
            color="cyan"
            wrap="truncate"
          >
            {col.align === 'right' 
              ? col.label.padStart(col.width - 1)
              : col.label.padEnd(col.width - 1)}
          </Text>
        </Box>
      ))}
    </Box>
  );

  // Render separator line
  const renderSeparator = () => {
    const totalWidth = columns.reduce((sum, col) => sum + col.width + 1, 0);
    return (
      <Box>
        <Text color="gray">{'─'.repeat(totalWidth - 1)}</Text>
      </Box>
    );
  };

  // Render data row
  const renderRow = (metric: CostMetric, index: number) => {
    const isSelected = interactive && selectedIndex === index;
    
    return (
      <Box key={index}>
        {columns.map((col) => {
          let value: any;
          let displayValue: string;
          let color: string | undefined;

          if (col.key === 'index') {
            value = index + 1;
            displayValue = col.format ? col.format(value) : String(value);
          } else {
            value = metric[col.key as keyof CostMetric];
            displayValue = col.format ? col.format(value, metric) : String(value || '');
            color = col.color ? col.color(value, metric) : undefined;
          }

          // Truncate to column width
          if (displayValue.length > col.width - 1) {
            displayValue = displayValue.substring(0, col.width - 2) + '…';
          }

          // Align text
          if (col.align === 'right') {
            displayValue = displayValue.padStart(col.width - 1);
          } else if (col.align === 'center') {
            const padding = Math.floor((col.width - 1 - displayValue.length) / 2);
            displayValue = ' '.repeat(padding) + displayValue;
            displayValue = displayValue.padEnd(col.width - 1);
          } else {
            displayValue = displayValue.padEnd(col.width - 1);
          }

          return (
            <Box key={col.key} width={col.width} marginRight={1}>
              <Text 
                color={color}
                inverse={isSelected}
                wrap="truncate"
              >
                {displayValue}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render totals row
  const renderTotals = () => {
    if (!totals) return null;

    return (
      <>
        {renderSeparator()}
        <Box>
          {columns.map((col) => {
            let displayValue = '';
            let color: string | undefined;

            switch (col.key) {
              case 'index':
                displayValue = 'Total';
                break;
              case 'totalTokens':
                displayValue = formatTokens(totals.totalTokens);
                break;
              case 'inputTokens':
                displayValue = formatTokens(totals.inputTokens);
                break;
              case 'outputTokens':
                displayValue = formatTokens(totals.outputTokens);
                break;
              case 'cost':
                displayValue = formatCurrency(totals.totalCost);
                color = getCostColor(totals.totalCost);
                break;
              case 'duration':
                displayValue = formatDuration(totals.totalDuration);
                break;
              default:
                displayValue = '';
            }

            // Align text
            if (col.align === 'right' && displayValue) {
              displayValue = displayValue.padStart(col.width - 1);
            } else {
              displayValue = displayValue.padEnd(col.width - 1);
            }

            return (
              <Box key={col.key} width={col.width} marginRight={1}>
                <Text 
                  bold
                  color={color || 'white'}
                  wrap="truncate"
                >
                  {displayValue}
                </Text>
              </Box>
            );
          })}
        </Box>
      </>
    );
  };

  // Empty state
  if (metrics.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="gray">No analytics data available for the specified criteria.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {renderHeader()}
      {renderSeparator()}
      {sortedMetrics.map((metric, index) => renderRow(metric, index))}
      {renderTotals()}
    </Box>
  );
};

export default AnalyticsTable;