/**
 * Layout Keyboard Shortcuts
 * Handles keyboard shortcuts for panel management
 */

import { LayoutManager } from './layout-manager.js';

export interface LayoutKeyboardHandlers {
  [key: string]: (layoutManager: LayoutManager) => void;
}

/**
 * Default keyboard shortcuts for layout management
 */
export const layoutKeyboardHandlers: LayoutKeyboardHandlers = {
  // Panel visibility toggles
  'f1': (layout) => {
    const statusPanel = layout.getPanel('status');
    if (statusPanel) {
      layout.togglePanel('status');
    }
  },
  
  'f2': (layout) => {
    const infoPanel = layout.getPanel('info');
    if (infoPanel) {
      layout.togglePanel('info');
    }
  },
  
  'f3': (layout) => {
    // Toggle between single and multi-panel modes
    const currentMode = layout.getLayoutMode();
    layout.setLayoutMode(currentMode === 'single' ? 'multi' : 'single');
  },
  
  // Panel focus navigation
  'ctrl+1': (layout) => {
    const mainPanel = layout.getPanel('main');
    if (mainPanel) {
      layout.focusPanel('main');
    }
  },
  
  'ctrl+2': (layout) => {
    const statusPanel = layout.getPanel('status');
    if (statusPanel && statusPanel.state.visible) {
      layout.focusPanel('status');
    }
  },
  
  'ctrl+3': (layout) => {
    const infoPanel = layout.getPanel('info');
    if (infoPanel && infoPanel.state.visible) {
      layout.focusPanel('info');
    }
  },
  
  // Panel navigation
  'ctrl+tab': (layout) => {
    layout.focusNextPanel();
  },
  
  'ctrl+shift+tab': (layout) => {
    layout.focusPreviousPanel();
  },
  
  // Panel resizing (focused panel)
  'ctrl+shift+left': (layout) => {
    const focused = layout.getFocusedPanel();
    if (focused && focused.config.resizable) {
      layout.resizePanel(focused.id, focused.state.width - 5);
    }
  },
  
  'ctrl+shift+right': (layout) => {
    const focused = layout.getFocusedPanel();
    if (focused && focused.config.resizable) {
      layout.resizePanel(focused.id, focused.state.width + 5);
    }
  },
  
  // Panel collapse/expand
  'ctrl+w': (layout) => {
    const focused = layout.getFocusedPanel();
    if (focused && focused.config.collapsible) {
      if (focused.state.collapsed) {
        layout.expandPanel(focused.id);
      } else {
        layout.collapsePanel(focused.id);
      }
    }
  },
  
  // Layout mode shortcuts
  'ctrl+shift+1': (layout) => {
    layout.setLayoutMode('single');
  },
  
  'ctrl+shift+2': (layout) => {
    layout.setLayoutMode('split');
  },
  
  'ctrl+shift+3': (layout) => {
    layout.setLayoutMode('multi');
  }
};

/**
 * Process keyboard input for layout management
 */
export function handleLayoutKeyboard(
  input: string,
  key: any,
  layoutManager: LayoutManager
): boolean {
  // Build key combination string
  let keyCombo = '';
  
  if (key.ctrl) keyCombo += 'ctrl+';
  if (key.shift) keyCombo += 'shift+';
  if (key.alt) keyCombo += 'alt+';
  
  // Function keys
  if (key.f1) keyCombo += 'f1';
  else if (key.f2) keyCombo += 'f2';
  else if (key.f3) keyCombo += 'f3';
  else if (key.tab) keyCombo += 'tab';
  else if (key.leftArrow) keyCombo += 'left';
  else if (key.rightArrow) keyCombo += 'right';
  else if (input) keyCombo += input.toLowerCase();
  
  // Check if we have a handler for this key combination
  const handler = layoutKeyboardHandlers[keyCombo];
  if (handler) {
    handler(layoutManager);
    return true; // Handled
  }
  
  return false; // Not handled
}