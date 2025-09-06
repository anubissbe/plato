import { FileRelevanceScorer } from '../context/relevance-scorer.js';
import { ContentSampler } from '../context/content-sampler.js';
import { SemanticIndex } from '../context/semantic-index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContextCommandOptions {
  workingDirectory: string;
  tokenBudget: number;
  currentFiles?: Array<{
    path: string;
    tokens: number;
    relevance: number;
  }>;
}

export interface ContextCommandResult {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
}

export async function handleContextCommand(
  args: string,
  options: ContextCommandOptions
): Promise<ContextCommandResult> {
  const parts = args.trim().split(' ');
  const subCommand = parts[0] || 'show';
  const subArgs = parts.slice(1);

  try {
    switch (subCommand) {
      case 'show':
      case '':
        return await showContextOverview(options);
      
      case 'suggest':
        return await suggestRelevantFiles(options);
      
      case 'add-related':
        if (subArgs.length === 0) {
          return { success: false, action: 'add-related', error: 'File path required' };
        }
        return await addRelatedFiles(subArgs[0], options);
      
      case 'optimize':
        return await optimizeContext(options);
      
      case 'search':
        if (subArgs.length === 0) {
          return { success: false, action: 'search', error: 'Search query required' };
        }
        return await searchContext(subArgs.join(' '), options);
      
      case 'export':
        if (subArgs.length === 0) {
          return { success: false, action: 'export', error: 'Export path required' };
        }
        return await exportContext(subArgs[0], options);
      
      case 'import':
        if (subArgs.length === 0) {
          return { success: false, action: 'import', error: 'Import path required' };
        }
        return await importContext(subArgs[0], options);
      
      default:
        return { 
          success: false, 
          action: subCommand, 
          error: `Unknown command: ${subCommand}. Use /context [suggest|add-related|optimize|search|export|import]` 
        };
    }
  } catch (error: any) {
    return {
      success: false,
      action: subCommand,
      error: error.message || 'Command failed',
    };
  }
}

async function showContextOverview(options: ContextCommandOptions): Promise<ContextCommandResult> {
  const { currentFiles = [] } = options;
  
  const tokenUsage = currentFiles.reduce((sum, file) => sum + file.tokens, 0);
  const fileCount = currentFiles.length;
  
  const relevanceDistribution = {
    high: currentFiles.filter(f => f.relevance >= 80).length,
    medium: currentFiles.filter(f => f.relevance >= 40 && f.relevance < 80).length,
    low: currentFiles.filter(f => f.relevance < 40).length,
  };

  const budgetBreakdown = await calculateBudgetBreakdown(currentFiles);

  return {
    success: true,
    action: 'show',
    data: {
      tokenUsage,
      tokenBudget: options.tokenBudget,
      fileCount,
      relevanceDistribution,
      budgetBreakdown,
      files: currentFiles.map(f => ({
        path: f.path,
        tokens: f.tokens,
        relevance: f.relevance,
        percentage: Math.round((f.tokens / options.tokenBudget) * 100),
      })),
    },
  };
}

async function suggestRelevantFiles(options: ContextCommandOptions): Promise<ContextCommandResult> {
  const index = new SemanticIndex();
  const scorer = new FileRelevanceScorer(index);
  const files = index.getAllFiles();
  
  const suggestions = files
    .map(file => {
      const score = scorer.scoreFile(file.path, {
        currentFile: '',
        recentFiles: [],
        userQuery: '',
      });
      return {
        path: file.path,
        score: score.score,
        reasons: score.reasons,
        size: file.size,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 suggestions

  return {
    success: true,
    action: 'suggest',
    data: {
      suggestions,
      totalFiles: files.length,
    },
  };
}

async function addRelatedFiles(
  filePath: string,
  options: ContextCommandOptions
): Promise<ContextCommandResult> {
  const index = new SemanticIndex();
  const fileIndex = index.getFile(filePath);
  if (!fileIndex) {
    return { success: false, action: 'add-related', error: 'File not found in index' };
  }

  // Find related files through imports and symbol usage
  const relatedFiles = new Set<string>();
  
  // Add direct imports
  fileIndex.imports.forEach(imp => relatedFiles.add(imp));
  
  // Add files that import this file
  index.getAllFiles().forEach(file => {
    if (file.imports.includes(filePath)) {
      relatedFiles.add(file.path);
    }
  });

  // Apply smart sampling if needed
  const sampler = new ContentSampler(index);
  const sampledFiles = [];
  let totalTokens = 0;

  for (const file of relatedFiles) {
    if (totalTokens >= options.tokenBudget * 0.8) {
      break; // Leave 20% buffer
    }

    const content = await fs.readFile(file, 'utf-8').catch(() => '');
    const sample = sampler.sampleFile(file, content, {
      strategy: 'context',
      maxTokens: Math.min(2000, options.tokenBudget - totalTokens),
      focusKeywords: ['import', 'export', fileIndex.exports[0]],
    });

    sampledFiles.push({
      path: file,
      tokens: sample.tokens,
      completeness: Math.round((sample.tokens / (content.length * 0.25)) * 100),
    });
    totalTokens += sample.tokens;
  }

  return {
    success: true,
    action: 'add-related',
    data: {
      sourceFile: filePath,
      addedFiles: Array.from(relatedFiles),
      samplingApplied: totalTokens > options.tokenBudget * 0.5,
      totalTokens,
    },
  };
}

async function optimizeContext(options: ContextCommandOptions): Promise<ContextCommandResult> {
  const { currentFiles = [], tokenBudget } = options;
  
  if (currentFiles.length === 0) {
    return { success: false, action: 'optimize', error: 'No files in context to optimize' };
  }

  const currentUsage = currentFiles.reduce((sum, f) => sum + f.tokens, 0);
  const optimizations = [];
  let newTokenUsage = currentUsage;

  // Remove low-relevance files if over budget
  if (currentUsage > tokenBudget) {
    const sortedFiles = [...currentFiles].sort((a, b) => a.relevance - b.relevance);
    const toRemove = [];
    
    for (const file of sortedFiles) {
      if (newTokenUsage <= tokenBudget * 0.9) break;
      if (file.relevance < 40) {
        toRemove.push(file.path);
        newTokenUsage -= file.tokens;
        optimizations.push(`Remove ${path.basename(file.path)} (relevance: ${file.relevance})`);
      }
    }
  }

  // Suggest sampling for medium-relevance files
  const mediumRelevanceFiles = currentFiles.filter(f => f.relevance >= 40 && f.relevance < 70);
  if (mediumRelevanceFiles.length > 0) {
    const potentialSavings = mediumRelevanceFiles.reduce((sum, f) => sum + Math.floor(f.tokens * 0.4), 0);
    optimizations.push(`Apply summary sampling to ${mediumRelevanceFiles.length} medium-relevance files (save ~${potentialSavings} tokens)`);
  }

  // Suggest removing test files if present
  const testFiles = currentFiles.filter(f => f.path.includes('test') || f.path.includes('spec'));
  if (testFiles.length > 0) {
    const testTokens = testFiles.reduce((sum, f) => sum + f.tokens, 0);
    optimizations.push(`Consider excluding ${testFiles.length} test files (save ${testTokens} tokens)`);
  }

  return {
    success: true,
    action: 'optimize',
    data: {
      currentUsage,
      newTokenUsage,
      tokensSaved: currentUsage - newTokenUsage,
      optimizations,
      withinBudget: newTokenUsage <= tokenBudget,
    },
  };
}

async function searchContext(query: string, options: ContextCommandOptions): Promise<ContextCommandResult> {
  const index = new SemanticIndex();
  
  // Search for symbols and files matching the query
  const files = index.getAllFiles();
  const results: Array<{ file: string; symbol: string; type: string }> = [];
  
  files.forEach(file => {
    // Search in file path
    if (file.path.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        file: file.path,
        symbol: 'file',
        type: 'file',
      });
    }
    
    // Search in symbols
    file.symbols.forEach(symbol => {
      if (symbol.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          file: file.path,
          symbol: symbol.name,
          type: symbol.type,
        });
      }
    });
  });
  
  return {
    success: true,
    action: 'search',
    data: {
      query,
      results: results.slice(0, 20), // Limit to 20 results
      totalMatches: results.length,
    },
  };
}

async function exportContext(
  exportPath: string,
  options: ContextCommandOptions
): Promise<ContextCommandResult> {
  const { currentFiles = [], tokenBudget, workingDirectory } = options;
  
  const exportData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    workingDirectory,
    tokenBudget,
    files: currentFiles.map(f => f.path),
    settings: {
      tokenBudget,
      totalTokens: currentFiles.reduce((sum, f) => sum + f.tokens, 0),
    },
  };

  try {
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return {
      success: true,
      action: 'export',
      data: {
        path: exportPath,
        fileCount: currentFiles.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'export',
      error: `Failed to export: ${error.message}`,
    };
  }
}

async function importContext(
  importPath: string,
  options: ContextCommandOptions
): Promise<ContextCommandResult> {
  try {
    const content = await fs.readFile(importPath, 'utf-8');
    const importData = JSON.parse(content);
    
    return {
      success: true,
      action: 'import',
      data: {
        importedFiles: importData.files || [],
        settings: importData.settings || {},
        version: importData.version,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'import',
      error: `Failed to import: ${error.message}`,
    };
  }
}

async function calculateBudgetBreakdown(
  files: Array<{ path: string; tokens: number; relevance: number }>
): Promise<{ code: number; comments: number; types: number; imports: number }> {
  // Simplified estimation - in real implementation would analyze actual content
  const total = files.reduce((sum, f) => sum + f.tokens, 0);
  
  return {
    code: Math.floor(total * 0.6),
    comments: Math.floor(total * 0.2),
    types: Math.floor(total * 0.1),
    imports: Math.floor(total * 0.1),
  };
}