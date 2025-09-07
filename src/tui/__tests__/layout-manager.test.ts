/**
 * Tests for LayoutManager component
 * Validates panel state management, resize operations, and layout persistence
 */

import { EventEmitter } from 'events';
import { LayoutManager, PanelConfig, LayoutConfig, PanelState } from '../layout-manager.js';

describe('LayoutManager', () => {
  let layoutManager: LayoutManager;
  let eventEmitter: EventEmitter;
  
  beforeEach(() => {
    eventEmitter = new EventEmitter();
    layoutManager = new LayoutManager(eventEmitter);
  });
  
  afterEach(() => {
    layoutManager.destroy();
  });

  describe('Panel Registration', () => {
    it('should register new panels', () => {
      const panelConfig: PanelConfig = {
        id: 'main',
        type: 'conversation',
        defaultWidth: 70,
        minWidth: 40,
        maxWidth: 90,
        resizable: true,
        collapsible: true
      };
      
      layoutManager.registerPanel(panelConfig);
      const panel = layoutManager.getPanel('main');
      
      expect(panel).toBeDefined();
      expect(panel?.config).toEqual(panelConfig);
      expect(panel?.state.width).toBe(70);
      expect(panel?.state.visible).toBe(true);
    });
    
    it('should handle multiple panel registration', () => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      layoutManager.registerPanel({ id: 'status', type: 'info', defaultWidth: 40 });
      
      expect(layoutManager.getPanels()).toHaveLength(2);
      expect(layoutManager.getPanel('main')).toBeDefined();
      expect(layoutManager.getPanel('status')).toBeDefined();
    });
    
    it('should prevent duplicate panel registration', () => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      
      expect(() => {
        layoutManager.registerPanel({ id: 'main', type: 'info', defaultWidth: 40 });
      }).toThrow('Panel with id "main" already registered');
    });
  });

  describe('Panel State Management', () => {
    beforeEach(() => {
      layoutManager.registerPanel({
        id: 'main',
        type: 'conversation',
        defaultWidth: 60,
        minWidth: 30,
        maxWidth: 80,
        resizable: true,
        collapsible: true
      });
      
      layoutManager.registerPanel({
        id: 'status',
        type: 'info',
        defaultWidth: 40,
        minWidth: 20,
        maxWidth: 60,
        resizable: true,
        collapsible: true
      });
    });
    
    it('should toggle panel visibility', () => {
      layoutManager.togglePanel('status');
      expect(layoutManager.getPanel('status')?.state.visible).toBe(false);
      
      layoutManager.togglePanel('status');
      expect(layoutManager.getPanel('status')?.state.visible).toBe(true);
    });
    
    it('should collapse and expand panels', () => {
      layoutManager.collapsePanel('status');
      const statusPanel = layoutManager.getPanel('status');
      expect(statusPanel?.state.collapsed).toBe(true);
      expect(statusPanel?.state.width).toBe(0);
      
      layoutManager.expandPanel('status');
      expect(statusPanel?.state.collapsed).toBe(false);
      expect(statusPanel?.state.width).toBe(40);
    });
    
    it('should resize panels within constraints', () => {
      layoutManager.resizePanel('main', 70);
      expect(layoutManager.getPanel('main')?.state.width).toBe(70);
      
      // Should constrain to max width
      layoutManager.resizePanel('main', 100);
      expect(layoutManager.getPanel('main')?.state.width).toBe(80);
      
      // Should constrain to min width
      layoutManager.resizePanel('main', 20);
      expect(layoutManager.getPanel('main')?.state.width).toBe(30);
    });
    
    it('should maintain total width constraint when resizing', () => {
      // Both panels start at 60 + 40 = 100%
      layoutManager.resizePanel('main', 70);
      
      // Status panel should automatically adjust
      expect(layoutManager.getPanel('main')?.state.width).toBe(70);
      expect(layoutManager.getPanel('status')?.state.width).toBe(30);
    });
    
    it('should focus panels', () => {
      layoutManager.focusPanel('status');
      expect(layoutManager.getPanel('status')?.state.focused).toBe(true);
      expect(layoutManager.getPanel('main')?.state.focused).toBe(false);
      
      layoutManager.focusPanel('main');
      expect(layoutManager.getPanel('main')?.state.focused).toBe(true);
      expect(layoutManager.getPanel('status')?.state.focused).toBe(false);
    });
  });

  describe('Layout Modes', () => {
    beforeEach(() => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      layoutManager.registerPanel({ id: 'status', type: 'info', defaultWidth: 40 });
      layoutManager.registerPanel({ id: 'tools', type: 'tools', defaultWidth: 30 });
    });
    
    it('should switch between single and multi-panel modes', () => {
      layoutManager.setLayoutMode('single');
      expect(layoutManager.getLayoutMode()).toBe('single');
      expect(layoutManager.getPanel('status')?.state.visible).toBe(false);
      expect(layoutManager.getPanel('tools')?.state.visible).toBe(false);
      
      layoutManager.setLayoutMode('multi');
      expect(layoutManager.getLayoutMode()).toBe('multi');
      expect(layoutManager.getPanel('status')?.state.visible).toBe(true);
    });
    
    it('should support split layout mode', () => {
      layoutManager.setLayoutMode('split');
      expect(layoutManager.getLayoutMode()).toBe('split');
      
      // In split mode, two panels should be visible
      const visiblePanels = layoutManager.getPanels().filter(p => p.state.visible);
      expect(visiblePanels).toHaveLength(2);
    });
    
    it('should restore panel states when switching modes', () => {
      layoutManager.resizePanel('main', 70);
      layoutManager.setLayoutMode('single');
      layoutManager.setLayoutMode('multi');
      
      // Panel width should be restored
      expect(layoutManager.getPanel('main')?.state.width).toBe(70);
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      layoutManager.registerPanel({ id: 'status', type: 'info', defaultWidth: 40 });
    });
    
    it('should emit panel resize events', (done) => {
      eventEmitter.on('layout:panel:resize', ({ panelId, newWidth, oldWidth }) => {
        expect(panelId).toBe('main');
        expect(oldWidth).toBe(60);
        expect(newWidth).toBe(70);
        done();
      });
      
      layoutManager.resizePanel('main', 70);
    });
    
    it('should emit panel visibility events', (done) => {
      eventEmitter.on('layout:panel:toggle', ({ panelId, visible }) => {
        expect(panelId).toBe('status');
        expect(visible).toBe(false);
        done();
      });
      
      layoutManager.togglePanel('status');
    });
    
    it('should emit layout mode change events', (done) => {
      eventEmitter.on('layout:mode:change', ({ oldMode, newMode }) => {
        expect(oldMode).toBe('multi');
        expect(newMode).toBe('single');
        done();
      });
      
      layoutManager.setLayoutMode('single');
    });
    
    it('should emit panel focus events', (done) => {
      eventEmitter.on('layout:panel:focus', ({ panelId, previousPanelId }) => {
        expect(panelId).toBe('status');
        expect(previousPanelId).toBe('main');
        done();
      });
      
      layoutManager.focusPanel('main');
      layoutManager.focusPanel('status');
    });
  });

  describe('Layout Persistence', () => {
    beforeEach(() => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      layoutManager.registerPanel({ id: 'status', type: 'info', defaultWidth: 40 });
    });
    
    it('should serialize layout configuration', () => {
      layoutManager.resizePanel('main', 70);
      layoutManager.collapsePanel('status');
      layoutManager.setLayoutMode('single');
      
      const serialized = layoutManager.serialize();
      
      expect(serialized.mode).toBe('single');
      expect(serialized.panels).toHaveLength(2);
      expect(serialized.panels.find(p => p.id === 'main')?.state.width).toBe(70);
      expect(serialized.panels.find(p => p.id === 'status')?.state.collapsed).toBe(true);
    });
    
    it('should restore from serialized layout', () => {
      const savedLayout: LayoutConfig = {
        mode: 'split',
        panels: [
          {
            id: 'main',
            config: { id: 'main', type: 'conversation', defaultWidth: 60 },
            state: { width: 75, visible: true, collapsed: false, focused: true }
          },
          {
            id: 'status',
            config: { id: 'status', type: 'info', defaultWidth: 40 },
            state: { width: 25, visible: true, collapsed: true, focused: false }
          }
        ],
        focusedPanelId: 'main'
      };
      
      layoutManager.restore(savedLayout);
      
      expect(layoutManager.getLayoutMode()).toBe('split');
      expect(layoutManager.getPanel('main')?.state.width).toBe(75);
      expect(layoutManager.getPanel('status')?.state.collapsed).toBe(true);
      expect(layoutManager.getFocusedPanel()?.id).toBe('main');
    });
  });

  describe('Responsive Layout', () => {
    beforeEach(() => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      layoutManager.registerPanel({ id: 'status', type: 'info', defaultWidth: 40 });
    });
    
    it('should handle terminal resize events', () => {
      layoutManager.handleTerminalResize(120, 40);
      expect(layoutManager.getTerminalSize()).toEqual({ columns: 120, rows: 40 });
    });
    
    it('should auto-collapse panels on small terminals', () => {
      layoutManager.handleTerminalResize(80, 24);
      
      // Should switch to single panel mode on narrow terminals
      expect(layoutManager.getLayoutMode()).toBe('single');
      expect(layoutManager.getPanel('status')?.state.visible).toBe(false);
    });
    
    it('should restore panels when terminal size increases', () => {
      layoutManager.handleTerminalResize(80, 24);
      expect(layoutManager.getLayoutMode()).toBe('single');
      
      layoutManager.handleTerminalResize(150, 40);
      expect(layoutManager.getLayoutMode()).toBe('multi');
      expect(layoutManager.getPanel('status')?.state.visible).toBe(true);
    });
  });

  describe('Panel Constraints', () => {
    it('should enforce minimum panel count', () => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 100 });
      
      // Should not allow hiding the only panel
      expect(() => {
        layoutManager.togglePanel('main');
      }).toThrow('Cannot hide the only visible panel');
    });
    
    it('should enforce width constraints', () => {
      layoutManager.registerPanel({
        id: 'main',
        type: 'conversation',
        defaultWidth: 60,
        minWidth: 40,
        maxWidth: 80
      });
      
      layoutManager.registerPanel({
        id: 'status',
        type: 'info',
        defaultWidth: 40,
        minWidth: 20,
        maxWidth: 60
      });
      
      // Try to violate constraints
      layoutManager.resizePanel('main', 85);
      expect(layoutManager.getPanel('main')?.state.width).toBe(80);
      expect(layoutManager.getPanel('status')?.state.width).toBe(20);
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      layoutManager.registerPanel({ id: 'main', type: 'conversation', defaultWidth: 60 });
      layoutManager.registerPanel({ id: 'status', type: 'info', defaultWidth: 40 });
      layoutManager.registerPanel({ id: 'tools', type: 'tools', defaultWidth: 30 });
    });
    
    it('should cycle focus through panels', () => {
      layoutManager.focusPanel('main');
      
      layoutManager.focusNextPanel();
      expect(layoutManager.getFocusedPanel()?.id).toBe('status');
      
      layoutManager.focusNextPanel();
      expect(layoutManager.getFocusedPanel()?.id).toBe('tools');
      
      layoutManager.focusNextPanel();
      expect(layoutManager.getFocusedPanel()?.id).toBe('main');
    });
    
    it('should cycle focus backwards', () => {
      layoutManager.focusPanel('main');
      
      layoutManager.focusPreviousPanel();
      expect(layoutManager.getFocusedPanel()?.id).toBe('tools');
      
      layoutManager.focusPreviousPanel();
      expect(layoutManager.getFocusedPanel()?.id).toBe('status');
    });
    
    it('should only cycle through visible panels', () => {
      layoutManager.togglePanel('status');
      layoutManager.focusPanel('main');
      
      layoutManager.focusNextPanel();
      expect(layoutManager.getFocusedPanel()?.id).toBe('tools');
    });
  });
});