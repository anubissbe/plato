# Plato Documentation Index

> **Complete documentation catalog for Plato - Claude Code-compatible terminal AI assistant**

## 📚 Documentation Overview

This index provides a comprehensive guide to all documentation in the Plato project, organized by category with cross-references and quick navigation.

### Quick Links
- [Getting Started](#getting-started)
- [Architecture & Design](#architecture--design)
- [Feature Documentation](#feature-documentation)
- [API Reference](#api-reference)
- [Developer Guides](#developer-guides)
- [Operations & Maintenance](#operations--maintenance)

---

## Getting Started

### Core Documentation
- **[README.md](./README.md)** - Project overview, installation, and quick start guide
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code instructions and AI guidance
- **[docs/README.md](./docs/README.md)** - Documentation hub and navigation guide

### Setup & Configuration
- **[docs/verification.md](./docs/verification.md)** - End-to-end testing and verification procedures
- **[docs/persistence/config-schema.md](./docs/persistence/config-schema.md)** - Configuration file structure and options
- **[docs/ops/doctor.md](./docs/ops/doctor.md)** - Diagnostic tools and setup troubleshooting

---

## Architecture & Design

### System Architecture
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - High-level system architecture and component relationships
- **[DESIGN.md](./DESIGN.md)** - Design decisions, patterns, and principles
- **[AGENTS.md](./AGENTS.md)** - Agent system architecture and capabilities

### Technical Implementation
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation details and technical decisions
- **[docs/CLAUDE_CODE_PARITY_GUIDE.md](./docs/CLAUDE_CODE_PARITY_GUIDE.md)** - Claude Code compatibility implementation
- **[docs/PLATO_DOCUMENTATION.md](./docs/PLATO_DOCUMENTATION.md)** - Comprehensive project documentation

---

## Feature Documentation

### Terminal User Interface (TUI)
- **[docs/tui/commands.md](./docs/tui/commands.md)** - Slash command reference and usage
- **[docs/tui/statusline.md](./docs/tui/statusline.md)** - Status line configuration and customization
- **[docs/tui/bashes.md](./docs/tui/bashes.md)** - Bash session management
- **[docs/OUTPUT_STYLES.md](./docs/OUTPUT_STYLES.md)** - Output styling system and themes

### AI Provider Integration
- **[docs/providers/copilot-auth.md](./docs/providers/copilot-auth.md)** - GitHub Copilot authentication
- **[docs/providers/models.md](./docs/providers/models.md)** - Supported AI models and configuration

### Runtime & Orchestration
- **[docs/runtime/orchestrator.md](./docs/runtime/orchestrator.md)** - Message orchestration and flow control
- **[docs/runtime/streaming.md](./docs/runtime/streaming.md)** - Streaming response handling
- **[docs/runtime/tool-calls.md](./docs/runtime/tool-calls.md)** - Tool call system and integration

### Tools & Extensions
- **[docs/tools/patch-engine.md](./docs/tools/patch-engine.md)** - Code patch application system
- **[docs/tools/permissions.md](./docs/tools/permissions.md)** - Permission system and security
- **[docs/tools/hooks.md](./docs/tools/hooks.md)** - Hook system for extensibility
- **[docs/tools/git.md](./docs/tools/git.md)** - Git integration features
- **[docs/tools/exec-tests.md](./docs/tools/exec-tests.md)** - Test execution framework

### Integrations
- **[docs/integrations/mcp.md](./docs/integrations/mcp.md)** - Model Context Protocol (MCP) integration
- **[docs/integrations/proxy.md](./docs/integrations/proxy.md)** - OpenAI-compatible proxy server

### Context Management
- **[docs/context/indexing.md](./docs/context/indexing.md)** - File indexing and context management

### Session & Persistence
- **[docs/persistence/session.md](./docs/persistence/session.md)** - Session management and restoration
- **[docs/persistence/config-schema.md](./docs/persistence/config-schema.md)** - Configuration persistence

---

## API Reference

### Core APIs
- **[docs/API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete API documentation
- **[docs/API/OUTPUT_STYLES_API.md](./docs/API/OUTPUT_STYLES_API.md)** - Output styles API reference

### Component APIs
- Runtime APIs → See [orchestrator.md](./docs/runtime/orchestrator.md)
- Tool APIs → See [patch-engine.md](./docs/tools/patch-engine.md)
- Provider APIs → See [copilot-auth.md](./docs/providers/copilot-auth.md)

---

## Developer Guides

### Testing & Quality
- **[docs/testing/testing.md](./docs/testing/testing.md)** - Testing strategies and guidelines
- **[docs/verification.md](./docs/verification.md)** - Verification procedures

### Platform Support
- **[docs/platforms/cross-platform.md](./docs/platforms/cross-platform.md)** - Cross-platform compatibility
- **[docs/platforms/a11y-i18n.md](./docs/platforms/a11y-i18n.md)** - Accessibility and internationalization

### Policies & Security
- **[docs/policies/privacy.md](./docs/policies/privacy.md)** - Privacy policy and data handling
- **[docs/policies/security-review.md](./docs/policies/security-review.md)** - Security review processes

### Release & Deployment
- **[docs/release/packaging.md](./docs/release/packaging.md)** - Packaging and distribution
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes

---

## Operations & Maintenance

### Diagnostics & Monitoring
- **[docs/ops/doctor.md](./docs/ops/doctor.md)** - System diagnostics
- **[docs/ops/telemetry.md](./docs/ops/telemetry.md)** - Telemetry and metrics

### Known Issues & Gaps
- **[ISSUES.md](./ISSUES.md)** - Known issues and bug tracking
- **[SPEC_GAPS.md](./SPEC_GAPS.md)** - Specification gaps analysis
- **[SPEC_GAPS_NEW.md](./SPEC_GAPS_NEW.md)** - New specification gaps
- **[SPEC_GAPS_AUDIT.md](./SPEC_GAPS_AUDIT.md)** - Specification gaps audit

---

## Documentation Categories

### 📖 User Documentation
Essential guides for end users:
- [README.md](./README.md) - Getting started
- [docs/tui/commands.md](./docs/tui/commands.md) - Command reference
- [docs/OUTPUT_STYLES.md](./docs/OUTPUT_STYLES.md) - Customization
- [docs/verification.md](./docs/verification.md) - Testing your setup

### 🏗️ Architecture Documentation
System design and structure:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [DESIGN.md](./DESIGN.md) - Design principles
- [docs/runtime/orchestrator.md](./docs/runtime/orchestrator.md) - Core runtime

### 🔧 Developer Documentation
Implementation and API guides:
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) - API documentation
- [docs/testing/testing.md](./docs/testing/testing.md) - Testing guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details

### 🚀 Operations Documentation
Deployment and maintenance:
- [docs/ops/doctor.md](./docs/ops/doctor.md) - Diagnostics
- [docs/release/packaging.md](./docs/release/packaging.md) - Distribution
- [docs/platforms/cross-platform.md](./docs/platforms/cross-platform.md) - Platform support

### 📋 Policy Documentation
Security and compliance:
- [docs/policies/privacy.md](./docs/policies/privacy.md) - Privacy
- [docs/policies/security-review.md](./docs/policies/security-review.md) - Security
- [docs/tools/permissions.md](./docs/tools/permissions.md) - Permissions

---

## Cross-References

### By Feature Area

#### Authentication & Providers
- [copilot-auth.md](./docs/providers/copilot-auth.md) → [models.md](./docs/providers/models.md)
- [proxy.md](./docs/integrations/proxy.md) → [copilot-auth.md](./docs/providers/copilot-auth.md)

#### Runtime System
- [orchestrator.md](./docs/runtime/orchestrator.md) → [streaming.md](./docs/runtime/streaming.md) → [tool-calls.md](./docs/runtime/tool-calls.md)
- [mcp.md](./docs/integrations/mcp.md) → [tool-calls.md](./docs/runtime/tool-calls.md)

#### User Interface
- [commands.md](./docs/tui/commands.md) → [statusline.md](./docs/tui/statusline.md) → [bashes.md](./docs/tui/bashes.md)
- [OUTPUT_STYLES.md](./docs/OUTPUT_STYLES.md) → [OUTPUT_STYLES_API.md](./docs/API/OUTPUT_STYLES_API.md)

#### Tools & Extensions
- [patch-engine.md](./docs/tools/patch-engine.md) → [permissions.md](./docs/tools/permissions.md)
- [hooks.md](./docs/tools/hooks.md) → [git.md](./docs/tools/git.md)

#### Configuration & Persistence
- [config-schema.md](./docs/persistence/config-schema.md) → [session.md](./docs/persistence/session.md)
- [indexing.md](./docs/context/indexing.md) → [session.md](./docs/persistence/session.md)

### By Implementation Phase

#### Phase 0: Core Features (Completed)
- TUI Application → [commands.md](./docs/tui/commands.md)
- Copilot Integration → [copilot-auth.md](./docs/providers/copilot-auth.md)
- Patch Engine → [patch-engine.md](./docs/tools/patch-engine.md)
- MCP Support → [mcp.md](./docs/integrations/mcp.md)

#### Phase 1: Claude Code Parity
- Keyboard Shortcuts → [CLAUDE_CODE_PARITY_GUIDE.md](./docs/CLAUDE_CODE_PARITY_GUIDE.md)
- Custom Commands → [commands.md](./docs/tui/commands.md)
- Memory System → [session.md](./docs/persistence/session.md)
- Output Styles → [OUTPUT_STYLES.md](./docs/OUTPUT_STYLES.md)

---

## Documentation Standards

### File Organization
```
/
├── *.md                    # Root-level architecture and overview docs
├── docs/
│   ├── README.md          # Documentation hub
│   ├── API/               # API reference documentation
│   ├── providers/         # Provider integration docs
│   ├── runtime/           # Runtime system docs
│   ├── tools/             # Tool documentation
│   ├── tui/               # Terminal UI docs
│   ├── integrations/      # Integration guides
│   ├── persistence/       # Data persistence docs
│   ├── context/           # Context management docs
│   ├── platforms/         # Platform-specific docs
│   ├── policies/          # Policy documentation
│   ├── ops/               # Operations docs
│   ├── testing/           # Testing documentation
│   └── release/           # Release documentation
└── .agent-os/             # Agent OS documentation
```

### Documentation Types
- **Overview** (README.md) - Project introduction and quick start
- **Architecture** (ARCHITECTURE.md) - System design and structure
- **API Reference** (API/*.md) - Detailed API documentation
- **User Guides** (docs/tui/*.md) - End-user documentation
- **Developer Guides** (docs/testing/*.md) - Development documentation
- **Operations** (docs/ops/*.md) - Deployment and maintenance

### Maintenance Notes
- Documentation is organized hierarchically by feature area
- Cross-references use relative links for navigation
- API documentation follows JSDoc/TypeDoc conventions
- User guides include examples and common use cases
- Architecture docs use diagrams where appropriate

---

## Quick Navigation Map

```
Start Here → README.md
    ├── Setup → docs/verification.md
    ├── Commands → docs/tui/commands.md
    ├── Configuration → docs/persistence/config-schema.md
    └── Troubleshooting → docs/ops/doctor.md

Architecture → ARCHITECTURE.md
    ├── Design → DESIGN.md
    ├── Runtime → docs/runtime/orchestrator.md
    └── Implementation → IMPLEMENTATION_SUMMARY.md

Features
    ├── TUI → docs/tui/commands.md
    ├── Styles → docs/OUTPUT_STYLES.md
    ├── Tools → docs/tools/patch-engine.md
    └── Integrations → docs/integrations/mcp.md

Development
    ├── API → docs/API_REFERENCE.md
    ├── Testing → docs/testing/testing.md
    └── Contributing → CHANGELOG.md
```

---

*Last updated: January 2025*
*Documentation version: 1.0.0*
*Total documentation files: 44*