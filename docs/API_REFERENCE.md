# Plato API Reference

## Core APIs

### TUI Application API

#### `src/tui/app.tsx`

```typescript
/**
 * Main TUI React component for Plato
 * Handles user input, command routing, and display
 */
export function App(): JSX.Element

// Internal state management
const [input, setInput] = useState<string>('')
const [lines, setLines] = useState<string[]>([])
const [status, setStatus] = useState<string>('')
const [cfg, setCfg] = useState<any>(null)
const [confirm, setConfirm] = useState<{ question: string; proceed: () => Promise<void> } | null>(null)

// Key handlers
useInput((input: string, key: any) => void)
handleSubmit(): Promise<void>
```

### Runtime Orchestrator API

#### `src/runtime/orchestrator.ts`

```typescript
/**
 * Core orchestration engine managing conversation flow,
 * tool calls, and session persistence
 */
interface Orchestrator {
  /**
   * Process user input and generate AI response
   * @param input - User message
   * @param onEvent - Optional event handler for tool calls
   * @returns AI response text
   */
  respond(input: string, onEvent?: (e: OrchestratorEvent) => void): Promise<string>

  /**
   * Stream response with incremental updates
   * @param input - User message  
   * @param onDelta - Callback for each response chunk
   * @returns Complete response text
   */
  respondStream(input: string, onDelta: (delta: string) => void): Promise<string>

  /**
   * Export conversation to JSON format
   * @param file - Optional file path, outputs to console if not provided
   */
  exportJSON(file?: string): Promise<void>

  /**
   * Export conversation to Markdown format
   * @param file - Optional file path, outputs to console if not provided
   */
  exportMarkdown(file?: string): Promise<void>

  /**
   * Import session from JSON file
   * @param file - Path to session JSON file
   */
  importJSON(file: string): Promise<void>

  /**
   * Get current conversation history
   * @returns Array of messages
   */
  getHistory(): Message[]

  /**
   * Compact history keeping only recent messages
   * @param keep - Number of messages to keep
   */
  compactHistory(keep: number): void

  /**
   * Clear conversation memory
   */
  clearMemory(): void

  /**
   * Get conversation metrics
   * @returns Token counts and timing information
   */
  getMetrics(): Metrics

  /**
   * Get pending patch if any
   * @returns Unified diff string or null
   */
  getPendingPatch(): string | null

  /**
   * Clear pending patch
   */
  clearPendingPatch(): void
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

interface Metrics {
  inputTokens: number
  outputTokens: number
  durationMs: number
  turns: number
}

interface OrchestratorEvent {
  type: 'tool-start' | 'tool-end' | 'info'
  message: string
}
```

### Provider APIs

#### `src/providers/copilot.ts`

```typescript
/**
 * GitHub Copilot authentication and token management
 */

/**
 * Initiate OAuth device flow for Copilot authentication
 * Displays device code and polls for completion
 */
export async function loginCopilot(): Promise<void>

/**
 * Clear stored credentials and logout
 */
export async function logoutCopilot(): Promise<void>

/**
 * Get current authentication status
 * @returns Auth info including user details if logged in
 */
export async function getAuthInfo(): Promise<{
  loggedIn: boolean
  user?: {
    login: string
    email?: string
  }
}>

/**
 * Ensure valid access token for API calls
 * Refreshes if expired
 * @returns Valid access token
 */
export async function ensureAccessToken(): Promise<string>

/**
 * Get chat completion headers for Copilot API
 * @param token - Access token
 * @returns Headers object for fetch requests
 */
export function getChatHeaders(token: string): Record<string, string>
```

#### `src/providers/chat.ts`

```typescript
/**
 * Chat completion API wrapper
 */

/**
 * Stream chat completion from provider
 * @param messages - Conversation history
 * @param onDelta - Callback for each response chunk
 * @returns Complete response and usage metrics
 */
export async function streamChat(
  messages: Message[],
  onDelta: (delta: string) => void
): Promise<{
  content: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}>
```

### Tool APIs

#### `src/tools/patch.ts`

```typescript
/**
 * Git patch operations for file modifications
 */

/**
 * Sanitize diff for security
 * @param diff - Raw unified diff
 * @returns Sanitized diff safe for application
 */
export function sanitizeDiff(diff: string): string

/**
 * Test if patch can be applied cleanly
 * @param diff - Unified diff to test
 * @returns Success status and any conflicts
 */
export async function dryRunApply(diff: string): Promise<{
  ok: boolean
  conflicts: string[]
}>

/**
 * Apply patch to working directory
 * @param diff - Unified diff to apply
 * @throws Error if patch cannot be applied
 */
export async function apply(diff: string): Promise<void>

/**
 * Revert a previously applied patch
 * @param diff - Unified diff to revert
 */
export async function revert(diff: string): Promise<void>

/**
 * Revert the last applied patch from journal
 * @returns True if patch was reverted
 */
export async function revertLast(): Promise<boolean>
```

#### `src/tools/permissions.ts`

```typescript
/**
 * Permission system for tool access control
 */

interface Permissions {
  defaults?: Record<string, 'allow' | 'deny' | 'confirm'>
  rules?: Rule[]
}

interface Rule {
  match: {
    tool?: string
    path?: string
    command?: string
  }
  action: 'allow' | 'deny' | 'confirm'
}

/**
 * Check if operation is permitted
 * @param request - Operation details
 * @returns Permission decision
 */
export async function checkPermission(request: {
  tool: string
  path?: string
  command?: string
}): Promise<'allow' | 'deny' | 'confirm'>

/**
 * Load permissions from project config
 * @returns Current permissions configuration
 */
export async function loadPermissions(): Promise<Permissions>

/**
 * Save permissions to project config
 * @param permissions - New permissions configuration
 */
export async function savePermissions(permissions: Permissions): Promise<void>

/**
 * Set default action for a tool
 * @param tool - Tool name
 * @param action - Default action
 */
export async function setDefault(
  tool: string,
  action: 'allow' | 'deny' | 'confirm'
): Promise<void>

/**
 * Add a permission rule
 * @param rule - New rule to add
 */
export async function addPermissionRule(rule: Rule): Promise<void>

/**
 * Remove a permission rule by index
 * @param index - Rule index to remove
 */
export async function removePermissionRule(index: number): Promise<void>
```

#### `src/tools/bashes.ts`

```typescript
/**
 * Persistent shell session management
 */

interface BashSession {
  id: string
  pid: number
  process: ChildProcess
  created: Date
  cwd: string
}

/**
 * Handle bash command from TUI
 * @param command - Full command string
 * @returns Output lines to display
 */
export async function handleBashCommand(command: string): Promise<string[]>

/**
 * List all active sessions
 * @returns Session list output
 */
export function listSessions(): string[]

/**
 * Create new bash session
 * @returns Creation status message
 */
export async function createSession(): Promise<string[]>

/**
 * Kill specific session by ID
 * @param id - Session ID (can be partial)
 * @returns Kill status message
 */
export function killSession(id: string): string[]

/**
 * Clean up all sessions on exit
 */
export function killAllSessions(): void
```

#### `src/tools/hooks.ts`

```typescript
/**
 * Hook system for command lifecycle events
 */

interface Hook {
  name: string
  type: 'pre-prompt' | 'post-response' | 'pre-apply' | 'post-apply'
  command: string
  timeout?: number
}

/**
 * Run hooks for specific event type
 * @param type - Hook type to execute
 * @param phase - Optional phase qualifier
 */
export async function runHooks(type: string, phase?: string): Promise<void>

/**
 * Manage hooks via slash command
 * @param command - Full hook command
 * @returns Output lines to display
 */
export async function manageHooks(command: string): Promise<string[]>

/**
 * Load hooks from config file
 * @returns Array of configured hooks
 */
export async function loadHooks(): Promise<Hook[]>

/**
 * Save hooks to config file
 * @param hooks - Hooks to save
 */
export async function saveHooks(hooks: Hook[]): Promise<void>
```

### Integration APIs

#### `src/integrations/mcp.ts`

```typescript
/**
 * MCP (Model Context Protocol) server integration
 */

interface McpServer {
  id: string
  url: string
}

interface McpTool {
  id: string
  name: string
  description?: string
  input_schema?: any
}

/**
 * List all attached MCP servers
 * @returns Array of servers
 */
export async function listServers(): Promise<McpServer[]>

/**
 * Attach new MCP server
 * @param id - Server identifier
 * @param url - Server URL
 */
export async function attachServer(id: string, url: string): Promise<void>

/**
 * Detach MCP server
 * @param id - Server identifier
 */
export async function detachServer(id: string): Promise<void>

/**
 * Check health of MCP servers
 * @param id - Optional specific server ID
 * @returns Health status for each server
 */
export async function health(id?: string): Promise<{
  id: string
  ok: boolean
  status?: number
}[]>

/**
 * List available tools from servers
 * @param serverId - Optional specific server ID
 * @returns Tools grouped by server
 */
export async function listTools(serverId?: string): Promise<{
  server: string
  tools: McpTool[]
}[]>

/**
 * Call tool on MCP server
 * @param serverId - Server identifier
 * @param toolName - Tool name
 * @param input - Tool input parameters
 * @returns Tool output
 */
export async function callTool(
  serverId: string,
  toolName: string,
  input: any
): Promise<any>
```

#### `src/integrations/proxy.ts`

```typescript
/**
 * OpenAI-compatible HTTP proxy server
 */

/**
 * Start proxy server
 * @param port - Port number (default: 11434)
 * @returns Actual port number used
 */
export async function startProxy(port?: number): Promise<number>

/**
 * Stop proxy server
 */
export async function stopProxy(): Promise<void>

/**
 * Check if proxy is running
 * @returns Running status and port
 */
export function getProxyStatus(): {
  running: boolean
  port?: number
}
```

### Context Management APIs

#### `src/context/context.ts`

```typescript
/**
 * File context and project management
 */

/**
 * Get configured root directories
 * @returns Array of root paths
 */
export async function getRoots(): Promise<string[]>

/**
 * Add new root directory
 * @param path - Directory path to add
 */
export async function addRoot(path: string): Promise<void>

/**
 * List candidate files matching patterns
 * @param globs - Glob patterns to match
 * @returns Matched file paths
 */
export async function listCandidates(globs: string[]): Promise<string[]>

/**
 * Get selected context files
 * @returns Array of selected file paths
 */
export async function getSelected(): Promise<string[]>

/**
 * Add files to selected context
 * @param paths - File paths to add
 * @returns Updated selected list
 */
export async function addToSelected(paths: string[]): Promise<string[]>

/**
 * Remove files from selected context
 * @param paths - File paths to remove
 * @returns Updated selected list
 */
export async function removeFromSelected(paths: string[]): Promise<string[]>

/**
 * Estimate tokens for files
 * @param paths - File paths to estimate
 * @returns Token and byte estimates
 */
export async function tokenEstimateForFiles(paths: string[]): Promise<{
  bytes: number
  tokens: number
}>
```

#### `src/context/indexer.ts`

```typescript
/**
 * File indexing for context awareness
 */

interface IndexEntry {
  path: string
  size: number
  modified: number
  hash?: string
}

/**
 * Build index of project files
 * @param options - Indexing options
 * @returns Index entries
 */
export async function buildIndex(options: {
  roots: string[]
  ignore?: string[]
}): Promise<IndexEntry[]>

/**
 * Search index for files
 * @param query - Search query
 * @returns Matching entries
 */
export async function searchIndex(query: string): Promise<IndexEntry[]>
```

### Configuration API

#### `src/config.ts`

```typescript
/**
 * Configuration management for global and project settings
 */

interface Config {
  provider?: {
    active: string
    copilot?: {
      client_id?: string
    }
  }
  model?: {
    active: string
    catalogs?: Record<string, any[]>
  }
  outputStyle?: string
  vimMode?: boolean
  telemetry?: boolean
  statusline?: {
    format: string
  }
  editing?: {
    autoApply: 'on' | 'off'
  }
  toolCallPreset?: {
    enabled: boolean
    strictOnly?: boolean
    allowHeuristics?: boolean
    messageOverride?: string
    overrides?: Record<string, string>
  }
}

/**
 * Load configuration merging global and project
 * @returns Merged configuration object
 */
export async function loadConfig(): Promise<Config>

/**
 * Save configuration
 * @param config - Configuration to save
 */
export async function saveConfig(config: Config): Promise<void>

/**
 * Set specific configuration value
 * @param key - Configuration key
 * @param value - Value to set (with type coercion)
 */
export async function setConfigValue(key: string, value: any): Promise<void>

/**
 * Get configuration paths
 * @returns Object with config file paths
 */
export function paths(): {
  GLOBAL_DIR: string
  GLOBAL_CFG: string
  PROJECT_DIR: string
  PROJECT_CFG: string
}
```

### Security API

#### `src/policies/security.ts`

```typescript
/**
 * Security review and patch validation
 */

interface SecurityIssue {
  severity: 'low' | 'medium' | 'high'
  message: string
  line?: number
}

/**
 * Review patch for security issues
 * @param patch - Unified diff to review
 * @returns Array of security issues found
 */
export function reviewPatch(patch: string): SecurityIssue[]

/**
 * Run comprehensive security review
 * @returns Security issues in workspace
 */
export async function runSecurityReview(): Promise<SecurityIssue[]>
```

### Operations API

#### `src/ops/doctor.ts`

```typescript
/**
 * System diagnostics and health checks
 */

/**
 * Run diagnostic checks
 * @returns Array of diagnostic messages
 */
export async function runDoctor(): Promise<string[]>
```

#### `src/ops/init.ts`

```typescript
/**
 * Project initialization and documentation generation
 */

/**
 * Generate PLATO.md documentation
 * Analyzes codebase and creates comprehensive docs
 */
export async function generateProjectDoc(): Promise<void>
```

### TODO Management API

#### `src/todos/todos.ts`

```typescript
/**
 * TODO item tracking and management
 */

interface Todo {
  id: string
  text: string
  done: boolean
  file?: string
  line?: number
}

/**
 * Load saved TODOs
 * @returns Array of TODO items
 */
export async function loadTodos(): Promise<Todo[]>

/**
 * Scan directories for TODO comments
 * @param roots - Root directories to scan
 * @returns Found TODO items
 */
export async function scanTodos(roots: string[]): Promise<Todo[]>

/**
 * Mark TODO as done
 * @param id - TODO identifier
 */
export async function markDone(id: string): Promise<void>

/**
 * Save TODOs to storage
 * @param todos - TODOs to save
 */
export async function saveTodos(todos: Todo[]): Promise<void>
```

## Type Definitions

### Common Types

```typescript
// Message types for conversation
type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

// Slash command definition
type SlashCommand = {
  name: string
  summary: string
}

// Unified diff type
type UnifiedDiff = string

// Permission action types
type PermissionAction = 'allow' | 'deny' | 'confirm'

// Output styles
type OutputStyle = 'markdown' | 'minimal' | 'verbose'

// Hook types
type HookType = 'pre-prompt' | 'post-response' | 'pre-apply' | 'post-apply'
```

## Error Handling

### Error Classes

```typescript
// Permission denied error
class PermissionDeniedError extends Error {
  constructor(tool: string, reason?: string)
}

// Patch application error
class PatchError extends Error {
  constructor(message: string, conflicts?: string[])
}

// Authentication error
class AuthError extends Error {
  constructor(message: string, requiresLogin?: boolean)
}

// MCP server error
class McpError extends Error {
  constructor(server: string, message: string, status?: number)
}
```

### Error Handling Patterns

```typescript
// Network errors with retry
try {
  const response = await fetch(url, options)
  // Handle response
} catch (error) {
  if (isRetryable(error)) {
    // Exponential backoff retry
  } else {
    // Report to user
    setLines(prev => prev.concat(`❌ Error: ${error.message}`))
  }
}

// File operation errors
try {
  await fs.writeFile(path, content)
} catch (error) {
  setLines(prev => prev.concat(`❌ Failed to write file: ${error.message}`))
}

// Silent failures for optional features
try {
  // Optional dependency usage
} catch {
  // Silent - feature not available
}
```

## Events and Hooks

### System Events

```typescript
// Process lifecycle
process.on('SIGINT', async () => {
  await saveSessionDefault()
  killAllSessions()
  process.exit(0)
})

// Hook execution points
await runHooks('pre-prompt')     // Before processing user input
await runHooks('post-response')  // After AI response
await runHooks('pre-apply')      // Before applying patch
await runHooks('post-apply')     // After applying patch
```

### Custom Events

```typescript
// Orchestrator events
orchestrator.on('tool-start', (tool) => {
  console.log(`🔧 Running tool: ${tool.name}...`)
})

orchestrator.on('tool-end', (result) => {
  console.log('Tool completed')
})
```

## Constants

```typescript
// File paths
const CONFIG_DIR = '~/.config/plato'
const PROJECT_DIR = '.plato'
const SESSION_FILE = '.plato/session.json'
const CREDENTIALS_FILE = '~/.config/plato/credentials.json'

// Limits
const MAX_SESSION_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_HISTORY_LENGTH = 100
const HOOK_TIMEOUT = 5000  // 5 seconds
const TOOL_CALL_TIMEOUT = 30000  // 30 seconds

// Retry configuration
const RETRY_DELAYS = [1000, 2000, 4000]  // Exponential backoff
const RETRYABLE_STATUS_CODES = [502, 503, 504, 429]
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404]

// Default values
const DEFAULT_MODEL = 'gpt-4'
const DEFAULT_PROVIDER = 'copilot'
const DEFAULT_OUTPUT_STYLE = 'markdown'
const DEFAULT_STATUSLINE = 'plato | {provider} | {model} | {tokens} {branch}'
```