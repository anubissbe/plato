import fs from 'fs/promises';
import path from 'path';
import {
  MemoryEntry,
  MemoryStore,
  SessionData,
  MemoryManagerOptions,
  MemorySearchOptions,
  PlatoFileSection,
  MemoryStatistics,
} from './types.js';

/**
 * MemoryManager - Manages memory persistence and project context
 */
export class MemoryManager {
  private options: Required<MemoryManagerOptions>;
  private memoryStore: MemoryStore;
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(options: MemoryManagerOptions = {}) {
    this.options = {
      memoryDir: options.memoryDir || '.plato/memory',
      platoFile: options.platoFile || 'PLATO.md',
      maxEntries: options.maxEntries || 1000,
      autoLoad: options.autoLoad !== undefined ? options.autoLoad : true,
      autoSave: options.autoSave !== undefined ? options.autoSave : true,
      autoSaveInterval: options.autoSaveInterval || 30000,
    };

    this.memoryStore = {
      entries: [],
      projectContext: '',
    };
  }

  /**
   * Initialize the memory manager
   */
  async initialize(): Promise<void> {
    // Create memory directory if it doesn't exist
    try {
      await fs.access(this.options.memoryDir);
    } catch {
      await fs.mkdir(this.options.memoryDir, { recursive: true });
    }

    // Load PLATO.md if it exists
    try {
      const platoContent = await fs.readFile(this.options.platoFile, 'utf8');
      this.memoryStore.projectContext = platoContent;
    } catch {
      // PLATO.md doesn't exist yet, that's ok
    }

    // Auto-load memories if enabled
    if (this.options.autoLoad) {
      await this.loadAllMemories();
      await this.restoreSession();
    }

    // Start auto-save timer if enabled
    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Add a memory entry
   */
  async addMemory(entry: MemoryEntry): Promise<void> {
    // Add to store
    this.memoryStore.entries.push(entry);

    // Save to disk
    const filePath = path.join(this.options.memoryDir, `${entry.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');

    // Check if we need to cleanup old memories
    await this.enforceMaxEntries();
  }

  /**
   * Get all memories
   */
  async getAllMemories(): Promise<MemoryEntry[]> {
    return this.memoryStore.entries;
  }

  /**
   * Load all memories from disk
   */
  private async loadAllMemories(): Promise<void> {
    try {
      const files = await fs.readdir(this.options.memoryDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'session.json');

      this.memoryStore.entries = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.options.memoryDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const entry = JSON.parse(content) as MemoryEntry;
          this.memoryStore.entries.push(entry);
        } catch {
          // Skip invalid files
        }
      }

      // Sort by timestamp
      this.memoryStore.entries.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch {
      // Directory doesn't exist yet
    }
  }

  /**
   * Clear all memories
   */
  async clearAllMemories(): Promise<void> {
    try {
      const files = await fs.readdir(this.options.memoryDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'session.json') {
          await fs.unlink(path.join(this.options.memoryDir, file));
        }
      }

      this.memoryStore.entries = [];
    } catch {
      // Directory doesn't exist
    }
  }

  /**
   * Search memories by content
   */
  async searchMemories(query: string): Promise<MemoryEntry[]> {
    const lowerQuery = query.toLowerCase();
    return this.memoryStore.entries.filter(entry =>
      entry.content.toLowerCase().includes(lowerQuery) ||
      entry.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get memories by type
   */
  async getMemoriesByType(type: MemoryEntry['type']): Promise<MemoryEntry[]> {
    return this.memoryStore.entries.filter(entry => entry.type === type);
  }

  /**
   * Enforce maximum entries limit
   */
  private async enforceMaxEntries(): Promise<void> {
    if (this.memoryStore.entries.length > this.options.maxEntries) {
      // Sort by timestamp and remove oldest
      this.memoryStore.entries.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const toRemove = this.memoryStore.entries.slice(
        0,
        this.memoryStore.entries.length - this.options.maxEntries
      );

      for (const entry of toRemove) {
        const filePath = path.join(this.options.memoryDir, `${entry.id}.json`);
        try {
          await fs.unlink(filePath);
        } catch {
          // File might not exist
        }
      }

      this.memoryStore.entries = this.memoryStore.entries.slice(-this.options.maxEntries);
    }
  }

  /**
   * Save PLATO.md file
   */
  async savePlatoFile(content: string): Promise<void> {
    await fs.writeFile(this.options.platoFile, content, 'utf8');
    this.memoryStore.projectContext = content;
  }

  /**
   * Get project context from PLATO.md
   */
  async getProjectContext(): Promise<string> {
    return this.memoryStore.projectContext;
  }

  /**
   * Update project context
   */
  async updateProjectContext(content: string): Promise<void> {
    await this.savePlatoFile(content);
  }

  /**
   * Append to PLATO.md file
   */
  async appendToPlatoFile(content: string): Promise<void> {
    const existing = this.memoryStore.projectContext || '';
    await this.savePlatoFile(existing + content);
  }

  /**
   * Save session data
   */
  async saveSession(data: SessionData): Promise<void> {
    this.memoryStore.session = data;
    const sessionPath = path.join(this.options.memoryDir, 'session.json');
    await fs.writeFile(sessionPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Restore session data
   */
  async restoreSession(): Promise<SessionData | null> {
    try {
      const sessionPath = path.join(this.options.memoryDir, 'session.json');
      const content = await fs.readFile(sessionPath, 'utf8');
      const session = JSON.parse(content) as SessionData;
      this.memoryStore.session = session;
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      await this.saveCurrentState();
    }, this.options.autoSaveInterval);
  }

  /**
   * Save current state
   */
  private async saveCurrentState(): Promise<void> {
    // Save session if it exists
    if (this.memoryStore.session) {
      await this.saveSession(this.memoryStore.session);
    }

    // Project context is already saved when updated
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Get memory statistics
   */
  async getStatistics(): Promise<MemoryStatistics> {
    const byType: Record<string, number> = {};
    
    for (const entry of this.memoryStore.entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }

    const timestamps = this.memoryStore.entries
      .map(e => new Date(e.timestamp).getTime())
      .sort((a, b) => a - b);

    return {
      totalMemories: this.memoryStore.entries.length,
      byType,
      diskUsage: 0, // Would need to calculate actual disk usage
      oldestMemory: timestamps[0] ? new Date(timestamps[0]).toISOString() : undefined,
      newestMemory: timestamps[timestamps.length - 1] 
        ? new Date(timestamps[timestamps.length - 1]).toISOString() 
        : undefined,
    };
  }

  /**
   * Export memories
   */
  async exportMemories(format: 'json' | 'markdown' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify({
        memories: this.memoryStore.entries,
        projectContext: this.memoryStore.projectContext,
        session: this.memoryStore.session,
      }, null, 2);
    } else {
      let markdown = '# Memory Export\n\n';
      markdown += '## Project Context\n\n';
      markdown += this.memoryStore.projectContext || 'No project context available.\n';
      markdown += '\n## Memories\n\n';
      
      for (const entry of this.memoryStore.entries) {
        markdown += `### ${entry.type}: ${entry.id}\n`;
        markdown += `**Timestamp**: ${entry.timestamp}\n\n`;
        markdown += `${entry.content}\n\n`;
        if (entry.tags?.length) {
          markdown += `**Tags**: ${entry.tags.join(', ')}\n\n`;
        }
        markdown += '---\n\n';
      }
      
      return markdown;
    }
  }

  /**
   * Import memories
   */
  async importMemories(data: string, format: 'json' | 'markdown' = 'json'): Promise<void> {
    if (format === 'json') {
      const imported = JSON.parse(data);
      
      if (imported.memories) {
        for (const entry of imported.memories) {
          await this.addMemory(entry);
        }
      }
      
      if (imported.projectContext) {
        await this.savePlatoFile(imported.projectContext);
      }
      
      if (imported.session) {
        await this.saveSession(imported.session);
      }
    } else {
      throw new Error('Markdown import not yet implemented');
    }
  }

  /**
   * Parse PLATO.md into sections
   */
  parsePlatoFile(): PlatoFileSection[] {
    const sections: PlatoFileSection[] = [];
    const lines = this.memoryStore.projectContext.split('\n');
    let currentSection: PlatoFileSection | null = null;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: headingMatch[2],
          level: headingMatch[1].length,
          content: '',
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }
}