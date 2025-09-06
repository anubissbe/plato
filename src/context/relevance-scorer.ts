/**
 * Intelligent File Relevance Scorer for Advanced Context Management
 * Scores files based on multiple factors to determine relevance to current context
 */

import { SemanticIndex } from './semantic-index';
import { RelevanceScore, RelevanceReason, FileIndex } from './types';
import * as path from 'path';

export interface ScoringContext {
  currentFile: string;
  recentFiles: string[];
  userQuery: string;
}

export interface ScoringOptions {
  minScore?: number;
  maxFiles?: number;
}

interface UserHistory {
  [contextFile: string]: string[];
}

/**
 * Scores file relevance based on multiple factors
 */
export class FileRelevanceScorer {
  private userHistory: UserHistory = {};
  private readonly MAX_HISTORY_SIZE = 500;
  private readonly HISTORY_LIMIT_PER_CONTEXT = 20;

  constructor(private index: SemanticIndex) {}

  /**
   * Score a single file's relevance
   */
  scoreFile(filePath: string, context: ScoringContext): RelevanceScore {
    const reasons: RelevanceReason[] = [];
    let score = 0;
    let confidence = 0.5;

    // Direct reference scoring (highest weight)
    const directScore = this.scoreDirectReference(filePath, context.currentFile);
    if (directScore > 0) {
      score += directScore * 85;  // Increased from 40 to 85
      reasons.push('direct_reference');
      confidence = Math.max(confidence, 0.9);
    }

    // Symbol matching
    const symbolScore = this.scoreSymbolMatch(filePath, context.userQuery);
    if (symbolScore > 0) {
      score += symbolScore * 65;  // Increased from 25 to 65
      reasons.push('symbol_match');
      confidence = Math.max(confidence, 0.75);
    }

    // Import chain distance
    const chainScore = this.scoreImportChain(filePath, context.currentFile);
    if (chainScore > 0) {
      score += chainScore * 40;  // Increased from 20 to 40
      reasons.push('import_chain');
      confidence = Math.max(confidence, 0.7);
    }

    // Recent access
    if (context.recentFiles.includes(filePath)) {
      const recencyBoost = 30 * (1 - context.recentFiles.indexOf(filePath) / context.recentFiles.length);  // Increased from 15 to 30
      score += recencyBoost;
      reasons.push('recent_access');
      confidence = Math.max(confidence, 0.6);
    }

    // User patterns
    const patternScore = this.scoreUserPattern(filePath, context.currentFile);
    if (patternScore > 0) {
      score += patternScore * 35;  // Increased from 10 to 35
      reasons.push('user_pattern');
    }

    // Size penalty for large utility files
    const sizePenalty = this.calculateSizePenalty(filePath);
    score *= (1 - sizePenalty);

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      file: filePath,
      score: Math.round(score),
      reasons,
      confidence
    };
  }

  /**
   * Score multiple files and return sorted by relevance
   */
  scoreMultipleFiles(
    files: string[], 
    context: ScoringContext,
    options?: ScoringOptions
  ): RelevanceScore[] {
    const scores = files.map(file => this.scoreFile(file, context));
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Apply filters
    let filtered = scores;
    if (options?.minScore !== undefined) {
      filtered = filtered.filter(s => s.score >= options.minScore!);
    }
    if (options?.maxFiles !== undefined) {
      filtered = filtered.slice(0, options.maxFiles);
    }

    return filtered;
  }

  /**
   * Add a file access to user history
   */
  addToHistory(accessedFile: string, contextFile: string): void {
    if (!this.userHistory[contextFile]) {
      this.userHistory[contextFile] = [];
    }

    const history = this.userHistory[contextFile];
    
    // Add to history if not already recent
    if (!history.includes(accessedFile)) {
      history.unshift(accessedFile);
      
      // Limit history size per context
      if (history.length > this.HISTORY_LIMIT_PER_CONTEXT) {
        history.pop();
      }
    }

    // Limit total history size
    this.pruneHistory();
  }

  /**
   * Get user history for analysis
   */
  getUserHistory(): UserHistory {
    return { ...this.userHistory };
  }

  /**
   * Clear user history
   */
  clearHistory(): void {
    this.userHistory = {};
  }

  private scoreDirectReference(targetFile: string, currentFile: string): number {
    const currentIndex = this.index.getFile(currentFile);
    if (!currentIndex) return 0;

    // Check if current file imports target
    // Match both exact paths and relative imports
    const targetBasename = path.basename(targetFile, path.extname(targetFile));
    const targetDir = path.dirname(targetFile);
    
    for (const imp of currentIndex.imports) {
      // Handle relative imports like './utils'
      if (imp.startsWith('.')) {
        const resolvedPath = this.resolveImportPath(currentFile, imp);
        if (resolvedPath === targetFile || 
            resolvedPath === targetFile.replace(/\.(ts|js|tsx|jsx)$/, '') ||
            resolvedPath.endsWith(targetBasename)) {
          return 1.0;
        }
      }
      // Handle absolute or module imports
      else if (imp === targetFile || imp.endsWith(targetBasename)) {
        return 1.0;
      }
    }

    // Check if target file imports current
    const targetIndex = this.index.getFile(targetFile);
    if (targetIndex) {
      const currentBasename = path.basename(currentFile, path.extname(currentFile));
      
      for (const imp of targetIndex.imports) {
        if (imp.startsWith('.')) {
          const resolvedPath = this.resolveImportPath(targetFile, imp);
          if (resolvedPath === currentFile || 
              resolvedPath === currentFile.replace(/\.(ts|js|tsx|jsx)$/, '') ||
              resolvedPath.endsWith(currentBasename)) {
            return 0.8;
          }
        }
        else if (imp === currentFile || imp.endsWith(currentBasename)) {
          return 0.8;
        }
      }
    }

    return 0;
  }

  private scoreSymbolMatch(filePath: string, query: string): number {
    if (!query) return 0;

    const fileIndex = this.index.getFile(filePath);
    if (!fileIndex) return 0;

    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/);

    let matchScore = 0;
    for (const symbol of fileIndex.symbols) {
      const symbolLower = symbol.name.toLowerCase();
      
      // Exact match
      if (queryTokens.some(token => symbolLower === token)) {
        matchScore += 1.0;
      }
      // Partial match
      else if (queryTokens.some(token => symbolLower.includes(token) || token.includes(symbolLower))) {
        matchScore += 0.5;
      }
    }

    // Normalize by number of symbols (favor focused files)
    const normalizedScore = fileIndex.symbols.length > 0 
      ? matchScore / Math.sqrt(fileIndex.symbols.length)
      : 0;

    return Math.min(1.0, normalizedScore);
  }

  private scoreImportChain(targetFile: string, currentFile: string): number {
    // Build import graph if not available
    const graph = this.index.buildImportGraph();
    
    // Normalize file paths for consistency
    const normalizedTarget = targetFile.replace(/\.(ts|js|tsx|jsx)$/, '');
    const normalizedCurrent = currentFile.replace(/\.(ts|js|tsx|jsx)$/, '');
    
    // Try with both normalized and original paths
    let distance = this.findShortestDistance(graph, currentFile, targetFile);
    if (distance === -1) {
      distance = this.findShortestDistance(graph, normalizedCurrent, normalizedTarget);
    }
    
    // Also try with just the base names if full paths don't work
    if (distance === -1) {
      const currentBase = path.basename(currentFile, path.extname(currentFile));
      const targetBase = path.basename(targetFile, path.extname(targetFile));
      
      // Find entries in graph that end with these basenames
      for (const [key, value] of graph.entries()) {
        if (key.endsWith(currentBase) || key.endsWith(normalizedCurrent)) {
          for (const [key2, value2] of graph.entries()) {
            if (key2.endsWith(targetBase) || key2.endsWith(normalizedTarget)) {
              distance = this.findShortestDistance(graph, key, key2);
              if (distance !== -1) break;
            }
          }
          if (distance !== -1) break;
        }
      }
    }

    if (distance === -1) return 0;
    if (distance === 1) return 1.0;
    if (distance === 2) return 0.6;
    if (distance === 3) return 0.3;
    return 0.1;
  }

  private scoreUserPattern(targetFile: string, contextFile: string): number {
    const history = this.userHistory[contextFile];
    if (!history || !history.includes(targetFile)) return 0;

    const index = history.indexOf(targetFile);
    const recencyScore = 1 - (index / history.length);
    return recencyScore;
  }

  private calculateSizePenalty(filePath: string): number {
    const fileIndex = this.index.getFile(filePath);
    if (!fileIndex) return 0;

    // Penalize very large files (likely utility files)
    if (fileIndex.size > 10000) {
      // Penalty increases logarithmically with size
      return Math.min(0.5, Math.log10(fileIndex.size / 10000) * 0.2);
    }

    // Also penalize files with too many exports (utility files)
    if (fileIndex.exports.length > 20) {
      return Math.min(0.3, fileIndex.exports.length / 100);
    }

    return 0;
  }

  private findShortestDistance(
    graph: Map<string, { imports: string[]; importedBy: string[] }>,
    start: string,
    end: string
  ): number {
    if (start === end) return 0;

    const visited = new Set<string>();
    const queue: { file: string; distance: number }[] = [{ file: start, distance: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.file === end) {
        return current.distance;
      }

      if (visited.has(current.file)) continue;
      visited.add(current.file);

      const node = graph.get(current.file);
      if (!node) continue;

      // Check both imports and files that import this one
      const neighbors = [...node.imports, ...node.importedBy];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ file: neighbor, distance: current.distance + 1 });
        }
      }
    }

    return -1; // No path found
  }

  private resolveImportPath(fromFile: string, importPath: string): string {
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      return path.join(dir, importPath);
    }
    return importPath;
  }

  private pruneHistory(): void {
    const entries = Object.keys(this.userHistory);
    if (entries.length > this.MAX_HISTORY_SIZE) {
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - this.MAX_HISTORY_SIZE);
      toRemove.forEach(key => delete this.userHistory[key]);
    }
  }
}