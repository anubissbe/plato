// Tests for output styles system

import { StyleManager } from '../styles/manager.js';
import { defaultStyle, minimalStyle, verboseStyle, BUILTIN_STYLES } from '../styles/builtin.js';
import { OutputStyle } from '../styles/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock the config module
jest.mock('../config.js', () => ({
  loadConfig: jest.fn(() => Promise.resolve({
    outputStyle: {
      active: 'default',
      custom: []
    }
  })),
  saveConfig: jest.fn(() => Promise.resolve())
}));

// Mock fs for file operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Output Styles System', () => {
  let styleManager: StyleManager;

  beforeEach(() => {
    jest.clearAllMocks();
    styleManager = new StyleManager();
  });

  describe('StyleManager', () => {
    test('should initialize with default style', async () => {
      await styleManager.initialize();
      const currentStyle = styleManager.getStyle();
      expect(currentStyle.name).toBe('default');
    });

    test('should switch to minimal style', async () => {
      await styleManager.initialize();
      await styleManager.setStyle('minimal');
      const currentStyle = styleManager.getStyle();
      expect(currentStyle.name).toBe('minimal');
      expect(currentStyle.formatting.showIcons).toBe(false);
    });

    test('should switch to verbose style', async () => {
      await styleManager.initialize();
      await styleManager.setStyle('verbose');
      const currentStyle = styleManager.getStyle();
      expect(currentStyle.name).toBe('verbose');
      expect(currentStyle.formatting.showTimestamps).toBe(true);
    });

    test('should throw error for non-existent style', async () => {
      await styleManager.initialize();
      await expect(styleManager.setStyle('non-existent')).rejects.toThrow("Style 'non-existent' not found");
    });

    test('should list all available styles', async () => {
      await styleManager.initialize();
      const styles = styleManager.listStyles();
      
      expect(styles).toHaveLength(3);
      expect(styles.map(s => s.name)).toContain('default');
      expect(styles.map(s => s.name)).toContain('minimal');
      expect(styles.map(s => s.name)).toContain('verbose');
    });

    test('should identify active style correctly', async () => {
      await styleManager.initialize();
      await styleManager.setStyle('minimal');
      
      const styles = styleManager.listStyles();
      const minimalStyle = styles.find(s => s.name === 'minimal');
      const defaultStyle = styles.find(s => s.name === 'default');
      
      expect(minimalStyle?.active).toBe(true);
      expect(defaultStyle?.active).toBe(false);
    });

    test('should create custom style', async () => {
      await styleManager.initialize();
      
      await styleManager.createCustomStyle('my-custom', 'default', {
        description: 'My custom style'
      });
      
      const styles = styleManager.listStyles();
      const customStyle = styles.find(s => s.name === 'my-custom');
      
      expect(customStyle).toBeDefined();
      expect(customStyle?.custom).toBe(true);
      expect(customStyle?.description).toBe('My custom style');
    });

    test('should delete custom style', async () => {
      await styleManager.initialize();
      
      await styleManager.createCustomStyle('temp-style', 'minimal', {
        description: 'Temporary style'
      });
      
      let styles = styleManager.listStyles();
      expect(styles.map(s => s.name)).toContain('temp-style');
      
      await styleManager.deleteCustomStyle('temp-style');
      
      styles = styleManager.listStyles();
      expect(styles.map(s => s.name)).not.toContain('temp-style');
    });

    test('should throw error when deleting non-existent custom style', async () => {
      await styleManager.initialize();
      await expect(styleManager.deleteCustomStyle('non-existent')).rejects.toThrow("Custom style 'non-existent' not found");
    });

    test('should format text with theme colors', () => {
      const text = styleManager.formatText('Hello', 'primary');
      expect(text).toBe('Hello'); // Color will be applied by Ink
    });

    test('should format component with placeholders', () => {
      const formatted = styleManager.formatComponent('fileWrite', { 
        file: 'test.js', 
        lines: 100,
        success: true 
      });
      expect(formatted).toContain('test.js');
      expect(formatted).toContain('100');
    });

    test('should get theme color', () => {
      const color = styleManager.getThemeColor('success');
      expect(color).toBe('green');
    });

    test('should get formatting options', () => {
      const formatting = styleManager.getFormatting();
      expect(formatting).toHaveProperty('bold');
      expect(formatting).toHaveProperty('showIcons');
      expect(formatting).toHaveProperty('borderStyle');
    });

    test('should get component props for Box', () => {
      const props = styleManager.getComponentProps('Box');
      expect(props).toHaveProperty('borderStyle');
      expect(props).toHaveProperty('borderColor');
      expect(props).toHaveProperty('padding');
    });

    test('should get component props for Text', () => {
      const props = styleManager.getComponentProps('Text', { type: 'error' });
      expect(props).toHaveProperty('color');
      expect(props.color).toBe('red');
    });

    test('should get component props for Spinner', () => {
      const props = styleManager.getComponentProps('Spinner');
      expect(props).toHaveProperty('color');
      expect(props).toHaveProperty('type');
      expect(props.type).toBe('dots');
    });
  });

  describe('Built-in Styles', () => {
    test('default style should have correct properties', () => {
      expect(defaultStyle.name).toBe('default');
      expect(defaultStyle.theme.primary).toBe('white');
      expect(defaultStyle.formatting.showIcons).toBe(true);
      expect(defaultStyle.formatting.borderStyle).toBe('round');
      expect(defaultStyle.components.welcome.icon).toBe('✻');
    });

    test('minimal style should have correct properties', () => {
      expect(minimalStyle.name).toBe('minimal');
      expect(minimalStyle.formatting.showIcons).toBe(false);
      expect(minimalStyle.formatting.borderStyle).toBe('none');
      expect(minimalStyle.components.welcome.icon).toBe('');
    });

    test('verbose style should have correct properties', () => {
      expect(verboseStyle.name).toBe('verbose');
      expect(verboseStyle.formatting.showTimestamps).toBe(true);
      expect(verboseStyle.formatting.showLineNumbers).toBe(true);
      expect(verboseStyle.formatting.borderStyle).toBe('double');
      expect(verboseStyle.components.welcome.icon).toBe('🚀');
    });

    test('all built-in styles should be in BUILTIN_STYLES', () => {
      expect(BUILTIN_STYLES).toHaveProperty('default');
      expect(BUILTIN_STYLES).toHaveProperty('minimal');
      expect(BUILTIN_STYLES).toHaveProperty('verbose');
      expect(Object.keys(BUILTIN_STYLES)).toHaveLength(3);
    });
  });

  describe('Style Components', () => {
    test('welcome component should format correctly', () => {
      const formatted = styleManager.formatComponent('welcome', { name: 'TestApp' });
      expect(formatted).toContain('TestApp');
    });

    test('fileWrite component should format correctly', () => {
      const formatted = styleManager.formatComponent('fileWrite', { 
        file: 'app.js',
        lines: 50
      });
      expect(formatted).toContain('app.js');
    });

    test('error component should format correctly', () => {
      const formatted = styleManager.formatComponent('error', { 
        message: 'Something went wrong'
      });
      expect(formatted).toContain('Something went wrong');
    });

    test('toolCall component should format correctly', () => {
      const formatted = styleManager.formatComponent('toolCall', { 
        name: 'compiler'
      });
      expect(formatted).toContain('compiler');
    });

    test('components should include icons when enabled', async () => {
      await styleManager.initialize();
      await styleManager.setStyle('default');
      
      const formatted = styleManager.formatComponent('fileWrite', { file: 'test.js' });
      expect(formatted).toContain('📝');
    });

    test('components should not include icons when disabled', async () => {
      await styleManager.initialize();
      await styleManager.setStyle('minimal');
      
      const formatted = styleManager.formatComponent('fileWrite', { file: 'test.js' });
      expect(formatted).not.toContain('📝');
    });

    test('components should include timestamps when enabled', async () => {
      await styleManager.initialize();
      await styleManager.setStyle('verbose');
      
      const formatted = styleManager.formatComponent('fileWrite', { file: 'test.js' });
      // Check for time format HH:MM:SS
      expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });
});