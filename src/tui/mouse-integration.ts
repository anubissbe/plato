/**
 * Mouse Integration Bridge
 * Integrates enhanced mouse support with existing keyboard handler system
 */

import { MouseProtocolParser } from './mouse-parser.js';
import { MouseEventProcessor } from './mouse-processor.js';
import { MousePlatformDetector } from './mouse-platform.js';
import {
  MouseEvent,
  MouseEventHandlers,
  MouseBounds,
  MouseEventProcessingOptions,
  MouseProtocolConfig,
  PlatformMouseCapabilities
} from './mouse-types.js';

/**
 * Configuration for mouse integration
 */
interface MouseIntegrationConfig {
  /** Whether to enable mouse support */
  enabled: boolean;
  /** Auto-detect platform capabilities */
  autoDetect: boolean;
  /** Processing options */
  processing: Partial<MouseEventProcessingOptions>;
  /** Protocol configuration override */
  protocol?: Partial<MouseProtocolConfig>;
  /** Debug mode */
  debug: boolean;
}

/**
 * Default integration configuration
 */
const DEFAULT_INTEGRATION_CONFIG: MouseIntegrationConfig = {
  enabled: true,
  autoDetect: true,
  processing: {
    throttleMs: 16,
    validateBounds: true,
    debug: false,
    maxQueueSize: 100
  },
  debug: false
};

/**
 * Mouse Integration System
 * Bridges mouse events with existing TUI keyboard handler
 */
export class MouseIntegration {
  private parser: MouseProtocolParser;
  private processor: MouseEventProcessor;
  private platformDetector: MousePlatformDetector;
  private config: MouseIntegrationConfig;
  private eventHandlers: MouseEventHandlers = {};
  private isInitialized = false;
  private isEnabled = false;
  private capabilities: PlatformMouseCapabilities | null = null;

  constructor(config: Partial<MouseIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
    this.parser = new MouseProtocolParser(this.config.debug);
    this.processor = new MouseEventProcessor(this.config.processing);
    this.platformDetector = MousePlatformDetector.getInstance();
  }

  /**
   * Initialize mouse support
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.isEnabled;
    }

    try {
      // Detect platform capabilities
      if (this.config.autoDetect) {
        this.capabilities = await this.platformDetector.detectCapabilities();
        
        if (this.config.debug) {
          console.debug('[MouseIntegration] Platform capabilities:', this.capabilities);
        }

        // Disable if no support detected
        if (this.capabilities.supportLevel === 'none') {
          this.config.enabled = false;
          if (this.config.debug) {
            console.debug('[MouseIntegration] Disabled due to no platform support');
          }
        }
      }

      // Configure mouse support if enabled
      if (this.config.enabled) {
        const success = await this.platformDetector.configureMouseSupport();
        this.isEnabled = success;
        
        if (this.config.debug) {
          console.debug(`[MouseIntegration] Mouse support ${success ? 'enabled' : 'failed'}`);
        }
      }

      this.isInitialized = true;
      return this.isEnabled;
    } catch (error) {
      console.error('[MouseIntegration] Initialization failed:', error);
      this.isInitialized = true;
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Process raw input data that may contain mouse sequences
   */
  processInput(data: string, bounds?: MouseBounds): {
    mouseEvents: MouseEvent[];
    remainingData: string;
  } {
    if (!this.isEnabled) {
      return { mouseEvents: [], remainingData: data };
    }

    try {
      // Extract mouse events from input data
      const mouseEvents = this.parser.extractMultipleEvents(data);
      
      // Process events through the processor
      const processedEvents: MouseEvent[] = [];
      for (const event of mouseEvents) {
        const processed = this.processor.processEvent(event, bounds);
        if (processed) {
          processedEvents.push(processed);
        }
      }

      // Remove mouse sequences from input data
      let remainingData = data;
      for (const event of mouseEvents) {
        if (event.rawSequence) {
          remainingData = remainingData.replace(event.rawSequence, '');
        }
      }

      // Process queued events
      const queuedEvents = this.processor.processEventQueue();
      processedEvents.push(...queuedEvents);

      if (this.config.debug && processedEvents.length > 0) {
        console.debug(`[MouseIntegration] Processed ${processedEvents.length} mouse events`);
      }

      return { mouseEvents: processedEvents, remainingData };
    } catch (error) {
      if (this.config.debug) {
        console.error('[MouseIntegration] Error processing input:', error);
      }
      return { mouseEvents: [], remainingData: data };
    }
  }

  /**
   * Register mouse event handlers
   */
  setEventHandlers(handlers: Partial<MouseEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Dispatch mouse event to registered handlers
   */
  async dispatchEvent(event: MouseEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'click':
          if (this.eventHandlers.onClick) {
            await this.eventHandlers.onClick(event);
          }
          break;
        case 'drag_start':
          if (this.eventHandlers.onDragStart) {
            await this.eventHandlers.onDragStart(event);
          }
          break;
        case 'drag':
          if (this.eventHandlers.onDrag) {
            await this.eventHandlers.onDrag(event);
          }
          break;
        case 'drag_end':
          if (this.eventHandlers.onDragEnd) {
            await this.eventHandlers.onDragEnd(event);
          }
          break;
        case 'scroll':
          if (this.eventHandlers.onScroll) {
            await this.eventHandlers.onScroll(event);
          }
          break;
        case 'move':
          if (this.eventHandlers.onMove) {
            await this.eventHandlers.onMove(event);
          }
          break;
        case 'hover':
          if (this.eventHandlers.onHover) {
            await this.eventHandlers.onHover(event);
          }
          break;
        case 'leave':
          if (this.eventHandlers.onLeave) {
            await this.eventHandlers.onLeave(event);
          }
          break;
      }
    } catch (error) {
      if (this.config.debug) {
        console.error(`[MouseIntegration] Error dispatching ${event.type} event:`, error);
      }
    }
  }

  /**
   * Enable mouse support
   */
  async enable(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isEnabled) return true;

    try {
      const success = await this.platformDetector.configureMouseSupport();
      this.isEnabled = success;
      
      if (this.config.debug) {
        console.debug(`[MouseIntegration] Mouse support ${success ? 'enabled' : 'failed to enable'}`);
      }
      
      return success;
    } catch (error) {
      console.error('[MouseIntegration] Failed to enable mouse support:', error);
      return false;
    }
  }

  /**
   * Disable mouse support
   */
  async disable(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.platformDetector.disableMouseSupport();
      this.isEnabled = false;
      
      if (this.config.debug) {
        console.debug('[MouseIntegration] Mouse support disabled');
      }
    } catch (error) {
      console.error('[MouseIntegration] Failed to disable mouse support:', error);
    }
  }

  /**
   * Toggle mouse support
   */
  async toggle(): Promise<boolean> {
    if (this.isEnabled) {
      await this.disable();
      return false;
    } else {
      return await this.enable();
    }
  }

  /**
   * Update terminal bounds
   */
  setBounds(bounds: MouseBounds): void {
    this.processor.setBounds(bounds);
  }

  /**
   * Get current mouse state
   */
  getMouseState() {
    return this.processor.getMouseState();
  }

  /**
   * Check if mouse is enabled
   */
  isMouseEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get platform capabilities
   */
  getCapabilities(): PlatformMouseCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get platform recommendations
   */
  async getRecommendations(): Promise<string[]> {
    if (!this.capabilities) {
      await this.initialize();
    }
    return this.platformDetector.getPlatformRecommendations();
  }

  /**
   * Test mouse functionality
   */
  async testMouseFunctionality(): Promise<boolean> {
    return this.platformDetector.testMouseFunctionality();
  }

  /**
   * Get configuration
   */
  getConfig(): MouseIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MouseIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update processor options if changed
    if (config.processing) {
      this.processor.updateOptions(config.processing);
    }
    
    // Update parser debug mode if changed
    if (config.debug !== undefined) {
      this.parser = new MouseProtocolParser(config.debug);
    }
  }

  /**
   * Reset mouse integration state
   */
  reset(): void {
    this.processor.reset();
    this.eventHandlers = {};
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      initialized: this.isInitialized,
      enabled: this.isEnabled,
      capabilities: this.capabilities,
      config: this.config,
      mouseState: this.processor.getMouseState(),
      queueStatus: this.processor.getQueueStatus(),
      processorBounds: this.processor.getBounds()
    };
  }

  /**
   * Check if input contains mouse sequences
   */
  containsMouseSequences(data: string): boolean {
    return this.parser.isMouseSequence(data);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.isEnabled) {
      await this.disable();
    }
    this.reset();
    this.isInitialized = false;
  }
}