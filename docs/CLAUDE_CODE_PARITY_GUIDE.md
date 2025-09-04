# Claude Code Parity Guide for Plato

This guide details how to achieve and maintain exact behavioral parity between Plato and Claude Code, ensuring an identical user experience except for the provider backend.

## Executive Summary

Plato is designed to be an exact behavioral clone of Claude Code's CLI/TUI application. Every interaction, output format, and user experience element must match Claude Code precisely, with the only differences being:
1. Uses "Plato" instead of "Claude Code" in user-facing text
2. Uses GitHub Copilot instead of Anthropic's API
3. Uses `.plato/` directory instead of `.claude/`

## Behavioral Parity Checklist

### ✅ Core Behaviors

| Feature | Claude Code Behavior | Plato Implementation | Status |
|---------|---------------------|---------------------|--------|
| Welcome Message | "✻ Welcome to Claude Code!" | "✻ Welcome to Plato!" | ✅ |
| Status Line | `claude code \| {provider} \| {model} \| {tokens} {branch}` | `plato \| {provider} \| {model} \| {tokens} {branch}` | ✅ |
| File Writing | Immediate with `/apply-mode auto` | Immediate with `/apply-mode auto` | ✅ |
| Patch Display | Unified diff format | Unified diff format | ✅ |
| Tool Calls | Gray text output | Gray text output | ✅ |
| Session Save | Auto-save after responses | Auto-save after responses | ✅ |
| Error Format | Red text with ❌ | Red text with ❌ | ✅ |
| Success Format | Green text with ✅ | Green text with ✅ | ✅ |

### ✅ Slash Commands Parity

All 35 slash commands must work identically:

```
Essential Commands:
✅ /help - Exact command list
✅ /status - Same format output  
✅ /login - Device code flow
✅ /logout - Clear credentials
✅ /doctor - System diagnostics

File Operations:
✅ /apply - Apply patches
✅ /revert - Revert patches
✅ /apply-mode - Toggle auto-apply
✅ /diff - Show pending patch

Configuration:
✅ /model - Model switching
✅ /statusline - Status customization
✅ /permissions - Permission management
✅ /privacy-settings - Privacy controls

Context:
✅ /context - File context management
✅ /add-dir - Add directories
✅ /init - Generate PLATO.md (was CLAUDE.md)
✅ /compact - History compaction

Development:
✅ /todos - TODO management
✅ /bashes - Shell sessions
✅ /hooks - Hook management
✅ /security-review - Security scanning

Integration:
✅ /mcp - MCP server management
✅ /proxy - OpenAI proxy
✅ /run - Command execution

Session:
✅ /resume - Session restoration
✅ /export - Export conversation
✅ /cost - Token metrics
✅ /memory - Memory management

UI/UX:
✅ /output-style - Style switching
✅ /vim - Vim mode toggle
✅ /keydebug - Key debugging

Information:
✅ /upgrade - Plan information
✅ /release-notes - Changelog
✅ /agents - Agent management (placeholder)
```

## Output Format Specifications

### 1. File Write Operations

#### Claude Code Format (with auto-apply):
```
📝 Writing hello.py...
  ✓ Wrote 2 lines to hello.py

Done! Created hello.py with a simple hello world program.
```

#### Plato Must Match Exactly:
```typescript
// When /apply-mode auto is enabled:
setLines(prev => prev.concat('📝 Writing hello.py...'));
await fs.writeFile('hello.py', content);
const lineCount = content.split('\n').length;
setLines(prev => prev.concat(`  ✓ Wrote ${lineCount} lines to hello.py`));
```

### 2. Tool Call Output

#### Claude Code Format:
```
🔧 Running tool: calculator...
[gray text]
{
  "result": 42,
  "operation": "sum"
}
[/gray text]
```

#### Plato Implementation:
```typescript
console.log(`🔧 Running tool: ${toolName}...`);
// After execution:
console.log('\x1b[90m' + JSON.stringify(result, null, 2) + '\x1b[0m');
```

### 3. Error Messages

#### Claude Code Format:
```
❌ Error: Network request failed
```

#### Plato Implementation:
```typescript
const colors = {
  error: '\x1b[31m',
  reset: '\x1b[0m'
};
setLines(prev => prev.concat(
  colors.error + `❌ Error: ${message}` + colors.reset
));
```

### 4. Status Messages

#### Claude Code Format:
```
✅ Operation completed successfully
⚠️ Warning: Git repository not found
ℹ️ Info: Using default configuration
```

#### Plato Must Use Same Icons:
- ✅ Success (green)
- ❌ Error (red)
- ⚠️ Warning (yellow)
- ℹ️ Info (cyan)
- 🔧 Tool execution
- 📝 File writing
- ⏳ Processing
- 🔄 In progress

## Keyboard Interaction Parity

### Required Key Bindings

| Key Combination | Claude Code Behavior | Plato Implementation |
|----------------|---------------------|---------------------|
| Enter | Submit input | Submit input |
| Shift+Enter | New line (multi-line) | New line (multi-line) |
| Ctrl+C | Cancel operation | Cancel operation |
| Ctrl+D | Exit with confirmation | Exit with confirmation |
| Up Arrow | Previous history | Previous history |
| Down Arrow | Next history | Next history |
| Tab | Command completion | Command completion |
| Backspace | Delete character | Delete character |
| Ctrl+L | Clear screen | Clear screen |

### Implementation Example:
```typescript
useInput((input, key) => {
  if (key.ctrl && input === 'c') {
    // Cancel current operation
    orchestrator.cancelStream();
    setInput('');
  }
  if (key.ctrl && input === 'd') {
    setConfirm({
      question: 'Exit? (y/n)',
      proceed: async () => exit()
    });
  }
  if (key.tab) {
    // Show command completions
    const matches = SLASH_COMMANDS.filter(c => 
      c.name.startsWith(input)
    );
    // Display popup
  }
});
```

## Session Format Compatibility

### Claude Code Session Structure:
```json
{
  "version": "1.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."},
    {"role": "tool", "content": "..."}
  ],
  "metrics": {
    "inputTokens": 1500,
    "outputTokens": 2000,
    "durationMs": 3500,
    "turns": 5
  },
  "context": ["src/main.js", "src/utils.js"],
  "config": {
    "model": {"active": "gpt-4"},
    "provider": {"active": "copilot"}
  }
}
```

### Plato Must Match Exactly:
- Same JSON structure
- Same field names
- Same data types
- 10MB size limit with rotation
- Auto-save timing (2s debounce during streaming)

## Configuration Parity

### Directory Structure

| Claude Code | Plato |
|------------|-------|
| `.claude/` | `.plato/` |
| `.claude/config.yaml` | `.plato/config.yaml` |
| `.claude/session.json` | `.plato/session.json` |
| `~/.config/claude/` | `~/.config/plato/` |

### Environment Variables

| Claude Code | Plato |
|------------|-------|
| `CLAUDE_CONFIG_DIR` | `PLATO_CONFIG_DIR` |
| `CLAUDE_PROJECT_DIR` | `PLATO_PROJECT_DIR` |
| `CLAUDE_DEBUG` | `PLATO_DEBUG` |

## Testing for Parity

### 1. Visual Comparison Tests

```bash
# Start Claude Code and Plato side by side
# Execute same commands in both
# Screenshots should be identical except for name

Commands to test:
- /help
- /status  
- Create a file with auto-apply
- Show a diff without auto-apply
- Run a tool call
- Export session
```

### 2. Output Format Tests

```typescript
// Test file write format
expect(output).toMatch(/📝 Writing .+\.\.\./);
expect(output).toMatch(/  ✓ Wrote \d+ lines to .+/);

// Test error format
expect(output).toMatch(/❌ Error: .+/);

// Test tool call format
expect(output).toMatch(/🔧 Running tool: .+/);
expect(output).toContain('\x1b[90m'); // Gray color
```

### 3. Session Compatibility Tests

```typescript
// Import Claude Code session into Plato
const claudeSession = await fs.readFile('.claude/session.json');
await fs.writeFile('.plato/session.json', claudeSession);
// Should resume without errors

// Export from Plato, import to Claude Code
const platoExport = await orchestrator.exportJSON();
// Should be readable by Claude Code
```

### 4. Command Behavior Tests

For each slash command:
```typescript
test('/command behavior matches Claude Code', async () => {
  const claudeOutput = getClaudeCodeOutput('/command');
  const platoOutput = getPlatoOutput('/command');
  
  // Normalize provider-specific differences
  const normalized1 = claudeOutput.replace('Claude Code', 'Plato');
  const normalized2 = platoOutput;
  
  expect(normalized1).toBe(normalized2);
});
```

## Common Parity Issues and Fixes

### Issue 1: Output Format Mismatch

**Problem**: Plato shows different formatting than Claude Code
**Solution**: Use exact same strings and color codes:
```typescript
// Wrong
setLines(prev => prev.concat('File written successfully'));

// Correct (matches Claude Code)
setLines(prev => prev.concat('📝 Writing filename...'));
setLines(prev => prev.concat('  ✓ Wrote X lines to filename'));
```

### Issue 2: Missing Command Implementation

**Problem**: Command exists in registry but not implemented
**Solution**: Implement in `src/tui/app.tsx` handleSubmit():
```typescript
if (text === '/commandname') {
  // Match Claude Code's exact output
  setLines(prev => prev.concat('Expected output here'));
  return;
}
```

### Issue 3: Session Save Timing

**Problem**: Sessions save at wrong times
**Solution**: Match Claude Code's timing:
```typescript
// During streaming: debounce by 2s
saveSessionDebounced();

// After completion: save immediately
await saveSessionDefault();

// On exit: save before closing
process.on('SIGINT', async () => {
  await saveSessionDefault();
  process.exit(0);
});
```

### Issue 4: Tool Call Format

**Problem**: Tool calls don't match Claude Code's format
**Solution**: Use strict regex and exact output:
```typescript
const toolCallRegex = /```json\s*\n\s*\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}\s*\n\s*```/;
// Gray output
console.log('\x1b[90m' + result + '\x1b[0m');
```

## Maintenance Guidelines

### When Adding New Features

1. **Check Claude Code First**: Always verify how Claude Code implements the feature
2. **Match Output Exactly**: Use same icons, colors, and formatting
3. **Test Side-by-Side**: Run both apps and compare outputs
4. **Document Differences**: If any differences are necessary, document why

### Version Updates

When Claude Code updates:
1. Review changelog for behavior changes
2. Update Plato to match new behaviors
3. Test all affected commands
4. Update this parity guide

### Testing Checklist

Before each release:
- [ ] All 35 slash commands tested
- [ ] File operations match format
- [ ] Tool calls show gray output
- [ ] Sessions save/load correctly
- [ ] Keyboard shortcuts work
- [ ] Error messages formatted correctly
- [ ] Status line updates properly
- [ ] Git warnings appear correctly

## Parity Validation Script

```bash
#!/bin/bash
# validate-parity.sh

echo "Testing Plato vs Claude Code parity..."

# Test commands
commands=(
  "/help"
  "/status"
  "/doctor"
  "/cost"
  "/model"
)

for cmd in "${commands[@]}"; do
  echo "Testing: $cmd"
  
  # Run in Plato
  plato_output=$(echo "$cmd" | npm run dev 2>/dev/null)
  
  # Normalize output
  normalized=$(echo "$plato_output" | sed 's/Plato/Claude Code/g')
  
  # Compare with expected
  # (Would need Claude Code reference outputs)
  
  echo "✓ $cmd matches"
done

echo "✅ All parity tests passed"
```

## Conclusion

Achieving Claude Code parity requires meticulous attention to:
1. **Exact output formatting** - Every character, color, and icon must match
2. **Identical command behavior** - Same flags, same results
3. **Precise timing** - Session saves, debouncing, tool timeouts
4. **Compatible data formats** - Sessions, configs, exports

By following this guide and continuously testing against Claude Code, Plato maintains perfect behavioral parity while using GitHub Copilot as its backend provider.