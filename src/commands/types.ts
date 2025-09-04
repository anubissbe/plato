/**
 * Custom Command System Types
 * Defines the structure for custom commands loaded from .plato/commands/
 */

export interface CustomCommand {
  /** Command name (without slash prefix) */
  name: string;
  
  /** Optional namespace (e.g., 'git' for git:commit) */
  namespace?: string;
  
  /** Command description for help text */
  description: string;
  
  /** The actual script/command to execute */
  script: string;
  
  /** Whether this command accepts arguments via $ARGUMENTS */
  hasArguments: boolean;
  
  /** Optional command aliases */
  aliases?: string[];
  
  /** Optional metadata from YAML frontmatter */
  metadata?: Record<string, any>;
  
  /** File path where command was loaded from */
  filePath?: string;
}

export interface CommandNamespace {
  name: string;
  commands: CustomCommand[];
}

export interface CommandMenu {
  /** Root-level commands (no namespace) */
  root: CustomCommand[];
  
  /** Namespaced commands grouped by namespace */
  namespaces: Map<string, CustomCommand[]>;
}

export interface CommandExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  duration?: number;
}

export interface CommandExecutionOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** Working directory for command execution */
  cwd?: string;
  
  /** Environment variables */
  env?: Record<string, string>;
  
  /** Whether to capture output (default: true) */
  captureOutput?: boolean;
  
  /** Whether to show output in real-time */
  stream?: boolean;
}

export interface SlashCommand {
  name: string;
  summary: string;
}

export interface CommandLoaderOptions {
  /** Base directory for commands (default: .plato/commands) */
  baseDir?: string;
  
  /** Whether to watch for changes */
  watch?: boolean;
  
  /** File extensions to consider (default: ['.md']) */
  extensions?: string[];
  
  /** Maximum depth for namespace directories (default: 3) */
  maxDepth?: number;
}

export interface CommandParseResult {
  command: CustomCommand | null;
  errors?: string[];
}

export interface MarkdownSection {
  heading: string;
  content: string;
  level: number;
}

export interface CommandMetadata {
  name?: string;
  description?: string;
  namespace?: string;
  aliases?: string[] | string;
  timeout?: number;
  cwd?: string;
  [key: string]: any;
}