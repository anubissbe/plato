// Output style system types

export interface OutputStyleTheme {
  // Text colors
  primary: string;      // Main text
  secondary: string;    // Subdued text  
  success: string;      // Success messages
  error: string;        // Error messages
  warning: string;      // Warnings
  info: string;         // Info messages
  muted: string;        // Gray/dimmed text
  
  // Backgrounds
  bgPrimary?: string;   // Main background
  bgSecondary?: string; // Alternate background
  
  // Borders and UI
  border: string;       // Box borders
  spinner: string;      // Progress spinner
  selection: string;    // Selected items
}

export interface OutputStyleFormatting {
  // Text decorations
  bold: boolean;
  italic: boolean;
  underline: boolean;
  
  // Layout
  padding: number;      // Internal spacing
  margin: number;       // External spacing
  borderStyle: 'single' | 'double' | 'round' | 'none';
  
  // Components
  showIcons: boolean;   // Emoji indicators
  showTimestamps: boolean;
  showLineNumbers: boolean;
}

export interface OutputStyleComponents {
  // Welcome message
  welcome: {
    icon: string;       // ✻ or custom
    text: string;       // Template with {name}
  };
  
  // Status line
  statusLine: {
    format: string;     // Template with placeholders
    separator: string;  // | or custom
  };
  
  // File operations
  fileWrite: {
    icon: string;       // 📝 or custom
    format: string;     // "Writing {file}..."
    success: string;    // "✓ Wrote {lines} lines to {file}"
  };
  
  // Errors
  error: {
    icon: string;       // ❌ or custom
    format: string;     // "Error: {message}"
  };
  
  // Tool calls
  toolCall: {
    icon: string;       // 🔧 or custom
    format: string;     // "Running tool: {name}"
  };
}

export interface OutputStyle {
  name: string;
  description: string;
  theme: OutputStyleTheme;
  formatting: OutputStyleFormatting;
  components: OutputStyleComponents;
}

export type StyleType = 'default' | 'minimal' | 'verbose' | string;