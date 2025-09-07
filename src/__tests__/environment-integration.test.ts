/**
 * Task 4.8: Environment-Specific Integration Tests
 * Comprehensive testing for cross-platform mouse integration
 */

import { PlatformDetector, PlatformCapabilities } from '../platform/platform-detector.js';
import { FallbackManager } from '../platform/fallback-manager.js';
import { MouseConfigurationManager, ConfigurationContext } from '../platform/mouse-configuration.js';
import { MouseInitializer, MouseInitializationOptions } from '../platform/mouse-initializer.js';
import { ErrorHandler, ErrorContext } from '../platform/error-handler.js';

// Mock environment variables for testing
const mockEnvironmentVariables: Record<string, Record<string, string>> = {
  'windows': {
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'Windows Terminal',
    OS: 'Windows_NT'
  },
  'wsl': {
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'Windows Terminal',
    WSL_DISTRO_NAME: 'Ubuntu',
    WSLENV: 'PATH/l:PS1'
  },
  'macos': {
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'iTerm.app',
    COLORTERM: 'truecolor'
  },
  'linux': {
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'gnome-terminal',
    COLORTERM: 'truecolor'
  },
  'container': {
    TERM: 'xterm',
    container: 'docker'
  },
  'ci': {
    TERM: 'dumb',
    CI: 'true',
    GITHUB_ACTIONS: 'true'
  }
};

// Test utilities
class TestEnvironment {
  private originalEnv: Record<string, string | undefined> = {};
  private originalPlatform: string;
  private originalIsTTY: boolean;

  constructor() {
    this.originalPlatform = process.platform;
    this.originalIsTTY = process.stdout.isTTY;
  }

  /**
   * Setup test environment
   */
  setup(environment: keyof typeof mockEnvironmentVariables, platform?: string): void {
    // Save original environment
    Object.keys(mockEnvironmentVariables[environment]).forEach(key => {
      this.originalEnv[key] = process.env[key];
    });

    // Apply mock environment
    Object.assign(process.env, mockEnvironmentVariables[environment]);

    // Mock platform if specified
    if (platform) {
      Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true
      });
    }

    // Mock TTY based on environment
    const mockIsTTY = environment !== 'ci';
    Object.defineProperty(process.stdout, 'isTTY', {
      value: mockIsTTY,
      configurable: true
    });
  }

  /**
   * Restore original environment
   */
  restore(): void {
    // Restore environment variables
    Object.keys(this.originalEnv).forEach(key => {
      if (this.originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = this.originalEnv[key];
      }
    });

    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: this.originalPlatform,
      configurable: true
    });

    // Restore TTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: this.originalIsTTY,
      configurable: true
    });
  }
}

describe('Environment Integration Tests', () => {
  let testEnv: TestEnvironment;
  let platformDetector: PlatformDetector;
  let fallbackManager: FallbackManager;
  let configManager: MouseConfigurationManager;
  let mouseInitializer: MouseInitializer;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    testEnv = new TestEnvironment();
    platformDetector = PlatformDetector.getInstance();
    fallbackManager = FallbackManager.getInstance();
    configManager = MouseConfigurationManager.getInstance();
    mouseInitializer = MouseInitializer.getInstance();
    errorHandler = ErrorHandler.getInstance();

    // Clear any cached data
    (platformDetector as any).capabilities = null;
    (platformDetector as any).detectionPromise = null;
    (fallbackManager as any).capabilities = null;
    (configManager as any).currentConfig = null;
  });

  afterEach(async () => {
    testEnv.restore();
    await mouseInitializer.cleanup();
  });

  describe('Windows Environment', () => {
    beforeEach(() => {
      testEnv.setup('windows', 'win32');
    });

    test('should detect Windows platform correctly', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      
      expect(capabilities.platform).toBe('windows');
      expect(capabilities.environment.isWSL).toBe(false);
      expect(capabilities.environment.isContainer).toBe(false);
      expect(capabilities.terminal.name).toBe('Windows Terminal');
      expect(capabilities.mouse.supportLevel).toBe('full');
    });

    test('should generate appropriate Windows configuration', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.enabled).toBe(true);
      expect(config.protocol.mode).toBe('sgr');
      expect(config.features.clicks).toBe(true);
      expect(config.features.scrolling).toBe(true);
    });

    test('should initialize mouse support successfully', async () => {
      const options: MouseInitializationOptions = {
        testMode: true // Don't actually apply terminal sequences in tests
      };

      const result = await mouseInitializer.initialize(options);
      
      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBeLessThanOrEqual(1);
      expect(result.configuration.enabled).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('WSL Environment', () => {
    beforeEach(() => {
      testEnv.setup('wsl', 'linux');
    });

    test('should detect WSL environment correctly', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      
      expect(capabilities.platform).toBe('linux');
      expect(capabilities.environment.isWSL).toBe(true);
      expect(capabilities.environment.wslVersion).toBeDefined();
      expect(capabilities.mouse.supportLevel).toBe('partial');
    });

    test('should apply WSL-specific optimizations', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.enabled).toBe(true);
      expect(config.features.motionTracking).toBe(false); // WSL limitation
      expect(config.features.hovering).toBe(false); // WSL limitation
      expect(config.performance.throttleMs).toBeGreaterThanOrEqual(25); // WSL optimization
    });

    test('should handle WSL mouse initialization with fallbacks', async () => {
      const options: MouseInitializationOptions = {
        testMode: true
      };

      const result = await mouseInitializer.initialize(options);
      
      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some(w => w.includes('WSL'))).toBe(true);
    });
  });

  describe('macOS Environment', () => {
    beforeEach(() => {
      testEnv.setup('macos', 'darwin');
    });

    test('should detect macOS platform correctly', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      
      expect(capabilities.platform).toBe('darwin');
      expect(capabilities.environment.isWSL).toBe(false);
      expect(capabilities.terminal.name).toBe('iTerm.app');
      expect(capabilities.terminal.features.trueColor).toBe(true);
      expect(capabilities.mouse.supportLevel).toBe('full');
    });

    test('should optimize for macOS performance', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.enabled).toBe(true);
      expect(config.protocol.mode).toBe('sgr');
      expect(config.features.motionTracking).toBe(false); // Disabled by default for performance
      expect(config.features.hovering).toBe(false); // Disabled by default
    });
  });

  describe('Linux Environment', () => {
    beforeEach(() => {
      testEnv.setup('linux', 'linux');
    });

    test('should detect Linux platform correctly', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      
      expect(capabilities.platform).toBe('linux');
      expect(capabilities.environment.isWSL).toBe(false);
      expect(capabilities.terminal.features.trueColor).toBe(true);
      expect(capabilities.mouse.supportLevel).toBe('full');
    });

    test('should handle Linux-specific optimizations', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.enabled).toBe(true);
      expect(config.protocol.mode).toBe('sgr');
      expect(config.performance.throttleMs).toBeLessThanOrEqual(16);
    });
  });

  describe('Container Environment', () => {
    beforeEach(() => {
      testEnv.setup('container', 'linux');
    });

    test('should detect container environment', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      
      expect(capabilities.environment.isContainer).toBe(true);
      expect(['none', 'minimal', 'partial']).toContain(capabilities.mouse.supportLevel);
    });

    test('should apply container-specific limitations', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.features.motionTracking).toBe(false);
      expect(config.performance.throttleMs).toBeGreaterThanOrEqual(16);
    });

    test('should handle container initialization gracefully', async () => {
      const options: MouseInitializationOptions = {
        testMode: true
      };

      const result = await mouseInitializer.initialize(options);
      
      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some(w => w.includes('container') || w.includes('Container'))).toBe(true);
    });
  });

  describe('CI Environment', () => {
    beforeEach(() => {
      testEnv.setup('ci', 'linux');
    });

    test('should detect CI environment', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      
      expect(capabilities.environment.isCI).toBe(true);
      expect(capabilities.terminal.colorDepth).toBeLessThanOrEqual(1);
    });

    test('should disable mouse in CI environment', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.enabled).toBe(false);
    });

    test('should handle CI initialization with keyboard-only mode', async () => {
      const options: MouseInitializationOptions = {
        testMode: true
      };

      const result = await mouseInitializer.initialize(options);
      
      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBe(4); // Maximum fallback
      expect(result.configuration.enabled).toBe(false);
      expect(result.warnings.some(w => w.includes('CI') || w.includes('keyboard'))).toBe(true);
    });
  });

  describe('Fallback System Integration', () => {
    test('should provide platform-specific fallback recommendations', async () => {
      // Test different environments
      const environments = ['windows', 'wsl', 'macos', 'linux', 'container', 'ci'] as const;
      
      for (const env of environments) {
        testEnv.setup(env, env === 'wsl' ? 'linux' : env === 'windows' ? 'win32' : env === 'macos' ? 'darwin' : 'linux');
        
        const recommendations = await fallbackManager.getFallbackRecommendations();
        
        expect(recommendations).toBeDefined();
        expect(recommendations.mouse).toBeDefined();
        expect(recommendations.terminal).toBeDefined();
        expect(recommendations.performance).toBeDefined();
        expect(recommendations.general).toBeDefined();

        if (env === 'ci') {
          expect(recommendations.general.some(r => r.includes('CI'))).toBe(true);
        }
        
        if (env === 'wsl') {
          expect(recommendations.mouse.some(r => r.includes('WSL'))).toBe(true);
        }
        
        if (env === 'container') {
          expect(recommendations.performance.some(r => r.includes('container') || r.includes('Container'))).toBe(true);
        }
      }
    });

    test('should adapt configuration based on platform capabilities', async () => {
      const testCases = [
        { env: 'windows', platform: 'win32', expectedSupport: 'full' },
        { env: 'wsl', platform: 'linux', expectedSupport: 'partial' },
        { env: 'container', platform: 'linux', expectedSupport: 'partial' },
        { env: 'ci', platform: 'linux', expectedSupport: 'none' }
      ] as const;

      for (const testCase of testCases) {
        testEnv.setup(testCase.env, testCase.platform);
        
        const mouseConfig = await fallbackManager.getOptimalMouseConfig();
        
        if (testCase.expectedSupport === 'none') {
          expect(mouseConfig.config.enableTracking).toBe(false);
        } else {
          expect(mouseConfig.config.enableTracking).toBe(true);
        }
        
        expect(mouseConfig.fallbackLevel).toBeGreaterThanOrEqual(0);
        expect(mouseConfig.warnings).toBeDefined();
      }
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle platform detection errors gracefully', async () => {
      // Mock a platform detection error
      const originalDetect = platformDetector.detectCapabilities;
      (platformDetector as any).detectCapabilities = jest.fn().mockRejectedValue(new Error('Platform detection failed'));

      const context = errorHandler.createErrorContext('platform-detector', 'detectCapabilities');
      const result = await errorHandler.handleError(new Error('Platform detection failed'), context);

      expect(result.success).toBe(true);
      expect(result.action).toContain('fallback');
      expect(result.messages.length).toBeGreaterThan(0);

      // Restore original method
      (platformDetector as any).detectCapabilities = originalDetect;
    });

    test('should handle mouse initialization errors with recovery', async () => {
      testEnv.setup('ci', 'linux'); // Environment where mouse might fail

      const options: MouseInitializationOptions = {
        testMode: true,
        forceEnable: true // Try to force enable in unsupported environment
      };

      const result = await mouseInitializer.initialize(options);
      
      // Should succeed with fallbacks even in hostile environment
      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should export meaningful error reports', async () => {
      // Generate some errors
      const context1 = errorHandler.createErrorContext('test-component', 'test-operation');
      await errorHandler.handleError(new Error('Test error 1'), context1);
      
      const context2 = errorHandler.createErrorContext('mouse-initializer', 'initialize');
      await errorHandler.handleError(new Error('Test error 2'), context2);

      const report = errorHandler.exportErrorReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.metrics.totalErrors).toBe(2);
      expect(report.recentErrors).toHaveLength(2);
      expect(report.platformInfo.platform).toBeDefined();
      expect(report.platformInfo.nodeVersion).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    test('should optimize performance based on platform tier', async () => {
      // Test low-performance environment
      const mockLowPerf = jest.spyOn(require('os'), 'cpus').mockReturnValue([{}, {}]); // 2 cores
      const mockLowMem = jest.spyOn(require('os'), 'totalmem').mockReturnValue(1024 * 1024 * 1024); // 1GB

      const capabilities = await platformDetector.detectCapabilities();
      expect(capabilities.performance.tier).toBe('low');

      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui'
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.performance.throttleMs).toBeGreaterThanOrEqual(50);
      expect(config.performance.maxEventsPerSecond).toBeLessThanOrEqual(20);
      expect(config.features.motionTracking).toBe(false);
      expect(config.features.hovering).toBe(false);

      mockLowPerf.mockRestore();
      mockLowMem.mockRestore();
    });

    test('should measure initialization performance', async () => {
      const options: MouseInitializationOptions = {
        testMode: true
      };

      const result = await mouseInitializer.initialize(options);
      
      expect(result.metrics.initializationTimeMs).toBeGreaterThan(0);
      expect(result.metrics.initializationTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metrics.memoryUsageMB).toBeGreaterThan(0);
      expect(result.metrics.compatibilityScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.compatibilityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration Persistence', () => {
    test('should handle configuration updates at runtime', async () => {
      const options: MouseInitializationOptions = {
        testMode: true
      };

      const result = await mouseInitializer.initialize(options);
      expect(result.success).toBe(true);

      const updates = {
        features: {
          ...result.configuration.features,
          hovering: true
        }
      };

      const updateResult = await mouseInitializer.updateConfiguration(updates, 'Test update');
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.newConfiguration.features.hovering).toBe(true);
      expect(updateResult.appliedChanges).toContain('Updated features');
    });

    test('should export and import configurations', async () => {
      const options: MouseInitializationOptions = {
        testMode: true
      };

      await mouseInitializer.initialize(options);
      
      const exportData = configManager.exportConfiguration();
      expect(exportData.config).toBeDefined();
      expect(exportData.metadata).toBeDefined();
      expect(exportData.metadata.platform).toBe(process.platform);

      const importResult = await configManager.importConfiguration(exportData);
      expect(importResult.success).toBe(true);
    });
  });

  describe('Accessibility Integration', () => {
    test('should handle accessibility requirements', async () => {
      const capabilities = await platformDetector.detectCapabilities();
      const context: ConfigurationContext = {
        capabilities,
        applicationType: 'tui',
        accessibilityRequirements: {
          reducedMotion: true,
          screenReader: true
        }
      };

      const config = await configManager.generateOptimalConfiguration(context);
      
      expect(config.accessibility.reducedMotion).toBe(true);
      expect(config.accessibility.keyboardAlternatives).toBe(true);
      expect(config.features.motionTracking).toBe(false);
      expect(config.features.hovering).toBe(false);
    });

    test('should provide accessibility profile', async () => {
      const config = configManager.getProfileConfiguration('accessibility');
      
      expect(config.accessibility.largerClickTargets).toBe(true);
      expect(config.accessibility.reducedMotion).toBe(true);
      expect(config.accessibility.simplifiedInteractions).toBe(true);
      expect(config.accessibility.keyboardAlternatives).toBe(true);
      expect(config.features.hovering).toBe(false);
      expect(config.features.motionTracking).toBe(false);
    });
  });
});

// Mock implementations for testing
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn((path: string) => {
    // Mock filesystem existence based on environment
    if (path === '/.dockerenv') return process.env.container === 'docker';
    if (path === '/proc/version') return process.platform === 'linux';
    if (path === '/') return process.platform !== 'win32';
    if (path === 'C:\\') return process.platform === 'win32';
    return false;
  }),
  readFileSync: jest.fn((path: string) => {
    if (path === '/proc/version') {
      return process.env.WSL_DISTRO_NAME ? 'Linux version 4.4.0-microsoft-wsl' : 'Linux version 5.0.0';
    }
    return '';
  })
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    return jest.fn(async (command: string) => {
      // Mock command execution results
      if (command.includes('uname -r')) {
        return { stdout: '5.0.0-generic\n' };
      }
      if (command.includes('cat /proc/version')) {
        return { 
          stdout: process.env.WSL_DISTRO_NAME ? 'Linux version 4.4.0-microsoft-wsl\n' : 'Linux version 5.0.0\n' 
        };
      }
      if (command.includes('which')) {
        // Mock binary availability
        const binary = command.split(' ').pop();
        const availableBinaries = ['git', 'curl', 'grep', 'sed', 'awk'];
        if (availableBinaries.includes(binary || '')) {
          return { stdout: `/usr/bin/${binary}\n` };
        }
        throw new Error('Command not found');
      }
      if (command.includes('df -T')) {
        return { stdout: 'Filesystem Type Used Available Use% Mounted\n/dev/sda1 ext4 10G 5G 50% /\n' };
      }
      return { stdout: '' };
    });
  })
}));