/**
 * Status Configuration Manager
 * Handles loading, saving, and applying status display preferences
 */

import { loadConfig, saveConfig, setConfigValue, type Config } from '../config.js';
import type { StatusConfig } from './status-integration.js';

export const DEFAULT_STATUS_CONFIG: StatusConfig = {
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

/**
 * Load status configuration from the config system
 */
export async function loadStatusConfig(): Promise<StatusConfig> {
  const config = await loadConfig();
  
  if (!config.status) {
    return DEFAULT_STATUS_CONFIG;
  }
  
  // Merge with defaults to ensure all fields are present
  return {
    ...DEFAULT_STATUS_CONFIG,
    ...config.status,
    // Ensure visibleMetrics is always an array
    visibleMetrics: config.status.visibleMetrics || DEFAULT_STATUS_CONFIG.visibleMetrics
  };
}

/**
 * Save status configuration to the config system
 */
export async function saveStatusConfig(statusConfig: Partial<StatusConfig>): Promise<void> {
  const config = await loadConfig();
  
  // Merge with existing status config
  config.status = {
    ...config.status,
    ...statusConfig
  };
  
  await saveConfig(config);
}

/**
 * Update a single status configuration value
 */
export async function setStatusConfigValue(key: keyof StatusConfig, value: any): Promise<void> {
  const statusKey = `status.${key}`;
  
  // Convert value to string for setConfigValue
  let stringValue: string;
  if (typeof value === 'boolean') {
    stringValue = value.toString();
  } else if (typeof value === 'object') {
    stringValue = JSON.stringify(value);
  } else {
    stringValue = String(value);
  }
  
  await setConfigValue(statusKey, stringValue);
}

/**
 * Toggle a boolean status configuration value
 */
export async function toggleStatusConfig(key: keyof StatusConfig): Promise<boolean> {
  const config = await loadStatusConfig();
  const currentValue = config[key];
  
  if (typeof currentValue === 'boolean') {
    const newValue = !currentValue;
    await setStatusConfigValue(key, newValue);
    return newValue;
  }
  
  throw new Error(`Cannot toggle non-boolean config key: ${key}`);
}

/**
 * Cycle through position options
 */
export async function cyclePosition(): Promise<'top' | 'bottom'> {
  const config = await loadStatusConfig();
  const newPosition = config.position === 'top' ? 'bottom' : 'top';
  await setStatusConfigValue('position', newPosition);
  return newPosition;
}

/**
 * Cycle through theme options
 */
export async function cycleTheme(): Promise<'light' | 'dark'> {
  const config = await loadStatusConfig();
  const newTheme = config.theme === 'light' ? 'dark' : 'light';
  await setStatusConfigValue('theme', newTheme);
  return newTheme;
}

/**
 * Add or remove a metric from the visible metrics list
 */
export async function toggleMetric(metric: string): Promise<void> {
  const config = await loadStatusConfig();
  const metrics = [...config.visibleMetrics];
  
  const index = metrics.indexOf(metric);
  if (index >= 0) {
    metrics.splice(index, 1);
  } else {
    metrics.push(metric);
  }
  
  await setStatusConfigValue('visibleMetrics', metrics);
}

/**
 * Get available metric options
 */
export function getAvailableMetrics(): string[] {
  return [
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'responseTime',
    'averageResponseTime',
    'memoryUsageMB',
    'memoryPercentage',
    'sessionTurns',
    'sessionTokens',
    'streamProgress',
    'charactersStreamed'
  ];
}

/**
 * Apply preset configurations
 */
export async function applyPreset(preset: 'minimal' | 'detailed' | 'performance' | 'developer'): Promise<void> {
  let config: Partial<StatusConfig>;
  
  switch (preset) {
    case 'minimal':
      config = {
        showStatusLine: true,
        showProgressBar: false,
        compactMode: true,
        visibleMetrics: ['totalTokens'],
        showSpinner: false,
        pulseOnUpdate: false
      };
      break;
      
    case 'detailed':
      config = {
        showStatusLine: true,
        showProgressBar: true,
        compactMode: false,
        visibleMetrics: getAvailableMetrics(),
        showSpinner: true,
        pulseOnUpdate: true,
        showStreamingProgress: true,
        showToolCallProgress: true
      };
      break;
      
    case 'performance':
      config = {
        showStatusLine: true,
        showProgressBar: true,
        compactMode: false,
        visibleMetrics: ['responseTime', 'averageResponseTime', 'memoryUsageMB', 'memoryPercentage'],
        showSpinner: true,
        pulseOnUpdate: false
      };
      break;
      
    case 'developer':
      config = {
        showStatusLine: true,
        showProgressBar: true,
        compactMode: false,
        visibleMetrics: ['inputTokens', 'outputTokens', 'totalTokens', 'responseTime', 'memoryUsageMB'],
        showSpinner: true,
        showStreamingProgress: true,
        showToolCallProgress: true,
        pulseOnUpdate: true
      };
      break;
  }
  
  await saveStatusConfig(config);
}

/**
 * Export current configuration to JSON
 */
export async function exportStatusConfig(): Promise<string> {
  const config = await loadStatusConfig();
  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON
 */
export async function importStatusConfig(json: string): Promise<void> {
  try {
    const config = JSON.parse(json) as StatusConfig;
    await saveStatusConfig(config);
  } catch (error) {
    throw new Error(`Invalid status configuration JSON: ${error}`);
  }
}