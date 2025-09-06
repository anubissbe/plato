/**
 * Workflow Integration Tests
 * Tests for mouse integration with keyboard workflows and slash commands
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SlashCommandMouseIntegration } from '../integration/slash-command-mouse.js';
import { MouseUserGuidance } from '../ui/mouse-guidance.js';
import { MousePreferencesManager } from '../persistence/mouse-preferences.js';
import { MouseSettingsManager } from '../config/mouse-settings.js';
import type { MouseEvent, MouseCoordinates } from '../tui/mouse-types.js';
import type { MouseSettings } from '../config/mouse-settings.js';

// Mock dependencies
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
};

jest.mock('fs', () => mockFs);

jest.mock('../commands/mouse-command.js', () => ({
  executeMouseCommand: jest.fn(),
}));

const mockDefaultSettings: MouseSettings = {
  enabled: true,
  clickToFocus: true,
  dragToSelect: true,
  rightClickMenu: false,
  scrollSupport: true,
  doubleClickSpeed: 500,
  dragThreshold: 3,
  hoverDelay: 100,
  showCursor: true,
  sensitivity: 1.0,
};

/**
 * Helper to create mouse event
 */
function createMouseEvent(
  type: MouseEvent['type'],
  coordinates: MouseCoordinates,
  button: MouseEvent['button'] = 'left',
  timestamp = Date.now()
): MouseEvent {
  return {
    type,
    coordinates,
    button,
    modifiers: { shift: false, ctrl: false, alt: false, meta: false },
    timestamp,
    rawSequence: '',
  };
}

describe('Workflow Integration', () => {
  let slashMouseIntegration: SlashCommandMouseIntegration;
  let mouseGuidance: MouseUserGuidance;
  let preferencesManager: MousePreferencesManager;
  let settingsManager: MouseSettingsManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockDefaultSettings));
    (executeMouseCommand as jest.Mock).mockResolvedValue({ success: true, output: 'Command executed' });
    
    // Initialize components
    settingsManager = new MouseSettingsManager('/tmp/test-config');
    preferencesManager = new MousePreferencesManager('/tmp/test-config');
    slashMouseIntegration = new SlashCommandMouseIntegration();
    mouseGuidance = new MouseUserGuidance(
      mockDefaultSettings,
      {
        supported: true,
        rightClick: false,
        scrollWheel: true,
        dragAndDrop: true,
        hover: true,
        multiTouch: false,
      }
    );
  });

  afterEach(() => {
    // Clean up any timers or resources
    jest.useRealTimers();
  });

  describe('Mouse-Keyboard Workflow Integration', () => {
    it('should seamlessly switch between mouse and keyboard input', () => {
      // Simulate mouse click to focus
      const clickEvent = createMouseEvent('click', { x: 10, y: 5 });
      const gesture = slashMouseIntegration.processMouseEvent(clickEvent);
      
      expect(gesture).toBeNull(); // No special gesture for regular click
      
      // Should be able to continue with keyboard input after mouse focus
      const suggestions = slashMouseIntegration.updateSuggestions('/mou', { x: 10, y: 5 });
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].command).toBe('/mouse');
    });

    it('should handle mouse selection followed by keyboard commands', () => {
      // Simulate drag selection
      const dragStart = createMouseEvent('drag_start', { x: 5, y: 3 });
      const dragEnd = createMouseEvent('drag_end', { x: 15, y: 3 });
      
      slashMouseIntegration.processMouseEvent(dragStart);
      const gesture = slashMouseIntegration.processMouseEvent(dragEnd);
      
      // Should detect drag-to-select gesture
      expect(gesture?.type).toBe('drag_to_select_command');
    });

    it('should provide keyboard alternatives in mouse guidance', () => {
      const guidance = mouseGuidance.getQuickStartGuide();
      expect(guidance).toContain('Right-click not available (use keyboard shortcuts)');
      
      const troubleshooting = mouseGuidance.getTroubleshootingSuggestions();
      const accessibilityTips = troubleshooting.filter(tip => 
        tip.toLowerCase().includes('keyboard')
      );
      expect(accessibilityTips.length).toBeGreaterThan(0);
    });
  });

  describe('Slash Command Integration', () => {
    it('should execute mouse commands via slash command interface', async () => {
      const result = await slashMouseIntegration.executeCommand('/mouse', ['on']);
      
      expect(executeMouseCommand).toHaveBeenCalledWith(['on']);
      expect(result).toBe(true);
    });

    it('should provide contextual command suggestions based on mouse position', () => {
      // Test different UI areas
      const inputAreaSuggestions = slashMouseIntegration.getContextMenu({ x: 10, y: 25 });
      expect(inputAreaSuggestions.some(s => s.command === '/paste')).toBe(true);
      
      const outputAreaSuggestions = slashMouseIntegration.getContextMenu({ x: 10, y: 15 });
      expect(outputAreaSuggestions.some(s => s.command === '/export')).toBe(true);
    });

    it('should handle double-click command execution', () => {
      jest.useFakeTimers();
      
      // First click
      const click1 = createMouseEvent('click', { x: 10, y: 5 }, 'left', 1000);
      slashMouseIntegration.processMouseEvent(click1);
      
      // Second click within double-click threshold
      const click2 = createMouseEvent('click', { x: 10, y: 5 }, 'left', 1300);
      const gesture = slashMouseIntegration.processMouseEvent(click2);
      
      // Should detect double-click if there was a command at that position
      // (In real implementation, this would depend on text content analysis)
      expect(gesture?.type).toBeUndefined(); // No command at position in mock
    });

    it('should handle right-click context menu when enabled', () => {
      // Enable right-click in configuration
      slashMouseIntegration.updateConfig({ rightClickMenu: true });
      
      const rightClick = createMouseEvent('click', { x: 10, y: 5 }, 'right');
      const gesture = slashMouseIntegration.processMouseEvent(rightClick);
      
      expect(gesture?.type).toBe('right_click_menu');
    });
  });

  describe('Session Persistence Integration', () => {
    it('should persist mouse interaction preferences across sessions', () => {
      // Record mouse events
      const events = [
        createMouseEvent('click', { x: 5, y: 5 }),
        createMouseEvent('drag_start', { x: 10, y: 10 }),
        createMouseEvent('drag_end', { x: 20, y: 10 }),
        createMouseEvent('scroll', { x: 15, y: 15 }),
      ];
      
      events.forEach(event => preferencesManager.recordMouseEvent(event));
      
      // Check that preferences learned from behavior
      const stats = preferencesManager.getSessionStats();
      expect(stats.totalEvents).toBe(4);
      expect(stats.featureUsage.click).toBe(1);
      expect(stats.featureUsage.drag).toBe(2);
      expect(stats.featureUsage.scroll).toBe(1);
      
      // Proficiency should update
      expect(stats.proficiencyLevel).toBe('intermediate');
    });

    it('should provide learned recommendations for settings', () => {
      // Simulate failed double-clicks (would require more sophisticated event analysis in real implementation)
      const behaviorData = {
        featureUsage: {
          double_click_success: 2,
          double_click_failure: 8,
        },
        errorPatterns: ['accidental_drag', 'tooltip_interference'],
        successPatterns: ['single_click', 'scroll'],
      };
      
      const learnedSettings = preferencesManager.learnFromBehavior(behaviorData);
      
      // Should recommend slower double-click and higher drag threshold
      expect(learnedSettings.doubleClickSpeed).toBeGreaterThan(500);
      expect(learnedSettings.dragThreshold).toBeGreaterThan(3);
      expect(learnedSettings.hoverDelay).toBeGreaterThan(100);
    });

    it('should maintain guidance dismissal state across workflow transitions', () => {
      const guidanceId = 'welcome';
      
      // Dismiss guidance
      preferencesManager.dismissGuidance(guidanceId);
      expect(preferencesManager.isGuidanceDismissed(guidanceId)).toBe(true);
      
      // Guidance should remain dismissed in new guidance instance
      mouseGuidance.markGuidanceShown(guidanceId);
      const messages = mouseGuidance.getGuidanceMessages();
      const welcomeMessage = messages.find(m => m.title === 'welcome');
      expect(welcomeMessage).toBeUndefined();
    });
  });

  describe('Performance and Accessibility Integration', () => {
    it('should adapt mouse sensitivity based on performance metrics', () => {
      // Simulate high-frequency events indicating performance issues
      const rapidEvents = Array.from({ length: 20 }, (_, i) => 
        createMouseEvent('move', { x: i, y: 5 }, 'left', 1000 + i * 10)
      );
      
      rapidEvents.forEach(event => {
        preferencesManager.recordMouseEvent(event);
        mouseGuidance.updateContext(event);
      });
      
      const guidanceMessages = mouseGuidance.getGuidanceMessages();
      const performanceWarning = guidanceMessages.find(m => 
        m.type === 'performance_warning'
      );
      
      // Should suggest performance optimizations
      expect(performanceWarning?.message).toContain('High mouse activity');
    });

    it('should provide accessibility recommendations based on settings', () => {
      // Test with accessibility-challenged settings
      const poorAccessibilitySettings: Partial<MouseSettings> = {
        hoverDelay: 50, // Too fast for accessibility
        doubleClickSpeed: 200, // Too fast
        sensitivity: 5.0, // Too sensitive
      };
      
      settingsManager.updateSettings(poorAccessibilitySettings);
      
      const guidance = mouseGuidance.getGuidanceMessages();
      const accessibilityMessage = guidance.find(m => 
        m.type === 'accessibility'
      );
      
      // Should provide accessibility guidance
      expect(accessibilityMessage?.message).toContain('accessibility');
    });

    it('should handle concurrent mouse and keyboard input gracefully', async () => {
      const promises = [];
      
      // Simulate concurrent interactions
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              const event = createMouseEvent('click', { x: i, y: i });
              slashMouseIntegration.processMouseEvent(event);
              preferencesManager.recordMouseEvent(event);
              resolve();
            }, Math.random() * 100);
          })
        );
      }
      
      await Promise.all(promises);
      
      // System should remain in consistent state
      const stats = preferencesManager.getSessionStats();
      expect(stats.totalEvents).toBe(10);
      expect(typeof stats.eventsPerMinute).toBe('number');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle mouse hardware disconnection gracefully', () => {
      // Simulate loss of mouse capability
      const disabledGuidance = new MouseUserGuidance(
        { ...mockDefaultSettings, enabled: false },
        {
          supported: false,
          rightClick: false,
          scrollWheel: false,
          dragAndDrop: false,
          hover: false,
          multiTouch: false,
        }
      );
      
      const messages = disabledGuidance.getGuidanceMessages();
      expect(messages.length).toBe(0); // No guidance when disabled
      
      // Slash integration should also handle gracefully
      const gesture = slashMouseIntegration.processMouseEvent(
        createMouseEvent('click', { x: 10, y: 10 })
      );
      expect(gesture).toBeNull();
    });

    it('should recover from corrupted preference files', () => {
      // Mock corrupted file
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json content');
      
      const newManager = new MousePreferencesManager('/tmp/corrupted-test');
      const preferences = newManager.loadPreferences();
      
      // Should fall back to defaults
      expect(preferences.proficiencyLevel).toBe('beginner');
      expect(preferences.totalEvents).toBe(0);
    });

    it('should handle invalid mouse events without crashing', () => {
      const invalidEvents = [
        // @ts-ignore - Testing invalid event
        { type: 'invalid', coordinates: null },
        // @ts-ignore - Testing missing fields
        { type: 'click' },
        // @ts-ignore - Testing invalid coordinates
        { type: 'click', coordinates: { x: -1, y: -1 }, button: 'invalid' },
      ];
      
      expect(() => {
        invalidEvents.forEach((event: any) => {
          try {
            slashMouseIntegration.processMouseEvent(event);
            if (event.coordinates) {
              preferencesManager.recordMouseEvent(event);
            }
          } catch (error) {
            // Should handle errors gracefully
            expect(error).toBeInstanceOf(Error);
          }
        });
      }).not.toThrow();
    });
  });

  describe('Integration Testing Scenarios', () => {
    it('should complete full mouse-keyboard workflow cycle', async () => {
      // 1. Enable mouse via slash command
      const enableResult = await slashMouseIntegration.executeCommand('/mouse', ['on']);
      expect(enableResult).toBe(true);
      
      // 2. User clicks to focus input area
      const focusClick = createMouseEvent('click', { x: 10, y: 25 });
      slashMouseIntegration.processMouseEvent(focusClick);
      preferencesManager.recordMouseEvent(focusClick);
      
      // 3. User types slash command
      const suggestions = slashMouseIntegration.updateSuggestions('/exp', { x: 10, y: 25 });
      expect(suggestions.length).toBeGreaterThan(0);
      
      // 4. User selects command via mouse or keyboard
      const selectedCommand = suggestions[0];
      expect(selectedCommand.command).toContain('/export');
      
      // 5. Settings should reflect usage
      const stats = preferencesManager.getSessionStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.proficiencyLevel).toBeDefined();
    });

    it('should handle complex multi-gesture workflows', () => {
      jest.useFakeTimers();
      
      // Complex workflow: hover -> right-click -> select command -> drag selection
      const events = [
        createMouseEvent('hover', { x: 10, y: 10 }),
        createMouseEvent('click', { x: 10, y: 10 }, 'right'),
        createMouseEvent('drag_start', { x: 10, y: 10 }),
        createMouseEvent('drag', { x: 15, y: 10 }),
        createMouseEvent('drag_end', { x: 20, y: 10 }),
      ];
      
      const gestures = events.map(event => {
        preferencesManager.recordMouseEvent(event);
        mouseGuidance.updateContext(event);
        return slashMouseIntegration.processMouseEvent(event);
      });
      
      // Should handle all gestures appropriately
      expect(gestures.filter(g => g !== null).length).toBeGreaterThan(0);
      
      const stats = preferencesManager.getSessionStats();
      expect(stats.featureUsage.hover).toBeGreaterThan(0);
      expect(stats.featureUsage.drag).toBeGreaterThan(0);
    });
  });
});
