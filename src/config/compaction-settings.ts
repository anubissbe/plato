/**
 * Configurable Compaction Settings System
 * Manages user preferences and compaction configuration
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface CompactionSettings {
  // Core compaction behavior
  autoCompaction: boolean;
  compressionLevel: 'light' | 'moderate' | 'aggressive';
  qualityThreshold: number; // 0.0 to 1.0
  
  // Preservation rules
  preserveSystemMessages: boolean;
  preserveCodeBlocks: boolean;
  preserveErrorMessages: boolean;
  preserveQuestions: boolean;
  customPreservationRules: string[];
  
  // UI and interaction
  previewRequired: boolean;
  showDiffDetails: boolean;
  collectFeedback: boolean;
  confirmBeforeCompact: boolean;
  
  // Advanced settings
  maxHistorySize: number;
  processingTimeout: number;
  enableMetricsTracking: boolean;
  debugMode: boolean;
  
  // Automatic triggers
  autoCompactAfterMessages: number;
  autoCompactOnTokenLimit: number;
  autoCompactInterval: number; // minutes, 0 = disabled
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SettingsPreset {
  name: string;
  description: string;
  settings: Partial<CompactionSettings>;
}

/**
 * Manages compaction settings with validation and persistence
 */
export class CompactionSettingsManager {
  private settings: CompactionSettings;
  private readonly settingsFile: string;
  private readonly defaultSettings: CompactionSettings;

  constructor(settingsDir?: string) {
    // Default settings optimized for balanced performance
    this.defaultSettings = {
      autoCompaction: false,
      compressionLevel: 'moderate',
      qualityThreshold: 0.8,
      
      preserveSystemMessages: true,
      preserveCodeBlocks: true,
      preserveErrorMessages: true,
      preserveQuestions: true,
      customPreservationRules: [],
      
      previewRequired: true,
      showDiffDetails: true,
      collectFeedback: true,
      confirmBeforeCompact: true,
      
      maxHistorySize: 1000,
      processingTimeout: 5000,
      enableMetricsTracking: true,
      debugMode: false,
      
      autoCompactAfterMessages: 0, // Disabled by default
      autoCompactOnTokenLimit: 0, // Disabled by default  
      autoCompactInterval: 0 // Disabled by default
    };

    this.settings = { ...this.defaultSettings };
    
    // Settings file location
    const configDir = settingsDir || path.join(os.homedir(), '.plato');
    this.settingsFile = path.join(configDir, 'compaction-settings.json');
  }

  /**
   * Get current settings
   */
  getSettings(): CompactionSettings {
    return { ...this.settings };
  }

  /**
   * Update settings with validation
   */
  async updateSettings(updates: Partial<CompactionSettings>): Promise<{ success: boolean; errors: string[] }> {
    const newSettings = { ...this.settings, ...updates };
    const validation = this.validateSettings(newSettings);
    
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    
    this.settings = newSettings;
    
    try {
      await this.saveSettings();
      return { success: true, errors: [] };
    } catch (error) {
      return { success: false, errors: [`Failed to save settings: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<CompactionSettings> {
    this.settings = { ...this.defaultSettings };
    await this.saveSettings();
    return this.getSettings();
  }

  /**
   * Load settings from disk
   */
  async loadSettings(): Promise<CompactionSettings> {
    try {
      const data = await fs.readFile(this.settingsFile, 'utf8');
      const loaded = JSON.parse(data);
      
      // Merge with defaults to handle new settings fields
      this.settings = { ...this.defaultSettings, ...loaded };
      
      // Validate loaded settings
      const validation = this.validateSettings(this.settings);
      if (!validation.valid) {
        console.warn('Invalid settings detected, using defaults for invalid fields');
        // Reset invalid fields to defaults
        this.settings = this.repairSettings(this.settings);
        await this.saveSettings();
      }
      
      return this.getSettings();
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
      this.settings = { ...this.defaultSettings };
      await this.saveSettings();
      return this.getSettings();
    }
  }

  /**
   * Save settings to disk
   */
  async saveSettings(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.settingsFile);
      await fs.mkdir(dir, { recursive: true });
      
      // Save with pretty formatting
      const data = JSON.stringify(this.settings, null, 2);
      await fs.writeFile(this.settingsFile, data, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save compaction settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate settings configuration
   */
  validateSettings(settings: CompactionSettings): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Quality threshold validation
    if (settings.qualityThreshold < 0 || settings.qualityThreshold > 1) {
      errors.push('Quality threshold must be between 0.0 and 1.0');
    }

    // Compression level validation
    if (!['light', 'moderate', 'aggressive'].includes(settings.compressionLevel)) {
      errors.push('Compression level must be light, moderate, or aggressive');
    }

    // Max history size validation
    if (settings.maxHistorySize < 10 || settings.maxHistorySize > 10000) {
      errors.push('Max history size must be between 10 and 10000');
    }

    // Processing timeout validation
    if (settings.processingTimeout < 1000 || settings.processingTimeout > 30000) {
      errors.push('Processing timeout must be between 1000ms and 30000ms');
    }

    // Auto-compaction validation
    if (settings.autoCompactAfterMessages < 0 || settings.autoCompactAfterMessages > 1000) {
      errors.push('Auto-compact after messages must be between 0 and 1000');
    }

    if (settings.autoCompactOnTokenLimit < 0 || settings.autoCompactOnTokenLimit > 100000) {
      errors.push('Auto-compact token limit must be between 0 and 100000');
    }

    if (settings.autoCompactInterval < 0 || settings.autoCompactInterval > 1440) {
      errors.push('Auto-compact interval must be between 0 and 1440 minutes');
    }

    // Custom preservation rules validation
    if (settings.customPreservationRules.length > 20) {
      warnings.push('Large number of custom preservation rules may impact performance');
    }

    // Logic warnings
    if (settings.autoCompaction && !settings.enableMetricsTracking) {
      warnings.push('Auto-compaction without metrics tracking may reduce quality insights');
    }

    if (settings.qualityThreshold > 0.9 && settings.compressionLevel === 'aggressive') {
      warnings.push('High quality threshold with aggressive compression may result in frequent rejections');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get predefined settings presets
   */
  getPresets(): SettingsPreset[] {
    return [
      {
        name: 'conservative',
        description: 'Light compression with maximum preservation',
        settings: {
          compressionLevel: 'light',
          qualityThreshold: 0.9,
          previewRequired: true,
          confirmBeforeCompact: true,
          preserveSystemMessages: true,
          preserveCodeBlocks: true,
          preserveErrorMessages: true,
          preserveQuestions: true
        }
      },
      {
        name: 'balanced',
        description: 'Moderate compression with good preservation',
        settings: {
          compressionLevel: 'moderate',
          qualityThreshold: 0.8,
          previewRequired: true,
          confirmBeforeCompact: false,
          preserveSystemMessages: true,
          preserveCodeBlocks: true,
          preserveErrorMessages: true,
          preserveQuestions: false
        }
      },
      {
        name: 'aggressive',
        description: 'Maximum compression for token efficiency',
        settings: {
          compressionLevel: 'aggressive',
          qualityThreshold: 0.7,
          previewRequired: false,
          confirmBeforeCompact: false,
          preserveSystemMessages: true,
          preserveCodeBlocks: false,
          preserveErrorMessages: true,
          preserveQuestions: false
        }
      },
      {
        name: 'development',
        description: 'Optimized for coding sessions',
        settings: {
          compressionLevel: 'moderate',
          qualityThreshold: 0.85,
          preserveSystemMessages: true,
          preserveCodeBlocks: true,
          preserveErrorMessages: true,
          preserveQuestions: true,
          previewRequired: true,
          debugMode: true
        }
      },
      {
        name: 'automated',
        description: 'Hands-off automatic compaction',
        settings: {
          autoCompaction: true,
          compressionLevel: 'moderate',
          qualityThreshold: 0.8,
          previewRequired: false,
          confirmBeforeCompact: false,
          autoCompactAfterMessages: 50,
          autoCompactOnTokenLimit: 8000
        }
      }
    ];
  }

  /**
   * Apply a preset configuration
   */
  async applyPreset(presetName: string): Promise<{ success: boolean; errors: string[] }> {
    const preset = this.getPresets().find(p => p.name === presetName);
    if (!preset) {
      return { success: false, errors: [`Preset '${presetName}' not found`] };
    }

    return await this.updateSettings(preset.settings);
  }

  /**
   * Get settings optimized for specific use case
   */
  getRecommendedSettings(useCase: 'coding' | 'debugging' | 'research' | 'general'): Partial<CompactionSettings> {
    const recommendations: Record<string, Partial<CompactionSettings>> = {
      coding: {
        compressionLevel: 'moderate',
        qualityThreshold: 0.85,
        preserveCodeBlocks: true,
        preserveErrorMessages: true,
        previewRequired: true,
        debugMode: true
      },
      debugging: {
        compressionLevel: 'light',
        qualityThreshold: 0.9,
        preserveErrorMessages: true,
        preserveQuestions: true,
        preserveCodeBlocks: true,
        previewRequired: true
      },
      research: {
        compressionLevel: 'moderate',
        qualityThreshold: 0.8,
        preserveQuestions: true,
        previewRequired: false,
        collectFeedback: true
      },
      general: {
        ...this.defaultSettings
      }
    };

    return recommendations[useCase] || recommendations.general;
  }

  /**
   * Export settings for backup
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON string
   */
  async importSettings(jsonString: string): Promise<{ success: boolean; errors: string[] }> {
    try {
      const imported = JSON.parse(jsonString);
      return await this.updateSettings(imported);
    } catch (error) {
      return { success: false, errors: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  /**
   * Repair invalid settings by resetting invalid fields to defaults
   */
  private repairSettings(settings: CompactionSettings): CompactionSettings {
    const repaired = { ...settings };
    
    // Repair individual fields
    if (repaired.qualityThreshold < 0 || repaired.qualityThreshold > 1) {
      repaired.qualityThreshold = this.defaultSettings.qualityThreshold;
    }
    
    if (!['light', 'moderate', 'aggressive'].includes(repaired.compressionLevel)) {
      repaired.compressionLevel = this.defaultSettings.compressionLevel;
    }
    
    if (repaired.maxHistorySize < 10 || repaired.maxHistorySize > 10000) {
      repaired.maxHistorySize = this.defaultSettings.maxHistorySize;
    }
    
    if (repaired.processingTimeout < 1000 || repaired.processingTimeout > 30000) {
      repaired.processingTimeout = this.defaultSettings.processingTimeout;
    }
    
    return repaired;
  }
}

/**
 * Global settings manager instance
 */
export const globalCompactionSettings = new CompactionSettingsManager();