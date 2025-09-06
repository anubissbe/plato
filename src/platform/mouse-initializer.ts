/**
 * Task 4.6: Mouse Mode Initialization with Terminal Setup
 * Comprehensive mouse initialization system with proper cleanup
 */

import { MouseConfiguration, MouseConfigurationManager, ConfigurationContext } from './mouse-configuration.js';
import { PlatformDetector, PlatformCapabilities } from './platform-detector.js';
import { FallbackManager } from './fallback-manager.js';
import { ErrorHandler } from './error-handler.js';
import { MouseProtocolConfig, MOUSE_SEQUENCES } from '../tui/mouse-types.js';

export interface MouseInitializationOptions {
  /** Force enable mouse even in unsupported environments */
  forceEnable?: boolean;
  /** Configuration profile to use */
  profile?: 'default' | 'performance' | 'accessibility' | 'minimal' | 'developer' | 'gaming' | 'presentation';
  /** Custom configuration overrides */
  configOverrides?: Partial<MouseConfiguration>;
  /** Application context for optimization */
  applicationContext?: 'cli' | 'tui' | 'interactive' | 'presentation';
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
  /** Timeout for initialization */
  timeoutMs?: number;
  /** Enable debug mode */
  debug?: boolean;
  /** Test mode (don't actually initialize) */
  testMode?: boolean;
}

export interface MouseInitializationResult {
  /** Whether initialization was successful */
  success: boolean;
  /** Final configuration applied */
  configuration: MouseConfiguration;
  /** Platform capabilities detected */
  capabilities: PlatformCapabilities;
  /** Fallback level applied (0 = no fallbacks) */
  fallbackLevel: number;
  /** Initialization warnings */
  warnings: string[];
  /** Initialization errors */
  errors: string[];
  /** Performance metrics */
  metrics: {
    /** Time taken to initialize (ms) */
    initializationTimeMs: number;
    /** Memory usage (MB) */
    memoryUsageMB: number;
    /** Compatibility score (0-1) */
    compatibilityScore: number;
  };
  /** Cleanup function to call on shutdown */
  cleanup: () => Promise<void>;
}

export interface MouseState {
  /** Whether mouse is currently enabled */
  enabled: boolean;
  /** Current configuration */
  configuration: MouseConfiguration | null;
  /** Platform capabilities */
  capabilities: PlatformCapabilities | null;
  /** Initialization timestamp */
  initializationTime: number | null;
  /** Active terminal sequences */
  activeSequences: string[];
  /** Error handler instance */
  errorHandler: ErrorHandler | null;
  /** Cleanup handlers */
  cleanupHandlers: Array<() => Promise<void>>;
}

/**
 * Comprehensive mouse initialization and management system
 */
export class MouseInitializer {
  private static instance: MouseInitializer;
  private platformDetector: PlatformDetector;
  private configManager: MouseConfigurationManager;
  private fallbackManager: FallbackManager;
  private errorHandler: ErrorHandler;
  
  private state: MouseState = {
    enabled: false,
    configuration: null,
    capabilities: null,
    initializationTime: null,
    activeSequences: [],
    errorHandler: null,
    cleanupHandlers: []
  };

  private constructor() {
    this.platformDetector = PlatformDetector.getInstance();
    this.configManager = MouseConfigurationManager.getInstance();
    this.fallbackManager = FallbackManager.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MouseInitializer {
    if (!MouseInitializer.instance) {
      MouseInitializer.instance = new MouseInitializer();
    }
    return MouseInitializer.instance;
  }

  /**
   * Initialize mouse support with comprehensive setup
   */
  async initialize(options: MouseInitializationOptions = {}): Promise<MouseInitializationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    
    try {
      // Set timeout if specified
      if (options.timeoutMs) {
        return await Promise.race([
          this.performInitialization(options, warnings, errors, startTime),
          this.createTimeoutPromise(options.timeoutMs)
        ]);
      }

      return await this.performInitialization(options, warnings, errors, startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Initialization failed: ${errorMessage}`);
      
      return {
        success: false,
        configuration: this.configManager.getProfileConfiguration('minimal'),
        capabilities: await this.platformDetector.detectCapabilities(),
        fallbackLevel: 4,
        warnings,
        errors,
        metrics: {
          initializationTimeMs: Date.now() - startTime,
          memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
          compatibilityScore: 0
        },
        cleanup: async () => {}
      };
    }
  }

  /**
   * Quick initialization for fast startup
   */
  async quickInitialize(): Promise<{
    success: boolean;
    canUseMouse: boolean;
    recommendedProfile: string;
    warnings: string[];
  }> {
    try {
      const quickCheck = await this.platformDetector.quickPlatformCheck();
      const recommendations = await this.configManager.getConfigurationRecommendations();
      
      return {
        success: true,
        canUseMouse: quickCheck.canRunMouse,
        recommendedProfile: recommendations.profile,
        warnings: quickCheck.hasRestrictions ? ['Platform restrictions detected'] : []
      };
    } catch (error) {
      return {
        success: false,
        canUseMouse: false,
        recommendedProfile: 'minimal',
        warnings: [`Quick initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Re-initialize with new options
   */
  async reinitialize(options: MouseInitializationOptions): Promise<MouseInitializationResult> {
    // Clean up existing initialization
    await this.cleanup();
    
    // Re-initialize with new options
    return await this.initialize(options);
  }

  /**
   * Get current mouse state
   */
  getState(): MouseState {
    return { ...this.state };
  }

  /**
   * Update mouse configuration at runtime
   */
  async updateConfiguration(
    updates: Partial<MouseConfiguration>,
    reason: string = 'Runtime update'
  ): Promise<{
    success: boolean;
    newConfiguration: MouseConfiguration;
    appliedChanges: string[];
  }> {
    if (!this.state.configuration) {
      throw new Error('Mouse not initialized - cannot update configuration');
    }

    try {
      const result = await this.configManager.updateConfiguration(updates, reason);
      
      if (result.success) {
        // Apply terminal sequence changes
        await this.applyConfigurationChanges(this.state.configuration, result.newConfig);
        this.state.configuration = result.newConfig;
      }

      return {
        success: result.success,
        newConfiguration: result.newConfig,
        appliedChanges: result.changes
      };
    } catch (error) {
      throw new Error(`Configuration update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enable mouse support
   */
  async enable(): Promise<{ success: boolean; warnings: string[] }> {
    if (!this.state.configuration) {
      throw new Error('Mouse not initialized - call initialize() first');
    }

    const warnings: string[] = [];

    try {
      await this.applyTerminalSequences(this.state.configuration.protocol);
      this.state.enabled = true;
      
      return { success: true, warnings };
    } catch (error) {
      warnings.push(`Enable failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, warnings };
    }
  }

  /**
   * Disable mouse support
   */
  async disable(): Promise<{ success: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    try {
      await this.removeTerminalSequences();
      this.state.enabled = false;
      
      return { success: true, warnings };
    } catch (error) {
      warnings.push(`Disable failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, warnings };
    }
  }

  /**
   * Test mouse functionality
   */
  async testFunctionality(): Promise<{
    success: boolean;
    supportLevel: 'full' | 'partial' | 'minimal' | 'none';
    details: {
      terminalDetection: boolean;
      protocolSupport: boolean;
      eventGeneration: boolean;
      performanceTest: number;
    };
  }> {
    const details = {
      terminalDetection: false,
      protocolSupport: false,
      eventGeneration: false,
      performanceTest: 0
    };

    try {
      // Terminal detection
      details.terminalDetection = process.stdout.isTTY;
      
      // Protocol support
      if (this.state.capabilities) {
        details.protocolSupport = this.state.capabilities.mouse.supportLevel !== 'none';
      }
      
      // Performance test
      const startTime = Date.now();
      await this.simulateMouseEventProcessing();
      details.performanceTest = Date.now() - startTime;
      
      // Event generation (simplified test)
      details.eventGeneration = details.terminalDetection && details.protocolSupport;
      
      // Determine support level
      let supportLevel: 'full' | 'partial' | 'minimal' | 'none' = 'none';
      
      if (details.terminalDetection && details.protocolSupport && details.eventGeneration) {
        if (details.performanceTest < 50) {
          supportLevel = 'full';
        } else if (details.performanceTest < 100) {
          supportLevel = 'partial';
        } else {
          supportLevel = 'minimal';
        }
      } else if (details.terminalDetection) {
        supportLevel = 'minimal';
      }

      return {
        success: supportLevel !== 'none',
        supportLevel,
        details
      };
    } catch (error) {
      return {
        success: false,
        supportLevel: 'none',
        details
      };
    }
  }

  /**
   * Clean up mouse initialization
   */
  async cleanup(): Promise<void> {
    try {
      // Remove terminal sequences
      await this.removeTerminalSequences();
      
      // Run cleanup handlers
      for (const handler of this.state.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          console.warn('Cleanup handler failed:', error);
        }
      }
      
      // Reset state
      this.state = {
        enabled: false,
        configuration: null,
        capabilities: null,
        initializationTime: null,
        activeSequences: [],
        errorHandler: null,
        cleanupHandlers: []
      };
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  /**
   * Perform full initialization process
   */
  private async performInitialization(
    options: MouseInitializationOptions,
    warnings: string[],
    errors: string[],
    startTime: number
  ): Promise<MouseInitializationResult> {
    // Step 1: Platform detection
    const capabilities = await this.platformDetector.detectCapabilities();
    this.state.capabilities = capabilities;
    
    // Step 2: Create configuration context
    const context: ConfigurationContext = {
      capabilities,
      applicationType: options.applicationContext || 'tui',
      performanceConstraints: options.performanceConstraints,
      accessibilityRequirements: options.accessibilityRequirements
    };

    if (options.configOverrides) {
      context.userPreferences = options.configOverrides;
    }

    // Step 3: Generate optimal configuration
    let configuration: MouseConfiguration;
    if (options.profile) {
      configuration = this.configManager.getProfileConfiguration(options.profile);
      // Apply platform optimizations
      const optimizedConfig = await this.configManager.generateOptimalConfiguration(context);
      configuration = { ...configuration, ...optimizedConfig };
    } else {
      configuration = await this.configManager.generateOptimalConfiguration(context);
    }

    // Step 4: Apply configuration
    const configResult = await this.configManager.applyConfiguration(configuration);
    if (!configResult.success) {
      errors.push(...configResult.errors);
      warnings.push(...configResult.warnings);
    }
    
    configuration = configResult.appliedConfig;
    this.state.configuration = configuration;

    // Step 5: Calculate fallback level
    const fallbackLevel = await this.calculateFallbackLevel(configuration, capabilities);

    // Step 6: Initialize terminal sequences (if not in test mode)
    if (!options.testMode && configuration.enabled) {
      if (!options.forceEnable && capabilities.mouse.supportLevel === 'none') {
        warnings.push('Mouse support disabled - platform does not support mouse events');
        configuration.enabled = false;
      } else {
        try {
          await this.applyTerminalSequences(configuration.protocol);
          this.state.enabled = true;
        } catch (error) {
          errors.push(`Terminal setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          configuration.enabled = false;
        }
      }
    }

    // Step 7: Setup error handling
    this.state.errorHandler = this.errorHandler;
    this.setupErrorHandling(configuration);

    // Step 8: Setup cleanup handlers
    this.setupCleanupHandlers();

    // Step 9: Calculate metrics
    const endTime = Date.now();
    const metrics = {
      initializationTimeMs: endTime - startTime,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      compatibilityScore: this.calculateCompatibilityScore(capabilities, configuration)
    };

    // Step 10: Record initialization time
    this.state.initializationTime = endTime;

    return {
      success: errors.length === 0,
      configuration,
      capabilities,
      fallbackLevel,
      warnings,
      errors,
      metrics,
      cleanup: () => this.cleanup()
    };
  }

  /**
   * Apply terminal sequences for mouse protocol
   */
  private async applyTerminalSequences(protocol: MouseProtocolConfig): Promise<void> {
    const sequences: string[] = [];

    try {
      // Enable mouse tracking
      if (protocol.enableTracking) {
        process.stdout.write(MOUSE_SEQUENCES.ENABLE_TRACKING);
        sequences.push('tracking');
      }

      // Enable button tracking
      if (protocol.enableButtons) {
        process.stdout.write(MOUSE_SEQUENCES.ENABLE_BUTTONS);
        sequences.push('buttons');
      }

      // Enable protocol mode
      switch (protocol.mode) {
        case 'sgr':
          process.stdout.write(MOUSE_SEQUENCES.ENABLE_SGR);
          sequences.push('sgr');
          break;
        case 'utf8':
          process.stdout.write(MOUSE_SEQUENCES.ENABLE_UTF8);
          sequences.push('utf8');
          break;
        case 'urxvt':
          process.stdout.write(MOUSE_SEQUENCES.ENABLE_URXVT);
          sequences.push('urxvt');
          break;
      }

      // Enable motion tracking
      if (protocol.enableMotion) {
        // Motion tracking is enabled by default with button tracking
        sequences.push('motion');
      }

      // Enable focus events
      if (protocol.enableFocus) {
        process.stdout.write(MOUSE_SEQUENCES.ENABLE_FOCUS);
        sequences.push('focus');
      }

      this.state.activeSequences = sequences;
    } catch (error) {
      throw new Error(`Failed to apply terminal sequences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove terminal sequences
   */
  private async removeTerminalSequences(): Promise<void> {
    try {
      // Disable all possible mouse sequences
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_TRACKING);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_BUTTONS);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_SGR);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_UTF8);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_URXVT);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_FOCUS);
      
      this.state.activeSequences = [];
    } catch (error) {
      console.warn('Failed to remove terminal sequences:', error);
    }
  }

  /**
   * Apply configuration changes
   */
  private async applyConfigurationChanges(
    oldConfig: MouseConfiguration,
    newConfig: MouseConfiguration
  ): Promise<void> {
    // Check if protocol changed
    if (oldConfig.protocol.mode !== newConfig.protocol.mode ||
        oldConfig.protocol.enableTracking !== newConfig.protocol.enableTracking ||
        oldConfig.protocol.enableButtons !== newConfig.protocol.enableButtons ||
        oldConfig.protocol.enableMotion !== newConfig.protocol.enableMotion ||
        oldConfig.protocol.enableFocus !== newConfig.protocol.enableFocus) {
      
      // Re-apply terminal sequences
      await this.removeTerminalSequences();
      if (newConfig.enabled) {
        await this.applyTerminalSequences(newConfig.protocol);
      }
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(configuration: MouseConfiguration): void {
    if (configuration.debug.enabled) {
      this.errorHandler.enableDebugMode();
    }

    // Setup uncaught exception handler
    const cleanupHandler = async () => {
      await this.cleanup();
    };

    process.on('SIGINT', cleanupHandler);
    process.on('SIGTERM', cleanupHandler);
    process.on('uncaughtException', cleanupHandler);
    process.on('unhandledRejection', cleanupHandler);

    this.state.cleanupHandlers.push(cleanupHandler);
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanupHandlers(): void {
    // Add custom cleanup logic
    this.state.cleanupHandlers.push(async () => {
      // Custom cleanup logic here
    });
  }

  /**
   * Calculate fallback level
   */
  private async calculateFallbackLevel(
    configuration: MouseConfiguration,
    capabilities: PlatformCapabilities
  ): Promise<number> {
    let level = 0;

    if (!configuration.enabled) level = 4;
    else if (capabilities.mouse.supportLevel === 'minimal') level = 3;
    else if (capabilities.mouse.supportLevel === 'partial') level = 2;
    else if (capabilities.environment.isWSL || capabilities.environment.isContainer) level = 1;

    return level;
  }

  /**
   * Calculate compatibility score
   */
  private calculateCompatibilityScore(
    capabilities: PlatformCapabilities,
    configuration: MouseConfiguration
  ): number {
    let score = 1.0;

    // Reduce score for platform limitations
    if (capabilities.mouse.supportLevel === 'none') score -= 0.5;
    else if (capabilities.mouse.supportLevel === 'minimal') score -= 0.3;
    else if (capabilities.mouse.supportLevel === 'partial') score -= 0.1;

    // Reduce score for environment constraints
    if (capabilities.environment.isCI) score -= 0.3;
    if (capabilities.environment.isContainer) score -= 0.1;
    if (capabilities.environment.isWSL) score -= 0.1;

    // Adjust for configuration complexity
    if (!configuration.enabled) score = 0.1;

    return Math.max(0, score);
  }

  /**
   * Simulate mouse event processing for testing
   */
  private async simulateMouseEventProcessing(): Promise<void> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<MouseInitializationResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Initialization timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}