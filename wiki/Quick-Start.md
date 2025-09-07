# Quick Start Guide

Get up and running with Plato in just a few minutes!

## 🚀 5-Minute Setup

### Step 1: Install and Build

```bash
# Clone and enter directory
git clone https://git.euraika.net/Bert/plato.git
cd plato

# Install dependencies
npm ci

# Build the project
npm run build
```

### Step 2: Start Plato

```bash
npm run dev
```

### Step 3: Authenticate

When Plato starts, run:
```
/login
```

Follow the prompts to authenticate with GitHub Copilot.

### Step 4: Start Chatting!

Simply type your message and press Enter. Plato will respond using AI.

## 💡 Essential Commands

### Basic Commands
- `/help` - Show available commands
- `/doctor` - Check system status
- `/status` - Show authentication status
- `/model` - Switch AI models
- `/exit` or `Ctrl+C` - Exit Plato

### Conversation Management
- `/memory save` - Save current conversation
- `/memory load` - Load saved conversation
- `/compact` - Compress long conversations
- `/resume` - Restore last session

### Tool Integration
- `/mcp attach <name> <url>` - Add tool server
- `/mcp tools` - List available tools
- `/permissions` - Configure tool permissions

## ⌨️ Keyboard Shortcuts

### Navigation
- `↑/↓` - Scroll through conversation
- `Ctrl+U` - Page up
- `Ctrl+D` - Page down
- `Ctrl+L` - Clear screen

### Panels (Enhanced TUI)
- `Ctrl+1` - Focus main chat panel
- `Ctrl+2` - Focus status panel
- `Ctrl+3` - Focus input panel
- `F1` - Toggle status panel
- `F2` - Expand input panel
- `F3` - Switch layout modes

### Input
- `Enter` - Send message
- `Shift+Enter` - New line
- `Tab` - Auto-complete commands
- `Esc` - Cancel current input

## 🎯 Common Use Cases

### 1. Code Analysis
```
Analyze the architecture of my React application in src/
```

### 2. Bug Fixing
```
Help me debug the authentication error in auth.js line 45
```

### 3. Code Generation
```
Create a REST API endpoint for user management with TypeScript
```

### 4. Documentation
```
Write comprehensive documentation for the utils module
```

### 5. Testing
```
Generate unit tests for the MessageBubble component
```

## 🔧 Configuration Tips

### Enable File Operations
Allow Plato to directly modify files:
```
/permissions default fs_patch allow
/apply-mode auto
```

### Set Default Model
```
/model set gpt-4
```

### Configure Memory Auto-Save
```
/memory auto-save on
```

### Customize Output Style
```
/output-style technical
```

## 🚦 Status Indicators

### Connection Status
- 🟢 Connected to AI provider
- 🟡 Authenticating
- 🔴 Disconnected

### Message Status
- 🔄 AI is thinking
- ✅ Response complete
- ⚠️ Warning or notice
- ❌ Error occurred

### Memory Status
- 💾 Auto-save enabled
- 📝 Memory modified
- 🔄 Syncing

## 📊 Performance Tips

1. **Use `/compact` for long conversations** - Reduces memory usage
2. **Enable mouse mode** - `/mouse on` for easier text selection
3. **Use `/paste` mode** - Temporarily disable input for copying
4. **Leverage memory** - Save important contexts for reuse

## 🛠️ Troubleshooting Quick Fixes

### Can't authenticate?
```
/logout
/login
```

### Slow responses?
```
/compact --aggressive
/model set gpt-3.5-turbo
```

### TUI rendering issues?
```
/mouse off
# Restart Plato
```

### Lost your session?
```
/resume
```

## 📚 Next Steps

Now that you're up and running:

1. **Explore Commands**: Check out the full [Slash Commands](Slash-Commands) reference
2. **Add Tools**: Learn about [MCP Servers](MCP-Servers) integration
3. **Customize**: See [Configuration](Configuration) options
4. **Learn Shortcuts**: Master [Keyboard Shortcuts](Keyboard-Shortcuts)

## 💬 Getting Help

- Run `/help` for inline help
- Run `/doctor` for diagnostics
- Check the [FAQ](FAQ) for common questions
- Visit [Troubleshooting](Troubleshooting) for detailed solutions

---

[← Back to Home](Home) | [Installation →](Installation)