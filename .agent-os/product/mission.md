# Product Mission

## Pitch

PlatoV3 is an exact visual and functional clone of Claude Code that uses GitHub Copilot authentication instead of Claude API. Every pixel, every command, every interaction is identical - the only difference is you sign in with Copilot instead of Claude, saving 70% on costs. 

Beyond perfect Claude Code parity, PlatoV3 is self-hostable and runs entirely in the terminal with no vendor lock-in. It adds persistent context memory across sessions, an extensible platform for custom MCP servers, and future support for multiple AI backends. It's the terminal-native AI coding assistant that gives you Claude Code's exact experience at 70% lower cost, with full developer control.

## Users

### Primary Customers

- **Cost-conscious developers**: Developers who want Claude Code functionality but find the API costs prohibitive
- **GitHub Copilot subscribers**: Existing Copilot users seeking enhanced terminal AI capabilities
- **Power users & indie developers**: Developers who want Claude Code experience with more control and self-hosting
- **Small teams**: Development teams needing a shared AI coding assistant without vendor lock-in
- **Enterprises**: Organizations requiring privacy, compliance, or custom AI backend integration

### User Personas

**Terminal Power User** (25-40 years old)
- **Role:** Senior developer, DevOps engineer, or system architect
- **Context:** Lives in the terminal, values control and customization over convenience
- **Pain Points:** IDE vendor lock-in, lack of control over AI tools, context loss between sessions
- **Goals:** Terminal-native workflow, extensible platform, self-hosted control

**Privacy-Conscious Team Lead** (30-45 years old)
- **Role:** Engineering manager or tech lead at regulated company
- **Context:** Managing team development with compliance requirements
- **Pain Points:** Data privacy concerns with cloud AI, need for audit trails, custom integration requirements
- **Goals:** Self-hosted AI assistant, team collaboration features, enterprise compliance

## The Problem

### High AI Development Tool Costs

Developers want Claude Code's powerful AI-assisted development capabilities but find the API costs prohibitive for regular use. Many teams already pay for GitHub Copilot subscriptions but cannot justify additional AI tooling expenses.

**Our Solution:** Provide complete Claude Code functionality using existing GitHub Copilot subscriptions.

### Limited Terminal AI Integration

Existing AI coding tools lack the seamless terminal integration and immediate file operation capabilities that make Claude Code so productive. Developers need a unified terminal experience.

**Our Solution:** Mirror Claude Code's TUI/CLI behavior with immediate file writes, patch management, and comprehensive tool integration.

### Fragmented Development Workflow

Developers juggle multiple AI tools and interfaces, reducing productivity and increasing context switching overhead.

**Our Solution:** Single terminal interface providing all Claude Code features through familiar slash commands and integrated tool ecosystem.

## Differentiators

### Cost-Effective Claude Code Alternative

Unlike Claude Code which requires expensive API credits, Plato leverages existing GitHub Copilot subscriptions that developers already pay for. This results in 70-90% cost reduction while maintaining feature parity.

### Exact Feature Parity

Unlike other AI coding assistants that offer subset functionality, Plato provides complete Claude Code parity including immediate file writes, patch management, MCP integration, and 35+ slash commands. This results in zero learning curve for Claude Code users.

### Local-First Architecture

Unlike cloud-dependent solutions, Plato operates locally with Git integration, ensuring data privacy and enabling offline development. This results in better security posture and no dependency on external service availability.

## Key Features

### Core Features

- **GitHub Copilot Integration:** OAuth device flow authentication with token management
- **Immediate File Operations:** Claude Code-style Write(filename) with instant file creation/modification
- **Patch Engine:** Unified diff management with apply/revert capabilities and Git integration
- **MCP Server Support:** Full Model Context Protocol integration for extensible tool ecosystem
- **React/Ink TUI:** Modern terminal user interface with cross-platform compatibility

### Development Features

- **35+ Slash Commands:** Complete Claude Code command parity including /apply, /revert, /run, /permissions
- **Session Persistence:** Auto-save/resume functionality with .plato/session.json
- **Context Management:** Intelligent file indexing and token budget optimization
- **Git Integration:** Seamless version control with dry-run checks and safety validation

### Quality Assurance Features

- **Security Review:** Static analysis on pending diffs to detect secrets and risky operations
- **Permissions System:** Granular allow/deny rules with audit logging
- **TODO Management:** Automatic task extraction and tracking
- **Bash Session Management:** PTY session handling for long-running processes