/**
 * Interactive StatusLine Component
 * Wraps StatusLine with mouse interaction capabilities for cost analytics
 */

import React, { useCallback } from 'react';
import { StatusLine, StatusLineProps } from './status-line.js';
import type { StatusMetrics } from './status-manager.js';
import {
  toggleCostAnalytics,
  toggleDetailedCostAnalytics,
  toggleCurrentCost,
  isCostAnalyticsVisible
} from './status-config.js';

export interface InteractiveStatusLineProps extends Omit<StatusLineProps, 'onMetricClick'> {
  /** Custom metric click handlers */
  customHandlers?: Partial<Record<keyof StatusMetrics, () => void | Promise<void>>>;
  /** Enable cost metric interactions */
  enableCostInteractions?: boolean;
  /** Show click hints for cost metrics */
  showClickHints?: boolean;
}

/**
 * Interactive StatusLine with built-in cost analytics interactions
 */
export const InteractiveStatusLine: React.FC<InteractiveStatusLineProps> = ({
  customHandlers = {},
  enableCostInteractions = true,
  showClickHints = false,
  ...statusLineProps
}) => {
  /**
   * Handle metric clicks with built-in cost analytics functionality
   */
  const handleMetricClick = useCallback(async (metric: keyof StatusMetrics) => {
    // Check for custom handler first
    if (customHandlers[metric]) {
      try {
        await customHandlers[metric]?.();
        return;
      } catch (error) {
        console.error(`Error executing custom handler for ${String(metric)}:`, error);
      }
    }

    // Built-in cost analytics interactions
    if (!enableCostInteractions) return;

    try {
      switch (metric) {
        case 'currentCost':
          // Single click: Toggle current cost visibility
          await toggleCurrentCost();
          console.log('Current cost display toggled');
          break;

        case 'sessionCost':
          // Single click: Toggle basic cost analytics (current + session)
          const isVisible = await isCostAnalyticsVisible();
          if (isVisible) {
            await toggleCostAnalytics();
            console.log('Cost analytics hidden');
          } else {
            await toggleCostAnalytics();
            console.log('Cost analytics shown');
          }
          break;

        case 'todayCost':
          // Single click: Toggle detailed cost analytics
          const detailedEnabled = await toggleDetailedCostAnalytics();
          console.log(`Detailed cost analytics ${detailedEnabled ? 'enabled' : 'disabled'}`);
          break;

        case 'costPerToken':
          // Copy cost per token to clipboard (if available)
          if (statusLineProps.metrics.costPerToken > 0) {
            const costPerToken = statusLineProps.metrics.costPerToken;
            try {
              // In terminal environment, we can't access clipboard directly
              // Log the value for now - in a real implementation this could
              // integrate with terminal clipboard utilities
              console.log(`Cost per token: ${costPerToken} (copied to logs)`);
              
              // Could integrate with terminal clipboard utilities like:
              // - pbcopy on macOS
              // - xclip on Linux  
              // - clip.exe on Windows
            } catch (error) {
              console.log(`Cost per token: ${costPerToken}`);
            }
          }
          break;

        case 'projectedCost':
          // Show detailed projection information
          if (statusLineProps.metrics.projectedCost && statusLineProps.metrics.projectedCost > 0) {
            const { currentCost, sessionCost, projectedCost, costThreshold } = statusLineProps.metrics;
            console.log('Cost Projection Details:');
            console.log(`  Current: $${currentCost.toFixed(6)}`);
            console.log(`  Session: $${sessionCost.toFixed(6)}`);
            console.log(`  Projected: $${projectedCost.toFixed(6)}`);
            if (costThreshold) {
              const percentage = (projectedCost / costThreshold) * 100;
              console.log(`  Threshold: $${costThreshold.toFixed(6)} (${percentage.toFixed(1)}%)`);
            }
          }
          break;

        case 'provider':
        case 'model':
          // Show model information
          const { provider, model, costPerToken } = statusLineProps.metrics;
          console.log('Model Information:');
          if (provider) console.log(`  Provider: ${provider}`);
          if (model) console.log(`  Model: ${model}`);
          if (costPerToken > 0) console.log(`  Cost per token: $${costPerToken.toFixed(8)}`);
          break;

        default:
          // For non-cost metrics, just log the interaction
          console.log(`Clicked on metric: ${String(metric)}`);
          break;
      }
    } catch (error) {
      console.error(`Error handling click on ${String(metric)}:`, error);
    }
  }, [customHandlers, enableCostInteractions, statusLineProps.metrics]);

  return (
    <StatusLine
      {...statusLineProps}
      onMetricClick={handleMetricClick}
    />
  );
};

/**
 * Default export for convenience
 */
export default InteractiveStatusLine;