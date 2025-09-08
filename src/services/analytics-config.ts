/**
 * Analytics Configuration Service
 * 
 * Manages user preferences and configuration settings for the analytics system
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * User configuration for analytics preferences
 */
export interface AnalyticsConfig {
  /** Enable/disable automatic cost tracking */
  enableTracking: boolean;
  
  /** Data retention period in months (default: 6) */
  retentionMonths: number;
  
  /** Enable/disable automatic data compaction */
  enableAutoCompaction: boolean;
  
  /** Frequency of automatic cleanup (in days, default: 30) */
  cleanupFrequencyDays: number;
  
  /** Default date range for analytics queries (in days, default: 30) */
  defaultDateRangeDays: number;
  
  /** Enable/disable detailed logging */
  enableDetailedLogging: boolean;
  
  /** Export format preference (default: 'csv') */
  preferredExportFormat: 'csv' | 'json';
  
  /** Display preferences */
  display: {
    /** Show cost in currency format (default: true) */
    showCurrencySymbol: boolean;
    
    /** Decimal places for cost display (default: 4) */
    costPrecision: number;
    
    /** Default sort field for tables */
    defaultSortField: 'timestamp' | 'cost' | 'model' | 'sessionId';
    
    /** Default sort order */
    defaultSortOrder: 'asc' | 'desc';
    
    /** Show totals in tables (default: true) */
    showTotals: boolean;
  };
  
  /** Alert thresholds */
  alerts: {
    /** Enable cost alerts */
    enableCostAlerts: boolean;
    
    /** Daily cost threshold for alerts (in USD) */
    dailyCostThreshold: number;
    
    /** Monthly cost threshold for alerts (in USD) */
    monthlyCostThreshold: number;
    
    /** Enable usage alerts */
    enableUsageAlerts: boolean;
    
    /** Daily token usage threshold for alerts */
    dailyTokenThreshold: number;
  };
}

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enableTracking: true,
  retentionMonths: 6,
  enableAutoCompaction: true,
  cleanupFrequencyDays: 30,
  defaultDateRangeDays: 30,
  enableDetailedLogging: false,
  preferredExportFormat: 'csv',
  display: {
    showCurrencySymbol: true,
    costPrecision: 4,
    defaultSortField: 'timestamp',
    defaultSortOrder: 'desc',
    showTotals: true
  },
  alerts: {
    enableCostAlerts: true,
    dailyCostThreshold: 10.0,
    monthlyCostThreshold: 100.0,
    enableUsageAlerts: false,
    dailyTokenThreshold: 50000
  }
};

/**
 * Analytics Configuration Manager
 * Handles loading, saving, and validating user configuration
 */
export class AnalyticsConfigManager {
  private configPath: string;
  private config: AnalyticsConfig;

  constructor(dataDir: string = '.plato/analytics') {
    this.configPath = path.join(dataDir, 'config.json');
    this.config = { ...DEFAULT_ANALYTICS_CONFIG };
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<AnalyticsConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);
      
      // Merge with defaults to ensure all properties exist
      this.config = this.mergeConfig(DEFAULT_ANALYTICS_CONFIG, loadedConfig);
      
      // Validate configuration
      this.validateConfig(this.config);
      
      return this.config;
    } catch (error) {
      // If file doesn't exist or is invalid, use defaults
      console.warn('Failed to load analytics config, using defaults:', error);
      this.config = { ...DEFAULT_ANALYTICS_CONFIG };
      await this.save(); // Save defaults to create the file
      return this.config;
    }
  }

  /**
   * Save current configuration to file
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Save configuration
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save analytics config:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration partially
   */
  async updateConfig(updates: Partial<AnalyticsConfig>): Promise<AnalyticsConfig> {
    // Deep merge the updates
    this.config = this.mergeConfig(this.config, updates);
    
    // Validate the updated configuration
    this.validateConfig(this.config);
    
    // Save the changes
    await this.save();
    
    return this.getConfig();
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<AnalyticsConfig> {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG };
    await this.save();
    return this.getConfig();
  }

  /**
   * Get specific configuration section
   */
  getDisplayConfig() {
    return { ...this.config.display };
  }

  getAlertConfig() {
    return { ...this.config.alerts };
  }

  /**
   * Check if cost alert threshold is exceeded
   */
  shouldTriggerCostAlert(dailyCost: number, monthlyCost: number): { daily: boolean; monthly: boolean } {
    if (!this.config.alerts.enableCostAlerts) {
      return { daily: false, monthly: false };
    }

    return {
      daily: dailyCost > this.config.alerts.dailyCostThreshold,
      monthly: monthlyCost > this.config.alerts.monthlyCostThreshold
    };
  }

  /**
   * Check if usage alert threshold is exceeded
   */
  shouldTriggerUsageAlert(dailyTokens: number): boolean {
    return this.config.alerts.enableUsageAlerts && 
           dailyTokens > this.config.alerts.dailyTokenThreshold;
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfig(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeConfig(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate configuration values
   */
  private validateConfig(config: AnalyticsConfig): void {
    // Validate retention months
    if (config.retentionMonths < 1 || config.retentionMonths > 60) {
      throw new Error('Retention months must be between 1 and 60');
    }

    // Validate cleanup frequency
    if (config.cleanupFrequencyDays < 1 || config.cleanupFrequencyDays > 365) {
      throw new Error('Cleanup frequency must be between 1 and 365 days');
    }

    // Validate date range days
    if (config.defaultDateRangeDays < 1 || config.defaultDateRangeDays > 365) {
      throw new Error('Default date range must be between 1 and 365 days');
    }

    // Validate cost precision
    if (config.display.costPrecision < 0 || config.display.costPrecision > 8) {
      throw new Error('Cost precision must be between 0 and 8 decimal places');
    }

    // Validate alert thresholds
    if (config.alerts.dailyCostThreshold < 0) {
      throw new Error('Daily cost threshold must be non-negative');
    }

    if (config.alerts.monthlyCostThreshold < 0) {
      throw new Error('Monthly cost threshold must be non-negative');
    }

    if (config.alerts.dailyTokenThreshold < 0) {
      throw new Error('Daily token threshold must be non-negative');
    }
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: AnalyticsConfigManager | null = null;

/**
 * Get or create the global configuration manager
 */
export function getAnalyticsConfigManager(dataDir?: string): AnalyticsConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new AnalyticsConfigManager(dataDir);
  }
  return globalConfigManager;
}

/**
 * Helper function to format cost according to user preferences
 */
export function formatCost(cost: number, config?: AnalyticsConfig): string {
  const displayConfig = config?.display || DEFAULT_ANALYTICS_CONFIG.display;
  const precision = displayConfig.costPrecision;
  const formattedCost = cost.toFixed(precision);
  
  return displayConfig.showCurrencySymbol ? `$${formattedCost}` : formattedCost;
}