/**
 * Smart Content Sampler for Advanced Context Management
 * Extracts meaningful code snippets while respecting token budgets
 */

import { SemanticIndex } from './semantic-index';
import { ContentSample, FileIndex, SymbolInfo, SymbolType } from './types';

export type SamplingStrategy = 
  | 'function'
  | 'class'
  | 'type'
  | 'comment_aware'
  | 'context';

export interface SamplingOptions {
  strategy: SamplingStrategy;
  maxTokens: number;
  focusKeywords?: string[];
}

export interface FileSampleInput {
  path: string;
  content: string;
  relevanceScore?: number;
}

export interface MultiFileSamplingOptions {
  strategy: SamplingStrategy;
  totalTokenBudget: number;
  focusKeywords?: string[];
}

/**
 * Extracts meaningful code samples from files
 */
export class ContentSampler {
  private readonly TOKENS_PER_CHAR = 0.25; // Rough estimate: 4 chars = 1 token

  constructor(private index: SemanticIndex) {}

  /**
   * Sample content from a single file
   */
  sampleFile(
    filePath: string, 
    content: string, 
    options: SamplingOptions
  ): ContentSample {
    let sampledContent: string;
    let startLine = 1;
    let endLine = 1;
    let reason = '';

    switch (options.strategy) {
      case 'function':
        sampledContent = this.sampleFunctions(content, options);
        reason = 'Function definitions extracted';
        break;

      case 'class':
        sampledContent = this.sampleClasses(content, options);
        reason = 'Class structure with key methods';
        break;

      case 'type':
        sampledContent = this.sampleTypes(content, options);
        reason = 'Type definitions and interfaces';
        break;

      case 'comment_aware':
        sampledContent = this.sampleWithComments(content, options);
        reason = 'Important documentation preserved';
        break;

      case 'context':
        sampledContent = this.sampleByContext(content, options);
        reason = 'Context-relevant sections';
        break;

      default:
        sampledContent = this.sampleDefault(content, options);
        reason = 'Default sampling strategy';
    }

    // Calculate line numbers
    const lines = content.split('\n');
    const sampledLines = sampledContent.split('\n');
    
    // Find where the sample starts in the original content
    for (let i = 0; i < lines.length; i++) {
      if (sampledLines[0] && lines[i].includes(sampledLines[0].trim())) {
        startLine = i + 1;
        endLine = startLine + sampledLines.length - 1;
        break;
      }
    }

    const tokens = this.estimateTokens(sampledContent);

    return {
      file: filePath,
      content: sampledContent,
      startLine,
      endLine,
      tokens,
      reason
    };
  }

  /**
   * Sample content from multiple files within a token budget
   */
  sampleMultipleFiles(
    files: FileSampleInput[],
    options: MultiFileSamplingOptions
  ): ContentSample[] {
    const samples: ContentSample[] = [];
    
    // Sort files by relevance if provided
    const sortedFiles = [...files].sort((a, b) => 
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    // Calculate token allocation per file
    const tokenAllocations = this.calculateTokenAllocations(
      sortedFiles,
      options.totalTokenBudget
    );

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const allocation = tokenAllocations[i];
      
      if (allocation > 0) {
        const sample = this.sampleFile(file.path, file.content, {
          strategy: options.strategy,
          maxTokens: allocation,
          focusKeywords: options.focusKeywords
        });
        
        samples.push(sample);
      }
    }

    return samples;
  }

  private sampleFunctions(content: string, options: SamplingOptions): string {
    const lines = content.split('\n');
    const samples: string[] = [];
    let currentTokens = 0;
    const maxTokens = options.maxTokens;

    // Regular expressions for different languages
    const patterns = {
      typescript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      arrow: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/,
      method: /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/
    };

    let inFunction = false;
    let functionStart = -1;
    let braceCount = 0;
    let currentFunction: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line starts a function
      if (!inFunction) {
        for (const pattern of Object.values(patterns)) {
          if (pattern.test(line)) {
            inFunction = true;
            functionStart = i;
            braceCount = 0;
            currentFunction = [line];
            // Count opening braces in the same line
            for (const char of line) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
            // If it's a one-liner, handle it immediately
            if (braceCount === 0 && (line.includes('}') || line.includes('return'))) {
              const functionSample = currentFunction.join('\n');
              const functionTokens = this.estimateTokens(functionSample);
              
              if (currentTokens + functionTokens <= maxTokens) {
                samples.push(functionSample);
                currentTokens += functionTokens;
              }
              
              inFunction = false;
              currentFunction = [];
            }
            break;
          }
        }
      } else {
        currentFunction.push(line);
        
        // Track braces to find function end
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        // Function ended
        if (braceCount <= 0) {
          const functionSample = currentFunction.join('\n');
          const functionTokens = this.estimateTokens(functionSample);
          
          if (currentTokens + functionTokens <= maxTokens) {
            samples.push(functionSample);
            currentTokens += functionTokens;
          }
          
          inFunction = false;
          currentFunction = [];
        }
      }

      // Stop if we've reached token limit
      if (currentTokens >= maxTokens * 0.9) break;
    }

    return samples.join('\n\n');
  }

  private sampleClasses(content: string, options: SamplingOptions): string {
    const lines = content.split('\n');
    const samples: string[] = [];
    let currentTokens = 0;
    const maxTokens = options.maxTokens;

    const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;
    
    let inClass = false;
    let classDepth = 0;
    let currentClass: string[] = [];
    let methodCount = 0;
    const maxMethodsPerClass = 3;
    let inMethod = false;
    let methodDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!inClass && classPattern.test(line)) {
        inClass = true;
        classDepth = 0;
        currentClass = [line];
        methodCount = 0;
        // Count opening brace
        for (const char of line) {
          if (char === '{') classDepth++;
        }
      } else if (inClass) {
        currentClass.push(line);
        
        // Track depth for nested structures
        for (const char of line) {
          if (char === '{') {
            classDepth++;
            if (inMethod) methodDepth++;
          }
          if (char === '}') {
            classDepth--;
            if (inMethod) {
              methodDepth--;
              if (methodDepth <= 0) {
                inMethod = false;
              }
            }
          }
        }

        // Check if this is a method signature
        const isMethodSignature = /(?:public|private|protected|async|static)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/.test(line) &&
                                  !line.includes('constructor');
        
        if (isMethodSignature && !inMethod && methodCount < maxMethodsPerClass) {
          methodCount++;
          inMethod = true;
          methodDepth = 0;
          // Count braces in the method signature line
          for (const char of line) {
            if (char === '{') methodDepth++;
            if (char === '}') methodDepth--;
          }
        }

        // Class ended
        if (classDepth <= 0) {
          const classSample = currentClass.join('\n');
          const classTokens = this.estimateTokens(classSample);
          
          if (currentTokens + classTokens <= maxTokens) {
            samples.push(classSample);
            currentTokens += classTokens;
          }
          
          inClass = false;
          currentClass = [];
        }
      }

      if (currentTokens >= maxTokens * 0.9) break;
    }

    return samples.join('\n\n');
  }

  private sampleTypes(content: string, options: SamplingOptions): string {
    const lines = content.split('\n');
    const samples: string[] = [];
    let currentTokens = 0;
    const maxTokens = options.maxTokens;

    const patterns = {
      interface: /(?:export\s+)?interface\s+(\w+)/,
      type: /(?:export\s+)?type\s+(\w+)/,
      enum: /(?:export\s+)?enum\s+(\w+)/
    };

    let inDefinition = false;
    let braceCount = 0;
    let currentDefinition: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!inDefinition) {
        for (const pattern of Object.values(patterns)) {
          if (pattern.test(line)) {
            inDefinition = true;
            braceCount = 0;
            currentDefinition = [line];
            break;
          }
        }
      } else {
        currentDefinition.push(line);
        
        // Track braces for multi-line definitions
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        // Definition ended
        if ((braceCount === 0 && line.includes('}')) || 
            (braceCount === 0 && line.includes(';'))) {
          const definitionSample = currentDefinition.join('\n');
          const definitionTokens = this.estimateTokens(definitionSample);
          
          if (currentTokens + definitionTokens <= maxTokens) {
            samples.push(definitionSample);
            currentTokens += definitionTokens;
          }
          
          inDefinition = false;
          currentDefinition = [];
        }
      }

      if (currentTokens >= maxTokens * 0.9) break;
    }

    return samples.join('\n\n');
  }

  private sampleWithComments(content: string, options: SamplingOptions): string {
    const lines = content.split('\n');
    const samples: string[] = [];
    let currentTokens = 0;
    const maxTokens = options.maxTokens;

    let inComment = false;
    let currentBlock: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for JSDoc or block comments
      if (line.trim().startsWith('/**') || line.trim().startsWith('/*')) {
        inComment = true;
        currentBlock = [line];
      } else if (inComment) {
        currentBlock.push(line);
        
        if (line.includes('*/')) {
          // Include the next few lines after the comment (likely the documented code)
          for (let j = 1; j <= 5 && i + j < lines.length; j++) {
            const nextLine = lines[i + j];
            currentBlock.push(nextLine);
            if (nextLine.includes('{') || nextLine.includes(';')) {
              i += j;
              break;
            }
          }
          
          const blockSample = currentBlock.join('\n');
          const blockTokens = this.estimateTokens(blockSample);
          
          if (currentTokens + blockTokens <= maxTokens) {
            samples.push(blockSample);
            currentTokens += blockTokens;
          }
          
          inComment = false;
          currentBlock = [];
        }
      }

      if (currentTokens >= maxTokens * 0.9) break;
    }

    return samples.join('\n\n');
  }

  private sampleByContext(content: string, options: SamplingOptions): string {
    if (!options.focusKeywords || options.focusKeywords.length === 0) {
      return this.sampleDefault(content, options);
    }

    const lines = content.split('\n');
    const samples: string[] = [];
    let currentTokens = 0;
    const maxTokens = options.maxTokens;
    const keywords = options.focusKeywords.map(k => k.toLowerCase());

    // Find lines containing keywords
    const relevantSections: { start: number; end: number; score: number }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      let score = 0;
      
      for (const keyword of keywords) {
        if (lineLower.includes(keyword)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        // Include context around the matching line
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length - 1, i + 5);
        relevantSections.push({ start, end, score });
      }
    }

    // Merge overlapping sections
    const mergedSections = this.mergeSections(relevantSections);
    
    // Sort by score
    mergedSections.sort((a, b) => b.score - a.score);

    for (const section of mergedSections) {
      const sectionLines = lines.slice(section.start, section.end + 1);
      const sectionSample = sectionLines.join('\n');
      const sectionTokens = this.estimateTokens(sectionSample);
      
      if (currentTokens + sectionTokens <= maxTokens) {
        samples.push(sectionSample);
        currentTokens += sectionTokens;
      } else {
        // Try to fit partial section
        const availableTokens = maxTokens - currentTokens;
        if (availableTokens > 20) {
          const partialLines = Math.floor(availableTokens / 10); // Rough estimate
          const partialSection = sectionLines.slice(0, partialLines).join('\n');
          samples.push(partialSection);
        }
        break;
      }
    }

    return samples.length > 0 ? samples.join('\n\n// ...\n\n') : this.sampleDefault(content, options);
  }

  private sampleDefault(content: string, options: SamplingOptions): string {
    const maxChars = Math.floor(options.maxTokens / this.TOKENS_PER_CHAR);
    
    if (content.length <= maxChars) {
      return content;
    }
    
    // Take the beginning of the file up to the limit
    return content.substring(0, maxChars) + '\n// ... (truncated)';
  }

  private calculateTokenAllocations(
    files: FileSampleInput[],
    totalBudget: number
  ): number[] {
    const allocations: number[] = [];
    let remainingBudget = totalBudget;
    
    // Base allocation with relevance weighting
    const totalRelevance = files.reduce((sum, f) => sum + (f.relevanceScore || 50), 0);
    
    for (const file of files) {
      const relevance = file.relevanceScore || 50;
      const weight = relevance / totalRelevance;
      const allocation = Math.floor(totalBudget * weight);
      
      allocations.push(Math.min(allocation, remainingBudget));
      remainingBudget -= allocation;
      
      if (remainingBudget <= 0) break;
    }

    return allocations;
  }

  private mergeSections(
    sections: { start: number; end: number; score: number }[]
  ): { start: number; end: number; score: number }[] {
    if (sections.length === 0) return [];
    
    const sorted = [...sections].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number; score: number }[] = [];
    
    let current = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      
      if (next.start <= current.end + 2) {
        // Merge overlapping or nearby sections
        current = {
          start: current.start,
          end: Math.max(current.end, next.end),
          score: current.score + next.score
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  private estimateTokens(text: string): number {
    // More accurate estimation based on common patterns
    // Average: ~1 token per 4 characters for code
    // Adjust for whitespace and structure
    const chars = text.length;
    const lines = text.split('\n').length;
    const words = text.split(/\s+/).length;
    
    // Use word count as primary measure (more accurate for tokens)
    // Approximate 1.3 tokens per word for code
    return Math.ceil(words * 1.3);
  }
}