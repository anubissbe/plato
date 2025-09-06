/**
 * Slash Command Mouse Integration
 * Integrates mouse events with slash command system for enhanced interaction
 */

import type { MouseEvent, MouseCoordinates, MouseEventType } from '../tui/mouse-types.js';
import type { SlashCommand } from '../slash/commands.js';
import { SLASH_COMMANDS } from '../slash/commands.js';
import { executeMouseCommand } from '../commands/mouse-command.js';
import { getMouseSettings, isMouseEnabled } from '../config/mouse-settings.js';

/**
 * Mouse interaction context for slash commands
 */
export interface SlashMouseContext {
  /** Current mouse position */
  position: MouseCoordinates;
  /** UI element under mouse */
  targetElement?: string;
  /** Available slash commands at this position */
  availableCommands: SlashCommand[];
  /** Whether command palette is open */
  isCommandPaletteOpen: boolean;
  /** Current input text */
  currentInput: string;
}

/**
 * Mouse gesture for slash commands
 */
export interface MouseGesture {
  /** Gesture type */
  type: 'right_click_menu' | 'double_click_command' | 'drag_to_select_command' | 'hover_preview';
  /** Mouse event that triggered the gesture */
  triggerEvent: MouseEvent;
  /** Associated slash command */
  command?: string;
  /** Additional gesture data */
  data?: Record<string, any>;
}

/**
 * Slash command suggestion
 */
export interface SlashCommandSuggestion {
  /** Command name */
  command: string;
  /** Display text */
  displayText: string;
  /** Command description */
  description: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Whether this command is available in current context */
  available: boolean;
}

/**
 * Configuration for mouse-slash integration
 */
export interface MouseSlashConfig {
  /** Enable right-click command menu */
  rightClickMenu: boolean;
  /** Enable double-click to execute commands */
  doubleClickCommands: boolean;
  /** Enable hover previews for commands */
  hoverPreviews: boolean;
  /** Enable drag-to-select command text */
  dragToSelectCommands: boolean;
  /** Command suggestion threshold */
  suggestionThreshold: number;
  /** Maximum suggestions to show */
  maxSuggestions: number;
}

/**
 * Default mouse-slash integration configuration
 */
const DEFAULT_MOUSE_SLASH_CONFIG: MouseSlashConfig = {
  rightClickMenu: false, // Conservative default for terminal
  doubleClickCommands: true,
  hoverPreviews: true,
  dragToSelectCommands: true,
  suggestionThreshold: 0.3,
  maxSuggestions: 5,
};

/**
 * Slash Command Mouse Integration Manager
 */
export class SlashCommandMouseIntegration {
  private config: MouseSlashConfig;
  private context: SlashMouseContext;
  private gestureHandlers: Map<string, (gesture: MouseGesture) => void>;
  private commandSuggestions: SlashCommandSuggestion[];
  private lastClickTime: number = 0;
  private lastClickPosition: MouseCoordinates = { x: 0, y: 0 };
  private dragStartPosition: MouseCoordinates | null = null;
  private hoverTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<MouseSlashConfig> = {}) {
    this.config = { ...DEFAULT_MOUSE_SLASH_CONFIG, ...config };
    this.context = {
      position: { x: 0, y: 0 },
      availableCommands: SLASH_COMMANDS,
      isCommandPaletteOpen: false,
      currentInput: '',
    };
    this.gestureHandlers = new Map();
    this.commandSuggestions = [];
    
    this.initializeGestureHandlers();
  }

  /**
   * Process mouse event and check for slash command interactions
   */
  processMouseEvent(event: MouseEvent): MouseGesture | null {
    // Don't process if mouse is disabled
    if (!isMouseEnabled()) {
      return null;
    }

    // Update context
    this.updateContext(event);

    // Detect gestures
    const gesture = this.detectGesture(event);
    if (gesture) {
      this.handleGesture(gesture);
      return gesture;
    }

    return null;
  }

  /**
   * Update slash command suggestions based on current context
   */
  updateSuggestions(inputText: string, position: MouseCoordinates): SlashCommandSuggestion[] {
    this.context.currentInput = inputText;
    this.context.position = position;

    // Generate suggestions based on input and context
    this.commandSuggestions = this.generateSuggestions(inputText);
    
    return this.commandSuggestions
      .filter(s => s.relevance >= this.config.suggestionThreshold)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, this.config.maxSuggestions);
  }

  /**
   * Get contextual command menu for right-click
   */
  getContextMenu(position: MouseCoordinates): SlashCommandSuggestion[] {
    const targetElement = this.getElementAtPosition(position);
    const contextCommands = this.getContextualCommands(targetElement);
    
    return contextCommands.map(cmd => ({
      command: cmd.name,
      displayText: cmd.name,
      description: cmd.summary,
      relevance: 1.0,
      available: true,
    }));
  }

  /**
   * Execute slash command via mouse interaction
   */
  async executeCommand(command: string, args: string[] = []): Promise<boolean> {
    try {
      // Handle built-in mouse command
      if (command === '/mouse') {
        const result = await executeMouseCommand(args);
        return result.success;
      }

      // Handle other slash commands (would integrate with actual command system)
      console.log(`Executing command via mouse: ${command} ${args.join(' ')}`);
      return true;
    } catch (error) {
      console.error('Failed to execute command via mouse:', error);
      return false;
    }
  }

  /**
   * Register custom gesture handler
   */
  registerGestureHandler(gestureType: string, handler: (gesture: MouseGesture) => void): void {
    this.gestureHandlers.set(gestureType, handler);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MouseSlashConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): MouseSlashConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable specific mouse-slash features
   */
  toggleFeature(feature: keyof MouseSlashConfig, enabled?: boolean): void {
    if (enabled !== undefined) {
      (this.config as any)[feature] = enabled;
    } else {
      (this.config as any)[feature] = !(this.config as any)[feature];
    }
  }

  /**
   * Initialize default gesture handlers
   */
  private initializeGestureHandlers(): void {
    // Right-click menu
    this.gestureHandlers.set('right_click_menu', (gesture) => {
      if (this.config.rightClickMenu) {
        const menu = this.getContextMenu(gesture.triggerEvent.coordinates);
        // Would integrate with actual menu system
        console.log('Show context menu:', menu);
      }
    });

    // Double-click command execution
    this.gestureHandlers.set('double_click_command', (gesture) => {
      if (this.config.doubleClickCommands && gesture.command) {
        this.executeCommand(gesture.command);
      }
    });

    // Hover preview
    this.gestureHandlers.set('hover_preview', (gesture) => {
      if (this.config.hoverPreviews && gesture.command) {
        // Would show command preview tooltip
        console.log('Show command preview:', gesture.command);
      }
    });

    // Drag to select command
    this.gestureHandlers.set('drag_to_select_command', (gesture) => {
      if (this.config.dragToSelectCommands && gesture.data?.selectedText) {
        const suggestions = this.findCommandsForText(gesture.data.selectedText);
        console.log('Commands for selected text:', suggestions);
      }
    });
  }

  /**
   * Update interaction context
   */
  private updateContext(event: MouseEvent): void {
    this.context.position = event.coordinates;
    this.context.targetElement = this.getElementAtPosition(event.coordinates);
    
    // Update available commands based on context
    this.context.availableCommands = this.getContextualCommands(this.context.targetElement);
  }

  /**
   * Detect mouse gestures for slash commands
   */
  private detectGesture(event: MouseEvent): MouseGesture | null {
    const settings = getMouseSettings();
    const now = event.timestamp;
    const position = event.coordinates;

    switch (event.type) {
      case 'click':
        if (event.button === 'right' && settings.rightClickMenu) {
          return {
            type: 'right_click_menu',
            triggerEvent: event,
          };
        }
        
        // Detect double-click
        if (event.button === 'left') {
          const timeSinceLastClick = now - this.lastClickTime;
          const distance = this.calculateDistance(position, this.lastClickPosition);
          
          if (timeSinceLastClick < settings.doubleClickSpeed && distance < settings.dragThreshold) {
            const commandAtPosition = this.getCommandAtPosition(position);
            if (commandAtPosition) {
              return {
                type: 'double_click_command',
                triggerEvent: event,
                command: commandAtPosition,
              };
            }
          }
          
          this.lastClickTime = now;
          this.lastClickPosition = position;
        }
        break;

      case 'drag_start':
        if (settings.dragToSelect) {
          this.dragStartPosition = position;
        }
        break;

      case 'drag_end':
        if (this.dragStartPosition && settings.dragToSelect) {
          const selectedText = this.getSelectedTextInRange(
            this.dragStartPosition,
            position
          );
          
          if (selectedText && this.looksLikeCommand(selectedText)) {
            return {
              type: 'drag_to_select_command',
              triggerEvent: event,
              command: selectedText,
              data: { selectedText },
            };
          }
          
          this.dragStartPosition = null;
        }
        break;

      case 'hover':
        if (settings.hoverDelay > 0 && this.config.hoverPreviews) {
          // Clear existing hover timeout
          if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
          }
          
          // Set new hover timeout
          this.hoverTimeout = setTimeout(() => {
            const commandAtPosition = this.getCommandAtPosition(position);
            if (commandAtPosition) {
              const gesture: MouseGesture = {
                type: 'hover_preview',
                triggerEvent: event,
                command: commandAtPosition,
              };
              this.handleGesture(gesture);
            }
          }, settings.hoverDelay);
        }
        break;

      case 'leave':
        // Clear hover timeout when mouse leaves
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
          this.hoverTimeout = null;
        }
        break;
    }

    return null;
  }

  /**
   * Handle detected gesture
   */
  private handleGesture(gesture: MouseGesture): void {
    const handler = this.gestureHandlers.get(gesture.type);
    if (handler) {
      try {
        handler(gesture);
      } catch (error) {
        console.error(`Error handling gesture ${gesture.type}:`, error);
      }
    }
  }

  /**
   * Generate command suggestions based on input
   */
  private generateSuggestions(inputText: string): SlashCommandSuggestion[] {
    if (!inputText.startsWith('/')) {
      return [];
    }

    const query = inputText.slice(1).toLowerCase();
    const suggestions: SlashCommandSuggestion[] = [];

    for (const command of SLASH_COMMANDS) {
      const commandName = command.name.slice(1).toLowerCase();
      let relevance = 0;

      // Exact match
      if (commandName === query) {
        relevance = 1.0;
      }
      // Starts with query
      else if (commandName.startsWith(query)) {
        relevance = 0.8;
      }
      // Contains query
      else if (commandName.includes(query)) {
        relevance = 0.6;
      }
      // Fuzzy match in description
      else if (command.summary.toLowerCase().includes(query)) {
        relevance = 0.4;
      }

      if (relevance > 0) {
        suggestions.push({
          command: command.name,
          displayText: command.name,
          description: command.summary,
          relevance,
          available: this.isCommandAvailable(command.name),
        });
      }
    }

    return suggestions;
  }

  /**
   * Get contextual commands for UI element
   */
  private getContextualCommands(elementType?: string): SlashCommand[] {
    const contextMap: Record<string, string[]> = {
      'chat-input': ['/help', '/paste', '/context', '/memory'],
      'chat-output': ['/export', '/compact', '/output-style'],
      'status-bar': ['/status', '/doctor', '/cost'],
      'menu': ['/help', '/settings', '/logout'],
    };

    const relevantCommands = contextMap[elementType || ''] || [];
    
    return SLASH_COMMANDS.filter(cmd => 
      relevantCommands.includes(cmd.name) || 
      relevantCommands.length === 0
    );
  }

  /**
   * Get UI element at position (simplified)
   */
  private getElementAtPosition(position: MouseCoordinates): string {
    // This would integrate with actual UI layout detection
    if (position.y < 3) return 'status-bar';
    if (position.y > 20) return 'chat-input';
    return 'chat-output';
  }

  /**
   * Get command at specific position
   */
  private getCommandAtPosition(position: MouseCoordinates): string | null {
    // This would analyze text at position to find slash commands
    // For now, return null as this requires integration with text rendering
    return null;
  }

  /**
   * Get selected text in range (simplified)
   */
  private getSelectedTextInRange(
    start: MouseCoordinates,
    end: MouseCoordinates
  ): string | null {
    // This would integrate with actual text selection system
    // For now, return null as this requires text buffer access
    return null;
  }

  /**
   * Check if text looks like a command
   */
  private looksLikeCommand(text: string): boolean {
    return text.trim().startsWith('/') && text.trim().length > 1;
  }

  /**
   * Find commands related to selected text
   */
  private findCommandsForText(text: string): SlashCommandSuggestion[] {
    const suggestions: SlashCommandSuggestion[] = [];
    const lowerText = text.toLowerCase();

    // Look for commands that might be relevant to the selected text
    const relevanceMap: Record<string, string[]> = {
      '/export': ['export', 'save', 'download', 'copy'],
      '/memory': ['remember', 'memory', 'context', 'history'],
      '/compact': ['compact', 'summarize', 'compress'],
      '/help': ['help', 'documentation', '?'],
      '/mouse': ['mouse', 'click', 'drag', 'hover'],
    };

    for (const [command, keywords] of Object.entries(relevanceMap)) {
      const relevance = keywords.reduce((max, keyword) => {
        if (lowerText.includes(keyword)) {
          return Math.max(max, 0.8);
        }
        return max;
      }, 0);

      if (relevance > 0) {
        const cmd = SLASH_COMMANDS.find(c => c.name === command);
        if (cmd) {
          suggestions.push({
            command: cmd.name,
            displayText: cmd.name,
            description: cmd.summary,
            relevance,
            available: this.isCommandAvailable(cmd.name),
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Check if command is available in current context
   */
  private isCommandAvailable(command: string): boolean {
    // Simple availability check - in practice this would be more sophisticated
    return true;
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(p1: MouseCoordinates, p2: MouseCoordinates): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Create mouse-slash integration instance
 */
export function createSlashMouseIntegration(
  config?: Partial<MouseSlashConfig>
): SlashCommandMouseIntegration {
  return new SlashCommandMouseIntegration(config);
}

/**
 * Global instance for convenience
 */
let globalIntegration: SlashCommandMouseIntegration | undefined;

/**
 * Get global slash-mouse integration instance
 */
export function getSlashMouseIntegration(): SlashCommandMouseIntegration {
  if (!globalIntegration) {
    globalIntegration = new SlashCommandMouseIntegration();
  }
  return globalIntegration;
}
