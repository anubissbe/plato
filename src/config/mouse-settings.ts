/**
 * Mouse Settings Integration
 * Integrates mouse settings with Plato's configuration system
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Mouse configuration settings
 */
export interface MouseSettings {
  /** Whether mouse support is enabled */
  enabled: boolean;
  /** Click to focus UI elements */
  clickToFocus: boolean;
  /** Drag to select text */
  dragToSelect: boolean;
  /** Right-click context menu */
  rightClickMenu: boolean;
  /** Mouse scroll support */
  scrollSupport: boolean;
  /** Double-click speed threshold (ms) */
  doubleClickSpeed: number;
  /** Drag threshold (pixels) */
  dragThreshold: number;
  /** Hover delay before showing tooltips (ms) */
  hoverDelay: number;
  /** Whether to show mouse cursor */
  showCursor: boolean;
  /** Mouse sensitivity multiplier */
  sensitivity: number;
}

/**
 * Platform-specific mouse capabilities
 */
export interface MouseCapabilities {
  /** Platform supports mouse input */
  supported: boolean;
  /** Right-click is available */
  rightClick: boolean;
  /** Scroll wheel is available */
  scrollWheel: boolean;
  /** Drag and drop is available */
  dragAndDrop: boolean;
  /** Hover events are supported */
  hover: boolean;
  /** Multi-touch gestures */
  multiTouch: boolean;
}

/**
 * Default mouse settings
 */
const DEFAULT_MOUSE_SETTINGS: MouseSettings = {
  enabled: true,
  clickToFocus: true,
  dragToSelect: true,
  rightClickMenu: false, // Conservative default for terminal
  scrollSupport: true,
  doubleClickSpeed: 500,
  dragThreshold: 3,
  hoverDelay: 100,
  showCursor: true,
  sensitivity: 1.0,
};

/**
 * Environment variable mappings for mouse settings
 */
const ENV_MAPPINGS: Record<string, keyof MouseSettings> = {
  PLATO_MOUSE_ENABLED: 'enabled',
  PLATO_MOUSE_CLICK_FOCUS: 'clickToFocus',
  PLATO_MOUSE_DRAG_SELECT: 'dragToSelect',
  PLATO_MOUSE_RIGHT_CLICK: 'rightClickMenu',
  PLATO_MOUSE_SCROLL: 'scrollSupport',
  PLATO_MOUSE_DOUBLE_CLICK_SPEED: 'doubleClickSpeed',
  PLATO_MOUSE_DRAG_THRESHOLD: 'dragThreshold',
  PLATO_MOUSE_HOVER_DELAY: 'hoverDelay',
  PLATO_MOUSE_SHOW_CURSOR: 'showCursor',
  PLATO_MOUSE_SENSITIVITY: 'sensitivity',
};

/**
 * Mouse settings manager integrating with Plato configuration
 */
export class MouseSettingsManager {
  private settings: MouseSettings;
  private readonly configPath: string;
  private readonly capabilities: MouseCapabilities;

  constructor(configDir?: string) {
    this.configPath = join(
      configDir || join(homedir(), '.config', 'plato'),
      'mouse-settings.json'
    );
    
    this.capabilities = this.detectCapabilities();
    this.settings = this.loadSettings();
  }

  /**
   * Get current mouse settings
   */
  getSettings(): MouseSettings {
    return { ...this.settings };
  }

  /**
   * Get platform capabilities
   */
  getCapabilities(): MouseCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Update mouse settings
   */
  updateSettings(updates: Partial<MouseSettings>): void {
    // Validate updates
    this.validateSettings(updates);
    
    // Apply capability constraints
    const constrainedUpdates = this.constrainToCapabilities(updates);
    
    // Merge with existing settings
    this.settings = {
      ...this.settings,
      ...constrainedUpdates,
    };
    
    // Persist changes
    this.saveSettings();
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    this.settings = { ...DEFAULT_MOUSE_SETTINGS };
    this.saveSettings();
  }

  /**
   * Check if a specific feature is enabled and supported
   */
  isFeatureEnabled(feature: keyof MouseSettings): boolean {
    return this.settings[feature] as boolean && this.isFeatureSupported(feature);
  }

  /**
   * Check if a feature is supported by the platform
   */
  isFeatureSupported(feature: keyof MouseSettings): boolean {
    const featureCapabilityMap: Record<string, keyof MouseCapabilities> = {
      rightClickMenu: 'rightClick',
      scrollSupport: 'scrollWheel',
      dragToSelect: 'dragAndDrop',
      hoverDelay: 'hover',
    };
    
    const capability = featureCapabilityMap[feature];
    return capability ? this.capabilities[capability] : true;
  }

  /**
   * Get optimized settings for current platform
   */
  getOptimizedSettings(): MouseSettings {
    const optimized = { ...this.settings };
    
    // Disable unsupported features
    if (!this.capabilities.rightClick) {
      optimized.rightClickMenu = false;
    }
    if (!this.capabilities.scrollWheel) {
      optimized.scrollSupport = false;
    }
    if (!this.capabilities.dragAndDrop) {
      optimized.dragToSelect = false;
    }
    if (!this.capabilities.hover) {
      optimized.hoverDelay = 0;
    }
    
    return optimized;
  }

  /**
   * Validate settings values
   */
  validateSettings(settings: Partial<MouseSettings>): void {
    if (settings.doubleClickSpeed !== undefined) {
      if (typeof settings.doubleClickSpeed !== 'number' || settings.doubleClickSpeed <= 0) {
        throw new Error('Double click speed must be positive');
      }
      if (settings.doubleClickSpeed > 2000) {
        throw new Error('Double click speed too high (max 2000ms)');
      }
    }
    
    if (settings.dragThreshold !== undefined) {
      if (typeof settings.dragThreshold !== 'number' || settings.dragThreshold < 0) {
        throw new Error('Drag threshold must be non-negative');
      }
      if (settings.dragThreshold > 50) {
        throw new Error('Drag threshold too high (max 50px)');
      }
    }
    
    if (settings.hoverDelay !== undefined) {
      if (typeof settings.hoverDelay !== 'number' || settings.hoverDelay < 0) {
        throw new Error('Hover delay must be non-negative');
      }
      if (settings.hoverDelay > 5000) {
        throw new Error('Hover delay too high (max 5000ms)');
      }
    }
    
    if (settings.sensitivity !== undefined) {
      if (typeof settings.sensitivity !== 'number' || settings.sensitivity <= 0) {
        throw new Error('Sensitivity must be positive');
      }
      if (settings.sensitivity > 10) {
        throw new Error('Sensitivity too high (max 10x)');
      }
    }
    
    // Validate boolean settings
    const booleanSettings: (keyof MouseSettings)[] = [
      'enabled', 'clickToFocus', 'dragToSelect', 'rightClickMenu', 
      'scrollSupport', 'showCursor'
    ];
    
    for (const key of booleanSettings) {
      if (settings[key] !== undefined && typeof settings[key] !== 'boolean') {
        throw new Error(`${key} must be a boolean`);
      }
    }
  }

  /**
   * Load settings from file and environment variables
   */
  private loadSettings(): MouseSettings {
    let fileSettings: Partial<MouseSettings> = {};
    
    // Load from file
    try {
      if (existsSync(this.configPath)) {
        const content = readFileSync(this.configPath, 'utf-8');
        fileSettings = JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load mouse settings from ${this.configPath}:`, error);
    }
    
    // Apply environment variable overrides
    const envSettings = this.loadFromEnvironment();
    
    // Merge: defaults < file < environment
    const mergedSettings: MouseSettings = {
      ...DEFAULT_MOUSE_SETTINGS,
      ...fileSettings,
      ...envSettings,
    };
    
    // Apply platform constraints
    const constrained = this.constrainToCapabilities(mergedSettings);
    return { ...DEFAULT_MOUSE_SETTINGS, ...constrained };
  }

  /**
   * Load settings from environment variables
   */
  private loadFromEnvironment(): Partial<MouseSettings> {
    const envSettings: Partial<MouseSettings> = {};
    
    for (const [envVar, settingKey] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        try {
          if (typeof DEFAULT_MOUSE_SETTINGS[settingKey] === 'boolean') {
            (envSettings as any)[settingKey] = value.toLowerCase() === 'true';
          } else if (typeof DEFAULT_MOUSE_SETTINGS[settingKey] === 'number') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              (envSettings as any)[settingKey] = numValue;
            }
          }
        } catch (error) {
          console.warn(`Invalid value for ${envVar}: ${value}`);
        }
      }
    }
    
    return envSettings;
  }

  /**
   * Save settings to file
   */
  private saveSettings(): void {
    try {
      // Ensure config directory exists
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      // Write settings file
      writeFileSync(
        this.configPath,
        JSON.stringify(this.settings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.warn(`Failed to save mouse settings to ${this.configPath}:`, error);
      throw error;
    }
  }

  /**
   * Constrain settings to platform capabilities
   */
  private constrainToCapabilities(settings: Partial<MouseSettings>): Partial<MouseSettings> {
    const constrained = { ...settings };
    
    // Disable features not supported by platform
    if (!this.capabilities.supported) {
      constrained.enabled = false;
    }
    if (!this.capabilities.rightClick) {
      constrained.rightClickMenu = false;
    }
    if (!this.capabilities.scrollWheel) {
      constrained.scrollSupport = false;
    }
    if (!this.capabilities.dragAndDrop) {
      constrained.dragToSelect = false;
    }
    if (!this.capabilities.hover) {
      constrained.hoverDelay = 0;
    }
    
    return constrained;
  }

  /**
   * Detect platform mouse capabilities
   */
  private detectCapabilities(): MouseCapabilities {
    const platform = process.platform;
    const term = process.env.TERM || '';
    const termProgram = process.env.TERM_PROGRAM || '';
    const isWSL = process.env.WSL_DISTRO_NAME !== undefined;
    const isSSH = process.env.SSH_CLIENT !== undefined || process.env.SSH_TTY !== undefined;
    
    // Basic capability detection
    const capabilities: MouseCapabilities = {
      supported: true,
      rightClick: true,
      scrollWheel: true,
      dragAndDrop: true,
      hover: true,
      multiTouch: false,
    };
    
    // Platform-specific adjustments
    if (platform === 'win32' && !isWSL) {
      capabilities.multiTouch = true;
    }
    
    // Terminal-specific adjustments
    if (term.includes('xterm') || termProgram === 'iTerm.app') {
      capabilities.hover = true;
      capabilities.scrollWheel = true;
    }
    
    // Conservative defaults for SSH/remote connections
    if (isSSH) {
      capabilities.rightClick = false;
      capabilities.hover = false;
      capabilities.multiTouch = false;
    }
    
    // Detect if we're in a limited environment
    if (term === 'dumb' || process.env.CI) {
      capabilities.supported = false;
      capabilities.rightClick = false;
      capabilities.scrollWheel = false;
      capabilities.dragAndDrop = false;
      capabilities.hover = false;
    }
    
    return capabilities;
  }
}

/**
 * Create a singleton instance for global use
 */
let globalManager: MouseSettingsManager | undefined;

/**
 * Get the global mouse settings manager
 */
export function getMouseSettingsManager(): MouseSettingsManager {
  if (!globalManager) {
    globalManager = new MouseSettingsManager();
  }
  return globalManager;
}

/**
 * Quick access functions for common operations
 */
export function getMouseSettings(): MouseSettings {
  return getMouseSettingsManager().getSettings();
}

export function isMouseEnabled(): boolean {
  return getMouseSettingsManager().isFeatureEnabled('enabled');
}

export function updateMouseSettings(updates: Partial<MouseSettings>): void {
  getMouseSettingsManager().updateSettings(updates);
}

export function resetMouseSettings(): void {
  getMouseSettingsManager().resetToDefaults();
}
