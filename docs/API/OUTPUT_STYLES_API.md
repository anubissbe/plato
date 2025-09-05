# Output Styles API Reference

## Module: `src/styles`

### Exports

```typescript
// Main exports
export { StyleManager, getStyleManager, initializeStyleManager } from './manager';
export { defaultStyle, minimalStyle, verboseStyle, BUILTIN_STYLES } from './builtin';
export { 
  StyledText, 
  StyledBox, 
  StyledSpinner,
  FileWriteMessage,
  ErrorMessage,
  ToolCallMessage,
  WelcomeMessage,
  StatusLine 
} from './components';
export type { 
  OutputStyle,
  OutputStyleTheme,
  OutputStyleFormatting,
  OutputStyleComponents,
  StyleType 
} from './types';
```

## Class: StyleManager

### Constructor

```typescript
constructor(configPath?: string)
```

Creates a new StyleManager instance.

**Parameters:**
- `configPath` (optional): Path to config file. Defaults to `.plato/config.json`

### Methods

#### `async initialize(): Promise<void>`

Initializes the style manager by loading custom styles and setting the active style from configuration.

**Example:**
```typescript
const manager = new StyleManager();
await manager.initialize();
```

#### `async setStyle(name: string): Promise<void>`

Switches to the specified style by name.

**Parameters:**
- `name`: Name of the style to activate

**Throws:**
- Error if style name doesn't exist

**Example:**
```typescript
await manager.setStyle('minimal');
```

#### `getStyle(): OutputStyle`

Returns the currently active style object.

**Returns:** Complete OutputStyle object with theme, formatting, and components

**Example:**
```typescript
const currentStyle = manager.getStyle();
console.log(currentStyle.name); // "default"
```

#### `getCurrentStyleName(): string`

Returns the name of the currently active style.

**Returns:** Style name as string

#### `listStyles(): StyleInfo[]`

Lists all available styles including built-in and custom.

**Returns:** Array of style information objects:
```typescript
interface StyleInfo {
  name: string;
  description: string;
  active: boolean;
  custom: boolean;
}
```

**Example:**
```typescript
const styles = manager.listStyles();
// [
//   { name: 'default', description: '...', active: true, custom: false },
//   { name: 'minimal', description: '...', active: false, custom: false }
// ]
```

#### `async createCustomStyle(name: string, baseOn: string, customizations: Partial<OutputStyle>): Promise<void>`

Creates a new custom style based on an existing style.

**Parameters:**
- `name`: Name for the new custom style
- `baseOn`: Name of existing style to use as base
- `customizations`: Partial style object with custom properties

**Example:**
```typescript
await manager.createCustomStyle('my-style', 'default', {
  description: 'My custom style',
  theme: {
    primary: 'cyan'
  }
});
```

#### `async deleteCustomStyle(name: string): Promise<void>`

Deletes a custom style.

**Parameters:**
- `name`: Name of custom style to delete

**Throws:**
- Error if style doesn't exist or is not custom

#### `formatText(text: string, type: keyof OutputStyleTheme): string`

Formats text with the specified theme color type.

**Parameters:**
- `text`: Text to format
- `type`: Theme color type ('primary', 'error', 'success', etc.)

**Returns:** Formatted text string

#### `formatComponent(component: keyof OutputStyleComponents, data: Record<string, any>): string`

Formats a component message with placeholder substitution.

**Parameters:**
- `component`: Component name ('fileWrite', 'error', 'toolCall', etc.)
- `data`: Data object for placeholder substitution

**Returns:** Formatted component message

**Example:**
```typescript
const message = manager.formatComponent('fileWrite', {
  file: 'app.js',
  lines: 100
});
// "📝 Writing app.js..."
```

#### `getThemeColor(type: keyof OutputStyleTheme): string`

Gets the color value for a theme property.

**Parameters:**
- `type`: Theme color type

**Returns:** Color value as string

#### `getFormatting(): OutputStyleFormatting`

Returns the current style's formatting options.

**Returns:** Complete formatting configuration object

#### `getComponentProps(componentType: 'Box' | 'Text' | 'Spinner', props?: any): any`

Returns properly styled props for Ink components.

**Parameters:**
- `componentType`: Type of Ink component
- `props`: Additional props to merge

**Returns:** Merged props object with style applied

## React Components

### StyledText

Styled text component with theme support.

**Props:**
```typescript
interface StyledTextProps {
  type?: keyof OutputStyleTheme;  // Color type
  children?: React.ReactNode;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}
```

**Example:**
```tsx
<StyledText type="error">Error occurred!</StyledText>
<StyledText type="success" bold>Success!</StyledText>
```

### StyledBox

Styled box container with border support.

**Props:**
```typescript
interface StyledBoxProps {
  noBorder?: boolean;
  children?: React.ReactNode;
  flexDirection?: 'row' | 'column';
  height?: number | string;
  width?: number | string;
  padding?: number;
  margin?: number;
}
```

**Example:**
```tsx
<StyledBox flexDirection="column" height={10}>
  <StyledText>Content</StyledText>
</StyledBox>
```

### StyledSpinner

Animated spinner with styled colors.

**Props:**
```typescript
interface StyledSpinnerProps {
  text?: string;  // Optional text to display next to spinner
}
```

**Example:**
```tsx
<StyledSpinner text="Loading..." />
```

### FileWriteMessage

Pre-formatted file write message component.

**Props:**
```typescript
interface FileWriteMessageProps {
  file: string;
  lines?: number;
  success?: boolean;
}
```

**Example:**
```tsx
<FileWriteMessage file="app.js" lines={100} success={true} />
// Renders: "✓ Wrote 100 lines to app.js"
```

### ErrorMessage

Pre-formatted error message component.

**Props:**
```typescript
interface ErrorMessageProps {
  message: string;
}
```

**Example:**
```tsx
<ErrorMessage message="Failed to connect" />
// Renders: "❌ Error: Failed to connect"
```

### ToolCallMessage

Pre-formatted tool call message component.

**Props:**
```typescript
interface ToolCallMessageProps {
  name: string;
  args?: string;
}
```

**Example:**
```tsx
<ToolCallMessage name="compiler" args="--optimize" />
// Renders: "🔧 Running tool: compiler"
```

### WelcomeMessage

Pre-formatted welcome message component.

**Props:**
```typescript
interface WelcomeMessageProps {
  name?: string;  // Defaults to 'Plato'
}
```

**Example:**
```tsx
<WelcomeMessage name="MyApp" />
// Renders: "✻ Welcome to MyApp!"
```

### StatusLine

Pre-formatted status line component.

**Props:**
```typescript
interface StatusLineProps {
  mode?: string;
  context?: string;
  session?: string;
  tokens?: number;
}
```

**Example:**
```tsx
<StatusLine 
  mode="ready" 
  context="main" 
  session="active"
  tokens={1500}
/>
// Renders formatted status based on current style
```

## Utility Functions

### `getStyleManager(): StyleManager`

Returns the singleton StyleManager instance.

**Returns:** Global StyleManager instance

**Example:**
```typescript
const manager = getStyleManager();
```

### `async initializeStyleManager(): Promise<StyleManager>`

Initializes and returns the global StyleManager instance.

**Returns:** Initialized StyleManager

**Example:**
```typescript
const manager = await initializeStyleManager();
```

## Type Definitions

### OutputStyle

Complete style definition interface.

```typescript
interface OutputStyle {
  name: string;
  description: string;
  theme: OutputStyleTheme;
  formatting: OutputStyleFormatting;
  components: OutputStyleComponents;
}
```

### OutputStyleTheme

Theme color definitions.

```typescript
interface OutputStyleTheme {
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  muted: string;
  bgPrimary?: string;
  bgSecondary?: string;
  border: string;
  spinner: string;
  selection: string;
}
```

### OutputStyleFormatting

Formatting options.

```typescript
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

### OutputStyleComponents

Component message templates.

```typescript
interface OutputStyleComponents {
  welcome: {
    icon: string;
    text: string;
  };
  statusLine: {
    format: string;
    separator: string;
  };
  fileWrite: {
    icon: string;
    format: string;
    success: string;
  };
  error: {
    icon: string;
    format: string;
  };
  toolCall: {
    icon: string;
    format: string;
  };
}
```

### StyleType

Valid style type names.

```typescript
type StyleType = 'default' | 'minimal' | 'verbose' | string;
```