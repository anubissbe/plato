import fs from 'fs';
import path from 'path';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  [key: string]: string;
}

export interface ThemeSyntax {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  variable: string;
  [key: string]: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  syntax: ThemeSyntax;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export class ThemeManager {
  private themes: Map<string, Theme> = new Map();
  private currentTheme: Theme;
  private colorOverrides: Map<string, string> = new Map();
  private themeChangeListeners: Array<(theme: string) => void> = [];
  private persistencePath: string = '.plato/theme.json';

  constructor() {
    this.initializeDefaultThemes();
    this.currentTheme = this.loadPersistedTheme() || this.themes.get('dark')!;
  }

  private initializeDefaultThemes(): void {
    // Dark theme
    this.themes.set('dark', {
      name: 'dark',
      colors: {
        primary: '#61dafb',
        secondary: '#8cc8ff',
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        error: '#f48771',
        warning: '#ffcc00',
        success: '#89d185',
        info: '#61dafb',
      },
      syntax: {
        keyword: '#569cd6',
        string: '#ce9178',
        number: '#b5cea8',
        comment: '#6a9955',
        function: '#dcdcaa',
        variable: '#9cdcfe',
      },
    });

    // Light theme
    this.themes.set('light', {
      name: 'light',
      colors: {
        primary: '#0066cc',
        secondary: '#0052a3',
        background: '#ffffff',
        foreground: '#333333',
        error: '#d73a49',
        warning: '#e36209',
        success: '#28a745',
        info: '#0366d6',
      },
      syntax: {
        keyword: '#0000ff',
        string: '#a31515',
        number: '#098658',
        comment: '#008000',
        function: '#795e26',
        variable: '#001080',
      },
    });
  }

  registerTheme(theme: Theme): void {
    if (this.themes.has(theme.name) && (theme.name === 'dark' || theme.name === 'light')) {
      throw new Error(`Cannot overwrite built-in theme: ${theme.name}`);
    }
    this.themes.set(theme.name, theme);
  }

  getTheme(name: string): Theme | undefined {
    return this.themes.get(name);
  }

  listThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  setTheme(name: string): void {
    const theme = this.themes.get(name);
    if (!theme) {
      throw new Error(`Theme not found: ${name}`);
    }
    
    this.currentTheme = theme;
    this.colorOverrides.clear();
    this.persistTheme();
    this.notifyThemeChange(name);
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  onThemeChange(callback: (theme: string) => void): void {
    this.themeChangeListeners.push(callback);
  }

  private notifyThemeChange(themeName: string): void {
    this.themeChangeListeners.forEach(callback => callback(themeName));
  }

  // Color utilities
  getColor(key: string): string {
    if (this.colorOverrides.has(key)) {
      return this.colorOverrides.get(key)!;
    }
    return this.currentTheme.colors[key] || '#ffffff';
  }

  getSyntaxColor(tokenType: string): string {
    if (this.colorOverrides.has(`syntax.${tokenType}`)) {
      return this.colorOverrides.get(`syntax.${tokenType}`)!;
    }
    return this.currentTheme.syntax[tokenType] || '#ffffff';
  }

  overrideColor(key: string, color: string): void {
    this.colorOverrides.set(key, color);
  }

  resetOverrides(): void {
    this.colorOverrides.clear();
  }

  hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  // Calculate relative luminance
  private getLuminance(color: string): number {
    const rgb = this.hexToRgb(color);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  getContrast(color1: string, color2: string): number {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  // Theme customization
  exportTheme(): string {
    return JSON.stringify(this.currentTheme, null, 2);
  }

  importTheme(json: string): void {
    try {
      const theme = JSON.parse(json) as Theme;
      this.registerTheme(theme);
    } catch (error) {
      throw new Error(`Invalid theme JSON: ${error}`);
    }
  }

  // Accessibility
  checkWCAGCompliance(foreground: string, background: string, level: 'AA' | 'AAA'): boolean {
    const contrast = this.getContrast(foreground, background);
    if (level === 'AA') {
      return contrast >= 4.5; // Normal text
    } else {
      return contrast >= 7; // Enhanced contrast
    }
  }

  getAccessibleColorPairs(backgroundColor: string): string[] {
    const suggestions: string[] = [];
    const colors = [
      '#000000', '#ffffff', '#333333', '#666666', '#999999',
      '#0066cc', '#ff6600', '#009900', '#990099', '#ffcc00',
    ];

    colors.forEach(color => {
      if (this.checkWCAGCompliance(color, backgroundColor, 'AA')) {
        suggestions.push(color);
      }
    });

    return suggestions;
  }

  enableHighContrast(): void {
    const highContrastTheme: Theme = {
      name: 'high-contrast',
      colors: {
        primary: '#ffffff',
        secondary: '#ffff00',
        background: '#000000',
        foreground: '#ffffff',
        error: '#ff0000',
        warning: '#ffff00',
        success: '#00ff00',
        info: '#00ffff',
      },
      syntax: {
        keyword: '#ffff00',
        string: '#00ff00',
        number: '#00ffff',
        comment: '#808080',
        function: '#ff00ff',
        variable: '#ffffff',
      },
    };

    this.registerTheme(highContrastTheme);
    this.setTheme('high-contrast');
  }

  // Theme variants
  generateVariants(baseTheme: Theme): Record<string, Theme> {
    return {
      darker: this.adjustBrightness(0.8, baseTheme),
      lighter: this.adjustBrightness(1.2, baseTheme),
      highContrast: this.createHighContrastVariant(baseTheme),
      colorblind: this.createColorblindSafeVariant(baseTheme),
    };
  }

  adjustBrightness(factor: number, theme?: Theme): Theme {
    const targetTheme = theme || this.currentTheme;
    const adjustColor = (color: string): string => {
      const rgb = this.hexToRgb(color);
      const adjusted = {
        r: Math.min(255, Math.floor(rgb.r * factor)),
        g: Math.min(255, Math.floor(rgb.g * factor)),
        b: Math.min(255, Math.floor(rgb.b * factor)),
      };
      return this.rgbToHex(adjusted.r, adjusted.g, adjusted.b);
    };

    const adjustedColors: ThemeColors = {} as ThemeColors;
    Object.keys(targetTheme.colors).forEach(key => {
      adjustedColors[key] = adjustColor(targetTheme.colors[key]);
    });

    const adjustedSyntax: ThemeSyntax = {} as ThemeSyntax;
    Object.keys(targetTheme.syntax).forEach(key => {
      adjustedSyntax[key] = adjustColor(targetTheme.syntax[key]);
    });

    return {
      name: `${targetTheme.name}-brightness-${factor}`,
      colors: adjustedColors,
      syntax: adjustedSyntax,
    };
  }

  adjustSaturation(factor: number, theme?: Theme): Theme {
    const targetTheme = theme || this.currentTheme;
    const adjustColor = (color: string): string => {
      const rgb = this.hexToRgb(color);
      const max = Math.max(rgb.r, rgb.g, rgb.b);
      const gray = Math.floor((rgb.r + rgb.g + rgb.b) / 3);
      
      const adjusted = {
        r: Math.floor(gray + (rgb.r - gray) * factor),
        g: Math.floor(gray + (rgb.g - gray) * factor),
        b: Math.floor(gray + (rgb.b - gray) * factor),
      };
      
      return this.rgbToHex(
        Math.max(0, Math.min(255, adjusted.r)),
        Math.max(0, Math.min(255, adjusted.g)),
        Math.max(0, Math.min(255, adjusted.b))
      );
    };

    const adjustedColors: ThemeColors = {} as ThemeColors;
    Object.keys(targetTheme.colors).forEach(key => {
      adjustedColors[key] = adjustColor(targetTheme.colors[key]);
    });

    const adjustedSyntax: ThemeSyntax = {} as ThemeSyntax;
    Object.keys(targetTheme.syntax).forEach(key => {
      adjustedSyntax[key] = adjustColor(targetTheme.syntax[key]);
    });

    return {
      name: `${targetTheme.name}-saturation-${factor}`,
      colors: adjustedColors,
      syntax: adjustedSyntax,
    };
  }

  private createHighContrastVariant(baseTheme: Theme): Theme {
    // Create a high contrast version with maximum contrast ratios
    const isLightTheme = this.getLuminance(baseTheme.colors.background) > 0.5;
    
    return {
      name: `${baseTheme.name}-high-contrast`,
      colors: {
        primary: isLightTheme ? '#0000ff' : '#ffff00',
        secondary: isLightTheme ? '#ff0000' : '#00ffff',
        background: isLightTheme ? '#ffffff' : '#000000',
        foreground: isLightTheme ? '#000000' : '#ffffff',
        error: '#ff0000',
        warning: isLightTheme ? '#ff6600' : '#ffff00',
        success: isLightTheme ? '#008800' : '#00ff00',
        info: isLightTheme ? '#0066cc' : '#00ffff',
      },
      syntax: {
        keyword: isLightTheme ? '#0000ff' : '#ffff00',
        string: isLightTheme ? '#008800' : '#00ff00',
        number: isLightTheme ? '#ff0000' : '#ff00ff',
        comment: isLightTheme ? '#666666' : '#999999',
        function: isLightTheme ? '#ff00ff' : '#00ffff',
        variable: isLightTheme ? '#000000' : '#ffffff',
      },
    };
  }

  private createColorblindSafeVariant(baseTheme: Theme): Theme {
    // Create a colorblind-safe variant using patterns that work for most types
    return {
      name: `${baseTheme.name}-colorblind`,
      colors: {
        primary: '#0173b2',
        secondary: '#de8f05',
        background: baseTheme.colors.background,
        foreground: baseTheme.colors.foreground,
        error: '#cc3311',
        warning: '#ee7733',
        success: '#009988',
        info: '#33bbee',
      },
      syntax: {
        keyword: '#0173b2',
        string: '#009988',
        number: '#ee7733',
        comment: '#999999',
        function: '#de8f05',
        variable: baseTheme.syntax.variable,
      },
    };
  }

  // Persistence
  private persistTheme(): void {
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.persistencePath,
        JSON.stringify({
          currentTheme: this.currentTheme.name,
          overrides: Array.from(this.colorOverrides.entries()),
        }),
        'utf-8'
      );
    } catch (error) {
      // Silently fail if can't persist
    }
  }

  private loadPersistedTheme(): Theme | null {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf-8'));
        const theme = this.themes.get(data.currentTheme);
        
        if (theme && data.overrides) {
          this.colorOverrides = new Map(data.overrides);
        }
        
        return theme || null;
      }
    } catch (error) {
      // Silently fail if can't load
    }
    return null;
  }
}