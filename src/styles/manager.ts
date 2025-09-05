// Style manager for output styling

import { OutputStyle, OutputStyleTheme, StyleType } from './types.js';
import { BUILTIN_STYLES, defaultStyle } from './builtin.js';
import { loadConfig, saveConfig } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class StyleManager {
  private currentStyle: OutputStyle;
  private customStyles: Map<string, OutputStyle>;
  private configPath: string;

  constructor(configPath: string = '.plato/config.json') {
    this.currentStyle = defaultStyle;
    this.customStyles = new Map();
    this.configPath = configPath;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadCustomStyles();
      const config = await loadConfig();
      
      // Load active style from config
      if (config.outputStyle?.active) {
        await this.setStyle(config.outputStyle.active);
      }
    } catch (error) {
      // Use default style if loading fails
      console.error('Failed to load styles, using default:', error);
      this.currentStyle = defaultStyle;
    }
  }

  private async loadCustomStyles(): Promise<void> {
    try {
      const config = await loadConfig();
      
      if (config.outputStyle?.custom) {
        for (const style of config.outputStyle.custom) {
          this.customStyles.set(style.name, style);
        }
      }
    } catch (error) {
      // No custom styles to load
    }
  }

  async setStyle(name: string): Promise<void> {
    // Check built-in styles first
    if (BUILTIN_STYLES[name as keyof typeof BUILTIN_STYLES]) {
      this.currentStyle = BUILTIN_STYLES[name as keyof typeof BUILTIN_STYLES];
    } 
    // Then check custom styles
    else if (this.customStyles.has(name)) {
      this.currentStyle = this.customStyles.get(name)!;
    } 
    // Fall back to default
    else {
      throw new Error(`Style '${name}' not found`);
    }

    // Save active style to config
    await this.saveActiveStyle(name);
  }

  private async saveActiveStyle(name: string): Promise<void> {
    try {
      const config = await loadConfig();
      
      if (!config.outputStyle) {
        config.outputStyle = { active: 'default', custom: [] };
      }
      
      config.outputStyle.active = name;
      await saveConfig(config);
    } catch (error) {
      console.error('Failed to save active style:', error);
    }
  }

  getStyle(): OutputStyle {
    return this.currentStyle;
  }

  getCurrentStyleName(): string {
    return this.currentStyle.name;
  }

  async createCustomStyle(name: string, baseOn: string, customizations: Partial<OutputStyle>): Promise<void> {
    // Start with base style
    let baseStyle: OutputStyle;
    
    if (BUILTIN_STYLES[baseOn as keyof typeof BUILTIN_STYLES]) {
      baseStyle = BUILTIN_STYLES[baseOn as keyof typeof BUILTIN_STYLES];
    } else if (this.customStyles.has(baseOn)) {
      baseStyle = this.customStyles.get(baseOn)!;
    } else {
      baseStyle = defaultStyle;
    }

    // Create new style with customizations
    const newStyle: OutputStyle = {
      ...baseStyle,
      ...customizations,
      name,
      theme: {
        ...baseStyle.theme,
        ...(customizations.theme || {})
      },
      formatting: {
        ...baseStyle.formatting,
        ...(customizations.formatting || {})
      },
      components: {
        ...baseStyle.components,
        ...(customizations.components || {})
      }
    };

    // Save to custom styles
    this.customStyles.set(name, newStyle);
    
    // Persist to config
    await this.saveCustomStyle(newStyle);
  }

  private async saveCustomStyle(style: OutputStyle): Promise<void> {
    try {
      const config = await loadConfig();
      
      if (!config.outputStyle) {
        config.outputStyle = { active: 'default', custom: [] };
      }
      
      // Remove existing style with same name if exists
      config.outputStyle.custom = (config.outputStyle.custom || []).filter(s => s.name !== style.name);
      
      // Add new style
      config.outputStyle.custom.push(style);
      
      await saveConfig(config);
    } catch (error) {
      console.error('Failed to save custom style:', error);
      throw error;
    }
  }

  async deleteCustomStyle(name: string): Promise<void> {
    if (!this.customStyles.has(name)) {
      throw new Error(`Custom style '${name}' not found`);
    }

    this.customStyles.delete(name);

    // Remove from config
    try {
      const config = await loadConfig();
      
      if (config.outputStyle?.custom) {
        config.outputStyle.custom = config.outputStyle.custom.filter(s => s.name !== name);
        await saveConfig(config);
      }
    } catch (error) {
      console.error('Failed to delete custom style:', error);
      throw error;
    }
  }

  listStyles(): { name: string; description: string; active: boolean; custom: boolean }[] {
    const styles = [];

    // Add built-in styles
    for (const [key, style] of Object.entries(BUILTIN_STYLES)) {
      styles.push({
        name: style.name,
        description: style.description,
        active: this.currentStyle.name === style.name,
        custom: false
      });
    }

    // Add custom styles
    for (const [name, style] of this.customStyles) {
      styles.push({
        name: style.name,
        description: style.description,
        active: this.currentStyle.name === style.name,
        custom: true
      });
    }

    return styles;
  }

  formatText(text: string, type: keyof OutputStyleTheme): string {
    const color = this.currentStyle.theme[type];
    return color ? text : text; // Color will be applied by Ink components
  }

  formatComponent(component: keyof OutputStyle['components'], data: Record<string, any>): string {
    const comp = this.currentStyle.components[component];
    
    if (!comp) {
      return '';
    }

    // Get the appropriate format string
    let format: string;
    if (component === 'fileWrite' && data.success) {
      format = (comp as any).success;
    } else if ('format' in comp) {
      format = comp.format;
    } else if ('text' in comp) {
      format = comp.text;
    } else {
      return '';
    }

    // Add timestamp if needed
    if (this.currentStyle.formatting.showTimestamps && !data.timestamp) {
      data.timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    }

    // Replace placeholders
    let result = format;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    // Add icon if present
    const icon = (comp as any).icon;
    if (icon && this.currentStyle.formatting.showIcons) {
      result = `${icon} ${result}`;
    }

    return result;
  }

  getThemeColor(type: keyof OutputStyleTheme): string {
    return this.currentStyle.theme[type] || 'white';
  }

  getFormatting(): OutputStyle['formatting'] {
    return this.currentStyle.formatting;
  }

  // Helper to apply style to Ink component props
  getComponentProps(componentType: 'Box' | 'Text' | 'Spinner', props?: any): any {
    const style = this.currentStyle;
    
    switch(componentType) {
      case 'Box':
        return {
          borderStyle: style.formatting.borderStyle === 'none' ? undefined : style.formatting.borderStyle,
          borderColor: style.formatting.borderStyle === 'none' ? undefined : style.theme.border,
          padding: style.formatting.padding,
          margin: style.formatting.margin,
          ...props
        };
      
      case 'Text':
        const colorType = props?.type || 'primary';
        return {
          color: style.theme[colorType as keyof OutputStyleTheme] || style.theme.primary,
          bold: style.formatting.bold && props?.bold !== false,
          italic: style.formatting.italic && props?.italic !== false,
          underline: style.formatting.underline && props?.underline !== false,
          ...props
        };
      
      case 'Spinner':
        return {
          color: style.theme.spinner,
          type: 'dots',
          ...props
        };
      
      default:
        return props;
    }
  }
}

// Singleton instance
let styleManager: StyleManager | null = null;

export function getStyleManager(): StyleManager {
  if (!styleManager) {
    styleManager = new StyleManager();
  }
  return styleManager;
}

export async function initializeStyleManager(): Promise<StyleManager> {
  const manager = getStyleManager();
  await manager.initialize();
  return manager;
}