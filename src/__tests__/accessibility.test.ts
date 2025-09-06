import { AccessibilityManager } from '../tui/AccessibilityManager';
import { ScreenReaderSupport } from '../tui/ScreenReaderSupport';
import { KeyboardNavigation } from '../tui/KeyboardNavigation';
import { FocusManager } from '../tui/FocusManager';

describe('AccessibilityManager', () => {
  let manager: AccessibilityManager;

  beforeEach(() => {
    manager = new AccessibilityManager();
  });

  describe('ARIA Support', () => {
    it('should provide proper ARIA labels for components', () => {
      const labels = manager.getAriaLabels('button');
      expect(labels).toHaveProperty('role');
      expect(labels).toHaveProperty('ariaLabel');
      expect(labels.role).toBe('button');
    });

    it('should support live regions for dynamic content', () => {
      const liveRegion = manager.createLiveRegion('polite');
      expect(liveRegion.ariaLive).toBe('polite');
      expect(liveRegion.ariaAtomic).toBe(true);
    });

    it('should handle ARIA descriptions', () => {
      const description = manager.setAriaDescription('input', 'Enter your search query');
      expect(description.ariaDescribedBy).toBeDefined();
      expect(description.description).toBe('Enter your search query');
    });

    it('should manage ARIA states', () => {
      manager.setAriaState('checkbox', 'checked', true);
      expect(manager.getAriaState('checkbox', 'checked')).toBe(true);
      
      manager.setAriaState('menu', 'expanded', false);
      expect(manager.getAriaState('menu', 'expanded')).toBe(false);
    });
  });

  describe('High Contrast Mode', () => {
    it('should enable high contrast mode', () => {
      manager.enableHighContrast();
      expect(manager.isHighContrastEnabled()).toBe(true);
    });

    it('should provide high contrast color mappings', () => {
      manager.enableHighContrast();
      const colors = manager.getHighContrastColors();
      
      expect(colors.foreground).toBeDefined();
      expect(colors.background).toBeDefined();
      const contrast = manager.calculateContrast(colors.foreground, colors.background);
      expect(contrast).toBeGreaterThanOrEqual(7); // WCAG AAA standard
    });

    it('should support custom high contrast themes', () => {
      const customTheme = {
        foreground: '#ffffff',
        background: '#000000',
        accent: '#ffff00',
        error: '#ff0000',
      };
      
      manager.setHighContrastTheme(customTheme);
      const applied = manager.getHighContrastColors();
      expect(applied).toEqual(customTheme);
    });
  });

  describe('Focus Indicators', () => {
    it('should provide visible focus indicators', () => {
      const focusStyle = manager.getFocusIndicatorStyle();
      expect(focusStyle).toHaveProperty('outline');
      expect(focusStyle).toHaveProperty('outlineOffset');
      expect(focusStyle.outline).toContain('2px');
    });

    it('should support focus ring customization', () => {
      manager.setFocusRingStyle({
        color: '#0066cc',
        width: '3px',
        style: 'solid',
      });
      
      const style = manager.getFocusIndicatorStyle();
      expect(style.outline).toContain('#0066cc');
      expect(style.outline).toContain('3px');
    });

    it('should handle focus-visible properly', () => {
      manager.setFocusVisibleOnly(true);
      expect(manager.isFocusVisibleOnly()).toBe(true);
      
      const style = manager.getFocusIndicatorStyle();
      expect(style.focusVisible).toBe(true);
    });
  });

  describe('Reduced Motion', () => {
    it('should respect prefers-reduced-motion', () => {
      manager.setReducedMotion(true);
      expect(manager.isReducedMotionEnabled()).toBe(true);
    });

    it('should disable animations when reduced motion is enabled', () => {
      manager.setReducedMotion(true);
      const animationDuration = manager.getAnimationDuration('fade');
      expect(animationDuration).toBe(0);
    });

    it('should provide alternative transitions for reduced motion', () => {
      manager.setReducedMotion(true);
      const transition = manager.getTransition('slide');
      expect(transition.type).toBe('instant');
      expect(transition.duration).toBe(0);
    });
  });
});

describe('ScreenReaderSupport', () => {
  let screenReader: ScreenReaderSupport;

  beforeEach(() => {
    screenReader = new ScreenReaderSupport();
  });

  describe('Announcements', () => {
    it('should announce messages to screen readers', () => {
      const announcement = screenReader.announce('File saved successfully', 'polite');
      expect(announcement.message).toBe('File saved successfully');
      expect(announcement.priority).toBe('polite');
    });

    it('should queue announcements properly', () => {
      screenReader.announce('First message', 'polite');
      screenReader.announce('Second message', 'assertive');
      screenReader.announce('Third message', 'polite');
      
      const queue = screenReader.getAnnouncementQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0].priority).toBe('assertive'); // Assertive messages first
    });

    it('should clear announcements after timeout', (done) => {
      screenReader.announce('Temporary message', 'polite', { timeout: 100 });
      
      setTimeout(() => {
        const queue = screenReader.getAnnouncementQueue();
        expect(queue).toHaveLength(0);
        done();
      }, 150);
    });
  });

  describe('Semantic Structure', () => {
    it('should provide proper heading hierarchy', () => {
      const structure = screenReader.getSemanticStructure();
      expect(structure.headings).toBeDefined();
      expect(structure.headings.h1).toHaveLength(1); // Only one h1
      expect(structure.headings.h2.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify landmarks', () => {
      const landmarks = screenReader.getLandmarks();
      expect(landmarks).toContainEqual(expect.objectContaining({
        role: 'main',
      }));
      expect(landmarks).toContainEqual(expect.objectContaining({
        role: 'navigation',
      }));
    });

    it('should provide skip links', () => {
      const skipLinks = screenReader.getSkipLinks();
      expect(skipLinks).toContainEqual(expect.objectContaining({
        text: 'Skip to main content',
        target: '#main',
      }));
    });
  });

  describe('Form Support', () => {
    it('should associate labels with form controls', () => {
      const association = screenReader.associateLabel('input-1', 'Username');
      expect(association.htmlFor).toBe('input-1');
      expect(association.labelText).toBe('Username');
    });

    it('should provide error announcements for forms', () => {
      screenReader.announceFormError('email', 'Invalid email format');
      const errors = screenReader.getFormErrors();
      expect(errors.email).toBe('Invalid email format');
    });

    it('should handle required field indicators', () => {
      const required = screenReader.markFieldRequired('password');
      expect(required.ariaRequired).toBe(true);
      expect(required.ariaInvalid).toBe(false);
    });
  });
});

describe('KeyboardNavigation', () => {
  let navigation: KeyboardNavigation;

  beforeEach(() => {
    navigation = new KeyboardNavigation();
  });

  describe('Tab Navigation', () => {
    it('should manage tab order', () => {
      navigation.setTabIndex('button1', 0);
      navigation.setTabIndex('button2', 1);
      navigation.setTabIndex('button3', 2);
      
      const order = navigation.getTabOrder();
      expect(order).toEqual(['button1', 'button2', 'button3']);
    });

    it('should support roving tabindex', () => {
      navigation.enableRovingTabIndex(['item1', 'item2', 'item3']);
      navigation.setActiveRovingItem('item2');
      
      expect(navigation.getTabIndex('item1')).toBe(-1);
      expect(navigation.getTabIndex('item2')).toBe(0);
      expect(navigation.getTabIndex('item3')).toBe(-1);
    });

    it('should handle tab traps for modals', () => {
      navigation.createTabTrap('modal', ['input', 'button-ok', 'button-cancel']);
      navigation.activateTabTrap('modal');
      
      expect(navigation.isTabTrapActive()).toBe(true);
      expect(navigation.getTrappedElements()).toEqual(['input', 'button-ok', 'button-cancel']);
    });
  });

  describe('Arrow Key Navigation', () => {
    it('should navigate lists with arrow keys', () => {
      navigation.setupListNavigation('list', ['item1', 'item2', 'item3']);
      
      navigation.handleArrowKey('down');
      expect(navigation.getCurrentListItem()).toBe('item1');
      
      navigation.handleArrowKey('down');
      expect(navigation.getCurrentListItem()).toBe('item2');
      
      navigation.handleArrowKey('up');
      expect(navigation.getCurrentListItem()).toBe('item1');
    });

    it('should support grid navigation', () => {
      navigation.setupGridNavigation('grid', 3, 3); // 3x3 grid
      
      navigation.handleArrowKey('right');
      expect(navigation.getCurrentCell()).toEqual({ row: 0, col: 1 });
      
      navigation.handleArrowKey('down');
      expect(navigation.getCurrentCell()).toEqual({ row: 1, col: 1 });
    });

    it('should wrap navigation when enabled', () => {
      navigation.setupListNavigation('list', ['item1', 'item2', 'item3'], { wrap: true });
      navigation.setCurrentListItem('item3');
      
      navigation.handleArrowKey('down');
      expect(navigation.getCurrentListItem()).toBe('item1'); // Wrapped to first
    });
  });

  describe('Shortcut Keys', () => {
    it('should handle single key shortcuts', () => {
      const handler = jest.fn();
      navigation.registerShortcut('/', handler);
      
      navigation.handleKeyPress('/');
      expect(handler).toHaveBeenCalled();
    });

    it('should handle modifier key combinations', () => {
      const handler = jest.fn();
      navigation.registerShortcut('Ctrl+S', handler);
      
      navigation.handleKeyPress('s', { ctrlKey: true });
      expect(handler).toHaveBeenCalled();
    });

    it('should respect disabled state', () => {
      const handler = jest.fn();
      navigation.registerShortcut('Enter', handler);
      navigation.disableShortcuts();
      
      navigation.handleKeyPress('Enter');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('FocusManager', () => {
  let focusManager: FocusManager;

  beforeEach(() => {
    focusManager = new FocusManager();
  });

  describe('Focus Tracking', () => {
    it('should track current focus', () => {
      focusManager.setFocus('input1');
      expect(focusManager.getCurrentFocus()).toBe('input1');
    });

    it('should maintain focus history', () => {
      focusManager.setFocus('button1');
      focusManager.setFocus('input1');
      focusManager.setFocus('button2');
      
      const history = focusManager.getFocusHistory();
      expect(history).toEqual(['button1', 'input1', 'button2']);
    });

    it('should restore previous focus', () => {
      focusManager.setFocus('button1');
      focusManager.setFocus('input1');
      
      focusManager.restorePreviousFocus();
      expect(focusManager.getCurrentFocus()).toBe('button1');
    });
  });

  describe('Focus Groups', () => {
    it('should manage focus groups', () => {
      focusManager.createFocusGroup('toolbar', ['btn1', 'btn2', 'btn3']);
      focusManager.createFocusGroup('form', ['input1', 'input2']);
      
      expect(focusManager.getFocusGroup('toolbar')).toEqual(['btn1', 'btn2', 'btn3']);
      expect(focusManager.getFocusGroup('form')).toEqual(['input1', 'input2']);
    });

    it('should focus first element in group', () => {
      focusManager.createFocusGroup('menu', ['item1', 'item2', 'item3']);
      focusManager.focusGroup('menu');
      
      expect(focusManager.getCurrentFocus()).toBe('item1');
    });

    it('should cycle within focus group', () => {
      focusManager.createFocusGroup('tabs', ['tab1', 'tab2', 'tab3']);
      focusManager.setGroupCycling('tabs', true);
      focusManager.setFocus('tab3');
      
      focusManager.focusNext('tabs');
      expect(focusManager.getCurrentFocus()).toBe('tab1'); // Cycled back
    });
  });

  describe('Focus Guards', () => {
    it('should prevent focus from leaving container', () => {
      focusManager.createFocusGuard('modal', ['input', 'button']);
      focusManager.activateFocusGuard('modal');
      
      const canFocus = focusManager.canFocusElement('outside-element');
      expect(canFocus).toBe(false);
    });

    it('should allow focus within guarded container', () => {
      focusManager.createFocusGuard('dialog', ['field1', 'field2']);
      focusManager.activateFocusGuard('dialog');
      
      const canFocus = focusManager.canFocusElement('field1');
      expect(canFocus).toBe(true);
    });

    it('should deactivate focus guards', () => {
      focusManager.createFocusGuard('popup', ['content']);
      focusManager.activateFocusGuard('popup');
      focusManager.deactivateFocusGuard('popup');
      
      const canFocus = focusManager.canFocusElement('outside');
      expect(canFocus).toBe(true);
    });
  });
});