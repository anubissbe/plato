/**
 * Analytics Command TUI Integration
 * Bridges the analytics command with the TUI system
 */

import { AnalyticsCommand } from './analytics-command.js';

/**
 * Create analytics command handler for TUI integration
 */
export function createAnalyticsCommandHandler(
  orchestrator: any, // The orchestrator type from runtime
  setLines: (fn: (prev: string[]) => string[]) => void
) {
  const analyticsCommand = new AnalyticsCommand(orchestrator, setLines);
  
  return async (args: string = '') => {
    try {
      await analyticsCommand.execute(args);
    } catch (error) {
      setLines(prev => prev.concat(
        '❌ Analytics command error:',
        `  ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  };
}

/**
 * Register analytics command with the TUI system
 */
export function registerAnalyticsCommand(
  orchestrator: any,
  commandRegistry: Map<string, (args: string) => Promise<void> | void>
) {
  // Create a wrapper that manages the lines display
  let currentLines: string[] = [];
  
  const setLines = (fn: (prev: string[]) => string[]) => {
    currentLines = fn(currentLines);
    // In a real integration, this would update the TUI display
    // For now, we'll log to console or pass to the TUI's line handler
    return currentLines;
  };
  
  const handler = createAnalyticsCommandHandler(orchestrator, setLines);
  
  // Register the command
  commandRegistry.set('/analytics', handler);
  
  return handler;
}

/**
 * Get analytics command metadata for command palette
 */
export function getAnalyticsCommandMetadata() {
  return {
    id: '/analytics',
    name: '/analytics',
    description: 'View and manage cost tracking analytics',
    category: 'Analytics',
    keywords: ['cost', 'analytics', 'metrics', 'statistics', 'usage', 'tokens'],
    subcommands: [
      {
        name: 'summary',
        description: 'Show aggregated statistics',
        example: '/analytics summary week'
      },
      {
        name: 'history',
        description: 'Show detailed metrics history',
        example: '/analytics history --today --model gpt-4'
      },
      {
        name: 'export',
        description: 'Export analytics data to file',
        example: '/analytics export csv costs.csv --month'
      },
      {
        name: 'reset',
        description: 'Reset analytics data',
        example: '/analytics reset --force'
      },
      {
        name: 'help',
        description: 'Show analytics command help',
        example: '/analytics help'
      }
    ]
  };
}

export default {
  createAnalyticsCommandHandler,
  registerAnalyticsCommand,
  getAnalyticsCommandMetadata
};