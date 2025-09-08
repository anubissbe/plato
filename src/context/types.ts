/**
 * Types for Advanced Context Management System
 */

export enum SymbolType {
  Class = 'class',
  Function = 'function',
  Variable = 'variable',
  Interface = 'interface',
  Type = 'type',
  Enum = 'enum',
  Namespace = 'namespace',
  Method = 'method',
  Property = 'property'
}

export interface SymbolInfo {
  name: string;
  type: SymbolType;
  line: number;
  column?: number;
  exported: boolean;
  members?: SymbolInfo[];
  description?: string;
}

export interface FileIndex {
  path: string;
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
  hash: string;
  size: number;
  lastModified?: Date;
}

export interface SymbolReference {
  file: string;
  line: number;
  type: SymbolType;
  exported: boolean;
}

export interface ImportGraph {
  imports: string[];
  importedBy: string[];
}

export interface SemanticIndexData {
  files: Map<string, FileIndex>;
  symbols: Map<string, SymbolReference[]>;
  imports: Map<string, ImportGraph>;
  lastUpdated: Date;
}

export interface RelevanceScore {
  file: string;
  score: number; // 0-100
  reasons: RelevanceReason[];
  confidence: number;
}

export type RelevanceReason = 
  | 'direct_reference'
  | 'symbol_match' 
  | 'import_chain'
  | 'recent_access'
  | 'user_pattern';

export interface ContentSample {
  file: string;
  content: string;
  startLine: number;
  endLine: number;
  tokens: number;
  reason: string;
}

export interface ContextBudget {
  total: number;
  used: number;
  remaining: number;
  files: Map<string, number>;
}

export interface IndexingOptions {
  maxDepth?: number;
  includeTests?: boolean;
  includeNodeModules?: boolean;
  fileExtensions?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
}

export interface FileAnalyzerOptions {
  parseComments?: boolean;
  extractJSDoc?: boolean;
  followImports?: boolean;
  maxFileSize?: number;
}