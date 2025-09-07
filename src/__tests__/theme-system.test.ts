import { ThemeManager, Theme } from '../tui/ThemeManager';

describe('ThemeManager', () => {
  let themeManager: ThemeManager;

  beforeEach(() => {
    themeManager = new ThemeManager();
  });

  describe('Theme Registration', () => {
    it('should have default themes', () => {
      expect(themeManager.getTheme('dark')).toBeDefined();
      expect(themeManager.getTheme('light')).toBeDefined();
    });

    it('should register custom themes', () => {
      const customTheme: Theme = {
        name: 'custom',
        colors: {
          primary: '#ff0000',
          secondary: '#00ff00',
          background: '#000000',
          foreground: '#ffffff',
          error: '#ff0000',
          warning: '#ffff00',
          success: '#00ff00',
          info: '#0000ff',
        },
        syntax: {
          keyword: '#ff00ff',
          string: '#00ff00',
          number: '#ffff00',
          comment: '#888888',
          function: '#00ffff',
          variable: '#ffffff',
        },
      };

      themeManager.registerTheme(customTheme);
      expect(themeManager.getTheme('custom')).toEqual(customTheme);
    });

    it('should list all available themes', () => {
      const themes = themeManager.listThemes();
      expect(themes).toContain('dark');
      expect(themes).toContain('light');
    });

    it('should not allow overwriting built-in themes', () => {
      const fakeTheme: Theme = {
        name: 'dark',
        colors: {
          primary: '#000000',
          secondary: '#000000',
          background: '#000000',
          foreground: '#000000',
          error: '#000000',
          warning: '#000000',
          success: '#000000',
          info: '#000000',
        },
        syntax: {
          keyword: '#000000',
          string: '#000000',
          number: '#000000',
          comment: '#000000',
          function: '#000000',
          variable: '#000000',
        },
      };

      expect(() => themeManager.registerTheme(fakeTheme)).toThrow();
    });
  });

  describe('Theme Selection', () => {
    it('should set current theme', () => {
      themeManager.setTheme('light');
      expect(themeManager.getCurrentTheme().name).toBe('light');
    });

    it('should throw error for invalid theme', () => {
      expect(() => themeManager.setTheme('nonexistent')).toThrow();
    });

    it('should emit theme change event', () => {
      const callback = jest.fn();
      themeManager.onThemeChange(callback);

      themeManager.setTheme('light');
      expect(callback).toHaveBeenCalledWith('light');
    });

    it('should persist theme preference', () => {
      themeManager.setTheme('light');
      
      // Create new instance
      const newManager = new ThemeManager();
      expect(newManager.getCurrentTheme().name).toBe('light');
    });
  });

  describe('Color Utilities', () => {
    it('should get color by key', () => {
      themeManager.setTheme('dark');
      const primaryColor = themeManager.getColor('primary');
      expect(primaryColor).toBeDefined();
      expect(primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should get syntax color by token type', () => {
      themeManager.setTheme('dark');
      const keywordColor = themeManager.getSyntaxColor('keyword');
      expect(keywordColor).toBeDefined();
      expect(keywordColor).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should convert hex to RGB', () => {
      const rgb = themeManager.hexToRgb('#ff0000');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert RGB to hex', () => {
      const hex = themeManager.rgbToHex(255, 0, 0);
      expect(hex).toBe('#ff0000');
    });

    it('should calculate color contrast', () => {
      const contrast = themeManager.getContrast('#ffffff', '#000000');
      expect(contrast).toBe(21); // Maximum contrast

      const lowContrast = themeManager.getContrast('#ffffff', '#f0f0f0');
      expect(lowContrast).toBeLessThan(2);
    });
  });

  describe('Theme Customization', () => {
    it('should allow color overrides', () => {
      themeManager.setTheme('dark');
      themeManager.overrideColor('primary', '#ff00ff');

      expect(themeManager.getColor('primary')).toBe('#ff00ff');
    });

    it('should reset color overrides', () => {
      themeManager.setTheme('dark');
      const originalPrimary = themeManager.getColor('primary');
      
      themeManager.overrideColor('primary', '#ff00ff');
      themeManager.resetOverrides();

      expect(themeManager.getColor('primary')).toBe(originalPrimary);
    });

    it('should export theme as JSON', () => {
      themeManager.setTheme('dark');
      const exported = themeManager.exportTheme();
      
      expect(JSON.parse(exported)).toHaveProperty('name');
      expect(JSON.parse(exported)).toHaveProperty('colors');
      expect(JSON.parse(exported)).toHaveProperty('syntax');
    });

    it('should import theme from JSON', () => {
      const themeJson = JSON.stringify({
        name: 'imported',
        colors: {
          primary: '#123456',
          secondary: '#654321',
          background: '#000000',
          foreground: '#ffffff',
          error: '#ff0000',
          warning: '#ffff00',
          success: '#00ff00',
          info: '#0000ff',
        },
        syntax: {
          keyword: '#ff00ff',
          string: '#00ff00',
          number: '#ffff00',
          comment: '#888888',
          function: '#00ffff',
          variable: '#ffffff',
        },
      });

      themeManager.importTheme(themeJson);
      expect(themeManager.getTheme('imported')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should check WCAG contrast compliance', () => {
      themeManager.setTheme('light');
      
      const isCompliant = themeManager.checkWCAGCompliance(
        themeManager.getColor('foreground'),
        themeManager.getColor('background'),
        'AA'
      );

      expect(isCompliant).toBeDefined();
    });

    it('should suggest accessible color pairs', () => {
      const suggestions = themeManager.getAccessibleColorPairs('#ffffff');
      
      expect(suggestions).toBeInstanceOf(Array);
      suggestions.forEach(color => {
        const contrast = themeManager.getContrast('#ffffff', color);
        expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
      });
    });

    it('should provide high contrast mode', () => {
      themeManager.enableHighContrast();
      
      const foreground = themeManager.getColor('foreground');
      const background = themeManager.getColor('background');
      const contrast = themeManager.getContrast(foreground, background);

      expect(contrast).toBeGreaterThanOrEqual(7); // WCAG AAA standard
    });
  });

  describe('Theme Variants', () => {
    it('should generate theme variants', () => {
      const baseTheme = themeManager.getTheme('dark');
      if (!baseTheme) throw new Error('Base theme not found');
      const variants = themeManager.generateVariants(baseTheme);

      expect(variants).toHaveProperty('darker');
      expect(variants).toHaveProperty('lighter');
      expect(variants).toHaveProperty('highContrast');
      expect(variants).toHaveProperty('colorblind');
    });

    it('should adjust theme brightness', () => {
      themeManager.setTheme('dark');
      const brighterTheme = themeManager.adjustBrightness(1.2);

      // Colors should be brighter
      expect(brighterTheme.colors.primary).not.toBe(themeManager.getColor('primary'));
    });

    it('should adjust theme saturation', () => {
      themeManager.setTheme('dark');
      const desaturatedTheme = themeManager.adjustSaturation(0.5);

      // Colors should be less saturated
      expect(desaturatedTheme.colors.primary).not.toBe(themeManager.getColor('primary'));
    });
  });
});