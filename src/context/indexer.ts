/**
 * Enhanced indexer with semantic analysis capabilities
 */
import fg from 'fast-glob';
import path from 'path';
import fs from 'fs/promises';
import ignore from 'ignore';
import { FileAnalyzer, SemanticIndex } from './semantic-index';
import { IndexingOptions, FileIndex } from './types';

// Keep the original buildIndex function for compatibility
export async function buildIndex(opts: { roots: string[] }) {
  const entries: { path: string; size: number }[] = [];
  for (const root of opts.roots) {
    const ig = ignore();
    for (const file of ['.gitignore', '.platoignore']) {
      try {
        const txt = await fs.readFile(path.join(root, file), 'utf8');
        ig.add(txt);
      } catch {}
    }
    const files = await fg(['**/*'], { cwd: root, dot: false, followSymbolicLinks: false });
    for (const rel of files) {
      const abs = path.join(root, rel);
      if (ig.ignores(rel)) continue;
      try {
        const st = await fs.stat(abs);
        if (!st.isFile()) continue;
        entries.push({ path: abs, size: st.size });
      } catch {}
    }
  }
  return entries;
}

/**
 * Advanced semantic indexer with configurable options
 */
export class SemanticIndexer {
  private analyzer: FileAnalyzer;
  private index: SemanticIndex;
  private options: Required<IndexingOptions>;
  private indexPath: string;
  private ig: ReturnType<typeof ignore>;

  constructor(options?: IndexingOptions) {
    this.analyzer = new FileAnalyzer();
    this.index = new SemanticIndex();
    this.options = this.normalizeOptions(options);
    this.indexPath = path.join('.plato', 'semantic-index.json');
    this.ig = ignore();
  }

  /**
   * Index directories with semantic analysis
   */
  async indexDirectories(roots: string[]): Promise<void> {
    for (const root of roots) {
      await this.indexDirectory(root);
    }
  }

  /**
   * Index a single directory
   */
  async indexDirectory(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > this.options.maxDepth) {
      return;
    }

    // Load ignore patterns
    await this.loadIgnorePatterns(dirPath);

    const patterns = this.buildGlobPatterns();
    const files = await fg(patterns, {
      cwd: dirPath,
      absolute: true,
      ignore: this.options.excludePatterns,
      followSymbolicLinks: false,
      deep: this.options.maxDepth - depth,
      dot: false
    });

    // Process files in batches
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(file => this.indexFile(file)));
    }
  }

  /**
   * Index a single file with semantic analysis
   */
  async indexFile(filePath: string): Promise<void> {
    try {
      // Check if file should be indexed
      if (!this.shouldIndexFile(filePath)) {
        return;
      }

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.options.maxFileSize!) {
        return;
      }

      // Check if file needs re-indexing
      const existingIndex = this.index.getFile(filePath);
      if (existingIndex) {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileIndex = await this.analyzer.analyzeFile(filePath, content);
        
        if (existingIndex.hash === fileIndex.hash) {
          return; // File hasn't changed
        }
      }

      // Analyze and index file
      const content = await fs.readFile(filePath, 'utf-8');
      const fileIndex = await this.analyzer.analyzeFile(filePath, content);
      await this.index.addFile(fileIndex);
    } catch (error) {
      // Silently skip files that can't be indexed
    }
  }

  /**
   * Load index from storage
   */
  async loadIndex(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = SemanticIndex.deserialize(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save index to storage
   */
  async saveIndex(): Promise<void> {
    const dir = path.dirname(this.indexPath);
    await fs.mkdir(dir, { recursive: true });
    const data = this.index.serialize();
    await fs.writeFile(this.indexPath, data, 'utf-8');
  }

  /**
   * Get the semantic index
   */
  getIndex(): SemanticIndex {
    return this.index;
  }

  /**
   * Clear the index
   */
  clearIndex(): void {
    this.index = new SemanticIndex();
  }

  /**
   * Get indexing statistics
   */
  getStats(): {
    totalFiles: number;
    totalSymbols: number;
    indexSize: number;
  } {
    const files = this.index.getAllFiles();
    let totalSymbols = 0;
    let indexSize = 0;

    files.forEach(file => {
      totalSymbols += file.symbols.length;
      indexSize += file.size;
    });

    return {
      totalFiles: files.length,
      totalSymbols,
      indexSize
    };
  }

  private async loadIgnorePatterns(dirPath: string): Promise<void> {
    for (const file of ['.gitignore', '.platoignore']) {
      try {
        const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
        this.ig.add(content);
      } catch {
        // Ignore file doesn't exist
      }
    }
  }

  private normalizeOptions(options?: IndexingOptions): Required<IndexingOptions> {
    return {
      maxDepth: options?.maxDepth ?? 10,
      includeTests: options?.includeTests ?? false,
      includeNodeModules: options?.includeNodeModules ?? false,
      fileExtensions: options?.fileExtensions ?? [
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
        '.py', '.go', '.rs', '.java'
      ],
      excludePatterns: options?.excludePatterns ?? [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ],
      maxFileSize: options?.maxFileSize ?? 1024 * 1024 // 1MB
    };
  }

  private buildGlobPatterns(): string[] {
    return this.options.fileExtensions.map(ext => `**/*${ext}`);
  }

  private shouldIndexFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check extension
    if (!this.options.fileExtensions.includes(ext)) {
      return false;
    }

    // Check ignore patterns
    const relativePath = path.relative(process.cwd(), filePath);
    if (this.ig.ignores(relativePath)) {
      return false;
    }

    // Check test files
    if (!this.options.includeTests) {
      const basename = path.basename(filePath);
      if (basename.includes('.test.') || basename.includes('.spec.')) {
        return false;
      }
    }

    return true;
  }
}

