/**
 * Integration module for enhanced keyboard functionality
 * Connects keyboard shortcuts, input modes, and UI components
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useInput } from 'ink';
import { keyboardShortcuts } from './keyboard-shortcuts.js';
import { inputModes } from './input-modes.js';
import { SearchMode } from './SearchMode.js';
import { CommandPalette } from './CommandPalette.js';
import { KeyboardShortcutHelp } from './KeyboardShortcutHelp.js';

export interface EnhancedKeyboardState {
  currentInputMode: string;
  isCommandPaletteOpen: boolean;
  isSearchModeActive: boolean;
  isHelpVisible: boolean;
  activePanel: number;
}

interface EnhancedKeyboardIntegrationProps {
  onInputModeChange?: (mode: string) => void;
  onPanelFocus?: (panelIndex: number) => void;
  onCommandExecute?: (command: string, args?: string) => void;
  onSearch?: (query: string) => void;
  conversationHistory?: Array<{ role: string; content: string }>;
  availableCommands?: Array<{ name: string; description: string }>;
}

export const useEnhancedKeyboard = (props: EnhancedKeyboardIntegrationProps = {}) => {
  const {
    onInputModeChange,
    onPanelFocus,
    onCommandExecute,
    onSearch,
    conversationHistory = [],
    availableCommands = [],
  } = props;

  const [state, setState] = useState<EnhancedKeyboardState>({
    currentInputMode: 'normal',
    isCommandPaletteOpen: false,
    isSearchModeActive: false,
    isHelpVisible: false,
    activePanel: 1,
  });

  // Register custom shortcut handlers
  useEffect(() => {
    // Panel focus handlers
    const focusPanelHandler = (index: number) => {
      setState(prev => ({ ...prev, activePanel: index }));
      onPanelFocus?.(index);
    };

    // Update keyboard shortcut handlers
    const shortcut1 = keyboardShortcuts.getShortcut('focus-panel-1');
    if (shortcut1) {
      shortcut1.handler = () => focusPanelHandler(1);
    }

    const shortcut2 = keyboardShortcuts.getShortcut('focus-panel-2');
    if (shortcut2) {
      shortcut2.handler = () => focusPanelHandler(2);
    }

    const shortcut3 = keyboardShortcuts.getShortcut('focus-panel-3');
    if (shortcut3) {
      shortcut3.handler = () => focusPanelHandler(3);
    }

    // Help overlay handler
    const helpShortcut = keyboardShortcuts.getShortcut('help');
    if (helpShortcut) {
      helpShortcut.handler = () => {
        setState(prev => ({ ...prev, isHelpVisible: !prev.isHelpVisible }));
      };
    }

    // Command palette handler
    const commandPaletteShortcut = keyboardShortcuts.getShortcut('command-palette');
    if (commandPaletteShortcut) {
      commandPaletteShortcut.handler = () => {
        setState(prev => ({ ...prev, isCommandPaletteOpen: true }));
        inputModes.switchTo('command');
      };
    }

    // Search mode handler
    const searchShortcut = keyboardShortcuts.getShortcut('search');
    if (searchShortcut) {
      searchShortcut.handler = () => {
        setState(prev => ({ ...prev, isSearchModeActive: true }));
        inputModes.switchTo('search');
      };
    }
  }, [onPanelFocus]);

  // Input mode change listener
  useEffect(() => {
    const modeChangeListener = (mode: string) => {
      setState(prev => ({ ...prev, currentInputMode: mode }));
      onInputModeChange?.(mode);
    };

    inputModes.addListener(modeChangeListener);

    return () => {
      inputModes.removeListener(modeChangeListener);
    };
  }, [onInputModeChange]);

  // Keyboard input handler
  const handleKeyPress = useCallback((input: string, key: any) => {
    // First check if any modal is open
    if (state.isHelpVisible) {
      if (key.escape || key.f1) {
        setState(prev => ({ ...prev, isHelpVisible: false }));
      }
      return;
    }

    if (state.isCommandPaletteOpen) {
      if (key.escape) {
        setState(prev => ({ ...prev, isCommandPaletteOpen: false }));
        inputModes.switchTo('normal');
      }
      return;
    }

    if (state.isSearchModeActive) {
      if (key.escape) {
        setState(prev => ({ ...prev, isSearchModeActive: false }));
        inputModes.switchTo('normal');
      }
      return;
    }

    // Handle keyboard shortcuts
    const event = {
      key: key.name || input,
      ctrl: key.ctrl,
      alt: key.alt || key.meta,
      shift: key.shift,
      meta: key.meta,
      inputKey: input,
    };

    const handled = keyboardShortcuts.handleKeyPress(event);
    
    if (!handled) {
      // Pass to input mode handler
      const passthrough = inputModes.handleInput(input);
      
      // Handle mode-specific keys
      if (!passthrough) {
        // Check for mode switches
        if (key.escape) {
          // Return to normal mode
          inputModes.switchTo('normal');
          setState(prev => ({
            ...prev,
            currentInputMode: 'normal',
            isCommandPaletteOpen: false,
            isSearchModeActive: false,
          }));
        }
      }
    }
  }, [state]);

  // Close handlers
  const closeCommandPalette = useCallback(() => {
    setState(prev => ({ ...prev, isCommandPaletteOpen: false }));
    inputModes.switchTo('normal');
  }, []);

  const closeSearchMode = useCallback(() => {
    setState(prev => ({ ...prev, isSearchModeActive: false }));
    inputModes.switchTo('normal');
  }, []);

  const closeHelp = useCallback(() => {
    setState(prev => ({ ...prev, isHelpVisible: false }));
  }, []);

  // Command execution handler
  const handleCommandExecute = useCallback((command: any, args?: string) => {
    onCommandExecute?.(command.name, args);
    closeCommandPalette();
  }, [onCommandExecute, closeCommandPalette]);

  // Search selection handler
  const handleSearchSelect = useCallback((result: any) => {
    onSearch?.(result.content);
    closeSearchMode();
  }, [onSearch, closeSearchMode]);

  return {
    state,
    handleKeyPress,
    components: {
      CommandPalette: state.isCommandPaletteOpen ? (
        <CommandPalette
          isOpen={state.isCommandPaletteOpen}
          onClose={closeCommandPalette}
          onExecute={handleCommandExecute}
        />
      ) : null,
      SearchMode: state.isSearchModeActive ? (
        <SearchMode
          isActive={state.isSearchModeActive}
          onClose={closeSearchMode}
          onSelect={handleSearchSelect}
          conversationHistory={conversationHistory}
          availableCommands={availableCommands}
        />
      ) : null,
      KeyboardShortcutHelp: state.isHelpVisible ? (
        <KeyboardShortcutHelp
          isVisible={state.isHelpVisible}
          onClose={closeHelp}
        />
      ) : null,
    },
    // Utility functions
    switchInputMode: (mode: 'normal' | 'command' | 'search' | 'visual' | 'insert') => {
      inputModes.switchTo(mode);
    },
    focusPanel: (index: number) => {
      setState(prev => ({ ...prev, activePanel: index }));
      onPanelFocus?.(index);
    },
    openCommandPalette: () => {
      setState(prev => ({ ...prev, isCommandPaletteOpen: true }));
      inputModes.switchTo('command');
    },
    openSearch: () => {
      setState(prev => ({ ...prev, isSearchModeActive: true }));
      inputModes.switchTo('search');
    },
    toggleHelp: () => {
      setState(prev => ({ ...prev, isHelpVisible: !prev.isHelpVisible }));
    },
    // State getters
    getCurrentInputMode: () => inputModes.getCurrentMode(),
    getInputModeIndicator: () => inputModes.getIndicator(),
    getActivePanel: () => state.activePanel,
  };
};

/**
 * Enhanced keyboard handler hook for use in components
 */
export const useKeyboardShortcut = (
  binding: string | string[],
  handler: () => void,
  options?: {
    condition?: () => boolean;
    scope?: string;
    preventDefault?: boolean;
  }
) => {
  useEffect(() => {
    const id = `custom-${Date.now()}-${Math.random()}`;
    
    const bindings = Array.isArray(binding) ? binding : [binding];
    const keyBindings = bindings.map(b => {
      const parts = b.split('+');
      const key = parts[parts.length - 1];
      const modifiers = {
        ctrl: parts.includes('Ctrl'),
        alt: parts.includes('Alt'),
        shift: parts.includes('Shift'),
        meta: parts.includes('Meta'),
      };
      
      return { key, modifiers };
    });
    
    keyboardShortcuts.register({
      id,
      name: `Custom: ${binding}`,
      binding: keyBindings.length === 1 ? keyBindings[0] : keyBindings,
      handler,
      condition: options?.condition,
      scope: options?.scope,
    });
    
    return () => {
      keyboardShortcuts.unregister(id);
    };
  }, [binding, handler, options]);
};