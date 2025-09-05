# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/claude-code-parity/recap.md

> Created: 2025-09-05
> Version: 1.0.0

## Technical Requirements

### Core Architecture Requirements

1. **Memory System Overhaul**
   - Implement persistent memory storage in `.plato/memory/` directory
   - Create `MemoryManager` class to handle memory operations (save, load, compact, delete)
   - Support multiple memory formats: JSON conversations, markdown context files
   - Auto-save functionality with configurable intervals (default: 30 seconds)
   - Memory compaction algorithm to prevent unbounded growth

2. **Custom Commands System**
   - JSON-based command definitions stored in `.plato/commands/` directory
   - Dynamic command loading and registration at runtime
   - Command metadata: name, description, parameters, execution logic
   - Integration with existing slash command processor
   - Support for both simple text substitution and complex JavaScript execution

3. **Output Styles Framework**
   - Extensible style system with built-in styles: default, minimal, verbose, emoji, technical
   - User-defined custom styles stored in `.plato/styles/` directory
   - Style configuration includes: formatting rules, color schemes, verbosity levels
   - Runtime style switching via `/output-style` command
   - Template-based output formatting with variable substitution

4. **Enhanced Session Management**
   - Expanded session state including: memory references, active styles, custom commands
   - Session persistence improvements with atomic writes and backup recovery
   - Session handoff capabilities for multi-session workflows
   - Auto-resume functionality with conversation history restoration

### Implementation Architecture

#### Memory System (`src/memory/`)

**Core Classes:**
- `MemoryManager`: Central memory operations controller
- `MemoryStore`: Abstract storage interface with multiple implementations
- `ConversationMemory`: Handles chat history persistence
- `ContextMemory`: Manages PLATO.md and project context files

**Key Methods:**
```typescript
interface MemoryManager {
  save(key: string, data: any): Promise<void>
  load(key: string): Promise<any>
  delete(key: string): Promise<void>
  compact(strategy: CompactionStrategy): Promise<void>
  list(): Promise<string[]>
}
```

**Storage Strategy:**
- Primary storage: `.plato/memory/` with organized subdirectories
- Backup mechanism: Atomic writes with `.tmp` and `.bak` files
- Indexing: Maintain memory catalog for quick lookups
- Compression: Optional gzip compression for large memory files

#### Custom Commands (`src/commands/`)

**Command Structure:**
```json
{
  "name": "deploy",
  "description": "Deploy application to staging",
  "parameters": ["environment"],
  "template": "kubectl apply -f deployment-{environment}.yaml",
  "type": "shell" | "javascript" | "template"
}
```

**Command Processing:**
- Command discovery from `.plato/commands/` directory
- Runtime registration with existing slash command system
- Parameter validation and substitution
- Execution context with access to session state and memory
- Error handling with rollback capabilities

#### Output Styles (`src/styles/`)

**Style Definition:**
```json
{
  "name": "technical",
  "description": "Technical documentation style",
  "formatting": {
    "codeBlocks": true,
    "lineNumbers": true,
    "syntaxHighlighting": true
  },
  "colors": {
    "primary": "blue",
    "secondary": "gray",
    "accent": "green"
  },
  "verbosity": "detailed"
}
```

**Style Application:**
- Template-based output formatting
- Dynamic style switching without session restart
- Style inheritance and composition
- Context-aware formatting based on content type

### Integration Points

#### TUI Integration (`src/tui/`)
- Memory operations accessible via slash commands
- Custom command execution through keyboard handler
- Style switching with live preview
- Session state display with memory status

#### Runtime Orchestrator (`src/runtime/orchestrator.ts`)
- Memory persistence hooks in conversation flow
- Custom command registration and execution
- Style application in response formatting
- Session state management updates

#### CLI Interface (`src/cli.ts`)
- Direct memory operations: `plato memory list|save|load|delete`
- Custom command management: `plato commands add|remove|list`
- Style operations: `plato styles list|apply|create`
- Session utilities: `plato session backup|restore|clean`

## Approach

### Phase 1: Memory System Foundation
1. Create memory directory structure and core classes
2. Implement basic save/load operations with JSON storage
3. Add memory indexing and catalog management
4. Integrate with existing session persistence
5. Add memory-related slash commands to TUI

### Phase 2: Custom Commands Framework
1. Design command definition schema and validation
2. Implement command discovery and loading mechanism
3. Create command execution engine with parameter substitution
4. Integrate with slash command processor
5. Add command management utilities

### Phase 3: Output Styles System
1. Define style schema and template system
2. Implement style loading and application logic
3. Create built-in styles (default, minimal, verbose, emoji, technical)
4. Add style switching capabilities to TUI
5. Integrate style application in response formatting

### Phase 4: Enhanced Session Management
1. Expand session state to include new features
2. Improve session persistence with atomic operations
3. Add session backup and recovery mechanisms
4. Implement auto-resume with full context restoration
5. Add session handoff capabilities

### Phase 5: Integration and Testing
1. End-to-end testing of all new features
2. Performance optimization and memory usage analysis
3. Documentation updates for new capabilities
4. User experience refinements based on testing
5. Error handling and edge case coverage

## External Dependencies

### New Dependencies
- **fast-json-stable-stringify**: Consistent JSON serialization for memory storage
- **node-cron**: Scheduled operations for memory compaction and cleanup
- **ajv**: JSON schema validation for command and style definitions
- **lodash.template**: Template processing for custom commands and styles
- **pako**: Gzip compression for memory files (optional optimization)

### Enhanced Usage of Existing Dependencies
- **fs-extra**: Extended file operations for memory and command management
- **path**: Enhanced path handling for organized directory structures
- **picocolors**: Extended color support for custom styles
- **yargs**: Additional CLI commands for new features

### System Requirements
- Node.js 18+ (for enhanced file system APIs)
- Sufficient disk space for persistent memory storage
- File system permissions for `.plato/` directory creation and management

### Optional Enhancements
- **chokidar**: File watching for hot-reload of custom commands and styles
- **yaml**: Alternative configuration format support
- **inquirer**: Interactive setup wizards for complex configurations
- **blessed**: Advanced TUI widgets for memory and command browsers

## Performance Considerations

### Memory Management
- Lazy loading of memory files to reduce startup time
- Memory compaction strategies to prevent unbounded growth
- Caching frequently accessed memory items
- Background cleanup of unused memory files

### Custom Commands
- Command caching to avoid repeated parsing
- Asynchronous command execution for long-running operations
- Parameter validation caching
- Command execution timeouts and resource limits

### Output Styles
- Style compilation and caching for performance
- Template pre-processing to reduce runtime overhead
- Minimal style switching overhead
- Efficient color and formatting application

### File System Operations
- Atomic writes to prevent corruption
- Efficient directory scanning and indexing
- Background operations for cleanup and maintenance
- Proper error handling for disk space and permission issues