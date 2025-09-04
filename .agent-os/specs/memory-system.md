# Memory System Specification

## Overview

The memory system must provide persistent storage of conversation context, project understanding, and user preferences, exactly matching Claude Code's memory behavior.

## Requirements

### Storage Location
- **Directory**: `.plato/memory/`
- **Format**: JSON files with automatic rotation
- **Size Limit**: 10MB per memory file with compression

### Memory Schema

```typescript
interface MemorySystem {
  // Conversation memory across sessions
  conversations: {
    current: ConversationMemory;
    history: ConversationMemory[];
    maxHistory: 10; // Keep last 10 conversations
  };
  
  // Project understanding
  project: {
    structure: ProjectStructure;
    dependencies: DependencyMap;
    patterns: CodePatterns;
    lastUpdated: Date;
  };
  
  // User preferences learned over time
  preferences: {
    codeStyle: StylePreferences;
    commonCommands: string[];
    workingDirectories: string[];
    frequentFiles: FileAccessPattern[];
  };
}

interface ConversationMemory {
  id: string;
  timestamp: Date;
  messages: Message[];
  context: string[]; // File paths
  metrics: {
    inputTokens: number;
    outputTokens: number;
    duration: number;
  };
  insights: string[]; // Key learnings
}

interface ProjectStructure {
  rootPath: string;
  fileTree: FileNode[];
  entryPoints: string[];
  testDirectories: string[];
  configFiles: string[];
}
```

## Implementation

### File Structure
```
.plato/memory/
├── current.json      # Active conversation memory
├── project.json      # Project understanding
├── preferences.json  # User preferences
└── history/         # Historical conversations
    ├── 2024-01-15-001.json
    ├── 2024-01-15-002.json
    └── ...
```

### API Methods

```typescript
class MemoryManager {
  // Load memory on startup
  async loadMemory(): Promise<MemorySystem>;
  
  // Save current state
  async saveMemory(memory: Partial<MemorySystem>): Promise<void>;
  
  // Get specific memory
  async getMemory(type: 'conversation' | 'project' | 'preferences'): Promise<any>;
  
  // Clear memory with optional type filter
  async clearMemory(type?: string): Promise<void>;
  
  // Rotate old memories
  async rotateMemory(): Promise<void>;
  
  // Compress memories over size limit
  async compressMemory(): Promise<void>;
}
```

## Behavior

### Auto-Save Triggers
1. After each assistant response
2. On session end
3. Every 5 minutes during active use
4. Before clearing or rotating

### Memory Rotation
1. When current.json exceeds 1MB
2. After 24 hours of conversation
3. On explicit user request
4. Keep max 10 historical conversations

### Compression Strategy
1. Remove redundant context entries
2. Summarize old conversations
3. Compress JSON with gzip when > 5MB
4. Archive to history/ when compressed

## Integration Points

### With Orchestrator
```typescript
// In orchestrator.ts
async getMemory(): Promise<any> {
  return await memoryManager.getMemory('conversation');
}

async clearMemory(): Promise<void> {
  await memoryManager.clearMemory('conversation');
}
```

### With Session Manager
```typescript
// Auto-save on response
orchestrator.on('response', async (data) => {
  await memoryManager.saveMemory({
    conversations: {
      current: getCurrentConversation()
    }
  });
});
```

### With Context Manager
```typescript
// Track file access patterns
contextManager.on('fileAccess', async (path) => {
  await memoryManager.updatePreferences({
    frequentFiles: addFileAccess(path)
  });
});
```

## Claude Code Compatibility

### Import/Export Format
Must be able to import Claude Code memory exports:
```json
{
  "version": "1.0",
  "type": "claude-code-memory",
  "data": { /* memory contents */ }
}
```

### Migration Path
1. Detect `.claude/memory/` directory
2. Import existing memories
3. Convert to Plato format
4. Maintain compatibility layer

## Testing Requirements

1. **Persistence Tests**
   - Save and load memory across restarts
   - Verify data integrity
   - Test rotation and compression

2. **Performance Tests**
   - Memory operations < 100ms
   - No blocking during saves
   - Efficient compression

3. **Compatibility Tests**
   - Import Claude Code memories
   - Export in compatible format
   - Round-trip without data loss

## Success Criteria

- [ ] Memory persists across sessions
- [ ] Auto-save works reliably
- [ ] Rotation prevents unbounded growth
- [ ] Compatible with Claude Code format
- [ ] Performance within 100ms
- [ ] No data loss on crashes