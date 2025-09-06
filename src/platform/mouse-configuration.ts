/**
 * Task 4.5: Configuration System for Mouse Features
 * Comprehensive mouse configuration with platform-aware defaults
 */

import { MouseProtocolConfig, MouseEventProcessingOptions, PlatformMouseCapabilities } from '../tui/mouse-types.js';
import { PlatformDetector, PlatformCapabilities } from './platform-detector.js';
import { FallbackManager } from './fallback-manager.js';

export interface MouseConfiguration {
  /** Global mouse enable/disable */
  enabled: boolean;
  /** Mouse protocol configuration */
  protocol: MouseProtocolConfig;
  /** Event processing options */
  processing: MouseEventProcessingOptions;
  /** Platform-specific overrides */
  platformOverrides: PlatformOverrides;
  /** Feature toggles */
  features: MouseFeatureToggles;
  /** Performance tuning */
  performance: MousePerformanceConfig;
  /** Debug settings */
  debug: MouseDebugConfig;
  /** Accessibility settings */
  accessibility: MouseAccessibilityConfig;
}

export interface PlatformOverrides {
  /** Windows-specific settings */
  windows?: Partial<MouseConfiguration>;
  /** macOS-specific settings */
  darwin?: Partial<MouseConfiguration>;
  /** Linux-specific settings */
  linux?: Partial<MouseConfiguration>;
  /** WSL-specific settings */
  wsl?: Partial<MouseConfiguration>;
  /** Container-specific settings */
  container?: Partial<MouseConfiguration>;
  /** CI-specific settings */
  ci?: Partial<MouseConfiguration>;
}

export interface MouseFeatureToggles {
  /** Enable click events */
  clicks: boolean;
  /** Enable double-click detection */
  doubleClicks: boolean;
  /** Enable drag operations */
  dragging: boolean;
  /** Enable scroll wheel */
  scrolling: boolean;
  /** Enable hover detection */
  hovering: boolean;
  /** Enable right-click context */
  contextMenu: boolean;
  /** Enable middle-click actions */
  middleClick: boolean;
  /** Enable modifier key detection */
  modifierKeys: boolean;
  /** Enable motion tracking */
  motionTracking: boolean;
  /** Enable focus events */
  focusEvents: boolean;
}

export interface MousePerformanceConfig {
  /** Event throttling in milliseconds */
  throttleMs: number;
  /** Event debouncing in milliseconds */
  debounceMs: number;
  /** Maximum events per second */
  maxEventsPerSecond: number;
  /** Event queue size limit */
  queueSizeLimit: number;
  /** Enable event batching */
  enableBatching: boolean;
  /** Batch processing interval */
  batchIntervalMs: number;
  /** Memory usage limits */
  memoryLimits: {
    /** Maximum event history */
    maxEventHistory: number;
    /** Maximum drag state cache */
    maxDragStates: number;
    /** Maximum hover state cache */
    maxHoverStates: number;
  };
}

export interface MouseDebugConfig {
  /** Enable debug logging */
  enabled: boolean;
  /** Log raw ANSI sequences */
  logRawSequences: boolean;
  /** Log parsed events */
  logParsedEvents: boolean;
  /** Log performance metrics */
  logPerformance: boolean;
  /** Log fallback decisions */
  logFallbacks: boolean;
  /** Debug output target */
  outputTarget: 'console' | 'file' | 'memory';
  /** Maximum debug entries */
  maxEntries: number;
}

export interface MouseAccessibilityConfig {
  /** Increase click target sizes */
  largerClickTargets: boolean;
  /** Reduce motion sensitivity */
  reducedMotion: boolean;
  /** Simplified interaction model */
  simplifiedInteractions: boolean;
  /** Visual feedback for interactions */
  visualFeedback: boolean;
  /** Audio feedback for interactions */
  audioFeedback: boolean;
  /** High contrast mode */
  highContrast: boolean;
  /** Keyboard alternatives */
  keyboardAlternatives: boolean;
}

export type MouseConfigurationProfile = 
  | 'default'
  | 'performance'
  | 'accessibility' 
  | 'minimal'
  | 'developer'
  | 'gaming'
  | 'presentation';

export interface ConfigurationContext {
  /** Platform capabilities */
  capabilities: PlatformCapabilities;
  /** Application type */
  applicationType: 'cli' | 'tui' | 'interactive' | 'presentation';
  /** User preferences */
  userPreferences?: Partial<MouseConfiguration>;
  /** Performance constraints */
  performanceConstraints?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    maxLatencyMs?: number;
  };
  /** Accessibility requirements */
  accessibilityRequirements?: {
    reducedMotion?: boolean;
    highContrast?: boolean;
    screenReader?: boolean;
  };
}

/**
 * Comprehensive mouse configuration management system
 */
export class MouseConfigurationManager {
  private static instance: MouseConfigurationManager;
  private platformDetector: PlatformDetector;
  private fallbackManager: FallbackManager;
  private currentConfig: MouseConfiguration | null = null;
  private configHistory: Array<{ config: MouseConfiguration; timestamp: number; reason: string }> = [];

  private constructor() {
    this.platformDetector = PlatformDetector.getInstance();
    this.fallbackManager = FallbackManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MouseConfigurationManager {
    if (!MouseConfigurationManager.instance) {
      MouseConfigurationManager.instance = new MouseConfigurationManager();
    }
    return MouseConfigurationManager.instance;
  }

  /**
   * Generate optimal mouse configuration for current platform
   */
  async generateOptimalConfiguration(context: ConfigurationContext): Promise<MouseConfiguration> {
    const baseConfig = this.getProfileConfiguration(this.selectOptimalProfile(context));
    const platformConfig = await this.applyPlatformOptimizations(baseConfig, context.capabilities);
    const fallbackConfig = await this.applyFallbackStrategies(platformConfig, context);
    const finalConfig = this.applyUserPreferences(fallbackConfig, context.userPreferences);

    // Save configuration with context
    this.currentConfig = finalConfig;
    this.configHistory.push({
      config: finalConfig,
      timestamp: Date.now(),
      reason: `Generated for ${context.applicationType} on ${context.capabilities.platform}`
    });

    return finalConfig;
  }

  /**
   * Get configuration for specific profile
   */
  getProfileConfiguration(profile: MouseConfigurationProfile): MouseConfiguration {
    const profiles: Record<MouseConfigurationProfile, MouseConfiguration> = {
      default: this.createDefaultConfiguration(),
      performance: this.createPerformanceConfiguration(),
      accessibility: this.createAccessibilityConfiguration(),
      minimal: this.createMinimalConfiguration(),
      developer: this.createDeveloperConfiguration(),
      gaming: this.createGamingConfiguration(),
      presentation: this.createPresentationConfiguration()
    };

    return profiles[profile];
  }

  /**
   * Apply configuration with validation
   */
  async applyConfiguration(config: MouseConfiguration): Promise<{
    success: boolean;
    appliedConfig: MouseConfiguration;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Validate configuration
      const validation = await this.validateConfiguration(config);
      warnings.push(...validation.warnings);
      
      if (!validation.isValid) {
        errors.push(...validation.errors);
        return {
          success: false,
          appliedConfig: config,
          warnings,
          errors
        };
      }

      // Apply platform-specific adjustments
      const adjustedConfig = await this.adjustConfigurationForPlatform(config);
      
      // Test configuration
      const testResult = await this.testConfiguration(adjustedConfig);
      if (!testResult.success) {
        warnings.push('Configuration test failed - applying fallbacks');
        const fallbackConfig = await this.applyEmergencyFallbacks(adjustedConfig);
        return {
          success: true,
          appliedConfig: fallbackConfig,
          warnings: [...warnings, 'Emergency fallbacks applied'],
          errors
        };
      }

      this.currentConfig = adjustedConfig;
      return {
        success: true,
        appliedConfig: adjustedConfig,
        warnings,
        errors
      };
    } catch (error) {
      errors.push(`Configuration application failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        appliedConfig: config,
        warnings,
        errors
      };
    }
  }

  /**
   * Update configuration with live changes
   */
  async updateConfiguration(
    updates: Partial<MouseConfiguration>,
    reason: string = 'User update'
  ): Promise<{
    success: boolean;
    newConfig: MouseConfiguration;
    changes: string[];
  }> {
    if (!this.currentConfig) {
      throw new Error('No current configuration to update');
    }

    const changes: string[] = [];
    const newConfig: MouseConfiguration = {
      ...this.currentConfig,
      ...updates
    };

    // Track what changed
    Object.keys(updates).forEach(key => {
      changes.push(`Updated ${key}`);
    });

    const result = await this.applyConfiguration(newConfig);
    
    if (result.success) {
      this.configHistory.push({
        config: newConfig,
        timestamp: Date.now(),
        reason
      });
    }

    return {
      success: result.success,
      newConfig: result.appliedConfig,
      changes
    };
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): MouseConfiguration | null {
    return this.currentConfig;
  }

  /**
   * Reset to default configuration
   */
  async resetToDefault(): Promise<MouseConfiguration> {
    const capabilities = await this.platformDetector.detectCapabilities();
    const context: ConfigurationContext = {
      capabilities,
      applicationType: 'tui'
    };
    
    return await this.generateOptimalConfiguration(context);
  }

  /**
   * Get configuration recommendations
   */
  async getConfigurationRecommendations(): Promise<{
    profile: MouseConfigurationProfile;
    reasons: string[];
    alternatives: Array<{
      profile: MouseConfigurationProfile;
      reason: string;
      tradeoffs: string[];
    }>;
  }> {
    const capabilities = await this.platformDetector.detectCapabilities();
    const context: ConfigurationContext = { capabilities, applicationType: 'tui' };
    
    const optimalProfile = this.selectOptimalProfile(context);
    const reasons = this.getProfileReasons(optimalProfile, capabilities);
    
    const alternatives = this.getAlternativeProfiles(optimalProfile, capabilities);

    return {
      profile: optimalProfile,
      reasons,
      alternatives
    };
  }

  /**
   * Export configuration for sharing/backup
   */
  exportConfiguration(): {
    config: MouseConfiguration;
    metadata: {
      timestamp: number;
      platform: string;
      version: string;
      history: number;
    };
  } {
    if (!this.currentConfig) {
      throw new Error('No configuration to export');
    }

    return {
      config: this.currentConfig,
      metadata: {
        timestamp: Date.now(),
        platform: process.platform,
        version: '1.0.0',
        history: this.configHistory.length
      }
    };
  }

  /**
   * Import configuration from backup
   */
  async importConfiguration(exportData: ReturnType<MouseConfigurationManager['exportConfiguration']>): Promise<{
    success: boolean;
    warnings: string[];
    errors: string[];
  }> {
    try {
      const result = await this.applyConfiguration(exportData.config);
      
      if (result.success) {
        this.configHistory.push({
          config: exportData.config,
          timestamp: Date.now(),
          reason: `Imported from ${new Date(exportData.metadata.timestamp).toISOString()}`
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        warnings: [],
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Select optimal profile based on context
   */
  private selectOptimalProfile(context: ConfigurationContext): MouseConfigurationProfile {
    const { capabilities } = context;

    // CI environments
    if (capabilities.environment.isCI) {
      return 'minimal';
    }

    // Low performance systems
    if (capabilities.performance.tier === 'low') {
      return 'minimal';
    }

    // Accessibility requirements
    if (context.accessibilityRequirements?.reducedMotion || 
        context.accessibilityRequirements?.screenReader) {
      return 'accessibility';
    }

    // Developer contexts
    if (context.applicationType === 'cli' || 
        capabilities.features.nativeBinaries.git) {
      return 'developer';
    }

    // Performance contexts
    if (capabilities.performance.tier === 'high' && 
        capabilities.performance.memoryMB > 8192) {
      return 'performance';
    }

    // Presentation contexts
    if (context.applicationType === 'presentation') {
      return 'presentation';
    }

    return 'default';
  }

  /**
   * Apply platform-specific optimizations
   */
  private async applyPlatformOptimizations(
    config: MouseConfiguration,
    capabilities: PlatformCapabilities
  ): Promise<MouseConfiguration> {
    const optimizedConfig = { ...config };

    // Platform-specific overrides
    const platformOverride = optimizedConfig.platformOverrides[capabilities.platform];
    if (platformOverride) {
      Object.assign(optimizedConfig, platformOverride);
    }

    // Environment-specific overrides
    if (capabilities.environment.isWSL && optimizedConfig.platformOverrides.wsl) {
      Object.assign(optimizedConfig, optimizedConfig.platformOverrides.wsl);
    }

    if (capabilities.environment.isContainer && optimizedConfig.platformOverrides.container) {
      Object.assign(optimizedConfig, optimizedConfig.platformOverrides.container);
    }

    if (capabilities.environment.isCI && optimizedConfig.platformOverrides.ci) {
      Object.assign(optimizedConfig, optimizedConfig.platformOverrides.ci);
    }

    // Performance optimizations
    if (capabilities.performance.tier === 'low') {
      optimizedConfig.performance.throttleMs = Math.max(optimizedConfig.performance.throttleMs, 50);
      optimizedConfig.performance.maxEventsPerSecond = Math.min(optimizedConfig.performance.maxEventsPerSecond, 20);
      optimizedConfig.features.motionTracking = false;
      optimizedConfig.features.hovering = false;
    }

    // Memory optimizations
    if (capabilities.performance.memoryMB < 2048) {
      optimizedConfig.performance.memoryLimits.maxEventHistory = Math.min(
        optimizedConfig.performance.memoryLimits.maxEventHistory,
        50
      );
      optimizedConfig.processing.maxQueueSize = Math.min(optimizedConfig.processing.maxQueueSize, 25);
    }

    return optimizedConfig;
  }

  /**
   * Apply fallback strategies from FallbackManager
   */
  private async applyFallbackStrategies(
    config: MouseConfiguration,
    context: ConfigurationContext
  ): Promise<MouseConfiguration> {
    const mouseConfig = await this.fallbackManager.getOptimalMouseConfig();
    
    // Apply mouse protocol fallbacks
    config.protocol = mouseConfig.config;
    
    if (mouseConfig.fallbackLevel > 0) {
      // Disable advanced features for fallback levels
      if (mouseConfig.fallbackLevel >= 2) {
        config.features.motionTracking = false;
        config.features.hovering = false;
        config.features.focusEvents = false;
      }
      
      if (mouseConfig.fallbackLevel >= 3) {
        config.features.dragging = false;
        config.features.doubleClicks = false;
        config.features.contextMenu = false;
      }
      
      if (mouseConfig.fallbackLevel >= 4) {
        config.enabled = false;
      }
    }

    return config;
  }

  /**
   * Apply user preferences
   */
  private applyUserPreferences(
    config: MouseConfiguration,
    userPreferences?: Partial<MouseConfiguration>
  ): MouseConfiguration {
    if (!userPreferences) {
      return config;
    }

    return {
      ...config,
      ...userPreferences,
      // Deep merge for nested objects
      features: { ...config.features, ...userPreferences.features },
      performance: { ...config.performance, ...userPreferences.performance },
      processing: { ...config.processing, ...userPreferences.processing },
      debug: { ...config.debug, ...userPreferences.debug },
      accessibility: { ...config.accessibility, ...userPreferences.accessibility }
    };
  }

  /**
   * Configuration profiles implementation
   */
  private createDefaultConfiguration(): MouseConfiguration {
    return {
      enabled: true,
      protocol: {
        mode: 'sgr',
        enableTracking: true,
        enableButtons: true,
        enableMotion: false,
        enableFocus: false
      },
      processing: {
        throttleMs: 16,
        validateBounds: true,
        debug: false,
        maxQueueSize: 100
      },
      platformOverrides: {},
      features: {
        clicks: true,
        doubleClicks: true,
        dragging: true,
        scrolling: true,
        hovering: false,
        contextMenu: true,
        middleClick: true,
        modifierKeys: true,
        motionTracking: false,
        focusEvents: false
      },
      performance: {
        throttleMs: 16,
        debounceMs: 10,
        maxEventsPerSecond: 60,
        queueSizeLimit: 100,
        enableBatching: false,
        batchIntervalMs: 16,
        memoryLimits: {
          maxEventHistory: 100,
          maxDragStates: 10,
          maxHoverStates: 10
        }
      },
      debug: {
        enabled: false,
        logRawSequences: false,
        logParsedEvents: false,
        logPerformance: false,
        logFallbacks: false,
        outputTarget: 'console',
        maxEntries: 1000
      },
      accessibility: {
        largerClickTargets: false,
        reducedMotion: false,
        simplifiedInteractions: false,
        visualFeedback: false,
        audioFeedback: false,
        highContrast: false,
        keyboardAlternatives: true
      }
    };
  }

  private createPerformanceConfiguration(): MouseConfiguration {
    const config = this.createDefaultConfiguration();
    config.features.hovering = true;
    config.features.motionTracking = true;
    config.performance.throttleMs = 8;
    config.performance.maxEventsPerSecond = 120;
    config.performance.enableBatching = true;
    config.performance.batchIntervalMs = 8;
    return config;
  }

  private createAccessibilityConfiguration(): MouseConfiguration {
    const config = this.createDefaultConfiguration();
    config.accessibility.largerClickTargets = true;
    config.accessibility.reducedMotion = true;
    config.accessibility.simplifiedInteractions = true;
    config.accessibility.visualFeedback = true;
    config.accessibility.keyboardAlternatives = true;
    config.features.hovering = false;
    config.features.motionTracking = false;
    config.performance.throttleMs = 50;
    return config;
  }

  private createMinimalConfiguration(): MouseConfiguration {
    const config = this.createDefaultConfiguration();
    config.features.doubleClicks = false;
    config.features.dragging = false;
    config.features.hovering = false;
    config.features.contextMenu = false;
    config.features.middleClick = false;
    config.features.motionTracking = false;
    config.features.focusEvents = false;
    config.performance.throttleMs = 50;
    config.performance.maxEventsPerSecond = 20;
    return config;
  }

  private createDeveloperConfiguration(): MouseConfiguration {
    const config = this.createDefaultConfiguration();
    config.debug.enabled = true;
    config.debug.logParsedEvents = true;
    config.debug.logPerformance = true;
    config.debug.logFallbacks = true;
    config.features.hovering = true;
    return config;
  }

  private createGamingConfiguration(): MouseConfiguration {
    const config = this.createDefaultConfiguration();
    config.features.motionTracking = true;
    config.features.hovering = true;
    config.performance.throttleMs = 4;
    config.performance.debounceMs = 2;
    config.performance.maxEventsPerSecond = 240;
    config.performance.enableBatching = true;
    config.performance.batchIntervalMs = 4;
    return config;
  }

  private createPresentationConfiguration(): MouseConfiguration {
    const config = this.createDefaultConfiguration();
    config.accessibility.largerClickTargets = true;
    config.accessibility.visualFeedback = true;
    config.features.hovering = true;
    config.performance.throttleMs = 25;
    return config;
  }

  /**
   * Validation and testing methods
   */
  private async validateConfiguration(config: MouseConfiguration): Promise<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic validation
    if (config.performance.throttleMs < 1) {
      errors.push('Throttle time must be at least 1ms');
    }

    if (config.performance.maxEventsPerSecond < 1) {
      errors.push('Max events per second must be at least 1');
    }

    if (config.performance.queueSizeLimit < 1) {
      errors.push('Queue size limit must be at least 1');
    }

    // Performance warnings
    if (config.performance.throttleMs < 8) {
      warnings.push('Very low throttle time may impact performance');
    }

    if (config.performance.maxEventsPerSecond > 120) {
      warnings.push('High event rate may impact performance');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }

  private async testConfiguration(config: MouseConfiguration): Promise<{
    success: boolean;
    performanceScore: number;
    compatibilityScore: number;
  }> {
    try {
      // Basic compatibility test
      const hasMouseSupport = process.stdout.isTTY;
      
      // Performance test - simulate event processing
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        // Simulate processing delay based on throttle
        await new Promise(resolve => setTimeout(resolve, Math.max(1, config.performance.throttleMs / 10)));
      }
      const endTime = Date.now();
      
      const performanceScore = Math.max(0, 1 - (endTime - startTime) / 1000);
      const compatibilityScore = hasMouseSupport ? 1.0 : 0.5;

      return {
        success: true,
        performanceScore,
        compatibilityScore
      };
    } catch (error) {
      return {
        success: false,
        performanceScore: 0,
        compatibilityScore: 0
      };
    }
  }

  private async adjustConfigurationForPlatform(config: MouseConfiguration): Promise<MouseConfiguration> {
    const capabilities = await this.platformDetector.detectCapabilities();
    
    // Platform-specific adjustments
    if (capabilities.platform === 'windows') {
      // Windows Terminal specific adjustments
      if (process.env.WT_SESSION) {
        config.protocol.mode = 'sgr';
      }
    }

    if (capabilities.environment.isWSL) {
      // WSL adjustments
      config.features.motionTracking = false;
      config.performance.throttleMs = Math.max(config.performance.throttleMs, 25);
    }

    return config;
  }

  private async applyEmergencyFallbacks(config: MouseConfiguration): Promise<MouseConfiguration> {
    const fallbackConfig = this.createMinimalConfiguration();
    
    // Keep user preferences where possible
    fallbackConfig.debug = config.debug;
    fallbackConfig.accessibility = config.accessibility;
    
    return fallbackConfig;
  }

  private getProfileReasons(profile: MouseConfigurationProfile, capabilities: PlatformCapabilities): string[] {
    const reasons: string[] = [];

    switch (profile) {
      case 'minimal':
        if (capabilities.environment.isCI) reasons.push('CI environment detected');
        if (capabilities.performance.tier === 'low') reasons.push('Low performance system');
        if (capabilities.mouse.supportLevel === 'minimal') reasons.push('Limited mouse support');
        break;
      case 'accessibility':
        reasons.push('Accessibility requirements detected');
        break;
      case 'developer':
        if (capabilities.features.nativeBinaries.git) reasons.push('Development tools detected');
        break;
      case 'performance':
        if (capabilities.performance.tier === 'high') reasons.push('High performance system');
        break;
    }

    return reasons;
  }

  private getAlternativeProfiles(
    currentProfile: MouseConfigurationProfile,
    capabilities: PlatformCapabilities
  ): Array<{ profile: MouseConfigurationProfile; reason: string; tradeoffs: string[] }> {
    const alternatives: Array<{ profile: MouseConfigurationProfile; reason: string; tradeoffs: string[] }> = [];

    if (currentProfile !== 'minimal') {
      alternatives.push({
        profile: 'minimal',
        reason: 'Reduce resource usage',
        tradeoffs: ['Fewer features', 'Basic interactions only']
      });
    }

    if (currentProfile !== 'accessibility') {
      alternatives.push({
        profile: 'accessibility',
        reason: 'Better accessibility support',
        tradeoffs: ['Slower interactions', 'Simpler interface']
      });
    }

    if (currentProfile !== 'performance' && capabilities.performance.tier === 'high') {
      alternatives.push({
        profile: 'performance',
        reason: 'Maximize responsiveness',
        tradeoffs: ['Higher resource usage', 'More complex']
      });
    }

    return alternatives;
  }
}