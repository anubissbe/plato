# Claude Code Complete Reference Documentation

## Overview

Claude Code is an agentic coding tool that lives in your terminal, developed by Anthropic. It's designed to meet developers where they work, integrating seamlessly with existing tools and workflows.

- **Latest Version**: 1.0.97
- **Technology Stack**: TypeScript (54%), Node.js 18+
- **Package**: `@anthropic-ai/claude-code`
- **GitHub Stars**: 32.6k
- **Repository**: https://github.com/anthropics/claude-code

## Installation & Setup

```bash
npm install -g @anthropic-ai/claude-code
```

Run in your project directory:
```bash
claude
```

## Visual Appearance & UI Elements

### Welcome Message
- Format: Simple text-based welcome in terminal
- Displays current working directory
- Shows help hint: `/help for help`

### Status Line
- Customizable via `/statusline` command
- Shows: Model, tokens, current branch
- Format: `claude code | {provider} | {model} | {tokens} {branch}`

### UI Elements
- **Terminal-based interface** - No GUI, pure command line
- **Box borders** - Single line borders for UI sections
- **Colors**:
  - Gray text for tool calls and system messages
  - Red for errors with ❌ emoji
  - Green for success with ✅ emoji
  - Yellow for warnings with ⚠️ emoji
- **Spinners** - Progress indicators during operations
- **File operations display**: `📝 Writing {filename}...`

## Complete Slash Commands List

### Core Commands

1. **`/help`** - Get usage help and list all commands
2. **`/clear`** - Clear conversation history (most used command)
3. **`/compact [instructions]`** - Compact conversation with optional focus
4. **`/status`** - Show current status and configuration
5. **`/model`** - Select or change AI model (Opus, Sonnet, Haiku)
6. **`/init`** - Initialize project with CLAUDE.md guide
7. **`/memory`** - Edit CLAUDE.md memory files
8. **`/config`** - View/modify configuration
9. **`/cost`** - Show token usage statistics

### Authentication & Account
10. **`/login`** - Switch Anthropic accounts
11. **`/logout`** - Sign out from your Anthropic account
12. **`/upgrade`** - Information about plan upgrades

### Development Tools
13. **`/bug`** - Report bugs (sends conversation to Anthropic)
14. **`/doctor`** - Check health of Claude Code installation
15. **`/ide`** - Connect to IDE for file awareness and linter warnings
16. **`/install-github-app`** - Enable automatic PR reviews
17. **`/hooks`** - Configure lifecycle hooks interactively
18. **`/agents`** - Manage custom AI subagents for specialized tasks
19. **`/permissions`** - Manage tool permissions and safety settings

### File & Directory Management
20. **`/add-dir`** - Add additional working directories
21. **`/context`** - Debug and manage context issues
22. **`/export`** - Export conversation history
23. **`/todos`** - List current TODO items in codebase

### MCP & Integration
24. **`/mcp`** - Manage MCP server connections and OAuth
25. **`/terminal-setup`** - Fix terminal configuration issues

### Session Management
26. **`/resume`** - Resume previous session
27. **`/statusline`** - Customize status line display

### Output & Display
28. **`/output-style`** - Switch output style profiles
29. **`/privacy-settings`** - Manage privacy preferences
30. **`/release-notes`** - View release notes

## Custom Commands

Create custom slash commands in `.claude/commands/` directory:
- Add `commandname.md` files
- Write prompts in natural language
- Use `$ARGUMENTS` placeholder for arguments
- Supports namespacing through directories
- Git-shareable with team

## Keyboard Shortcuts & Navigation

### Essential Shortcuts
- **Escape** - Stop Claude (not Ctrl+C which exits)
- **Escape twice** - Show list of previous messages to jump to
- **Ctrl+R** - Transcript mode
- **Ctrl+B** - Background command execution
- **Ctrl+V** - Paste images (not Cmd+V on macOS)
- **Shift+Enter** - New line (after /terminal-setup)
- **Up Arrow** - Navigate chat history
- **Vim-style navigation** - In menus

### File Operations
- **Shift+Drag** - Reference files properly (vs normal drag which opens in new tab)
- **@-tagging** - Reference files with @ symbol

## Command Line Arguments

### Basic Usage
```bash
claude                                    # Interactive mode
claude -p "prompt"                       # Headless mode (no UI)
claude --dangerously-skip-permissions    # Skip all permission prompts
```

### Advanced Options
- **`-p`** - Headless mode for scripts and automation
- **`--output-format stream-json`** - Streaming JSON output
- **`--print`** - Output results directly

### Composable Usage
```bash
tail -f app.log | claude -p "Alert on anomalies"
claude -p "Translate new strings to French" | git commit
```

## Features & Capabilities

### Core Features
1. **Natural language commands** - Understands conversational requests
2. **Direct file editing** - Can modify files without confirmation (with permissions)
3. **Command execution** - Runs shell commands
4. **Git integration** - Creates commits, handles workflows
5. **Codebase understanding** - Deep analysis of project structure
6. **Web search capability** - Can search for information
7. **PDF reading** - Process PDF documents
8. **Image paste/upload** - Visual input support

### Development Workflows
- Bug fixes and debugging
- Feature implementation
- Code refactoring
- Test generation
- Documentation writing
- Code explanation
- Architecture planning
- Performance optimization

### MCP (Model Context Protocol)
- Connect external tools and services
- GitHub integration for PR reviews
- Custom server connections
- OAuth authentication support
- Dynamic command discovery from servers

### Hooks System
- Pre/post execution hooks
- Custom automation workflows
- Team-shareable configurations
- JSON or interactive configuration

### Session Management
- Auto-save sessions
- Resume previous conversations
- Context preservation
- Memory system via CLAUDE.md

## Configuration

### Project Configuration
- **`.claude/`** directory for project-specific settings
- **`CLAUDE.md`** - Project memory and context
- **`.claude/commands/`** - Custom commands
- **`.claude/hooks/`** - Hook configurations

### User Configuration
- Model selection (Opus 4.1, Sonnet 4, Haiku 3.5)
- Permission settings
- Privacy preferences
- Status line customization
- Output style profiles

## Best Practices

### Context Management
1. **Use `/clear` frequently** - Between tasks to reset context
2. **Use `/compact` at breakpoints** - After completing features
3. **Maintain CLAUDE.md** - Keep project context updated
4. **@-tag specific files** - Don't include unnecessary context

### Performance Optimization
- Clear history to save tokens
- Switch models based on task complexity
- Use Opus for complex work, Sonnet for routine tasks
- Leverage custom commands for repeated workflows

### Workflow Tips
- Initialize with `/init` for new projects
- Use `--dangerously-skip-permissions` for uninterrupted work
- Create team-shareable custom commands
- Set up hooks for automation
- Use headless mode for CI/CD integration

## Error Handling & Recovery

### Common Issues
- **Permission fatigue** - Use skip-permissions flag
- **Context overflow** - Use /clear or /compact
- **Terminal issues** - Run /terminal-setup
- **Connection problems** - Check with /doctor

### Error Formats
- Red text with ❌ for errors
- Yellow text with ⚠️ for warnings
- Detailed error messages with suggestions

## File Operation Formats

### Writing Files
```
📝 Writing filename.js...
  ✓ Wrote 42 lines to filename.js
```

### Tool Calls
- Displayed in gray/muted text
- Shows tool name and parameters
- Real-time output streaming

### Success Messages
```
✅ Task completed successfully
```

## Model Support

### Available Models
1. **Claude Opus 4.1** - Most capable, complex tasks
2. **Claude Sonnet 4** - Balanced performance
3. **Claude Haiku 3.5** - Fast, routine tasks

### Enterprise Options
- Amazon Bedrock integration
- Google Cloud Vertex AI support
- Custom model endpoints

## Version History Highlights

### Recent Major Features
- Custom subagents for specialized tasks
- Web search capability
- PDF reading support
- Native Windows support
- Image paste/upload functionality
- Custom slash commands
- Hooks system for extensibility
- SDK releases (TypeScript, Python)

### UI/UX Improvements
- Enhanced file path autocomplete
- Improved spinner animations
- Vim-style navigation
- Transcript mode
- Customizable status line
- Background command execution

## Integration Capabilities

### IDE Integration
- VS Code extension available
- File awareness from IDE
- Linter warning access
- Open file detection

### Version Control
- Git workflow automation
- PR creation and review
- Commit message generation
- Branch management

### CI/CD Integration
- Headless mode for automation
- Scriptable operations
- Pipeline integration
- Automated testing support

## Differences from Plato

Based on this research, key differences Plato needs to address:

1. **Command Coverage** - Plato has 35 commands but may be missing some like `/ide`, `/install-github-app`, `/terminal-setup`
2. **Visual Formatting** - Exact emoji usage and text formatting
3. **Keyboard Shortcuts** - Escape for stop, Ctrl+R for transcript, etc.
4. **Custom Commands** - Support for `.claude/commands/` directory
5. **Hooks System** - Interactive configuration
6. **Session Management** - Proper auto-save and resume
7. **Permission System** - Skip-permissions flag
8. **Headless Mode** - `-p` flag for non-interactive use
9. **Model Selection** - Support for Opus, Sonnet, Haiku
10. **IDE Integration** - `/ide` command functionality