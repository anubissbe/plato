/**
 * Mouse Command Implementation
 * Implements the /mouse slash command for toggling and configuring mouse support
 */

import { getMouseSettingsManager, type MouseSettings } from '../config/mouse-settings.js';
import { MouseUserGuidance } from '../ui/mouse-guidance.js';
import type { CommandExecutionResult } from './types.js';

/**
 * Mouse command arguments
 */
export interface MouseCommandArgs {
  /** Action to perform */
  action?: 'on' | 'off' | 'toggle' | 'status' | 'config' | 'reset' | 'help';
  /** Setting key for config action */
  setting?: keyof MouseSettings;
  /** Value for setting (for config action) */
  value?: string | number | boolean;
  /** Show detailed information */
  verbose?: boolean;
}

/**
 * Parse mouse command arguments
 */
export function parseMouseCommandArgs(args: string[]): MouseCommandArgs {
  const parsed: MouseCommandArgs = {};
  
  // No arguments defaults to toggle
  if (args.length === 0) {
    parsed.action = 'toggle';
    return parsed;
  }
  
  const [firstArg, ...remaining] = args;
  
  // Handle simple actions
  const simpleActions = ['on', 'off', 'toggle', 'status', 'config', 'reset', 'help'];
  if (simpleActions.includes(firstArg)) {
    parsed.action = firstArg as MouseCommandArgs['action'];
    
    // Handle config subcommands
    if (firstArg === 'config' && remaining.length >= 1) {
      parsed.setting = remaining[0] as keyof MouseSettings;
      if (remaining.length >= 2) {
        parsed.value = parseConfigValue(remaining[1]);
      }
    }
    
    // Check for verbose flag
    if (remaining.includes('--verbose') || remaining.includes('-v')) {
      parsed.verbose = true;
    }
  } else {
    // First argument might be a setting name
    const settingsKeys: (keyof MouseSettings)[] = [
      'enabled', 'clickToFocus', 'dragToSelect', 'rightClickMenu',
      'scrollSupport', 'doubleClickSpeed', 'dragThreshold', 
      'hoverDelay', 'showCursor', 'sensitivity'
    ];
    
    if (settingsKeys.includes(firstArg as keyof MouseSettings)) {
      parsed.action = 'config';
      parsed.setting = firstArg as keyof MouseSettings;
      if (remaining.length >= 1) {
        parsed.value = parseConfigValue(remaining[0]);
      }
    } else {
      parsed.action = 'help'; // Unknown argument, show help
    }
  }
  
  return parsed;
}

/**
 * Parse configuration value from string
 */
function parseConfigValue(value: string): string | number | boolean {
  // Boolean values
  if (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'on') {
    return true;
  }
  if (value.toLowerCase() === 'false' || value === '0' || value.toLowerCase() === 'off') {
    return false;
  }
  
  // Numeric values
  const numValue = parseFloat(value);
  if (!isNaN(numValue)) {
    return numValue;
  }
  
  // String value
  return value;
}

/**
 * Execute mouse command
 */
export async function executeMouseCommand(
  args: string[],
  guidance?: MouseUserGuidance
): Promise<CommandExecutionResult> {
  const parsedArgs = parseMouseCommandArgs(args);
  const manager = getMouseSettingsManager();
  const currentSettings = manager.getSettings();
  const capabilities = manager.getCapabilities();
  
  try {
    switch (parsedArgs.action) {
      case 'on':
        manager.updateSettings({ enabled: true });
        return {
          success: true,
          output: formatMouseStatus(manager, true) + 
            (guidance ? `\n\n${guidance.getQuickStartGuide()}` : ''),
        };
        
      case 'off':
        manager.updateSettings({ enabled: false });
        return {
          success: true,
          output: 'Mouse support disabled. Use `/mouse on` to re-enable.',
        };
        
      case 'toggle':
        const newState = !currentSettings.enabled;
        manager.updateSettings({ enabled: newState });
        return {
          success: true,
          output: formatMouseStatus(manager, parsedArgs.verbose) + 
            (newState && guidance ? `\n\n${guidance.getQuickStartGuide()}` : ''),
        };
        
      case 'status':
        return {
          success: true,
          output: formatMouseStatus(manager, parsedArgs.verbose) + 
            (parsedArgs.verbose ? `\n\n${formatCapabilities(capabilities)}` : ''),
        };
        
      case 'config':
        if (!parsedArgs.setting) {
          return {
            success: true,
            output: formatAllSettings(currentSettings, capabilities),
          };
        }
        
        if (parsedArgs.value === undefined) {
          return {
            success: true,
            output: formatSingleSetting(parsedArgs.setting, currentSettings[parsedArgs.setting], capabilities),
          };
        }
        
        // Update specific setting
        const updates = { [parsedArgs.setting]: parsedArgs.value };
        manager.updateSettings(updates as Partial<MouseSettings>);
        
        return {
          success: true,
          output: `Updated ${parsedArgs.setting} to ${parsedArgs.value}\n\n` +
            formatSingleSetting(parsedArgs.setting, parsedArgs.value, capabilities),
        };
        
      case 'reset':
        manager.resetToDefaults();
        return {
          success: true,
          output: 'Mouse settings reset to defaults\n\n' +
            formatMouseStatus(manager, false),
        };
        
      case 'help':
      default:
        return {
          success: true,
          output: formatHelpText(),
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      output: 'Use `/mouse help` for usage information.',
    };
  }
}

/**
 * Format mouse status output
 */
function formatMouseStatus(manager: any, verbose = false): string {
  const settings = manager.getSettings();
  const capabilities = manager.getCapabilities();
  const optimized = manager.getOptimizedSettings();
  
  const lines = [
    `Mouse support: ${settings.enabled ? '✅ Enabled' : '❌ Disabled'}`,
  ];
  
  if (settings.enabled) {
    const features = [];
    if (optimized.clickToFocus) features.push('click-to-focus');
    if (optimized.dragToSelect) features.push('text-selection');
    if (optimized.scrollSupport) features.push('scrolling');
    if (optimized.rightClickMenu) features.push('right-click');
    
    lines.push(`Active features: ${features.join(', ') || 'none'}`);
    
    if (verbose) {
      lines.push('\nDetailed settings:');
      lines.push(`  Click to focus: ${formatFeatureStatus(optimized.clickToFocus, capabilities.supported)}`);
      lines.push(`  Drag to select: ${formatFeatureStatus(optimized.dragToSelect, capabilities.dragAndDrop)}`);
      lines.push(`  Scroll support: ${formatFeatureStatus(optimized.scrollSupport, capabilities.scrollWheel)}`);
      lines.push(`  Right-click menu: ${formatFeatureStatus(optimized.rightClickMenu, capabilities.rightClick)}`);
      lines.push(`  Double-click speed: ${settings.doubleClickSpeed}ms`);
      lines.push(`  Drag threshold: ${settings.dragThreshold}px`);
      lines.push(`  Hover delay: ${settings.hoverDelay}ms`);
      lines.push(`  Mouse sensitivity: ${settings.sensitivity}x`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format feature status with capability check
 */
function formatFeatureStatus(enabled: boolean, supported: boolean): string {
  if (!supported) {
    return '❌ Not supported on this platform';
  }
  return enabled ? '✅ Enabled' : '❌ Disabled';
}

/**
 * Format platform capabilities
 */
function formatCapabilities(capabilities: any): string {
  const lines = ['Platform capabilities:'];
  lines.push(`  Mouse input: ${capabilities.supported ? '✅ Supported' : '❌ Not supported'}`);
  lines.push(`  Right-click: ${capabilities.rightClick ? '✅ Supported' : '❌ Not supported'}`);
  lines.push(`  Scroll wheel: ${capabilities.scrollWheel ? '✅ Supported' : '❌ Not supported'}`);
  lines.push(`  Drag and drop: ${capabilities.dragAndDrop ? '✅ Supported' : '❌ Not supported'}`);
  lines.push(`  Hover events: ${capabilities.hover ? '✅ Supported' : '❌ Not supported'}`);
  lines.push(`  Multi-touch: ${capabilities.multiTouch ? '✅ Supported' : '❌ Not supported'}`);
  
  return lines.join('\n');
}

/**
 * Format all settings
 */
function formatAllSettings(settings: MouseSettings, capabilities: any): string {
  const lines = ['Current mouse configuration:'];
  
  const settingDescriptions: Record<keyof MouseSettings, string> = {
    enabled: 'Mouse support',
    clickToFocus: 'Click to focus elements',
    dragToSelect: 'Drag to select text',
    rightClickMenu: 'Right-click context menu',
    scrollSupport: 'Mouse scroll wheel',
    doubleClickSpeed: 'Double-click speed (ms)',
    dragThreshold: 'Drag threshold (pixels)',
    hoverDelay: 'Hover tooltip delay (ms)',
    showCursor: 'Show mouse cursor',
    sensitivity: 'Mouse sensitivity multiplier',
  };
  
  for (const [key, description] of Object.entries(settingDescriptions)) {
    const value = settings[key as keyof MouseSettings];
    lines.push(`  ${description}: ${formatSettingValue(value)}`);
  }
  
  return lines.join('\n');
}

/**
 * Format single setting
 */
function formatSingleSetting(
  setting: keyof MouseSettings, 
  value: any, 
  capabilities: any
): string {
  const descriptions: Record<keyof MouseSettings, string> = {
    enabled: 'Enables/disables mouse support entirely',
    clickToFocus: 'Click on UI elements to focus them',
    dragToSelect: 'Drag mouse to select text',
    rightClickMenu: 'Right-click for context menu (limited support)',
    scrollSupport: 'Use mouse scroll wheel for navigation',
    doubleClickSpeed: 'Maximum time between clicks for double-click (ms)',
    dragThreshold: 'Minimum pixels to move before starting drag (px)',
    hoverDelay: 'Delay before showing hover tooltips (ms)',
    showCursor: 'Display mouse cursor in terminal',
    sensitivity: 'Mouse movement sensitivity multiplier',
  };
  
  const lines = [
    `Setting: ${setting}`,
    `Current value: ${formatSettingValue(value)}`,
    `Description: ${descriptions[setting]}`,
  ];
  
  // Add capability information for relevant settings
  const capabilityMap: Partial<Record<keyof MouseSettings, keyof any>> = {
    rightClickMenu: 'rightClick',
    scrollSupport: 'scrollWheel',
    dragToSelect: 'dragAndDrop',
    hoverDelay: 'hover',
  };
  
  const capability = capabilityMap[setting];
  if (capability) {
    const supported = capabilities[capability];
    lines.push(`Platform support: ${supported ? '✅ Supported' : '❌ Not supported'}`);
  }
  
  return lines.join('\n');
}

/**
 * Format setting value for display
 */
function formatSettingValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? '✅ Enabled' : '❌ Disabled';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return String(value);
}

/**
 * Format help text
 */
function formatHelpText(): string {
  return `Mouse Command Usage:

  /mouse                    Toggle mouse support
  /mouse on                 Enable mouse support
  /mouse off                Disable mouse support
  /mouse status             Show current status
  /mouse status --verbose   Show detailed status
  /mouse config             Show all settings
  /mouse config <setting>   Show specific setting
  /mouse config <setting> <value>  Update setting
  /mouse reset              Reset to defaults
  /mouse help               Show this help

Available settings:
  enabled          Enable/disable mouse support (true/false)
  clickToFocus     Click to focus UI elements (true/false)
  dragToSelect     Drag to select text (true/false)
  rightClickMenu   Right-click context menu (true/false)
  scrollSupport    Mouse scroll wheel (true/false)
  doubleClickSpeed Double-click speed in milliseconds (number)
  dragThreshold    Drag threshold in pixels (number)
  hoverDelay       Hover delay in milliseconds (number)
  showCursor       Show mouse cursor (true/false)
  sensitivity      Mouse sensitivity multiplier (number)

Examples:
  /mouse on
  /mouse config dragToSelect true
  /mouse config doubleClickSpeed 400
  /mouse status --verbose`;
}
