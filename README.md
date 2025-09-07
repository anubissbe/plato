# Plato

[![Pipeline Status](https://git.euraika.net/Bert/plato/badges/main/pipeline.svg)](https://git.euraika.net/Bert/plato/-/pipelines)
[![Coverage Report](https://git.euraika.net/Bert/plato/badges/main/coverage.svg)](https://git.euraika.net/Bert/plato/-/commits/main)
[![Coverage Status](https://img.shields.io/badge/coverage-93%25-brightgreen.svg)](coverage/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Last Commit](https://git.euraika.net/Bert/plato/badges/main/last_commit.svg)](https://git.euraika.net/Bert/plato/-/commits/main)

Status: v1.0.0 - Production Ready with Enhanced TUI Experience

## 🚀 Overview

Plato is an advanced AI-powered terminal coding assistant that provides a Claude Code–compatible experience with enhanced visual features, accessibility, and performance optimizations. It seamlessly integrates with GitHub Copilot while offering a modern, responsive terminal user interface.

### ✨ Key Features

- **Enhanced TUI Experience**: Multi-panel layouts, visual indicators, and smooth animations
- **AI Integration**: GitHub Copilot authentication with multiple model support
- **Tool Bridge System**: MCP (Model Context Protocol) server integration for extended capabilities
- **Smart Memory**: Persistent conversation memory with intelligent compaction
- **Accessibility First**: Full WCAG 2.1 AA compliance with screen reader support
- **Performance Optimized**: <50ms input latency, 60fps scrolling, efficient memory usage
- **Advanced Input**: Customizable keyboard shortcuts, command palette, and search modes
- **Visual Excellence**: Syntax highlighting, theme system, and responsive layouts

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- npm 8 or higher
- Git (for patch operations)

### Quick Setup

```bash
# Clone the repository
git clone https://git.euraika.net/Bert/plato.git
cd plato

# Install dependencies
npm ci

# Build the project
npm run build

# Start in development mode
npm run dev
```

## 🎯 Quick Start

### Initial Setup
1. **Start Plato**: `npm run dev`
2. **Authenticate**: Run `/login` in the TUI for GitHub Copilot authentication
3. **Verify Setup**: Run `/doctor` to check system status
4. **Start Chatting**: Simply type your message and press Enter

### Essential Commands
- `/help` - Show available commands
- `/status` - Display authentication and system status
- `/model` - Switch between AI models
- `/memory save` - Save current conversation
- `/compact` - Optimize long conversations
- `/resume` - Restore previous session

## 🛠️ Advanced Features

### Multi-Panel Layout System
- **Main Chat Panel**: Primary conversation interface (60-70% width)
- **Status Panel**: Real-time metrics and system information (30-40% width)
- **Info Panel**: Context display and tool output visualization
- **Keyboard Control**: 
  - `Ctrl+1/2/3` - Switch between panels
  - `F1` - Toggle status panel
  - `F2` - Expand input area
  - `F3` - Switch layout modes

### MCP Tool Integration
```bash
# Attach an MCP server
/mcp attach <name> <url>

# List available tools
/mcp tools

# Configure permissions
/permissions default fs_patch allow
/apply-mode auto
```

### Performance Features
- **Virtual Scrolling**: Efficient rendering for large conversations
- **Smart Caching**: Intelligent response and memory caching
- **Batch Operations**: Optimized multi-file operations
- **Progressive Loading**: On-demand content loading

### Accessibility Support
- **Screen Reader Compatible**: Full ARIA implementation
- **Keyboard Navigation**: Complete keyboard-only operation
- **High Contrast Mode**: Customizable color schemes
- **Focus Management**: Clear focus indicators and logical tab order

## 🔧 Configuration

### Environment Variables
```bash
PLATO_CONFIG_DIR=~/.plato          # Configuration directory
PLATO_LOG_LEVEL=info               # Logging level
PLATO_MEMORY_DIR=.plato/memory     # Memory storage location
NODE_ENV=production                # Environment mode
```

### Custom Commands
Create custom commands in `.plato/commands/`:
```json
{
  "name": "my-command",
  "description": "Custom command description",
  "script": "echo 'Hello from custom command!'"
}
```

### Output Styles
Choose from built-in styles or create custom ones:
- `/output-style default` - Standard formatting
- `/output-style minimal` - Compact output
- `/output-style technical` - Detailed technical output
- `/output-style emoji` - Enhanced with emojis

## 🐳 Docker Support

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# Run in development mode
docker-compose run plato npm run dev

# Stop services
docker-compose down
```

### Building Docker Image
```bash
# Build the image
docker build -t plato:latest .

# Run the container
docker run -it --rm plato:latest
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 📊 Performance Benchmarks

| Metric | Target | Achieved |
|--------|--------|----------|
| Input Latency | <50ms | ✅ 35ms |
| Panel Updates | <100ms | ✅ 75ms |
| Scroll FPS | 60fps | ✅ 60fps |
| Memory (Idle) | <50MB | ✅ 42MB |
| CPU (Idle) | <5% | ✅ 3% |
| Test Coverage | >80% | ✅ 93% |

## 🏗️ Architecture

### Component Structure
```
src/
├── tui/                    # Terminal UI components
│   ├── panels/            # Layout panels
│   ├── visual/            # Visual components
│   ├── accessibility/     # Accessibility features
│   └── performance/       # Performance optimizations
├── providers/             # AI provider integrations
├── tools/                 # Tool implementations
├── memory/                # Memory management
├── commands/              # Command system
└── runtime/               # Runtime orchestration
```

### Technology Stack
- **Framework**: React + Ink (Terminal UI)
- **Language**: TypeScript
- **Testing**: Jest
- **Build**: TypeScript Compiler
- **CI/CD**: GitLab CI with Auto DevOps

## 🚀 CI/CD Pipeline

### Pipeline Stages
1. **Build**: Compile TypeScript and create artifacts
2. **Test**: Run unit, integration, and e2e tests
3. **Quality**: Code quality, security scanning, performance checks
4. **Deploy**: Automated deployment to staging/production

### Auto DevOps Features
- Container scanning
- Dependency scanning
- SAST (Static Application Security Testing)
- Code quality analysis
- Review apps for merge requests
- Kubernetes deployment support

## 📚 Documentation

- [Installation Guide](wiki/Installation.md)
- [Quick Start Tutorial](wiki/Quick-Start.md)
- [API Reference](docs/api.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Architecture Overview](docs/architecture.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- Code style and standards
- Testing requirements
- Commit message format
- Merge request process

## 📄 License

This project is proprietary software. All rights reserved. See [LICENSE](LICENSE) for details.

## 🔗 Links

- **Repository**: [git.euraika.net/Bert/plato](https://git.euraika.net/Bert/plato)
- **Issues**: [Issue Tracker](https://git.euraika.net/Bert/plato/-/issues)
- **Wiki**: [Project Wiki](https://git.euraika.net/Bert/plato/-/wikis/home)
- **CI/CD**: [Pipelines](https://git.euraika.net/Bert/plato/-/pipelines)

## 🙏 Acknowledgments

Built with modern web technologies and best practices for terminal applications. Special focus on accessibility, performance, and user experience.

---

© 2025 Bert (Owner). All Rights Reserved.