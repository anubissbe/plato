/**
 * Task 4.4: Graceful Fallback Mechanisms
 * Comprehensive fallback system for mouse and terminal features
 */

import { PlatformCapabilities, PlatformDetector } from './platform-detector.js';
import { MouseProtocolConfig, PlatformMouseCapabilities, MouseEventProcessingOptions } from '../tui/mouse-types.js';

export interface FallbackStrategy {
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Compatibility level (0-1) */
  compatibility: number;
  /** Performance impact (0-1, lower is better) */
  performanceImpact: number;
  /** Feature completeness (0-1) */
  featureCompleteness: number;
  /** Implementation function */
  implement: () => Promise<boolean>;
  /** Rollback function */
  rollback?: () => Promise<void>;
}

export interface FallbackConfig {
  /** Mouse fallback strategies */
  mouse: MouseFallbackConfig;
  /** Terminal fallback strategies */
  terminal: TerminalFallbackConfig;
  /** Input fallback strategies */
  input: InputFallbackConfig;
  /** Performance fallback strategies */
  performance: PerformanceFallbackConfig;
}

export interface MouseFallbackConfig {
  /** Enable mouse fallbacks */
  enabled: boolean;
  /** Fallback strategies in order of preference */
  strategies: MouseFallbackStrategy[];
  /** Minimum acceptable compatibility */
  minCompatibility: number;
  /** Maximum performance impact */
  maxPerformanceImpact: number;
}

export interface TerminalFallbackConfig {
  /** Color fallback levels */
  colorFallbacks: ColorFallbackStrategy[];
  /** Unicode fallback options */
  unicodeFallbacks: UnicodeFallbackStrategy[];
  /** Dimension fallback values */
  dimensionFallbacks: DimensionFallbackStrategy[];
}

export interface InputFallbackConfig {
  /** Keyboard input fallbacks */
  keyboardFallbacks: KeyboardFallbackStrategy[];
  /** Raw mode alternatives */
  rawModeFallbacks: RawModeFallbackStrategy[];
  /** Signal handling fallbacks */
  signalFallbacks: SignalFallbackStrategy[];
}

export interface PerformanceFallbackConfig {
  /** Memory management fallbacks */
  memoryFallbacks: MemoryFallbackStrategy[];
  /** Processing fallbacks */
  processingFallbacks: ProcessingFallbackStrategy[];
  /** I/O fallbacks */
  ioFallbacks: IOFallbackStrategy[];
}

export type MouseFallbackStrategy = 
  | 'protocol-downgrade'
  | 'feature-disable'
  | 'polling-mode'
  | 'keyboard-only'
  | 'no-mouse';

export type ColorFallbackStrategy = 
  | 'truecolor'
  | '256color'
  | '16color'
  | '8color'
  | 'monochrome';

export type UnicodeFallbackStrategy = 
  | 'full-unicode'
  | 'basic-unicode'
  | 'ascii-fallback'
  | 'safe-ascii';

export type DimensionFallbackStrategy = 
  | 'auto-detect'
  | 'standard-80x24'
  | 'minimal-40x12'
  | 'single-line';

export type KeyboardFallbackStrategy = 
  | 'raw-mode'
  | 'line-mode'
  | 'simple-input'
  | 'no-input';

export type RawModeFallbackStrategy = 
  | 'native-raw'
  | 'tty-raw'
  | 'cbreak-mode'
  | 'cooked-mode';

export type SignalFallbackStrategy = 
  | 'native-signals'
  | 'process-signals'
  | 'polling-signals'
  | 'no-signals';

export type MemoryFallbackStrategy = 
  | 'full-caching'
  | 'limited-caching'
  | 'minimal-caching'
  | 'no-caching';

export type ProcessingFallbackStrategy = 
  | 'async-processing'
  | 'sync-processing'
  | 'batch-processing'
  | 'minimal-processing';

export type IOFallbackStrategy = 
  | 'buffered-io'
  | 'direct-io'
  | 'minimal-io'
  | 'polling-io';

/**
 * Comprehensive fallback management system
 */
export class FallbackManager {
  private static instance: FallbackManager;
  private platformDetector: PlatformDetector;
  private capabilities: PlatformCapabilities | null = null;
  private activeFallbacks: Map<string, FallbackStrategy> = new Map();
  private fallbackHistory: Array<{ strategy: string; timestamp: number; success: boolean }> = [];

  private constructor() {
    this.platformDetector = PlatformDetector.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FallbackManager {
    if (!FallbackManager.instance) {
      FallbackManager.instance = new FallbackManager();
    }
    return FallbackManager.instance;
  }

  /**
   * Initialize fallback system based on platform capabilities
   */
  async initialize(): Promise<void> {
    this.capabilities = await this.platformDetector.detectCapabilities();
    await this.setupDefaultFallbacks();
  }

  /**
   * Get optimal mouse configuration with fallbacks
   */
  async getOptimalMouseConfig(): Promise<{
    config: MouseProtocolConfig;
    fallbackLevel: number;
    warnings: string[];
  }> {
    if (!this.capabilities) {
      await this.initialize();
    }

    const warnings: string[] = [];
    let fallbackLevel = 0;

    // Start with ideal configuration
    let config: MouseProtocolConfig = {
      mode: 'sgr',
      enableTracking: true,
      enableButtons: true,
      enableMotion: true,
      enableFocus: true
    };

    const mouseCapabilities = this.capabilities!.mouse;

    // Apply fallbacks based on platform limitations
    if (mouseCapabilities.supportLevel === 'none') {
      return await this.applyMouseFallback('no-mouse', config, warnings);
    }

    if (mouseCapabilities.supportLevel === 'minimal') {
      fallbackLevel = 1;
      config = await this.applyMinimalMouseFallback(config, warnings);
    }

    if (mouseCapabilities.supportLevel === 'partial') {
      fallbackLevel = 2;
      config = await this.applyPartialMouseFallback(config, warnings);
    }

    // Platform-specific adjustments
    if (this.capabilities!.environment.isWSL) {
      fallbackLevel = Math.max(fallbackLevel, 1);
      config = await this.applyWSLMouseFallback(config, warnings);
    }

    if (this.capabilities!.environment.isContainer) {
      fallbackLevel = Math.max(fallbackLevel, 1);
      config = await this.applyContainerMouseFallback(config, warnings);
    }

    if (this.capabilities!.environment.isCI) {
      return await this.applyMouseFallback('keyboard-only', config, warnings);
    }

    // Protocol-specific fallbacks
    if (!mouseCapabilities.supportedProtocols.includes(config.mode)) {
      const { newConfig, level } = await this.applyProtocolFallback(config, mouseCapabilities);
      config = newConfig;
      fallbackLevel = Math.max(fallbackLevel, level);
    }

    return { config, fallbackLevel, warnings };
  }

  /**
   * Get optimal terminal configuration with fallbacks
   */
  async getOptimalTerminalConfig(): Promise<{
    colorDepth: number;
    useUnicode: boolean;
    dimensions: { width: number; height: number };
    fallbackLevel: number;
    warnings: string[];
  }> {
    if (!this.capabilities) {
      await this.initialize();
    }

    const warnings: string[] = [];
    let fallbackLevel = 0;

    const terminal = this.capabilities!.terminal;
    let colorDepth = terminal.colorDepth;
    let useUnicode = terminal.supportsUnicode;
    let dimensions = terminal.dimensions;

    // Color fallbacks
    if (colorDepth > 8 && this.capabilities!.performance.tier === 'low') {
      colorDepth = 8;
      fallbackLevel = 1;
      warnings.push('Reduced color depth for performance');
    }

    if (this.capabilities!.environment.isCI && colorDepth > 4) {
      colorDepth = 1;
      fallbackLevel = 2;
      warnings.push('Disabled colors for CI environment');
    }

    // Unicode fallbacks
    if (useUnicode && (
      this.capabilities!.environment.isContainer ||
      this.capabilities!.platform === 'windows'
    )) {
      useUnicode = false;
      fallbackLevel = Math.max(fallbackLevel, 1);
      warnings.push('Disabled Unicode for compatibility');
    }

    // Dimension fallbacks
    if (dimensions.width < 40 || dimensions.height < 10) {
      dimensions = { width: 80, height: 24 };
      fallbackLevel = Math.max(fallbackLevel, 1);
      warnings.push('Applied standard terminal dimensions');
    }

    return {
      colorDepth,
      useUnicode,
      dimensions,
      fallbackLevel,
      warnings
    };
  }

  /**
   * Apply performance fallbacks
   */
  async applyPerformanceFallbacks(): Promise<{
    caching: MemoryFallbackStrategy;
    processing: ProcessingFallbackStrategy;
    io: IOFallbackStrategy;
    maxConcurrency: number;
    fallbackLevel: number;
  }> {
    if (!this.capabilities) {
      await this.initialize();
    }

    const performance = this.capabilities!.performance;
    let fallbackLevel = 0;
    
    // Memory fallbacks
    let caching: MemoryFallbackStrategy = 'full-caching';
    if (performance.memoryMB < 1024) {
      caching = 'minimal-caching';
      fallbackLevel = 2;
    } else if (performance.memoryMB < 4096) {
      caching = 'limited-caching';
      fallbackLevel = 1;
    }

    // Processing fallbacks
    let processing: ProcessingFallbackStrategy = 'async-processing';
    if (performance.tier === 'low') {
      processing = 'minimal-processing';
      fallbackLevel = Math.max(fallbackLevel, 2);
    } else if (this.capabilities!.environment.isContainer) {
      processing = 'batch-processing';
      fallbackLevel = Math.max(fallbackLevel, 1);
    }

    // I/O fallbacks
    let io: IOFallbackStrategy = 'buffered-io';
    if (performance.io.throughputMBps < 50) {
      io = 'minimal-io';
      fallbackLevel = Math.max(fallbackLevel, 2);
    } else if (this.capabilities!.environment.isWSL) {
      io = 'direct-io';
      fallbackLevel = Math.max(fallbackLevel, 1);
    }

    // Concurrency limits
    let maxConcurrency = Math.max(1, Math.floor(performance.cpuCores * 0.75));
    if (this.capabilities!.environment.isContainer) {
      maxConcurrency = Math.min(maxConcurrency, 2);
    }

    return {
      caching,
      processing,
      io,
      maxConcurrency,
      fallbackLevel
    };
  }

  /**
   * Test fallback strategy
   */
  async testFallbackStrategy(strategyName: string): Promise<{
    success: boolean;
    performance: number;
    compatibility: number;
    error?: string;
  }> {
    try {
      const strategy = await this.createFallbackStrategy(strategyName);
      const startTime = Date.now();
      
      const success = await strategy.implement();
      const endTime = Date.now();
      
      const performance = Math.max(0, 1 - (endTime - startTime) / 1000); // Normalize to 0-1
      
      this.fallbackHistory.push({
        strategy: strategyName,
        timestamp: Date.now(),
        success
      });

      if (strategy.rollback) {
        await strategy.rollback();
      }

      return {
        success,
        performance,
        compatibility: strategy.compatibility
      };
    } catch (error) {
      return {
        success: false,
        performance: 0,
        compatibility: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get fallback recommendations
   */
  async getFallbackRecommendations(): Promise<{
    mouse: string[];
    terminal: string[];
    performance: string[];
    general: string[];
  }> {
    if (!this.capabilities) {
      await this.initialize();
    }

    const recommendations = {
      mouse: [] as string[],
      terminal: [] as string[],
      performance: [] as string[],
      general: [] as string[]
    };

    const caps = this.capabilities!;

    // Mouse recommendations
    if (caps.mouse.supportLevel === 'none') {
      recommendations.mouse.push('Mouse support not available - use keyboard navigation');
    } else if (caps.mouse.supportLevel === 'minimal') {
      recommendations.mouse.push('Limited mouse support - basic clicks only');
    }

    if (caps.environment.isWSL) {
      recommendations.mouse.push('WSL detected - use Windows Terminal for better mouse support');
    }

    // Terminal recommendations
    if (caps.terminal.colorDepth < 8) {
      recommendations.terminal.push('Limited color support - consider upgrading terminal');
    }

    if (!caps.terminal.supportsUnicode) {
      recommendations.terminal.push('Unicode not supported - some symbols may not display');
    }

    if (caps.terminal.dimensions.width < 80) {
      recommendations.terminal.push('Narrow terminal - some features may be limited');
    }

    // Performance recommendations
    if (caps.performance.tier === 'low') {
      recommendations.performance.push('Low performance detected - reduced features enabled');
    }

    if (caps.performance.memoryMB < 2048) {
      recommendations.performance.push('Limited memory - caching reduced');
    }

    if (caps.environment.isContainer) {
      recommendations.performance.push('Container environment - some features limited');
    }

    // General recommendations
    if (caps.environment.isCI) {
      recommendations.general.push('CI environment detected - interactive features disabled');
    }

    if (caps.features.security.restricted) {
      recommendations.general.push('Restricted environment - some operations may fail');
    }

    return recommendations;
  }

  /**
   * Setup default fallback strategies
   */
  private async setupDefaultFallbacks(): Promise<void> {
    // Register common fallback strategies
    await this.registerFallbackStrategy('mouse-minimal', await this.createMinimalMouseStrategy());
    await this.registerFallbackStrategy('mouse-keyboard-only', await this.createKeyboardOnlyStrategy());
    await this.registerFallbackStrategy('terminal-basic', await this.createBasicTerminalStrategy());
    await this.registerFallbackStrategy('performance-low', await this.createLowPerformanceStrategy());
  }

  /**
   * Register fallback strategy
   */
  private async registerFallbackStrategy(name: string, strategy: FallbackStrategy): Promise<void> {
    this.activeFallbacks.set(name, strategy);
  }

  /**
   * Create fallback strategy by name
   */
  private async createFallbackStrategy(name: string): Promise<FallbackStrategy> {
    switch (name) {
      case 'mouse-minimal':
        return await this.createMinimalMouseStrategy();
      case 'mouse-keyboard-only':
        return await this.createKeyboardOnlyStrategy();
      case 'terminal-basic':
        return await this.createBasicTerminalStrategy();
      case 'performance-low':
        return await this.createLowPerformanceStrategy();
      default:
        throw new Error(`Unknown fallback strategy: ${name}`);
    }
  }

  /**
   * Mouse fallback implementations
   */
  private async applyMouseFallback(
    strategy: MouseFallbackStrategy,
    config: MouseProtocolConfig,
    warnings: string[]
  ): Promise<{ config: MouseProtocolConfig; fallbackLevel: number; warnings: string[] }> {
    let fallbackLevel = 3;

    switch (strategy) {
      case 'no-mouse':
        config = {
          mode: 'urxvt',
          enableTracking: false,
          enableButtons: false,
          enableMotion: false,
          enableFocus: false
        };
        warnings.push('Mouse support disabled - no platform support');
        fallbackLevel = 4;
        break;

      case 'keyboard-only':
        config = {
          mode: 'urxvt',
          enableTracking: false,
          enableButtons: false,
          enableMotion: false,
          enableFocus: false
        };
        warnings.push('Mouse support disabled - keyboard navigation only');
        fallbackLevel = 4;
        break;

      case 'polling-mode':
        config.enableMotion = false;
        config.enableFocus = false;
        warnings.push('Mouse motion tracking disabled');
        fallbackLevel = 2;
        break;

      case 'feature-disable':
        config.enableMotion = false;
        config.enableFocus = false;
        warnings.push('Advanced mouse features disabled');
        fallbackLevel = 2;
        break;

      case 'protocol-downgrade':
        if (config.mode === 'sgr') {
          config.mode = 'utf8';
        } else if (config.mode === 'utf8') {
          config.mode = 'urxvt';
        }
        warnings.push(`Mouse protocol downgraded to ${config.mode}`);
        fallbackLevel = 1;
        break;
    }

    return { config, fallbackLevel, warnings };
  }

  /**
   * Apply minimal mouse fallback
   */
  private async applyMinimalMouseFallback(
    config: MouseProtocolConfig,
    warnings: string[]
  ): Promise<MouseProtocolConfig> {
    config.mode = 'urxvt';
    config.enableMotion = false;
    config.enableFocus = false;
    warnings.push('Minimal mouse mode - basic clicks only');
    return config;
  }

  /**
   * Apply partial mouse fallback
   */
  private async applyPartialMouseFallback(
    config: MouseProtocolConfig,
    warnings: string[]
  ): Promise<MouseProtocolConfig> {
    if (config.mode === 'sgr' && !this.capabilities!.mouse.supportedProtocols.includes('sgr')) {
      config.mode = 'utf8';
    }
    config.enableMotion = false;
    warnings.push('Partial mouse mode - limited features');
    return config;
  }

  /**
   * Apply WSL mouse fallback
   */
  private async applyWSLMouseFallback(
    config: MouseProtocolConfig,
    warnings: string[]
  ): Promise<MouseProtocolConfig> {
    config.enableMotion = false;
    config.enableFocus = false;
    warnings.push('WSL mouse adjustments applied');
    return config;
  }

  /**
   * Apply container mouse fallback
   */
  private async applyContainerMouseFallback(
    config: MouseProtocolConfig,
    warnings: string[]
  ): Promise<MouseProtocolConfig> {
    config.enableMotion = false;
    warnings.push('Container mouse adjustments applied');
    return config;
  }

  /**
   * Apply protocol fallback
   */
  private async applyProtocolFallback(
    config: MouseProtocolConfig,
    capabilities: PlatformMouseCapabilities
  ): Promise<{ newConfig: MouseProtocolConfig; level: number }> {
    const supportedProtocols = capabilities.supportedProtocols;
    
    if (supportedProtocols.includes('sgr')) {
      config.mode = 'sgr';
      return { newConfig: config, level: 0 };
    }
    
    if (supportedProtocols.includes('utf8')) {
      config.mode = 'utf8';
      config.enableMotion = false; // UTF-8 has limitations
      return { newConfig: config, level: 1 };
    }
    
    config.mode = 'urxvt';
    config.enableMotion = false;
    config.enableFocus = false;
    return { newConfig: config, level: 2 };
  }

  /**
   * Create strategy implementations
   */
  private async createMinimalMouseStrategy(): Promise<FallbackStrategy> {
    return {
      name: 'mouse-minimal',
      description: 'Minimal mouse support with basic click events only',
      compatibility: 0.8,
      performanceImpact: 0.1,
      featureCompleteness: 0.3,
      implement: async () => {
        // Test basic mouse functionality
        return process.stdout.isTTY;
      }
    };
  }

  private async createKeyboardOnlyStrategy(): Promise<FallbackStrategy> {
    return {
      name: 'mouse-keyboard-only',
      description: 'Disable mouse completely, keyboard navigation only',
      compatibility: 1.0,
      performanceImpact: 0.0,
      featureCompleteness: 0.0,
      implement: async () => {
        return true; // Always works
      }
    };
  }

  private async createBasicTerminalStrategy(): Promise<FallbackStrategy> {
    return {
      name: 'terminal-basic',
      description: 'Basic terminal with minimal colors and ASCII only',
      compatibility: 1.0,
      performanceImpact: 0.0,
      featureCompleteness: 0.5,
      implement: async () => {
        return true; // Always works
      }
    };
  }

  private async createLowPerformanceStrategy(): Promise<FallbackStrategy> {
    return {
      name: 'performance-low',
      description: 'Low performance mode with minimal caching and processing',
      compatibility: 1.0,
      performanceImpact: 0.0,
      featureCompleteness: 0.6,
      implement: async () => {
        return true; // Always works
      }
    };
  }
}