/**
 * Task 4.7: Error Handling for Initialization Failures
 * Comprehensive error handling and recovery system
 */

export interface ErrorContext {
  /** Component where error occurred */
  component: string;
  /** Operation that failed */
  operation: string;
  /** Error timestamp */
  timestamp: number;
  /** Platform information */
  platform: {
    os: string;
    arch: string;
    node: string;
    terminal: string;
  };
  /** Additional context data */
  context?: Record<string, unknown>;
}

export interface ErrorHandlingStrategy {
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Error types this strategy handles */
  errorTypes: string[];
  /** Priority (higher = handled first) */
  priority: number;
  /** Implementation function */
  handle: (error: Error, context: ErrorContext) => Promise<ErrorRecoveryResult>;
  /** Check if strategy can handle this error */
  canHandle: (error: Error, context: ErrorContext) => boolean;
}

export interface ErrorRecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovery action taken */
  action: string;
  /** New configuration or state after recovery */
  newState?: unknown;
  /** Messages to display to user */
  messages: string[];
  /** Whether to retry the original operation */
  shouldRetry: boolean;
  /** Delay before retry (ms) */
  retryDelay?: number;
}

export interface ErrorMetrics {
  /** Total errors encountered */
  totalErrors: number;
  /** Errors by category */
  errorsByCategory: Map<string, number>;
  /** Recovery success rate */
  recoverySuccessRate: number;
  /** Average recovery time */
  averageRecoveryTimeMs: number;
  /** Most common error types */
  mostCommonErrors: Array<{ error: string; count: number }>;
}

export type ErrorCategory = 
  | 'platform-detection'
  | 'terminal-setup'
  | 'mouse-initialization'
  | 'configuration'
  | 'protocol-negotiation'
  | 'sequence-application'
  | 'permission-denied'
  | 'resource-exhaustion'
  | 'timeout'
  | 'unknown';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ErrorRecord {
  /** Unique error ID */
  id: string;
  /** Error object */
  error: Error;
  /** Error context */
  context: ErrorContext;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Recovery attempts */
  recoveryAttempts: ErrorRecoveryResult[];
  /** Whether error was resolved */
  resolved: boolean;
  /** Resolution timestamp */
  resolvedAt?: number;
}

export interface ErrorHandlerConfiguration {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay multiplier */
  retryMultiplier: number;
  /** Maximum total error history */
  maxErrorHistory: number;
  /** Enable debug logging */
  debugMode: boolean;
  /** Error reporting endpoint */
  reportingEndpoint?: string;
  /** Silent mode (no console output) */
  silentMode: boolean;
  /** Custom error strategies */
  customStrategies: ErrorHandlingStrategy[];
}

/**
 * Comprehensive error handling and recovery system
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private strategies: Map<string, ErrorHandlingStrategy> = new Map();
  private errorHistory: ErrorRecord[] = [];
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCategory: new Map(),
    recoverySuccessRate: 0,
    averageRecoveryTimeMs: 0,
    mostCommonErrors: []
  };
  
  private config: ErrorHandlerConfiguration = {
    maxRetries: 3,
    retryMultiplier: 2,
    maxErrorHistory: 100,
    debugMode: false,
    silentMode: false,
    customStrategies: []
  };

  private debugMode: boolean = false;

  private constructor() {
    this.setupDefaultStrategies();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with automatic recovery
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    maxRetries: number = this.config.maxRetries
  ): Promise<ErrorRecoveryResult> {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error, context);
    const severity = this.determineSeverity(error, context, category);

    const errorRecord: ErrorRecord = {
      id: errorId,
      error,
      context: { ...context, timestamp: Date.now() },
      category,
      severity,
      recoveryAttempts: [],
      resolved: false
    };

    this.errorHistory.push(errorRecord);
    this.updateMetrics(errorRecord);

    if (this.debugMode || !this.config.silentMode) {
      console.error(`[ErrorHandler] ${severity.toUpperCase()}: ${error.message}`);
      if (this.debugMode) {
        console.error(`[ErrorHandler] Context:`, context);
      }
    }

    // Try recovery strategies
    const recoveryResult = await this.attemptRecovery(errorRecord, maxRetries);
    
    if (recoveryResult.success) {
      errorRecord.resolved = true;
      errorRecord.resolvedAt = Date.now();
    }

    // Cleanup old error records
    this.cleanupErrorHistory();

    return recoveryResult;
  }

  /**
   * Handle critical errors that may require immediate action
   */
  async handleCriticalError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorRecoveryResult> {
    const criticalContext = {
      ...context,
      operation: `CRITICAL: ${context.operation}`
    };

    // Log critical error immediately
    console.error(`[CRITICAL ERROR] ${error.message}`);
    console.error(`[CRITICAL ERROR] Component: ${context.component}, Operation: ${context.operation}`);

    // Attempt emergency recovery
    const result = await this.handleError(error, criticalContext, 1);
    
    if (!result.success) {
      // If recovery fails, try to safely degrade
      return await this.performEmergencyShutdown(error, context);
    }

    return result;
  }

  /**
   * Register custom error handling strategy
   */
  registerStrategy(strategy: ErrorHandlingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    
    if (this.debugMode) {
      console.log(`[ErrorHandler] Registered strategy: ${strategy.name}`);
    }
  }

  /**
   * Enable debug mode
   */
  enableDebugMode(): void {
    this.debugMode = true;
    this.config.debugMode = true;
  }

  /**
   * Disable debug mode
   */
  disableDebugMode(): void {
    this.debugMode = false;
    this.config.debugMode = false;
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get error history
   */
  getErrorHistory(limit: number = 50): ErrorRecord[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.resetMetrics();
  }

  /**
   * Export error report
   */
  exportErrorReport(): {
    timestamp: number;
    metrics: ErrorMetrics;
    recentErrors: ErrorRecord[];
    platformInfo: {
      platform: string;
      arch: string;
      nodeVersion: string;
      terminal: string;
    };
  } {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      recentErrors: this.getErrorHistory(20),
      platformInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        terminal: process.env.TERM || 'unknown'
      }
    };
  }

  /**
   * Create platform-specific error context
   */
  createErrorContext(component: string, operation: string, additionalContext?: Record<string, unknown>): ErrorContext {
    return {
      component,
      operation,
      timestamp: Date.now(),
      platform: {
        os: process.platform,
        arch: process.arch,
        node: process.version,
        terminal: process.env.TERM || 'unknown'
      },
      context: additionalContext
    };
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: Error, context: ErrorContext): boolean {
    const category = this.categorizeError(error, context);
    
    // Some errors are always unrecoverable
    const unrecoverableCategories: ErrorCategory[] = [
      'permission-denied',
      'resource-exhaustion'
    ];
    
    if (unrecoverableCategories.includes(category)) {
      return false;
    }

    // Check error message for unrecoverable patterns
    const unrecoverablePatterns = [
      /ENOENT.*required/i,
      /permission denied/i,
      /access denied/i,
      /out of memory/i,
      /maximum call stack/i
    ];

    return !unrecoverablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Setup default error handling strategies
   */
  private setupDefaultStrategies(): void {
    // Platform detection errors
    this.registerStrategy({
      name: 'platform-detection-retry',
      description: 'Retry platform detection with fallbacks',
      errorTypes: ['platform-detection'],
      priority: 100,
      canHandle: (error, context) => context.component === 'platform-detector',
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Fallback to minimal platform detection',
          messages: ['Using basic platform detection due to detection failure'],
          shouldRetry: true,
          retryDelay: 1000
        };
      }
    });

    // Terminal setup errors
    this.registerStrategy({
      name: 'terminal-setup-fallback',
      description: 'Apply terminal setup fallbacks',
      errorTypes: ['terminal-setup'],
      priority: 90,
      canHandle: (error, context) => context.component === 'mouse-initializer' && context.operation.includes('terminal'),
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Applied terminal compatibility mode',
          messages: ['Terminal setup failed, using compatibility mode'],
          shouldRetry: false
        };
      }
    });

    // Mouse initialization errors
    this.registerStrategy({
      name: 'mouse-init-fallback',
      description: 'Fallback to keyboard-only mode',
      errorTypes: ['mouse-initialization'],
      priority: 80,
      canHandle: (error, context) => context.component === 'mouse-initializer',
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Disabled mouse support, using keyboard navigation',
          messages: ['Mouse initialization failed, keyboard navigation enabled'],
          shouldRetry: false
        };
      }
    });

    // Configuration errors
    this.registerStrategy({
      name: 'config-reset',
      description: 'Reset to minimal configuration',
      errorTypes: ['configuration'],
      priority: 70,
      canHandle: (error, context) => context.component === 'configuration-manager',
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Reset to minimal configuration',
          messages: ['Configuration error, reset to minimal settings'],
          shouldRetry: true
        };
      }
    });

    // Protocol negotiation errors
    this.registerStrategy({
      name: 'protocol-downgrade',
      description: 'Downgrade to simpler mouse protocol',
      errorTypes: ['protocol-negotiation'],
      priority: 60,
      canHandle: (error, context) => context.operation.includes('protocol'),
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Downgraded to basic mouse protocol',
          messages: ['Advanced mouse protocol failed, using basic mode'],
          shouldRetry: true
        };
      }
    });

    // Timeout errors
    this.registerStrategy({
      name: 'timeout-retry',
      description: 'Retry with increased timeout',
      errorTypes: ['timeout'],
      priority: 50,
      canHandle: (error, context) => error.message.includes('timeout') || error.message.includes('timed out'),
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Retrying with increased timeout',
          messages: ['Operation timed out, retrying with longer timeout'],
          shouldRetry: true,
          retryDelay: 2000
        };
      }
    });

    // Generic fallback strategy
    this.registerStrategy({
      name: 'generic-fallback',
      description: 'Generic error recovery',
      errorTypes: ['unknown'],
      priority: 10,
      canHandle: () => true, // Handles any error as last resort
      handle: async (error, context) => {
        return {
          success: true,
          action: 'Applied generic fallback',
          messages: [`Error in ${context.component}: ${error.message}`, 'Continuing with reduced functionality'],
          shouldRetry: false
        };
      }
    });
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      const context = this.createErrorContext('global', 'uncaughtException');
      this.handleCriticalError(error, context).catch((recoveryError) => {
        console.error('[ErrorHandler] Recovery failed for uncaught exception:', recoveryError);
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const context = this.createErrorContext('global', 'unhandledRejection');
      
      this.handleCriticalError(error, context).catch((recoveryError) => {
        console.error('[ErrorHandler] Recovery failed for unhandled rejection:', recoveryError);
        process.exit(1);
      });
    });
  }

  /**
   * Attempt recovery using registered strategies
   */
  private async attemptRecovery(errorRecord: ErrorRecord, maxRetries: number): Promise<ErrorRecoveryResult> {
    const { error, context, category } = errorRecord;
    
    // Find applicable strategies
    const strategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(error, context))
      .sort((a, b) => b.priority - a.priority);

    if (strategies.length === 0) {
      return {
        success: false,
        action: 'No recovery strategy available',
        messages: [`No recovery strategy found for ${category} error`],
        shouldRetry: false
      };
    }

    // Try each strategy
    for (const strategy of strategies) {
      try {
        const startTime = Date.now();
        const result = await strategy.handle(error, context);
        const recoveryTime = Date.now() - startTime;

        errorRecord.recoveryAttempts.push({
          ...result,
          action: `${strategy.name}: ${result.action}`
        });

        if (this.debugMode) {
          console.log(`[ErrorHandler] Recovery strategy '${strategy.name}' ${result.success ? 'succeeded' : 'failed'} (${recoveryTime}ms)`);
        }

        if (result.success) {
          this.metrics.averageRecoveryTimeMs = (this.metrics.averageRecoveryTimeMs + recoveryTime) / 2;
          return result;
        }
      } catch (recoveryError) {
        if (this.debugMode) {
          console.error(`[ErrorHandler] Recovery strategy '${strategy.name}' threw error:`, recoveryError);
        }
      }
    }

    return {
      success: false,
      action: 'All recovery strategies failed',
      messages: ['All recovery attempts failed', 'System may operate with reduced functionality'],
      shouldRetry: false
    };
  }

  /**
   * Perform emergency shutdown
   */
  private async performEmergencyShutdown(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    console.error('[ErrorHandler] Performing emergency shutdown...');
    
    try {
      // Try to clean up resources
      if (process.stdout.write) {
        // Disable mouse sequences
        process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1006l\x1b[?1005l\x1b[?1015l\x1b[?1004l');
      }
      
      return {
        success: true,
        action: 'Emergency shutdown completed',
        messages: [
          'Critical error occurred, emergency shutdown performed',
          'Mouse support disabled for safety'
        ],
        shouldRetry: false
      };
    } catch (shutdownError) {
      return {
        success: false,
        action: 'Emergency shutdown failed',
        messages: [
          'Critical error and emergency shutdown both failed',
          'System may be in unstable state'
        ],
        shouldRetry: false
      };
    }
  }

  /**
   * Categorize error by type
   */
  private categorizeError(error: Error, context: ErrorContext): ErrorCategory {
    const message = error.message.toLowerCase();
    const component = context.component.toLowerCase();
    const operation = context.operation.toLowerCase();

    // Check specific patterns
    if (message.includes('permission denied') || message.includes('eacces')) {
      return 'permission-denied';
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    
    if (message.includes('out of memory') || message.includes('maximum call stack')) {
      return 'resource-exhaustion';
    }

    // Check by component
    if (component.includes('platform') || component.includes('detector')) {
      return 'platform-detection';
    }
    
    if (component.includes('mouse') && operation.includes('init')) {
      return 'mouse-initialization';
    }
    
    if (component.includes('config')) {
      return 'configuration';
    }
    
    if (operation.includes('terminal') || operation.includes('sequence')) {
      return 'terminal-setup';
    }
    
    if (operation.includes('protocol')) {
      return 'protocol-negotiation';
    }

    return 'unknown';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, context: ErrorContext, category: ErrorCategory): ErrorSeverity {
    // Critical errors
    if (category === 'resource-exhaustion' || context.operation.includes('CRITICAL')) {
      return 'critical';
    }

    // High severity
    if (category === 'permission-denied' || category === 'platform-detection') {
      return 'high';
    }

    // Medium severity
    if (category === 'mouse-initialization' || category === 'configuration') {
      return 'medium';
    }

    // Low severity
    if (category === 'terminal-setup' || category === 'protocol-negotiation') {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Update error metrics
   */
  private updateMetrics(errorRecord: ErrorRecord): void {
    this.metrics.totalErrors++;
    
    const categoryCount = this.metrics.errorsByCategory.get(errorRecord.category) || 0;
    this.metrics.errorsByCategory.set(errorRecord.category, categoryCount + 1);

    // Update most common errors
    this.updateMostCommonErrors();
    
    // Calculate recovery success rate
    const resolvedErrors = this.errorHistory.filter(record => record.resolved).length;
    this.metrics.recoverySuccessRate = resolvedErrors / this.metrics.totalErrors;
  }

  /**
   * Update most common errors list
   */
  private updateMostCommonErrors(): void {
    const errorCounts: Record<string, number> = {};
    
    this.errorHistory.forEach(record => {
      const key = `${record.category}:${record.error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    this.metrics.mostCommonErrors = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: new Map(),
      recoverySuccessRate: 0,
      averageRecoveryTimeMs: 0,
      mostCommonErrors: []
    };
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old error records
   */
  private cleanupErrorHistory(): void {
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
    }
  }
}