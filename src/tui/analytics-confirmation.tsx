/**
 * Analytics Confirmation Dialog Component
 * Provides interactive confirmation for destructive analytics operations
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface AnalyticsConfirmationProps {
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Analytics Confirmation Dialog
 */
export const AnalyticsConfirmation: React.FC<AnalyticsConfirmationProps> = ({
  title,
  message,
  details = [],
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel
}) => {
  const [selectedOption, setSelectedOption] = useState<'confirm' | 'cancel'>('cancel');

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow) {
      setSelectedOption(prev => prev === 'confirm' ? 'cancel' : 'confirm');
    } else if (key.return) {
      if (selectedOption === 'confirm') {
        onConfirm();
      } else {
        onCancel();
      }
    } else if (key.escape) {
      onCancel();
    } else if (input.toLowerCase() === 'y') {
      onConfirm();
    } else if (input.toLowerCase() === 'n') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={destructive ? 'red' : 'yellow'}>
          {destructive ? '⚠️  ' : '❓ '}{title}
        </Text>
      </Box>

      {/* Message */}
      <Box marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      {/* Details */}
      {details.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {details.map((detail, index) => (
            <Box key={index}>
              <Text color="gray">  • {detail}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Warning for destructive actions */}
      {destructive && (
        <Box marginBottom={1}>
          <Text bold color="red">
            ⚠️  This action cannot be undone!
          </Text>
        </Box>
      )}

      {/* Options */}
      <Box marginTop={1}>
        <Box marginRight={2}>
          <Text
            bold={selectedOption === 'confirm'}
            color={selectedOption === 'confirm' ? (destructive ? 'red' : 'green') : 'gray'}
          >
            [{selectedOption === 'confirm' ? '▶' : ' '}] {confirmText} (Y)
          </Text>
        </Box>
        <Box>
          <Text
            bold={selectedOption === 'cancel'}
            color={selectedOption === 'cancel' ? 'cyan' : 'gray'}
          >
            [{selectedOption === 'cancel' ? '▶' : ' '}] {cancelText} (N)
          </Text>
        </Box>
      </Box>

      {/* Instructions */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ← → arrows to select, Enter to confirm, ESC to cancel
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Analytics Reset Confirmation
 * Specialized confirmation for data reset operations
 */
export interface AnalyticsResetConfirmationProps {
  dateRange?: { start: Date; end: Date };
  estimatedRecords?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AnalyticsResetConfirmation: React.FC<AnalyticsResetConfirmationProps> = ({
  dateRange,
  estimatedRecords,
  onConfirm,
  onCancel
}) => {
  const details: string[] = [];

  if (dateRange) {
    details.push(`Date range: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`);
  } else {
    details.push('All analytics data will be deleted');
  }

  if (estimatedRecords !== undefined) {
    details.push(`Approximately ${estimatedRecords.toLocaleString()} records will be deleted`);
  }

  details.push('This includes all cost metrics, session data, and aggregated statistics');

  return (
    <AnalyticsConfirmation
      title="Reset Analytics Data"
      message="Are you sure you want to permanently delete analytics data?"
      details={details}
      confirmText="Delete Data"
      cancelText="Keep Data"
      destructive={true}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default AnalyticsConfirmation;