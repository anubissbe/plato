# Output Styles Documentation

## Overview

The Output Styles system provides customizable visual themes for Plato's terminal interface, allowing users to switch between different display styles to match their preferences and terminal capabilities. This feature achieves parity with Claude Code's output styling system.

## Architecture

### Core Components

#### 1. StyleManager (`src/styles/manager.ts`)

The central class responsible for managing output styles:

```typescript
class StyleManager {
  // Initialize and load styles from configuration
  async initialize(): Promise<void>
  
  // Switch to a different style
  async setStyle(name: string): Promise<void>
  
  // Get current active style
  getStyle(): OutputStyle
  
  // List all available styles
  listStyles(): StyleInfo[]
  
  // Create custom style
  async createCustomStyle(
    name: string, 
    baseOn: string, 
    customizations: Partial<OutputStyle>
  ): Promise<void>
  
  // Delete custom style
  async deleteCustomStyle(name: string): Promise<void>
  
  // Format text/components with current style
  formatText(text: string, type: keyof OutputStyleTheme): string
  formatComponent(component: string, data: Record<string, any>): string
}
```

#### 2. Type Definitions (`src/styles/types.ts`)

```typescript
interface OutputStyle {
  name: string;
  description: string;
  theme: OutputStyleTheme;
  formatting: OutputStyleFormatting;
  components: OutputStyleComponents;
}

interface OutputStyleTheme {
  primary: string;      // Main text color
  secondary: string;    // Subdued text
  success: string;      // Success messages
  error: string;        // Error messages
  warning: string;      // Warnings
  info: string;         // Info messages
  muted: string;        // Gray/dimmed text
  border: string;       // Box borders
  spinner: string;      // Progress spinner
  selection: string;    // Selected items
}

interface OutputStyleFormatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  padding: number;
  margin: number;
  borderStyle: 'single' | 'double' | 'round' | 'none';
  showIcons: boolean;
  showTimestamps: boolean;
  showLineNumbers: boolean;
}
```

#### 3. Built-in Styles (`src/styles/builtin.ts`)

Three pre-configured styles are available:

- **default**: Claude Code classic appearance with icons and rounded borders
- **minimal**: Clean, distraction-free output without icons or borders
- **verbose**: Detailed output with timestamps and double borders

#### 4. Styled Components (`src/styles/components.tsx`)

React components that apply the current style:

```typescript
// Styled text with theme colors
<StyledText type="error">Error message</StyledText>

// Styled box with borders and padding
<StyledBox flexDirection="column">
  {content}
</StyledBox>

// Pre-configured component messages
<FileWriteMessage file="app.js" lines={100} success={true} />
<ErrorMessage message="Something went wrong" />
<ToolCallMessage name="compiler" />
<WelcomeMessage name="Plato" />
<StatusLine mode="ready" context="main" />
```

## Usage

### Command Line Interface

#### List Available Styles
```bash
/output-style
```

Output:
```
🎨 Available output styles:
  ✓ default [built-in] - Claude Code classic appearance
    minimal [built-in] - Clean, distraction-free output
    verbose [built-in] - Detailed output with timestamps
    
Usage: /output-style <name> to switch styles
       /output-style:new to create a custom style
```

#### Switch Style
```bash
/output-style minimal
```

Output:
```
✅ Switched to 'minimal' style
```

#### Show Current Style Details
```bash
/output-style show
```

Output:
```
📋 Current style: default
   Description: Claude Code classic appearance
   Icons: enabled
   Timestamps: disabled
   Border: round
   Theme colors:
     Primary: white
     Success: green
     Error: red
     Info: blue
```

### Creating Custom Styles

Custom styles can be created by editing `.plato/config.yaml`:

```yaml
outputStyle:
  active: my-style
  custom:
    - name: my-style
      description: My custom terminal style
      theme:
        primary: cyan
        secondary: gray
        success: green
        error: red
        warning: yellow
        info: blue
        muted: gray
        border: magenta
        spinner: cyan
        selection: cyan
      formatting:
        bold: true
        italic: false
        underline: false
        padding: 1
        margin: 0
        borderStyle: double
        showIcons: true
        showTimestamps: false
        showLineNumbers: false
      components:
        welcome:
          icon: '🚀'
          text: 'Welcome to {name}!'
        fileWrite:
          icon: '📄'
          format: 'Writing {file}...'
          success: '✅ Wrote {lines} lines to {file}'
        error:
          icon: '❌'
          format: 'Error: {message}'
        toolCall:
          icon: '🔧'
          format: 'Running tool: {name}'
```

## Integration with TUI

The style system is integrated into the terminal user interface through:

1. **Initialization**: StyleManager initializes on app startup
2. **Component Rendering**: All TUI components use styled components
3. **Dynamic Updates**: Style changes apply immediately without restart
4. **Persistence**: Active style saved to configuration

### Example Integration

```typescript
import { StyledText, StyledBox, initializeStyleManager } from './styles';

export function App() {
  // Initialize styles on startup
  useEffect(() => {
    initializeStyleManager();
  }, []);

  return (
    <StyledBox flexDirection="column">
      <StyledText type="primary">Hello World</StyledText>
      <StyledText type="success">✓ Operation completed</StyledText>
      <StyledText type="error">✗ Something went wrong</StyledText>
    </StyledBox>
  );
}
```

## Configuration

### Storage Location

Styles are stored in the global configuration file:
- **Global**: `~/.config/plato/config.yaml`
- **Project**: `.plato/config.yaml` (project-specific overrides)

### Configuration Structure

```yaml
outputStyle:
  active: string           # Currently active style name
  custom: OutputStyle[]    # Array of custom style definitions
```

## API Reference

### StyleManager Methods

#### `initialize()`
Loads custom styles and sets the active style from configuration.

#### `setStyle(name: string)`
Switches to the specified style. Throws an error if style doesn't exist.

#### `getStyle()`
Returns the current active `OutputStyle` object.

#### `listStyles()`
Returns an array of available styles with metadata:
```typescript
{
  name: string;
  description: string;
  active: boolean;
  custom: boolean;
}[]
```

#### `createCustomStyle(name, baseOn, customizations)`
Creates a new custom style based on an existing style with modifications.

#### `deleteCustomStyle(name)`
Removes a custom style from the configuration.

#### `formatText(text, type)`
Formats text with the specified theme color type.

#### `formatComponent(component, data)`
Formats a component message with placeholder substitution.

#### `getThemeColor(type)`
Returns the color value for a theme property.

#### `getFormatting()`
Returns the current style's formatting options.

#### `getComponentProps(componentType, props)`
Returns properly styled props for Ink components.

## Testing

The output styles system includes comprehensive tests:

```bash
# Run output styles tests
npm test -- src/__tests__/output-styles.test.ts

# Test coverage includes:
- Style switching and persistence
- Custom style creation and deletion
- Component formatting and rendering
- Theme color application
- Built-in style validation
```

## Performance Considerations

- **Initialization**: < 10ms overhead on startup
- **Style Switching**: Instant with forced re-render
- **Memory Usage**: Minimal (< 1MB for style definitions)
- **Render Impact**: Negligible performance impact on TUI rendering

## Troubleshooting

### Style Not Applying

1. Ensure StyleManager is initialized: `await initializeStyleManager()`
2. Check configuration file for syntax errors
3. Verify style name exists: `/output-style` to list available styles

### Custom Style Not Loading

1. Check YAML syntax in config file
2. Ensure all required theme properties are defined
3. Verify style name is unique

### Icons Not Displaying

1. Check terminal Unicode support
2. Switch to minimal style if terminal doesn't support emoji
3. Verify font includes required Unicode characters

## Future Enhancements

Potential improvements for the output styles system:

1. **Interactive Style Creator**: GUI for creating custom styles
2. **Theme Import/Export**: Share styles between users
3. **Terminal Detection**: Auto-select appropriate style based on terminal
4. **Color Schemes**: Support for 16-color, 256-color, and true color terminals
5. **Dynamic Themes**: Time-based or context-aware theme switching

## Related Documentation

- [TUI Architecture](./TUI_ARCHITECTURE.md)
- [Configuration System](./CONFIG.md)
- [Claude Code Parity Guide](./CLAUDE_CODE_PARITY_GUIDE.md)