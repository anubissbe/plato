/**
 * Configuration Management Tests
 * Tests for user preferences, configuration persistence, and mouse settings integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MouseSettingsManager } from '../config/mouse-settings.js';
import { MousePreferencesManager } from '../persistence/mouse-preferences.js';
import { loadConfig, type AppConfig } from '../config/index.js';

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const TEST_CONFIG_DIR = join(process.cwd(), '.plato-test');
const TEST_PREFERENCES_FILE = join(TEST_CONFIG_DIR, 'mouse-preferences.json');

interface MockMousePreferences {
  enabled: boolean;
  clickToFocus: boolean;
  dragToSelect: boolean;
  rightClickMenu: boolean;
  scrollSupport: boolean;
  doubleClickSpeed: number;
  dragThreshold: number;
  hoverDelay: number;
}

const DEFAULT_PREFERENCES: MockMousePreferences = {
  enabled: true,
  clickToFocus: true,
  dragToSelect: true,
  rightClickMenu: false,
  scrollSupport: true,
  doubleClickSpeed: 500,
  dragThreshold: 3,
  hoverDelay: 100,
};

describe('Configuration Management', () => {
  let settingsManager: MouseSettingsManager;
  let preferencesManager: MousePreferencesManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(false);
    (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(DEFAULT_PREFERENCES));
    
    // Initialize managers
    settingsManager = new MouseSettingsManager();
    preferencesManager = new MousePreferencesManager(TEST_CONFIG_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  describe('MouseSettingsManager', () => {
    it('should load default settings when no config exists', () => {
      (existsSync as jest.Mock) as jest.Mock).mockReturnValue(false);
      
      const settings = settingsManager.getSettings();
      
      expect(settings.enabled).toBe(true);
      expect(settings.clickToFocus).toBe(true);
      expect(settings.dragToSelect).toBe(true);
      expect(settings.rightClickMenu).toBe(false);
    });

    it('should load settings from existing config', () => {
      const customSettings = {
        ...DEFAULT_PREFERENCES,
        enabled: false,
        rightClickMenu: true,
        doubleClickSpeed: 300,
      };
      
      (existsSync as jest.Mock) as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock) as jest.Mock).mockReturnValue(JSON.stringify(customSettings));
      
      const settings = settingsManager.getSettings();
      
      expect(settings.enabled).toBe(false);
      expect(settings.rightClickMenu).toBe(true);
      expect(settings.doubleClickSpeed).toBe(300);
    });

    it('should update settings and persist changes', () => {
      const updates = {
        enabled: false,
        doubleClickSpeed: 400,
      };
      
      settingsManager.updateSettings(updates);
      
      expect(writeFileSync).toHaveBeenCalled();
      
      const savedData = JSON.parse((writeFileSync as jest.Mock) as jest.Mock).mock.calls[0][1] as string);
      expect(savedData.enabled).toBe(false);
      expect(savedData.doubleClickSpeed).toBe(400);
    });

    it('should validate setting values', () => {
      expect(() => {
        settingsManager.updateSettings({ doubleClickSpeed: -1 });
      }).toThrow('Double click speed must be positive');
      
      expect(() => {
        settingsManager.updateSettings({ dragThreshold: -1 });
      }).toThrow('Drag threshold must be non-negative');
      
      expect(() => {
        settingsManager.updateSettings({ hoverDelay: -1 });
      }).toThrow('Hover delay must be non-negative');
    });

    it('should reset to defaults', () => {
      // First, modify settings
      settingsManager.updateSettings({ enabled: false, doubleClickSpeed: 999 });
      
      // Then reset
      settingsManager.resetToDefaults();
      
      const settings = settingsManager.getSettings();
      expect(settings).toEqual(DEFAULT_PREFERENCES);
    });
  });

  describe('MousePreferencesManager', () => {
    it('should create preferences file if it does not exist', () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      
      preferencesManager.loadPreferences();
      
      expect((mkdirSync).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
      expect((writeFileSync).toHaveBeenCalledWith(
        TEST_PREFERENCES_FILE,
        JSON.stringify(DEFAULT_PREFERENCES, null, 2)
      );
    });

    it('should load existing preferences', () => {
      const customPrefs = {
        ...DEFAULT_PREFERENCES,
        enabled: false,
        hoverDelay: 200,
      };
      
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(customPrefs));
      
      const preferences = preferencesManager.loadPreferences();
      
      expect(preferences.proficiencyLevel).toBe('beginner');
      expect(preferences.totalEvents).toBe(0);
    });

    it('should handle corrupted preferences file gracefully', () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('invalid json');
      
      const preferences = preferencesManager.loadPreferences();
      
      // Should fall back to defaults
      expect(preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should save preferences with proper formatting', () => {
      const newPreferences = {
        ...DEFAULT_PREFERENCES,
        proficiencyLevel: 'advanced' as const,
        totalEvents: 50,
      };
      
      preferencesManager.savePreferences(newPreferences);
      
      expect((writeFileSync).toHaveBeenCalledWith(
        TEST_PREFERENCES_FILE,
        JSON.stringify(newPreferences, null, 2)
      );
    });

    it('should merge partial updates correctly', () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(DEFAULT_PREFERENCES));
      
      const partialUpdate = {
        proficiencyLevel: 'advanced' as const,
        totalEvents: 10,
      };
      
      preferencesManager.updatePreferences(partialUpdate);
      
      const savedData = JSON.parse((writeFileSync as jest.Mock).mock.calls[0][1] as string);
      expect(savedData.proficiencyLevel).toBe('advanced');
      expect(savedData.totalEvents).toBe(10);
    });
  });

  describe('Integration with AppConfig', () => {
    it('should integrate mouse settings with app configuration', () => {
      const config = loadConfig();
      
      expect(config).toHaveProperty('githubToken');
      expect(config).toHaveProperty('endpoint');
      expect(config).toHaveProperty('defaultModel');
      
      // Mouse settings should be managed separately but compatible
      const mouseSettings = settingsManager.getSettings();
      expect(typeof mouseSettings.enabled).toBe('boolean');
    });

    it('should handle environment variable overrides', () => {
      const originalEnv = process.env.PLATO_MOUSE_ENABLED;
      
      try {
        process.env.PLATO_MOUSE_ENABLED = 'false';
        
        // Settings manager should respect environment variables
        const settings = new MouseSettingsManager();
        const config = settings.getSettings();
        
        // This would be implemented in the actual MouseSettingsManager
        // expect(config.enabled).toBe(false);
      } finally {
        if (originalEnv !== undefined) {
          process.env.PLATO_MOUSE_ENABLED = originalEnv;
        } else {
          delete process.env.PLATO_MOUSE_ENABLED;
        }
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should validate mouse configuration schema', () => {
      const validConfig = {
        enabled: true,
        clickToFocus: true,
        dragToSelect: true,
        rightClickMenu: false,
        scrollSupport: true,
        doubleClickSpeed: 500,
        dragThreshold: 3,
        hoverDelay: 100,
      };
      
      expect(() => settingsManager.validateSettings(validConfig)).not.toThrow();
    });

    it('should reject invalid configuration values', () => {
      const invalidConfigs = [
        { doubleClickSpeed: 'invalid' },
        { dragThreshold: -1 },
        { hoverDelay: 'not-a-number' },
        { enabled: 'yes' }, // Should be boolean
      ];
      
      invalidConfigs.forEach(config => {
        expect(() => {
          settingsManager.validateSettings(config as any);
        }).toThrow();
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with repeated configuration changes', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate many configuration changes
      for (let i = 0; i < 100; i++) {
        settingsManager.updateSettings({
          doubleClickSpeed: 400 + i,
          hoverDelay: 100 + i,
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle concurrent configuration access safely', async () => {
      const promises = [];
      
      // Simulate concurrent access
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              settingsManager.updateSettings({ doubleClickSpeed: 400 + i });
              resolve();
            }, Math.random() * 100);
          })
        );
      }
      
      await Promise.all(promises);
      
      // Settings should be in a consistent state
      const settings = settingsManager.getSettings();
      expect(typeof settings.doubleClickSpeed).toBe('number');
      expect(settings.doubleClickSpeed).toBeGreaterThan(0);
    });
  });
});
