# Installation Guide

This guide will help you install and set up Plato on your system.

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Git**: For cloning the repository
- **Terminal**: Any modern terminal emulator

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://git.euraika.net/Bert/plato.git
cd plato
```

### 2. Install Dependencies

```bash
npm ci
```

This installs all required dependencies with exact versions from `package-lock.json`.

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript files to the `dist/` directory.

### 4. Run Plato

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm run start
```

## Configuration

### Initial Setup

1. **Login to GitHub Copilot** (required for AI features):
   ```bash
   npx tsx src/cli.ts login
   ```
   Or use the `/login` command in the TUI.

2. **Configure Settings**:
   ```bash
   npx tsx src/cli.ts config set <key> <value>
   ```

### Environment Variables

Create a `.env` file in the project root:

```env
# Optional: Custom configuration
PLATO_CONFIG_DIR=~/.plato
PLATO_LOG_LEVEL=info
PLATO_MEMORY_DIR=.plato/memory
```

## Verification

### Check Installation

Run the diagnostic command:
```bash
npm run claude:capabilities
```

Or in the TUI:
```
/doctor
```

This will verify:
- Node.js version
- Dependencies installation
- GitHub Copilot authentication
- MCP server connectivity

### Run Tests

```bash
npm test
```

## Platform-Specific Notes

### macOS
- Keychain integration for credential storage
- Full mouse support in Terminal.app and iTerm2

### Linux
- May require additional packages for keytar (credential storage)
- Works best with modern terminal emulators

### Windows (WSL)
- Use within WSL2 for best compatibility
- Native Windows terminal or Windows Terminal recommended

## Troubleshooting

### Common Issues

**Issue**: `npm ci` fails
- **Solution**: Ensure Node.js 18+ is installed
- Run `node --version` to check

**Issue**: Authentication fails
- **Solution**: Re-run `/login` command
- Check internet connectivity

**Issue**: TUI rendering issues
- **Solution**: Ensure terminal supports Unicode
- Try different terminal emulator

**Issue**: Permission errors
- **Solution**: Check file permissions in `.plato/` directory
- Run `chmod -R 755 .plato/` if needed

### Getting Help

1. Run `/doctor` for diagnostics
2. Check the [FAQ](FAQ) page
3. Create an [issue](https://git.euraika.net/Bert/plato/-/issues)

## Next Steps

- Read the [Quick Start](Quick-Start) guide
- Explore [Slash Commands](Slash-Commands)
- Configure [MCP Servers](MCP-Servers)
- Customize with [Configuration](Configuration)

---

[← Back to Home](Home)