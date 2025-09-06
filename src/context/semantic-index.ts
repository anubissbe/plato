/**
 * Semantic Index Engine for Advanced Context Management
 * Provides lightweight semantic understanding of codebase structure and relationships
 */

import * as crypto from 'crypto';
import {
  FileIndex,
  SymbolInfo,
  SymbolType,
  SymbolReference,
  ImportGraph,
  SemanticIndexData,
  FileAnalyzerOptions
} from './types';

/**
 * Symbol extraction from source code
 */
export class SymbolExtractor {
  /**
   * Extract symbols from code content based on language
   */
  extractSymbols(content: string, language: string): SymbolInfo[] {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'tsx':
        return this.extractTypeScriptSymbols(content);
      case 'javascript':
      case 'jsx':
        return this.extractJavaScriptSymbols(content);
      case 'python':
        return this.extractPythonSymbols(content);
      case 'go':
        return this.extractGoSymbols(content);
      default:
        return [];
    }
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'java':
        return 'java';
      default:
        return 'unknown';
    }
  }

  private extractTypeScriptSymbols(content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');

    // Regular expressions for TypeScript/JavaScript symbols
    const patterns = {
      class: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      interface: /(?:export\s+)?interface\s+(\w+)/,
      type: /(?:export\s+)?type\s+(\w+)/,
      enum: /(?:export\s+)?enum\s+(\w+)/,
      function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      arrowFunc: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
      variable: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
      namespace: /(?:export\s+)?namespace\s+(\w+)/,
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Check for class
      let match = patterns.class.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Class,
          line: index + 1,
          exported: line.includes('export'),
          members: this.extractClassMembers(content, index)
        });
        return;
      }

      // Check for interface
      match = patterns.interface.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Interface,
          line: index + 1,
          exported: line.includes('export')
        });
        return;
      }

      // Check for type alias
      match = patterns.type.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Type,
          line: index + 1,
          exported: line.includes('export')
        });
        return;
      }

      // Check for enum
      match = patterns.enum.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Enum,
          line: index + 1,
          exported: line.includes('export')
        });
        return;
      }

      // Check for function
      match = patterns.function.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Function,
          line: index + 1,
          exported: line.includes('export')
        });
        return;
      }

      // Check for arrow function
      match = patterns.arrowFunc.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Function,
          line: index + 1,
          exported: line.includes('export')
        });
        return;
      }

      // Check for variable (only if not already matched as arrow function)
      if (!patterns.arrowFunc.test(line)) {
        match = patterns.variable.exec(line);
        if (match) {
          symbols.push({
            name: match[1],
            type: SymbolType.Variable,
            line: index + 1,
            exported: line.includes('export')
          });
          return;
        }
      }

      // Check for namespace
      match = patterns.namespace.exec(line);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Namespace,
          line: index + 1,
          exported: line.includes('export')
        });
      }
    });

    return symbols;
  }

  private extractJavaScriptSymbols(content: string): SymbolInfo[] {
    // Similar to TypeScript but without type-specific constructs
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');

    const patterns = {
      class: /(?:export\s+)?class\s+(\w+)/,
      function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      arrowFunc: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
      variable: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Check patterns similar to TypeScript
      for (const [type, pattern] of Object.entries(patterns)) {
        const match = pattern.exec(line);
        if (match) {
          const symbolType = type === 'class' ? SymbolType.Class :
                            type === 'function' || type === 'arrowFunc' ? SymbolType.Function :
                            SymbolType.Variable;
          
          symbols.push({
            name: match[1],
            type: symbolType,
            line: index + 1,
            exported: line.includes('export') || line.includes('module.exports')
          });
          break;
        }
      }
    });

    return symbols;
  }

  private extractPythonSymbols(content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');

    const patterns = {
      class: /^class\s+(\w+)/,
      function: /^(?:async\s+)?def\s+(\w+)/,
      variable: /^([A-Z_][A-Z0-9_]*)\s*=/,  // Only match uppercase constants
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      // Check for class
      let match = patterns.class.exec(trimmedLine);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Class,
          line: index + 1,
          exported: true // Python doesn't have explicit exports
        });
        return;
      }

      // Check for function
      match = patterns.function.exec(trimmedLine);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Function,
          line: index + 1,
          exported: !match[1].startsWith('_') // Convention: _ prefix means private
        });
        return;
      }

      // Check for constant variable (uppercase)
      match = patterns.variable.exec(trimmedLine);
      if (match) {
        symbols.push({
          name: match[1],
          type: SymbolType.Variable,
          line: index + 1,
          exported: true
        });
      }
    });

    return symbols;
  }

  private extractGoSymbols(content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');

    const patterns = {
      type: /^type\s+(\w+)/,
      function: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/,
      variable: /^(?:var|const)\s+(\w+)/,
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('//')) {
        return;
      }

      for (const [type, pattern] of Object.entries(patterns)) {
        const match = pattern.exec(trimmedLine);
        if (match) {
          const symbolType = type === 'type' ? SymbolType.Type :
                            type === 'function' ? SymbolType.Function :
                            SymbolType.Variable;
          
          // In Go, exported symbols start with uppercase
          const isExported = match[1][0] === match[1][0].toUpperCase();
          
          symbols.push({
            name: match[1],
            type: symbolType,
            line: index + 1,
            exported: isExported
          });
          break;
        }
      }
    });

    return symbols;
  }

  private extractClassMembers(content: string, classStartLine: number): SymbolInfo[] {
    const members: SymbolInfo[] = [];
    const lines = content.split('\n');
    
    let braceCount = 0;
    let inClass = false;

    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      
      // Track braces to know when class ends
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inClass = true;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && inClass) {
            return members;
          }
        }
      }

      if (!inClass) continue;

      // Look for class members
      const propertyMatch = /^\s+((?:private|public|protected|readonly)\s+)?(\w+)(?:\?)?:/?.exec(line);
      if (propertyMatch) {
        members.push({
          name: propertyMatch[2],
          type: SymbolType.Property,
          line: i + 1,
          exported: false
        });
      }

      const methodMatch = /^\s+((?:private|public|protected|async)\s+)?(\w+)\s*\([^)]*\)/.exec(line);
      if (methodMatch && methodMatch[2] !== 'constructor') {
        members.push({
          name: methodMatch[2],
          type: SymbolType.Method,
          line: i + 1,
          exported: false
        });
      }
    }

    return members;
  }
}

/**
 * File analyzer for extracting semantic information
 */
export class FileAnalyzer {
  private symbolExtractor: SymbolExtractor;

  constructor() {
    this.symbolExtractor = new SymbolExtractor();
  }

  /**
   * Analyze a file and extract semantic information
   */
  async analyzeFile(filePath: string, content: string, options?: FileAnalyzerOptions): Promise<FileIndex> {
    const language = this.symbolExtractor.detectLanguage(filePath);
    const symbols = this.symbolExtractor.extractSymbols(content, language);
    const imports = this.extractImports(content, language);
    const exports = this.extractExports(content, language, symbols);
    const hash = this.calculateHash(content);

    return {
      path: filePath,
      symbols,
      imports,
      exports,
      hash,
      size: content.length,
      lastModified: new Date()
    };
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // ES6 imports - including type imports
      const importRegex = /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // CommonJS requires
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } else if (language === 'python') {
      // Python imports
      const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    } else if (language === 'go') {
      // Go imports
      const importRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) {
          // Multiple imports
          const multiImports = match[1].match(/"[^"]+"/g);
          if (multiImports) {
            multiImports.forEach(imp => imports.push(imp.replace(/"/g, '')));
          }
        } else if (match[2]) {
          // Single import
          imports.push(match[2]);
        }
      }
    }

    return [...new Set(imports)]; // Remove duplicates
  }

  private extractExports(content: string, language: string, symbols: SymbolInfo[]): string[] {
    const exports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Named exports from symbols
      symbols.forEach(symbol => {
        if (symbol.exported) {
          exports.push(symbol.name);
        }
      });

      // Re-exports
      const reExportRegex = /export\s+\{([^}]+)\}\s+from/g;
      let match;
      while ((match = reExportRegex.exec(content)) !== null) {
        const items = match[1].split(',').map(item => {
          const parts = item.trim().split(/\s+as\s+/);
          return parts[parts.length - 1]; // Use alias if present
        });
        exports.push(...items);
      }

      // Default export
      if (/export\s+default/.test(content)) {
        exports.push('default');
      }

      // Export all
      if (/export\s+\*\s+from/.test(content)) {
        exports.push('*');
      }
    }

    return [...new Set(exports)];
  }

  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}

/**
 * Main semantic index for managing file relationships and symbols
 */
export class SemanticIndex {
  private files: Map<string, FileIndex>;
  private symbols: Map<string, SymbolReference[]>;
  private imports: Map<string, ImportGraph>;
  private lastUpdated: Date;

  constructor() {
    this.files = new Map();
    this.symbols = new Map();
    this.imports = new Map();
    this.lastUpdated = new Date();
  }

  /**
   * Add or update a file in the index
   */
  async addFile(fileIndex: FileIndex): Promise<void> {
    // Remove old symbol references if file exists
    if (this.files.has(fileIndex.path)) {
      this.removeFileSymbols(fileIndex.path);
    }

    // Add file to index
    this.files.set(fileIndex.path, fileIndex);

    // Update symbol references
    fileIndex.symbols.forEach(symbol => {
      if (!this.symbols.has(symbol.name)) {
        this.symbols.set(symbol.name, []);
      }
      this.symbols.get(symbol.name)!.push({
        file: fileIndex.path,
        line: symbol.line,
        type: symbol.type,
        exported: symbol.exported
      });
    });

    // Update import graph
    this.updateImportGraph(fileIndex);
    
    this.lastUpdated = new Date();
  }

  /**
   * Remove a file from the index
   */
  removeFile(filePath: string): void {
    if (!this.files.has(filePath)) {
      return;
    }

    this.removeFileSymbols(filePath);
    this.files.delete(filePath);
    this.imports.delete(filePath);
    
    // Remove from importedBy in other files
    this.imports.forEach(graph => {
      const index = graph.importedBy.indexOf(filePath);
      if (index !== -1) {
        graph.importedBy.splice(index, 1);
      }
    });

    this.lastUpdated = new Date();
  }

  /**
   * Check if a file exists in the index
   */
  hasFile(filePath: string): boolean {
    return this.files.has(filePath);
  }

  /**
   * Get file index data
   */
  getFile(filePath: string): FileIndex | undefined {
    return this.files.get(filePath);
  }

  /**
   * Get all files in the index
   */
  getAllFiles(): FileIndex[] {
    return Array.from(this.files.values());
  }

  /**
   * Get symbol references
   */
  getSymbolReferences(symbolName: string): SymbolReference[] {
    return this.symbols.get(symbolName) || [];
  }

  /**
   * Build import graph for dependency analysis
   */
  buildImportGraph(): Map<string, ImportGraph> {
    const graph = new Map<string, ImportGraph>();

    // Initialize graph for all files
    this.files.forEach((fileIndex, filePath) => {
      graph.set(filePath, {
        imports: fileIndex.imports,
        importedBy: []
      });
    });

    // Build importedBy relationships
    this.files.forEach((fileIndex, filePath) => {
      fileIndex.imports.forEach(importPath => {
        // Resolve relative imports
        const resolvedPath = this.resolveImportPath(filePath, importPath);
        if (graph.has(resolvedPath)) {
          graph.get(resolvedPath)!.importedBy.push(filePath);
        }
      });
    });

    return graph;
  }

  /**
   * Serialize index for storage
   */
  serialize(): string {
    const data: SemanticIndexData = {
      files: this.files,
      symbols: this.symbols,
      imports: this.imports,
      lastUpdated: this.lastUpdated
    };

    return JSON.stringify(data, (key, value) => {
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      return value;
    });
  }

  /**
   * Deserialize index from storage
   */
  static deserialize(data: string): SemanticIndex {
    const parsed = JSON.parse(data, (key, value) => {
      if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 2) {
        return new Map(value);
      }
      return value;
    });

    const index = new SemanticIndex();
    index.files = parsed.files;
    index.symbols = parsed.symbols;
    index.imports = parsed.imports;
    index.lastUpdated = new Date(parsed.lastUpdated);

    return index;
  }

  private removeFileSymbols(filePath: string): void {
    const fileIndex = this.files.get(filePath);
    if (!fileIndex) return;

    // Remove symbol references for this file
    fileIndex.symbols.forEach(symbol => {
      const references = this.symbols.get(symbol.name);
      if (references) {
        const filtered = references.filter(ref => ref.file !== filePath);
        if (filtered.length > 0) {
          this.symbols.set(symbol.name, filtered);
        } else {
          this.symbols.delete(symbol.name);
        }
      }
    });
  }

  private updateImportGraph(fileIndex: FileIndex): void {
    this.imports.set(fileIndex.path, {
      imports: fileIndex.imports,
      importedBy: []
    });

    // Update importedBy for imported files
    fileIndex.imports.forEach(importPath => {
      const resolvedPath = this.resolveImportPath(fileIndex.path, importPath);
      const importGraph = this.imports.get(resolvedPath);
      if (importGraph && !importGraph.importedBy.includes(fileIndex.path)) {
        importGraph.importedBy.push(fileIndex.path);
      }
    });
  }

  private resolveImportPath(fromFile: string, importPath: string): string {
    // Simple resolution - in real implementation would need proper module resolution
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import
      const parts = fromFile.split('/');
      parts.pop(); // Remove filename
      const importParts = importPath.split('/');
      
      importParts.forEach(part => {
        if (part === '..') {
          parts.pop();
        } else if (part !== '.') {
          parts.push(part);
        }
      });

      // Add common extensions if not present
      const resolvedPath = parts.join('/');
      if (!resolvedPath.match(/\.\w+$/)) {
        // Try common extensions
        for (const ext of ['.ts', '.js', '.tsx', '.jsx']) {
          const withExt = resolvedPath + ext;
          if (this.files.has(withExt)) {
            return withExt;
          }
        }
      }
      
      return resolvedPath;
    }
    
    // Node module or absolute import
    return importPath;
  }
}