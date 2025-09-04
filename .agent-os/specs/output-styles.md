# Output Styles Specification

## Overview

Output styles must control the visual appearance of all Plato output, exactly matching Claude Code's style system.

## Requirements

### Style Profiles

```typescript
interface OutputStyle {
  name: string;
  description: string;
  theme: {
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
  };
  
  formatting: {
    // Text decorations
    bold: boolean;
    italic: boolean;
    underline: boolean;
    
    // Layout
    padding: number;      // Internal spacing
    margin: number;       // External spacing
    borderStyle: 'single' | 'double' | 'rounded' | 'none';
    
    // Components
    showIcons: boolean;   // Emoji indicators
    showTimestamps: boolean;
    showLineNumbers: boolean;
  };
  
  components: {
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
  };
}
```

## Built-in Styles

### 1. Default (Claude Code Classic)
```typescript
const defaultStyle: OutputStyle = {
  name: 'default',
  description: 'Claude Code classic appearance',
  theme: {
    primary: 'white',
    secondary: 'gray',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
    muted: 'gray'
  },
  formatting: {
    bold: true,
    showIcons: true,
    borderStyle: 'single'
  },
  components: {
    welcome: {
      icon: '✻',
      text: 'Welcome to {name}!'
    },
    fileWrite: {
      icon: '📝',
      format: 'Writing {file}...',
      success: '✓ Wrote {lines} lines to {file}'
    }
  }
};
```

### 2. Minimal
```typescript
const minimalStyle: OutputStyle = {
  name: 'minimal',
  description: 'Clean, distraction-free output',
  theme: {
    primary: 'white',
    secondary: 'gray',
    success: 'green',
    error: 'red'
  },
  formatting: {
    showIcons: false,
    borderStyle: 'none'
  },
  components: {
    welcome: {
      icon: '',
      text: '{name} ready'
    },
    fileWrite: {
      icon: '',
      format: 'write: {file}',
      success: 'done: {lines} lines'
    }
  }
};
```

### 3. Verbose
```typescript
const verboseStyle: OutputStyle = {
  name: 'verbose',
  description: 'Detailed output with timestamps',
  formatting: {
    showTimestamps: true,
    showLineNumbers: true
  }
  // ... full details
};
```

## Implementation

### Style Manager

```typescript
class StyleManager {
  private currentStyle: OutputStyle;
  private customStyles: Map<string, OutputStyle>;
  
  // Load style by name
  setStyle(name: string): void;
  
  // Get current style
  getStyle(): OutputStyle;
  
  // Create custom style
  createCustomStyle(style: Partial<OutputStyle>): void;
  
  // Apply style to text
  formatText(text: string, type: keyof OutputStyle['theme']): string;
  
  // Apply style to component
  formatComponent(component: string, data: any): string;
}
```

### Integration with Ink Components

```typescript
// In app.tsx
const style = styleManager.getStyle();

// Apply to welcome message
<Text color={style.theme.primary}>
  {style.components.welcome.icon} {style.components.welcome.text}
</Text>

// Apply to file write
<Text color={style.theme.info}>
  {styleManager.formatComponent('fileWrite', { file: 'test.js' })}
</Text>

// Apply to errors
<Text color={style.theme.error}>
  {style.components.error.icon} {message}
</Text>
```

### Dynamic Style Application

```typescript
// Helper to apply current style
function styled(component: string, props: any) {
  const style = styleManager.getStyle();
  
  switch(component) {
    case 'Box':
      return {
        borderStyle: style.formatting.borderStyle,
        borderColor: style.theme.border,
        padding: style.formatting.padding
      };
    
    case 'Text':
      return {
        color: style.theme[props.type] || style.theme.primary,
        bold: style.formatting.bold && props.bold
      };
    
    case 'Spinner':
      return {
        color: style.theme.spinner,
        type: 'dots'
      };
  }
}

// Usage
<Box {...styled('Box', {})}>
  <Text {...styled('Text', { type: 'success' })}>
    Success!
  </Text>
</Box>
```

## Commands

### /output-style Command

```typescript
// List available styles
/output-style
> Available styles:
> - default (active)
> - minimal
> - verbose
> - custom-1

// Switch style
/output-style minimal
> Switched to minimal style

// Show current style
/output-style show
> Current style: minimal
> Theme: clean, distraction-free
> Icons: disabled
> Borders: none
```

### /output-style:new Command

```typescript
// Create custom style
/output-style:new
> Creating custom style...
> Name: my-style
> Base on (default/minimal/verbose): default
> Primary color: cyan
> Show icons (y/n): y
> Border style (single/double/rounded/none): rounded
> ✓ Created custom style: my-style
```

## Persistence

### Storage Location
```yaml
# .plato/config.yaml
outputStyle:
  active: default
  custom:
    - name: my-style
      theme:
        primary: cyan
      # ... full style definition
```

### Loading Priority
1. User's custom style if selected
2. Built-in style if selected
3. Default style as fallback

## Testing Requirements

1. **Visual Tests**
   - Each style renders correctly
   - Colors apply properly
   - Icons show/hide as configured

2. **Compatibility Tests**
   - Styles work across terminals
   - Unicode characters display correctly
   - Fallbacks for limited terminals

3. **Performance Tests**
   - Style switching is instant
   - No rendering lag
   - Memory efficient

## Success Criteria

- [ ] All output respects active style
- [ ] Style changes apply immediately
- [ ] Custom styles persist
- [ ] Claude Code style compatibility
- [ ] Performance < 10ms overhead
- [ ] Works in all terminals