# Technical Stack

## Core Application

**Application Framework:** Node.js 20+ with TypeScript 5.5.4 (ESM modules)
**Runtime Environment:** Node.js with cross-platform compatibility (Windows, macOS, Linux, WSL2)
**JavaScript Framework:** React 18 (for terminal UI components)
**Import Strategy:** ESM modules with TypeScript compilation
**Package Manager:** npm with package-lock.json

## User Interface

**UI Framework:** Ink 4.4.1 (React-based terminal UI)
**Terminal Handling:** Raw mode input with cross-platform keyboard support
**UI Component Library:** Custom components built on Ink primitives
**Icon Library:** Unicode symbols and ASCII art for terminal display
**Fonts Provider:** System terminal fonts

## Data & Storage

**Database System:** File-based JSON storage (credentials, session state, configuration)
**Configuration:** YAML files (~/.config/plato/config.yaml, .plato/config.yaml)
**Session Persistence:** JSON serialization (.plato/session.json)
**Credential Storage:** OS keychain (keytar) with JSON fallback

## External Integrations

**AI Provider:** GitHub Copilot via OpenAI-compatible Chat Completions API
**Authentication:** GitHub OAuth device flow with token management
**Version Control:** Git CLI integration with simple-git wrapper
**Process Execution:** execa for shell command execution

## Development Tools

**Build System:** TypeScript compiler (tsc) with rimraf for cleanup
**Development Server:** tsx for TypeScript execution in development
**Code Repository:** Git with GitHub integration
**Optional Dependencies:** keytar (OS keychain), node-pty (terminal emulation)

## Deployment & Distribution

**Application Hosting:** Local installation via npm
**Asset Hosting:** npm package registry
**Distribution:** npm binary distribution with global CLI
**Deployment Solution:** Direct installation on developer machines

## Architecture Patterns

**Module System:** ES modules with TypeScript
**Tool Integration:** MCP (Model Context Protocol) for extensible tools
**Command System:** Slash command router with declarative registry
**Provider System:** Pluggable AI provider interface
**Security Model:** Permissions-based tool access with audit logging