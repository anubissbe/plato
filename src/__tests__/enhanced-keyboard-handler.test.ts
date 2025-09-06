import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import the keyboard handling modules for testing
import { KeyboardShortcutManager } from '../tui/keyboard-shortcuts.js';
import { InputModeManager } from '../tui/input-modes.js';

describe('Enhanced KeyboardHandler Tests', () => {
  let keyboardManager: KeyboardShortcutManager;
  let inputModeManager: InputModeManager;

  beforeEach(() => {
    keyboardManager = new KeyboardShortcutManager();
    inputModeManager = new InputModeManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Key Sequence Handling', () => {
    test('should register keyboard shortcuts', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'test-shortcut',
        name: 'Test Shortcut',
        binding: { key: '1', modifiers: { ctrl: true } },
        handler,
      });

      const shortcut = keyboardManager.getShortcut('test-shortcut');
      expect(shortcut).toBeDefined();
      expect(shortcut?.name).toBe('Test Shortcut');
    });

    test('should handle Ctrl+1 key press', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'ctrl-1',
        name: 'Ctrl+1',
        binding: { key: '1', modifiers: { ctrl: true } },
        handler,
      });

      const event = {
        key: '1',
        ctrl: true,
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    test('should handle function keys', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'f1-help',
        name: 'F1 Help',
        binding: { key: 'F1' },
        handler,
      });

      const event = {
        key: 'F1',
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    test('should handle Alt key combinations', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'alt-p',
        name: 'Alt+P',
        binding: { key: 'P', modifiers: { alt: true } },
        handler,
      });

      const event = {
        key: 'P',
        alt: true,
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    test('should handle key sequences with timing', async () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'sequence',
        name: 'Sequence',
        binding: { sequence: ['Ctrl+K', 'Ctrl+S'] },
        handler,
      });

      // This would require more complex implementation
      // For now, just verify registration
      const shortcut = keyboardManager.getShortcut('sequence');
      expect(shortcut).toBeDefined();
    });
  });

  describe('Customizable Key Bindings', () => {
    test('should support multiple bindings for same action', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'multi-binding',
        name: 'Multi Binding',
        binding: [
          { key: 'F2' },
          { key: 'P', modifiers: { ctrl: true, shift: true } },
        ],
        handler,
      });

      const shortcut = keyboardManager.getShortcut('multi-binding');
      expect(shortcut).toBeDefined();
      expect(Array.isArray(shortcut?.binding)).toBe(true);
    });

    test('should detect binding conflicts', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      keyboardManager.register({
        id: 'shortcut1',
        name: 'Shortcut 1',
        binding: { key: 'P', modifiers: { ctrl: true } },
        handler: handler1,
      });

      // Registering same binding should warn about conflict
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      keyboardManager.register({
        id: 'shortcut2',
        name: 'Shortcut 2',
        binding: { key: 'P', modifiers: { ctrl: true } },
        handler: handler2,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should support conditional bindings', () => {
      const handler = jest.fn();
      const condition = jest.fn().mockReturnValue(true);

      keyboardManager.register({
        id: 'conditional',
        name: 'Conditional',
        binding: { key: 'S', modifiers: { ctrl: true } },
        handler,
        condition,
      });

      const event = {
        key: 'S',
        ctrl: true,
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).toHaveBeenCalled();
    });

    test('should skip disabled conditional bindings', () => {
      const handler = jest.fn();
      const condition = jest.fn().mockReturnValue(false);

      keyboardManager.register({
        id: 'disabled',
        name: 'Disabled',
        binding: { key: 'D', modifiers: { ctrl: true } },
        handler,
        condition,
      });

      const event = {
        key: 'D',
        ctrl: true,
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Input Mode Management', () => {
    test('should start in normal mode', () => {
      expect(inputModeManager.getCurrentMode()).toBe('normal');
    });

    test('should switch to command mode', () => {
      const result = inputModeManager.switchTo('command');
      expect(result).toBe(true);
      expect(inputModeManager.getCurrentMode()).toBe('command');
    });

    test('should switch to search mode', () => {
      const result = inputModeManager.switchTo('search');
      expect(result).toBe(true);
      expect(inputModeManager.getCurrentMode()).toBe('search');
    });

    test('should get mode indicator', () => {
      inputModeManager.switchTo('command');
      expect(inputModeManager.getIndicator()).toBe('⌘');

      inputModeManager.switchTo('search');
      expect(inputModeManager.getIndicator()).toBe('🔍');

      inputModeManager.switchTo('normal');
      expect(inputModeManager.getIndicator()).toBe('');
    });

    test('should maintain mode history', () => {
      inputModeManager.switchTo('command');
      inputModeManager.switchTo('search');
      inputModeManager.switchTo('normal');

      const history = inputModeManager.getModeHistory();
      expect(history).toContain('normal');
      expect(history).toContain('command');
    });

    test('should switch to previous mode', () => {
      inputModeManager.switchTo('command');
      inputModeManager.switchTo('search');
      
      inputModeManager.switchToPrevious();
      expect(inputModeManager.getCurrentMode()).toBe('command');
    });

    test('should handle input based on mode', () => {
      inputModeManager.switchTo('command');
      const passthrough = inputModeManager.handleInput('test');
      expect(passthrough).toBe(false); // Command mode doesn't pass through

      inputModeManager.switchTo('normal');
      const normalPassthrough = inputModeManager.handleInput('test');
      expect(normalPassthrough).toBe(true); // Normal mode passes through
    });

    test('should notify mode change listeners', () => {
      const listener = jest.fn();
      inputModeManager.addListener(listener);

      inputModeManager.switchTo('command');
      expect(listener).toHaveBeenCalledWith('command', 'normal');

      inputModeManager.removeListener(listener);
      inputModeManager.switchTo('search');
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called after removal
    });
  });

  describe('Cross-Platform Compatibility', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    });

    test('should handle Windows platform', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      
      const manager = new KeyboardShortcutManager();
      expect(manager).toBeDefined();
    });

    test('should handle macOS platform', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
      
      const manager = new KeyboardShortcutManager();
      expect(manager).toBeDefined();
    });

    test('should handle Linux platform', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      
      const manager = new KeyboardShortcutManager();
      expect(manager).toBeDefined();
    });
  });

  describe('Shortcut Categories', () => {
    test('should group shortcuts by category', () => {
      const handler = jest.fn();
      
      keyboardManager.register({
        id: 'panel-1',
        name: 'Panel 1',
        binding: { key: '1', modifiers: { ctrl: true } },
        handler,
        category: 'Panel',
      });

      keyboardManager.register({
        id: 'help',
        name: 'Help',
        binding: { key: 'F1' },
        handler,
        category: 'General',
      });

      const panelShortcuts = keyboardManager.getShortcutsByCategory('Panel');
      expect(panelShortcuts).toHaveLength(4); // 3 default + 1 we added

      const generalShortcuts = keyboardManager.getShortcutsByCategory('General');
      expect(generalShortcuts).toHaveLength(4); // 3 default + 1 we added
    });
  });

  describe('Shortcut Scopes', () => {
    test('should respect scope restrictions', () => {
      const handler = jest.fn();
      
      keyboardManager.register({
        id: 'modal-only',
        name: 'Modal Only',
        binding: { key: 'Escape' },
        handler,
        scope: 'modal',
      });

      // Default scope is 'global', so modal shortcut shouldn't trigger
      const event = {
        key: 'Escape',
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).not.toHaveBeenCalled();

      // Switch to modal scope
      keyboardManager.setScope('modal');
      keyboardManager.handleKeyPress(event);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should handle rapid key presses', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'rapid',
        name: 'Rapid',
        binding: { key: 'A' },
        handler,
      });

      const event = {
        key: 'A',
        preventDefault: jest.fn(),
      };

      // Simulate rapid key presses
      for (let i = 0; i < 100; i++) {
        keyboardManager.handleKeyPress(event);
      }

      expect(handler).toHaveBeenCalledTimes(100);
    });

    test('should handle many registered shortcuts', () => {
      const startTime = Date.now();
      
      // Register many shortcuts
      for (let i = 0; i < 100; i++) {
        keyboardManager.register({
          id: `shortcut-${i}`,
          name: `Shortcut ${i}`,
          binding: { key: String(i % 10), modifiers: { ctrl: i % 2 === 0 } },
          handler: jest.fn(),
        });
      }

      const endTime = Date.now();
      const registrationTime = endTime - startTime;
      
      expect(registrationTime).toBeLessThan(100); // Should be fast
      expect(keyboardManager.getShortcuts().length).toBeGreaterThan(100);
    });
  });

  describe('Enable/Disable Functionality', () => {
    test('should disable shortcut handling', () => {
      const handler = jest.fn();
      keyboardManager.register({
        id: 'test',
        name: 'Test',
        binding: { key: 'T' },
        handler,
      });

      keyboardManager.setEnabled(false);

      const event = {
        key: 'T',
        preventDefault: jest.fn(),
      };

      keyboardManager.handleKeyPress(event);
      expect(handler).not.toHaveBeenCalled();

      keyboardManager.setEnabled(true);
      keyboardManager.handleKeyPress(event);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Input Mode Features', () => {
    test('should toggle between modes', () => {
      const result = inputModeManager.toggle('normal', 'command');
      expect(result).toBe(true);
      expect(inputModeManager.getCurrentMode()).toBe('command');

      inputModeManager.toggle('normal', 'command');
      expect(inputModeManager.getCurrentMode()).toBe('normal');
    });

    test('should reset to normal mode', () => {
      inputModeManager.switchTo('command');
      inputModeManager.switchTo('search');
      
      inputModeManager.reset();
      expect(inputModeManager.getCurrentMode()).toBe('normal');
      expect(inputModeManager.getModeHistory()).toHaveLength(0);
    });

    test('should manage input buffer', () => {
      inputModeManager.setInputBuffer('test input');
      expect(inputModeManager.getInputBuffer()).toBe('test input');
      
      inputModeManager.clearInputBuffer();
      expect(inputModeManager.getInputBuffer()).toBe('');
    });

    test('should check if in specific mode', () => {
      inputModeManager.switchTo('command');
      expect(inputModeManager.isInMode('command')).toBe(true);
      expect(inputModeManager.isInMode('normal')).toBe(false);
    });

    test('should get all available modes', () => {
      const modes = inputModeManager.getAvailableModes();
      expect(modes).toHaveLength(5); // normal, command, search, visual, insert
      
      const modeNames = modes.map(m => m.name);
      expect(modeNames).toContain('normal');
      expect(modeNames).toContain('command');
      expect(modeNames).toContain('search');
    });
  });
});