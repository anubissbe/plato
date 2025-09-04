/**
 * Memory System Types
 * Defines the structure for memory persistence and project context
 */

export interface MemoryEntry {
  /** Unique identifier for the memory entry */
  id: string;
  
  /** Type of memory entry */
  type: 'context' | 'command' | 'session' | 'startup' | 'custom' | 'keyboard-test' | 'test' | 'test1' | 'test2' | 'transcript' | 'mode_change' | 'history_selection' | 'image_paste' | 'image_paste_error';
  
  /** Content of the memory */
  content: string;
  
  /** Timestamp when the memory was created */
  timestamp: string;
  
  /** Optional metadata */
  metadata?: Record<string, any>;
  
  /** Optional tags for categorization */
  tags?: string[];
}

export interface MemoryStore {
  /** All memory entries */
  entries: MemoryEntry[];
  
  /** Current project context from PLATO.md */
  projectContext: string;
  
  /** Session information */
  session?: SessionData;
}

export interface SessionData {
  /** When the session started */
  startTime: string;
  
  /** Commands executed in this session */
  commands: string[];
  
  /** Current working context */
  context: string;
  
  /** Session-specific memories */
  memories?: MemoryEntry[];
}

export interface MemoryManagerOptions {
  /** Base directory for memory storage (default: .plato/memory) */
  memoryDir?: string;
  
  /** Path to PLATO.md file (default: PLATO.md) */
  platoFile?: string;
  
  /** Maximum number of memory entries to keep (default: 1000) */
  maxEntries?: number;
  
  /** Whether to auto-load memories on startup (default: true) */
  autoLoad?: boolean;
  
  /** Whether to auto-save memories (default: true) */
  autoSave?: boolean;
  
  /** Auto-save interval in milliseconds (default: 30000) */
  autoSaveInterval?: number;
}

export interface MemorySearchOptions {
  /** Search query */
  query: string;
  
  /** Filter by type */
  type?: MemoryEntry['type'];
  
  /** Filter by tags */
  tags?: string[];
  
  /** Maximum results to return */
  limit?: number;
  
  /** Sort order */
  sortBy?: 'timestamp' | 'relevance';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface PlatoFileSection {
  /** Section heading */
  heading: string;
  
  /** Section content */
  content: string;
  
  /** Section level (1-6) */
  level: number;
}

export interface MemoryStatistics {
  /** Total number of memories */
  totalMemories: number;
  
  /** Memories by type */
  byType: Record<string, number>;
  
  /** Disk space used in bytes */
  diskUsage: number;
  
  /** Oldest memory timestamp */
  oldestMemory?: string;
  
  /** Newest memory timestamp */
  newestMemory?: string;
}

export interface MemoryImportExportOptions {
  /** Include project context */
  includeContext?: boolean;
  
  /** Include session data */
  includeSession?: boolean;
  
  /** Filter by date range */
  dateRange?: {
    start?: string;
    end?: string;
  };
  
  /** Filter by types */
  types?: MemoryEntry['type'][];
  
  /** Format for export */
  format?: 'json' | 'markdown';
}