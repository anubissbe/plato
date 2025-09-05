**Executive Summary**
- Claude Code is a bundled Node CLI that renders a React-based terminal UI and orchestrates an agent with tools via MCP (Model Context Protocol). The shipped package includes a binary-like `cli.js`, an SDK (`sdk.mjs` + `sdk.d.ts`) exposing a high-level `query()` API, and vendor assets (VSIX, JetBrains jars, ripgrep, `yoga.wasm`).
- The SDK spawns the CLI with carefully composed flags, using stream-json I/O for precise, machine-readable message passing. MCP servers are configurable via stdio, SSE, HTTP, or in-process SDK instances.
- The agent enforces permission modes, gated tool execution, and workspace trust. Sessions can resume/continue, and the CLI supports `--print` for non-interactive output.

**Package Layout (installed)**
- `/usr/lib/node_modules/@anthropic-ai/claude-code`
  - `cli.js`: bundled/minified runtime with React and terminal renderer (uses `yoga.wasm`).
  - `sdk.mjs`, `sdk.d.ts`: SDK transport and type definitions.
  - `vendor/`: `claude-code.vsix`, JetBrains plugin jars, ripgrep binaries per platform, `yoga.wasm`.
  - `package.json`: `bin: { "claude": "cli.js" }`, ESM, Node ≥ 18.

**CLI Behavior and Flags**
- Defaults to interactive session (React TUI). Use `--print` for non-interactive.
- Selected flags (from `--help` and SDK wiring):
  - `--model <model>`: Select provider model/alias.
  - `--fallback-model <model>`: Automatic fallback (must differ from `--model`).
  - `--print`: Print response and exit; workspace trust prompt skipped.
  - `--output-format <text|json|stream-json>`: Output format; stream-json recommended for automation.
  - `--input-format <text|stream-json>`: Requires `--output-format=stream-json` when set to `stream-json`.
  - `--append-system-prompt <string>`, `--settings <file-or-json>`.
  - `--permission-mode <default|acceptEdits|bypassPermissions|plan>`.
  - `--allowedTools`/`--disallowedTools` (aliases also support hyphenated forms).
  - `--mcp-config <json-or-file>`, `--strict-mcp-config`.
  - `--continue`, `--resume [sessionId]`, `--session-id <uuid>`.
  - `--ide` (auto-connect if exactly one valid IDE).
  - `--replay-user-messages` (stream-json mode only).
  - `--dangerously-skip-permissions` (blocked as root outside sandbox).
  - Diagnostics: `--debug [filter]`, `--verbose`, `doctor`, `update`, `install`, `setup-token`.

**SDK: High‑Level Flow**
- API:
  - `query({ prompt, options }) => AsyncGenerator<SDKMessage>`
  - `tool(...)` (define zod-typed tool for SDK MCP)
  - `createSdkMcpServer({ name, version?, tools? }) => { type: 'sdk', name, instance }`
- Transport:
  - The SDK builds a `ProcessTransport` which spawns `cli.js` (or a native binary) with flags that force `--output-format stream-json` and `--verbose`.
  - For a string `prompt`: adds `--print -- <trimmed prompt>`.
  - For streaming input: adds `--input-format stream-json` and expects the caller to `streamInput(...)` on the returned `Query`.
  - `CLAUDE_CODE_ENTRYPOINT` defaults to `sdk-ts` when spawned via SDK.
  - If `pathToClaudeCodeExecutable` is not provided, it resolves to the local `cli.js` path relative to `sdk.mjs`.
- Spawn logic (from `ProcessTransport` in `sdk.mjs`):
  - Composes args from options (see below), picks `node`/`bun` unless given a native path, then spawns.
  - Streams JSON messages (one per line/event) over stdout; supports stderr callback and debug-to-stderr when `DEBUG` is set.
- Options -> CLI Flags Mapping:
  - `customSystemPrompt` -> `--system-prompt <str>`
  - `appendSystemPrompt` -> `--append-system-prompt <str>`
  - `maxTurns` -> `--max-turns <n>`
  - `model` -> `--model <id>`
  - `fallbackModel` -> `--fallback-model <id>` (validated ≠ `model`)
  - `permissionMode` -> `--permission-mode <mode>`
  - `permissionPromptToolName` -> `--permission-prompt-tool <name>`
  - `continue` -> `--continue`
  - `resume` -> `--resume <id>`
  - `allowedTools` -> `--allowedTools a,b,c`
  - `disallowedTools` -> `--disallowedTools a,b`
  - `mcpServers` -> `--mcp-config '{"mcpServers":{...}}'`
  - `strictMcpConfig` -> `--strict-mcp-config`
  - `additionalDirectories[]` -> `--add-dir <path>` for each
  - `extraArgs` -> injects arbitrary `--flag [value|null]`
  - `canUseTool` requires streaming input; with it, SDK forces `--permission-prompt-tool stdio` and forbids also setting `permissionPromptToolName` (throws otherwise).

**SDK Types (selected)**
- Messages (`SDKMessage` union):
  - `SDKSystemMessage` (subtype: `init`): `{ apiKeySource, cwd, tools: string[], mcp_servers: {name,status}[], model, permissionMode, slash_commands, output_style }`
  - `SDKUserMessage`: `{ type: 'user', message: APIUserMessage, parent_tool_use_id }`
  - `SDKAssistantMessage`: `{ type: 'assistant', message: APIAssistantMessage, parent_tool_use_id }`
  - `SDKResultMessage` (success/error variants): duration metrics, cost, usage, permission denials.
- Hooks (`HOOK_EVENTS`): `PreToolUse | PostToolUse | Notification | UserPromptSubmit | SessionStart | SessionEnd | Stop | SubagentStop | PreCompact`.
  - `HookCallbackMatcher`: `{ matcher?: string, hooks: HookCallback[] }`
  - `HookInput` base: `{ session_id, transcript_path, cwd, permission_mode? }` plus per-event fields.
  - `HookJSONOutput`:
    - Global: `continue?`, `suppressOutput?`, `stopReason?`, `decision? ('approve'|'block')`, `systemMessage?`, `permissionDecision? ('allow'|'deny'|'ask')`, `reason?`.
    - Hook-specific payloads for `PreToolUse`, `UserPromptSubmit`, `SessionStart`, `PostToolUse`.
- Permissions:
  - Modes: `default | acceptEdits | bypassPermissions | plan`.
  - `CanUseTool(toolName, input, { signal, suggestions? }) => PermissionResult`:
    - `allow` with `updatedInput` and optional `updatedPermissions` (array of PermissionUpdate operations for rules/dirs/mode per destination: `userSettings|projectSettings|localSettings|session`).
    - `deny` with `message`, optional `interrupt`.
    - `passthrough`.
- MCP server configs:
  - `stdio`: `{ type?: 'stdio', command: string, args?: string[], env?: Record<string,string> }`
  - `sse`: `{ type: 'sse', url: string, headers?: Record<string,string> }`
  - `http`: `{ type: 'http', url: string, headers?: Record<string,string> }`
  - `sdk`: `{ type: 'sdk', name: string }` (SDK augments with `instance: McpServer` for in-process servers)

**MCP and Tools**
- The CLI manages external MCP servers declared via `--mcp-config` (user/global/project/local scopes) and respects `--strict-mcp-config` to ignore any other auto-discovered configs.
- The SDK’s `createSdkMcpServer()` constructs an in-process MCP server (via `@modelcontextprotocol/sdk/server/mcp`), enables tools capability, and registers tools declared with `tool()` (zod schemas + async handlers returning `CallToolResult`).
- At spawn, SDK splits SDK-internal MCP servers from external ones: it passes a minimized `{ type: 'sdk', name }` to the CLI while keeping the actual instance locally. The `Query` object then bridges SDK tool calls over the process boundary.

**Process Transport Details**
- Always sets `--output-format stream-json` and `--verbose` for the child.
- For string prompt: appends `--print -- <prompt>` (skips workspace trust prompts by design).
- For streaming prompt: appends `--input-format stream-json` and wires `Query.streamInput(...)` to write stdin events.
- Sets `CLAUDE_CODE_ENTRYPOINT=sdk-ts` unless already present.
- Supports spawning a native binary path (no `node` wrapper) or default `node`/`bun` executable.

**Interactive TUI (from `cli.js` characteristics)**
- React renderer with Yoga layout (`yoga.wasm`); handles keyboard/mouse input and draws panels/components.
- Onboarding and policy-update flows gate first runs or version changes.
- Workspace trust/permission modals; bypass mode enforced with safety checks (root/sudo blocked unless sandboxed).
- IDE attach (`--ide`) and vendor IDE packages in `vendor/` (VSCode `.vsix`, JetBrains jars) for tight editor integration.
- Ripgrep binaries for fast workspace indexing/search.
- Telemetry events (examples): `tengu_flicker`, `tengu_startup_telemetry`, `tengu_init`, `tengu_continue`, `tengu_remote_create_session`, `tengu_exit`.

**Session and Model Handling**
- Model selection precedence: CLI flag `--model` > `ANTHROPIC_MODEL` > settings file.
- Fallback model must differ from the primary; flagged at SDK level and CLI enforces provider constraints.
- Session controls: `--continue` for last session; `--resume [id]` for a specific saved session. `--session-id` sets a UUID if needed.
- Session end reports include cost, token usage, duration, and permission denials (see `SDKResultMessage`).

**Stream‑JSON Protocol (Observed Contracts)**
- Output events (one per line), JSON objects conforming to `SDKMessage` union:
  - System init example:
    {
      "type": "system",
      "subtype": "init",
      "session_id": "...",
      "uuid": "...",
      "apiKeySource": "user",
      "cwd": "/path",
      "tools": ["Bash(git:*)", "Edit"],
      "mcp_servers": [{"name":"serverA","status":"connected"}],
      "model": "claude-sonnet-4-20250514",
      "permissionMode": "default",
      "slash_commands": ["/config", "/bug"],
      "output_style": "..."
    }
  - Assistant message example:
    {
      "type": "assistant",
      "session_id": "...",
      "uuid": "...",
      "parent_tool_use_id": null,
      "message": {
        "role": "assistant",
        "content": [ { "type": "text", "text": "Hello" } ],
        "model": "...",
        "id": "...",
        "stop_reason": "end_turn"
      }
    }
  - Result (success) example:
    {
      "type": "result",
      "session_id": "...",
      "uuid": "...",
      "subtype": "success",
      "is_error": false,
      "num_turns": 3,
      "duration_ms": 21500,
      "duration_api_ms": 8200,
      "result": "...final text...",
      "total_cost_usd": 0.0123,
      "usage": { "input_tokens": 1234, "output_tokens": 567 },
      "permission_denials": []
    }
- Streaming input (when `--input-format stream-json`): caller sends `SDKUserMessage` objects on stdin (with required fields: `type:'user'`, `session_id`, `parent_tool_use_id|null`, and `message` shaped like Anthropic user message param).

**Permissions & Hooks in Practice**
- Permission modes gate when the UI prompts or auto-accepts changes and tool runs.
- `--permission-prompt-tool` selects the prompt implementation (e.g., `stdio`); when SDK’s `canUseTool` is provided, it enforces `stdio` and disallows any other prompt tool to avoid ambiguity.
- Hooks can be registered (SDK-only) by event; each receives a typed payload and returns `HookJSONOutput` which can alter flow, suppress output, provide system messages, or annotate permission decisions.

**IDE & External Integration**
- VS Code: `vendor/claude-code.vsix` ships the extension for direct integration.
- JetBrains: multiple jars under `vendor/claude-code-jetbrains-plugin/lib/`.
- CLI `--ide` mode tries to auto-connect when exactly one valid IDE is available.

**Updater & Diagnostics**
- `claude update`, `claude install [stable|latest|<ver>]`: manages native builds and updates.
- `claude doctor`: validates auto-updater health and environment.
- Settings migration flows and iTerm/Terminal state restoration paths are present for macOS terminals (string indicators in `cli.js`).

**Privacy**
- As per README: feedback (accept/reject, bug reports) may be collected for product improvements; transcripts stored 30 days; no training of generative models on feedback.

**Environment and Settings**
- Key env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DEBUG`, CI detection. Changelog references `MCP_TIMEOUT` and `MCP_TOOL_TIMEOUT`.
- Settings precedence: CLI flags > env > settings file.
- `--settings` accepts JSON string or file path; JSON is validated inside CLI.

**Limitations of This Analysis**
- `cli.js` is minified; while we can verify flags, flows, and embedded frameworks (React + Yoga), we cannot map one-to-one source files or internal component hierarchies.
- The SDK (`sdk.d.ts`/`sdk.mjs`) provides authoritative external contracts; all behavioral specifics included above are derived from these and from observable CLI behavior.

**Reference: MCP Config JSON Example**
{
  "mcpServers": {
    "docs": { "type": "sse", "url": "http://localhost:2024/sse", "headers": {"Authorization": "Bearer ..."} },
    "local": { "type": "stdio", "command": "my-mcp", "args": ["--flag"], "env": {"X": "Y"} },
    "sdk-tools": { "type": "sdk", "name": "sdk-tools" }
  }
}

**Reference: Hook Output Example (PreToolUse)**
{
  "continue": true,
  "systemMessage": "Be careful with deletes.",
  "permissionDecision": "ask",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "High-risk command"
  }
}

**Settings Schema Overview**
- Source: `--settings <file-or-json>` merges with env and CLI; CLI flags take precedence.
- Common fields (aligned with SDK Options and CLI flags):
  - `model: string` — default model alias/id.
  - `fallbackModel?: string` — fallback model (must differ from `model`).
  - `customSystemPrompt?: string` — replaces base system prompt.
  - `appendSystemPrompt?: string` — appended to system prompt.
  - `permissionMode?: 'default'|'acceptEdits'|'bypassPermissions'|'plan'` — default permission mode.
  - `allowedTools?: string[]` — whitelist of tool names.
  - `disallowedTools?: string[]` — blacklist of tool names.
  - `additionalDirectories?: string[]` — extra directories for tool access.
  - `maxTurns?: number` — cap on interaction turns.
  - `maxThinkingTokens?: number` — LLM thinking/chain-of-thought token cap (if supported).
  - `mcpServers?: Record<string, McpServerConfig>` — see MCP examples below.
  - `strictMcpConfig?: boolean` — only use servers provided by `mcpServers`.
  - `verbose?: boolean` — enable verbose logging.
- Example settings JSON:
  {
    "model": "sonnet",
    "fallbackModel": "haiku",
    "permissionMode": "default",
    "appendSystemPrompt": "Prefer small, safe diffs.",
    "allowedTools": ["Edit", "Bash(git:*)"],
    "disallowedTools": ["NetworkRequest"],
    "additionalDirectories": ["docs", "scripts"],
    "maxTurns": 12,
    "mcpServers": {
      "notes": { "type": "sse", "url": "http://localhost:2121/sse" }
    },
    "strictMcpConfig": true
  }

**CLI Flag Catalog + Validation Notes**
- Core session flags:
  - `--model <id>`: Sets model; overrides env/settings.
  - `--fallback-model <id>`: Must differ from `--model` (validated both in SDK and CLI).
  - `-p, --print`: Non-interactive; skips workspace trust dialog.
  - `--output-format <text|json|stream-json>`: Output mode; `stream-json` is machine-friendly.
  - `--input-format <text|stream-json>`: If `stream-json`, then `--output-format` must be `stream-json`.
  - `--settings <file-or-json>`: Merges configuration; invalid JSON causes exit with error.
  - `--append-system-prompt <str>`: Appends to the system prompt.
  - `--permission-mode <default|acceptEdits|bypassPermissions|plan>`.
  - `--continue`: Continue most recent conversation.
  - `--resume [sessionId]`: Resume a specific session or interactively choose one.
  - `--session-id <uuid>`: Force a session UUID (must be valid v4).
- Tools and permissions:
  - `--allowedTools/--allowed-tools <list>`: Comma/space-separated list. Filters tool availability.
  - `--disallowedTools/--disallowed-tools <list>`: Comma/space separated. Denylisted tools always blocked.
  - `--add-dir <path>`: Extra directories allowed for tools (repeatable).
  - `--permission-prompt-tool <name>`: Selects prompt implementation. When SDK `canUseTool` is used, this must be `stdio` and cannot be overridden (SDK enforces and errors otherwise).
  - `--dangerously-skip-permissions`: Bypass permission checks; on non-Windows, blocked when running as `root` outside sandbox.
- MCP integration:
  - `--mcp-config <configs...>`: Load MCP servers from JSON files or JSON strings. SDK also passes a single JSON blob: `{"mcpServers":{...}}`.
  - `--strict-mcp-config`: Ignore other MCP sources; only use what was provided via `--mcp-config`.
- IDE and environment:
  - `--ide`: Auto-connect to IDE when exactly one valid IDE is present.
  - `--verbose`: More logs; SDK sets this by default for `stream-json` transport.
  - `--debug [filter]`: Enables debug logs; supports category filters (e.g., `api,hooks` or negations like `!statsig`).
- Streaming and SDK specifics:
  - `--replay-user-messages`: Only valid when `--input-format=stream-json` and `--output-format=stream-json`.
  - Internal/advanced: `--sdk-url` exists and requires both input/output `stream-json` when used (observed validation in CLI).
- Platform/runtime constraints:
  - Node.js ≥ 18 required; CLI checks and exits otherwise.
  - CI detection limits interactive features.

**ASCII Architecture Diagram**
Caller/Script
  |
  v
SDK `query()`  --(Options)-->  ProcessTransport  --(spawn+flags)-->  `cli.js` (Claude CLI)
  |                                                         |
  |<-- stream-json (stdout) ------------------------------- |
  |                                                         v
  |                                                 React TUI (Yoga)
  |                                                         |
  |                                                 Agent Orchestrator
  |                                                         |
  |                                     +-------------------+------------------+
  |                                     |                                      |
  |                                 MCP Clients                           Local Tools
  |                         (stdio / sse / http / sdk)            (Edit, Bash, Git, Search)
  |                                     |                                      |
  |                           External MCP Servers                  FS / Git / Processes
  |                                     |                                      |
  +------------------------------ stream results -------------------------------+
                                        |
                                        v
                                   SDK `Query` -> Caller

**Slash Commands**
- Observed/Documented:
  - `/bug`: Opens bug reporting flow (also mentioned in README).
  - `/config`: Opens settings UI; toggles features like themes, compaction, vim mode.
  - `/vim`: Toggles vim-style input bindings (from changelog; also accessible via `/config`).
- Enumerating at runtime:
  - On session start, the first `system:init` message includes `slash_commands: string[]` listing all available commands for the build. Capture that field from stream-json to present a canonical list.

**Built‑in Tools (Representative)**
- Edit: Applies file edits/patches; surfaces diffs and asks permission based on `permissionMode`.
- Bash(git:*): Executes shell commands, often scoped to git workflows; high-sensitivity, gated by permission prompts and tool allowlists.
- Search (ripgrep): Uses bundled ripgrep to index/search the workspace for context and navigation.
- Git: High-level workflows (e.g., create branch, commit, revert) orchestrated via shell and git libs; typically behind permission prompts.
- Notes:
  - Exact tool set may vary by build and platform. The authoritative list appears in the `system:init` message `tools: string[]` field.
  - Tool calls can be intercepted via hooks (`PreToolUse`, `PostToolUse`) or `canUseTool` to enforce policies.

**Resume/Continue Examples**
- Continue last session:
  - `claude --continue`
  - Behavior: Loads most recent conversation (messages + checkpoints) and resumes in the TUI. Emits telemetry for continue events. Exits with message if none found.
- Resume by ID:
  - `claude --resume 3c7f2c9a-...`
  - Behavior: Restores the specified session; if run without an ID, the CLI presents an interactive picker.
- Settings interplay:
  - `--resume`/`--continue` respect `--permission-mode`, tool filters, and `--model` overrides for the resumed run.

**IDE Attach Flow**
- Auto-attach:
  - `claude --ide`
  - Behavior: If exactly one valid IDE is available (VS Code extension or JetBrains plugin installed and reachable), the CLI auto-connects on startup.
- Manual setup:
  - VS Code: Install `vendor/claude-code.vsix` (packaged) and allow it to connect to the local session.
  - JetBrains: Ensure the bundled plugin jars are installed/updated; the IDE presents a connector UI to the running CLI session.
- Notes:
  - When multiple IDEs are detected, the CLI avoids auto-connecting; connect from the IDE side.
  - IDE attach provides editor actions (open file, apply edits, navigate), streamed via the same orchestration layer.


**Complete SDK Type Reference**
- NonNullableUsage: Makes all fields of Anthropic `Usage` non-null. Used on `SDKResultMessage.usage`.
- ApiKeySource: `'user' | 'project' | 'org' | 'temporary'`.
- ConfigScope: `'local' | 'user' | 'project'` (used internally for settings scopes).
- Mcp Server Configs:
  - `McpStdioServerConfig`: `{ type?: 'stdio'; command: string; args?: string[]; env?: Record<string,string>; }`
  - `McpSSEServerConfig`: `{ type: 'sse'; url: string; headers?: Record<string,string>; }`
  - `McpHttpServerConfig`: `{ type: 'http'; url: string; headers?: Record<string,string>; }`
  - `McpSdkServerConfig`: `{ type: 'sdk'; name: string; }`
  - `McpSdkServerConfigWithInstance`: `McpSdkServerConfig & { instance: McpServer }`
  - `McpServerConfig`: union of the above 4
  - `McpServerConfigForProcessTransport`: same union without the `instance` augmentation
- Permissions API:
  - PermissionBehavior: `'allow' | 'deny' | 'ask'`
  - PermissionUpdateDestination: `'userSettings' | 'projectSettings' | 'localSettings' | 'session'`
  - PermissionRuleValue: `{ toolName: string; ruleContent?: string }`
  - PermissionUpdate (union):
    - `{ type:'addRules' | 'replaceRules' | 'removeRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }`
    - `{ type:'setMode'; mode: PermissionMode; destination: PermissionUpdateDestination }`
    - `{ type:'addDirectories' | 'removeDirectories'; directories: string[]; destination: PermissionUpdateDestination }`
  - PermissionResult (union):
    - Allow: `{ behavior:'allow'; updatedInput: Record<string,unknown>; updatedPermissions?: PermissionUpdate[] }`
    - Deny: `{ behavior:'deny'; message:string; interrupt?:boolean }`
    - Passthrough: `{ behavior:'passthrough' }`
  - CanUseTool: `(toolName:string, input:Record<string,unknown>, { signal, suggestions? }) => Promise<PermissionResult>`
- Hooks:
  - `HOOK_EVENTS`: `['PreToolUse','PostToolUse','Notification','UserPromptSubmit','SessionStart','SessionEnd','Stop','SubagentStop','PreCompact']`
  - HookEvent: element of `HOOK_EVENTS`
  - HookCallback: `(input: HookInput, toolUseID:string|undefined, { signal }) => Promise<HookJSONOutput>`
  - HookCallbackMatcher: `{ matcher?: string; hooks: HookCallback[] }`
  - BaseHookInput: `{ session_id: string; transcript_path: string; cwd: string; permission_mode?: string }`
  - PreToolUseHookInput: `Base + { hook_event_name:'PreToolUse'; tool_name:string; tool_input:unknown }`
  - PostToolUseHookInput: `Base + { hook_event_name:'PostToolUse'; tool_name:string; tool_input:unknown; tool_response:unknown }`
  - NotificationHookInput: `Base + { hook_event_name:'Notification'; message:string; title?:string }`
  - UserPromptSubmitHookInput: `Base + { hook_event_name:'UserPromptSubmit'; prompt:string }`
  - SessionStartHookInput: `Base + { hook_event_name:'SessionStart'; source:'startup'|'resume'|'clear'|'compact' }`
  - StopHookInput: `Base + { hook_event_name:'Stop'; stop_hook_active:boolean }`
  - SubagentStopHookInput: `Base + { hook_event_name:'SubagentStop'; stop_hook_active:boolean }`
  - PreCompactHookInput: `Base + { hook_event_name:'PreCompact'; trigger:'manual'|'auto'; custom_instructions:string|null }`
  - SessionEndHookInput: `Base + { hook_event_name:'SessionEnd'; reason: ExitReason }`
  - HookInput: union of all above event inputs
  - HookJSONOutput (union envelope):
    - Global optional fields: `continue?`, `suppressOutput?`, `stopReason?`, `decision?:'approve'|'block'`, `systemMessage?`, `permissionDecision?:'allow'|'deny'|'ask'`, `reason?`
    - `hookSpecificOutput` variants for event-specific data:
      - PreToolUse: `{ hookEventName:'PreToolUse'; permissionDecision?: 'allow'|'deny'|'ask'; permissionDecisionReason?: string }`
      - UserPromptSubmit: `{ hookEventName:'UserPromptSubmit'; additionalContext?: string }`
      - SessionStart: `{ hookEventName:'SessionStart'; additionalContext?: string }`
      - PostToolUse: `{ hookEventName:'PostToolUse'; additionalContext?: string }`
- Options (for `query`):
  - Process/exec: `abortController?`, `cwd?`, `env?`, `executable?:'bun'|'deno'|'node'`, `executableArgs?:string[]`, `extraArgs?:Record<string,string|null>`, `pathToClaudeCodeExecutable?`, `stderr?:(data:string)=>void`
  - Model/session: `model?`, `fallbackModel?`, `maxThinkingTokens?`, `maxTurns?`, `continue?:boolean`, `resume?:string`, `permissionMode?:PermissionMode`, `permissionPromptToolName?:string`
  - Prompts: `customSystemPrompt?`, `appendSystemPrompt?`
  - Tools/MCP: `allowedTools?:string[]`, `disallowedTools?:string[]`, `additionalDirectories?:string[]`, `mcpServers?:Record<string, McpServerConfig>`, `strictMcpConfig?:boolean`, `canUseTool?: CanUseTool`
  - Misc: `hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>`
- PermissionMode: `'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'`
- Messages:
  - SDKMessageBase: `{ uuid: UUID; session_id: string }`
  - SDKUserMessageContent: `{ type:'user'; message: APIUserMessage; parent_tool_use_id: string | null }`
  - SDKUserMessage: `SDKUserMessageContent & { uuid?: UUID; session_id: string }`
  - SDKUserMessageReplay: `SDKMessageBase & SDKUserMessageContent`
  - SDKAssistantMessage: `SDKMessageBase & { type:'assistant'; message: APIAssistantMessage; parent_tool_use_id: string|null }`
  - SDKPermissionDenial: `{ tool_name: string; tool_use_id: string; tool_input: Record<string,unknown> }`
  - SDKResultMessage (success): `SDKMessageBase & { type:'result'; subtype:'success'; duration_ms:number; duration_api_ms:number; is_error:boolean; num_turns:number; result:string; total_cost_usd:number; usage:NonNullableUsage; permission_denials: SDKPermissionDenial[] }`
  - SDKResultMessage (error): `SDKMessageBase & { type:'result'; subtype:'error_max_turns'|'error_during_execution'; duration_ms:number; duration_api_ms:number; is_error:boolean; num_turns:number; total_cost_usd:number; usage:NonNullableUsage; permission_denials: SDKPermissionDenial[] }`
  - SDKSystemMessage (init): `SDKMessageBase & { type:'system'; subtype:'init'; apiKeySource: ApiKeySource; cwd:string; tools:string[]; mcp_servers:{name:string; status:string}[]; model:string; permissionMode: PermissionMode; slash_commands:string[]; output_style:string }`
  - SDKMessage: union of the above
- Query interface: `AsyncGenerator<SDKMessage, void>` with methods `interrupt(): Promise<void>`, `setPermissionMode(mode:PermissionMode): Promise<void>`
- SDK helpers:
  - `tool(name:string, description:string, inputSchema:ZodRawShape, handler:(args: z.infer<ZodObject<Schema>>, extra:unknown)=>Promise<CallToolResult>)`
  - `createSdkMcpServer({ name:string; version?:string; tools?: Array<SdkMcpToolDefinition<any>> }): McpSdkServerConfigWithInstance`

**Stream‑JSON: Additional Examples**
- User message (streaming input stdin payload):
  {
    "type": "user",
    "session_id": "3c7f...",
    "parent_tool_use_id": null,
    "message": {
      "role": "user",
      "content": [ { "type": "text", "text": "List files changed since last commit" } ]
    }
  }
- Assistant message initiating a tool (illustrative Anthropic message shape):
  {
    "type": "assistant",
    "session_id": "3c7f...",
    "uuid": "...",
    "parent_tool_use_id": null,
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "I will check git status." },
        { "type": "tool_use", "id": "tool_abc123", "name": "Bash(git:*)", "input": { "cmd": "git status --porcelain" } }
      ]
    }
  }
- Tool result streamed back (assistant or system mediated):
  {
    "type": "assistant",
    "session_id": "3c7f...",
    "uuid": "...",
    "parent_tool_use_id": "tool_abc123",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "tool_result", "tool_use_id": "tool_abc123", "content": [ { "type":"text", "text":"M src/app.ts" } ] }
      ]
    }
  }
- Permission prompt decision via hooks (SDK):
  Hook returns `HookJSONOutput` with `permissionDecision:"allow"` or `"ask"`, optionally adding `updatedPermissions` through a `PermissionUpdate` array.
- Result (error due to max turns):
  {
    "type": "result",
    "session_id": "3c7f...",
    "uuid": "...",
    "subtype": "error_max_turns",
    "is_error": true,
    "num_turns": 20,
    "duration_ms": 600000,
    "duration_api_ms": 240000,
    "total_cost_usd": 0.2345,
    "usage": { "input_tokens": 50000, "output_tokens": 20000 },
    "permission_denials": [ { "tool_name":"Edit", "tool_use_id":"t1", "tool_input":{} } ]
  }

**MCP: Example Payloads (Standard Protocol)**
- Tools list (server -> client):
  {
    "method": "tools/list",
    "tools": [ { "name":"Edit", "description":"Apply patches", "input_schema": {"type":"object","properties":{...}} } ]
  }
- Tool call (client -> server):
  {
    "method": "tools/call",
    "name": "Edit",
    "arguments": { "patch": "...unified diff..." }
  }
- Prompts list (server -> client):
  {
    "method": "prompts/list",
    "prompts": [ { "name":"explain", "title":"Explain Selection", "description":"Explain the highlighted code" } ]
  }
- Prompt get (client -> server):
  {
    "method": "prompts/get",
    "name": "explain",
    "arguments": { "selection": "function hello(){}" }
  }
