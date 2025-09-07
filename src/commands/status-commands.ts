/**
 * Status Display Slash Commands
 * Commands for configuring and managing the status display system
 */

import type { CommandHandler } from '../tui/keyboard-handler.js';
import {
  loadStatusConfig,
  saveStatusConfig,
  toggleStatusConfig,
  cyclePosition,
  cycleTheme,
  toggleMetric,
  getAvailableMetrics,
  applyPreset,
  exportStatusConfig,
  importStatusConfig
} from '../tui/status-config.js';

/**
 * Register status-related slash commands
 */
export function registerStatusCommands(handlers: Map<string, CommandHandler>): void {
  
  // Toggle status display
  handlers.set('/status', {
    description: 'Toggle status display on/off',
    execute: async () => {
      const enabled = await toggleStatusConfig('enabled');
      return {
        success: true,
        message: `Status display ${enabled ? 'enabled' : 'disabled'}`
      };
    }
  });
  
  // Show current status configuration
  handlers.set('/status show', {
    description: 'Show current status configuration',
    execute: async () => {
      const config = await loadStatusConfig();
      const configText = JSON.stringify(config, null, 2);
      return {
        success: true,
        message: `Current status configuration:\n${configText}`
      };
    }
  });
  
  // Toggle compact mode
  handlers.set('/status compact', {
    description: 'Toggle compact status display mode',
    execute: async () => {
      const compact = await toggleStatusConfig('compactMode');
      return {
        success: true,
        message: `Compact mode ${compact ? 'enabled' : 'disabled'}`
      };
    }
  });
  
  // Cycle position
  handlers.set('/status position', {
    description: 'Toggle status position (top/bottom)',
    execute: async () => {
      const position = await cyclePosition();
      return {
        success: true,
        message: `Status position: ${position}`
      };
    }
  });
  
  // Cycle theme
  handlers.set('/status theme', {
    description: 'Toggle status theme (light/dark)',
    execute: async () => {
      const theme = await cycleTheme();
      return {
        success: true,
        message: `Status theme: ${theme}`
      };
    }
  });
  
  // Toggle progress bar
  handlers.set('/status progress', {
    description: 'Toggle progress bar display',
    execute: async () => {
      const show = await toggleStatusConfig('showProgressBar');
      return {
        success: true,
        message: `Progress bar ${show ? 'shown' : 'hidden'}`
      };
    }
  });
  
  // Toggle spinner
  handlers.set('/status spinner', {
    description: 'Toggle spinner animation',
    execute: async () => {
      const show = await toggleStatusConfig('showSpinner');
      return {
        success: true,
        message: `Spinner ${show ? 'enabled' : 'disabled'}`
      };
    }
  });
  
  // Apply presets
  handlers.set('/status preset', {
    description: 'Apply a status display preset (minimal|detailed|performance|developer)',
    execute: async (args: string[]) => {
      const preset = args[0];
      if (!['minimal', 'detailed', 'performance', 'developer'].includes(preset)) {
        return {
          success: false,
          message: 'Invalid preset. Choose: minimal, detailed, performance, or developer'
        };
      }
      
      await applyPreset(preset as any);
      return {
        success: true,
        message: `Applied ${preset} preset`
      };
    }
  });
  
  // Configure visible metrics
  handlers.set('/status metrics', {
    description: 'Configure visible metrics',
    execute: async (args: string[]) => {
      if (args.length === 0) {
        const config = await loadStatusConfig();
        const available = getAvailableMetrics();
        const visible = config.visibleMetrics;
        
        const message = [
          'Available metrics:',
          ...available.map(m => `  ${visible.includes(m) ? '✓' : ' '} ${m}`),
          '',
          'Use: /status metrics add <metric> or /status metrics remove <metric>'
        ].join('\n');
        
        return { success: true, message };
      }
      
      const action = args[0];
      const metric = args[1];
      
      if (action === 'add' && metric) {
        await toggleMetric(metric);
        return {
          success: true,
          message: `Added ${metric} to visible metrics`
        };
      }
      
      if (action === 'remove' && metric) {
        await toggleMetric(metric);
        return {
          success: true,
          message: `Removed ${metric} from visible metrics`
        };
      }
      
      return {
        success: false,
        message: 'Usage: /status metrics [add|remove] <metric>'
      };
    }
  });
  
  // Set update interval
  handlers.set('/status interval', {
    description: 'Set status update interval in milliseconds',
    execute: async (args: string[]) => {
      const interval = parseInt(args[0], 10);
      if (isNaN(interval) || interval < 100 || interval > 5000) {
        return {
          success: false,
          message: 'Invalid interval. Must be between 100 and 5000 milliseconds'
        };
      }
      
      const config = await loadStatusConfig();
      config.updateInterval = interval;
      await saveStatusConfig(config);
      
      return {
        success: true,
        message: `Update interval set to ${interval}ms`
      };
    }
  });
  
  // Set progress bar width
  handlers.set('/status width', {
    description: 'Set progress bar width',
    execute: async (args: string[]) => {
      const width = parseInt(args[0], 10);
      if (isNaN(width) || width < 10 || width > 100) {
        return {
          success: false,
          message: 'Invalid width. Must be between 10 and 100 characters'
        };
      }
      
      const config = await loadStatusConfig();
      config.progressBarWidth = width;
      await saveStatusConfig(config);
      
      return {
        success: true,
        message: `Progress bar width set to ${width} characters`
      };
    }
  });
  
  // Export configuration
  handlers.set('/status export', {
    description: 'Export status configuration as JSON',
    execute: async () => {
      const json = await exportStatusConfig();
      return {
        success: true,
        message: `Status configuration:\n${json}`
      };
    }
  });
  
  // Import configuration
  handlers.set('/status import', {
    description: 'Import status configuration from JSON',
    execute: async (args: string[]) => {
      const json = args.join(' ');
      if (!json) {
        return {
          success: false,
          message: 'Please provide JSON configuration to import'
        };
      }
      
      try {
        await importStatusConfig(json);
        return {
          success: true,
          message: 'Status configuration imported successfully'
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to import configuration: ${error}`
        };
      }
    }
  });
  
  // Reset to defaults
  handlers.set('/status reset', {
    description: 'Reset status configuration to defaults',
    execute: async () => {
      const { DEFAULT_STATUS_CONFIG } = await import('../tui/status-config.js');
      await saveStatusConfig(DEFAULT_STATUS_CONFIG);
      return {
        success: true,
        message: 'Status configuration reset to defaults'
      };
    }
  });
  
  // Help command
  handlers.set('/status help', {
    description: 'Show status command help',
    execute: async () => {
      const commands = [
        '/status - Toggle status display on/off',
        '/status show - Show current configuration',
        '/status compact - Toggle compact mode',
        '/status position - Toggle position (top/bottom)',
        '/status theme - Toggle theme (light/dark)',
        '/status progress - Toggle progress bar',
        '/status spinner - Toggle spinner animation',
        '/status preset <name> - Apply preset (minimal|detailed|performance|developer)',
        '/status metrics - Configure visible metrics',
        '/status interval <ms> - Set update interval',
        '/status width <chars> - Set progress bar width',
        '/status export - Export configuration as JSON',
        '/status import <json> - Import configuration from JSON',
        '/status reset - Reset to defaults',
        '',
        'Keyboard shortcuts:',
        'Ctrl+S - Toggle status display',
        'Ctrl+Shift+S - Toggle compact mode',
        'Ctrl+Shift+P - Toggle progress bar',
        'Ctrl+Shift+M - Clear metrics history'
      ].join('\n');
      
      return {
        success: true,
        message: commands
      };
    }
  });
}