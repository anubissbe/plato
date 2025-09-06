import chalk from 'chalk';

export interface Token {
  type: 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'variable' | 'operator' | 'punctuation' | 'plain';
  value: string;
  start?: number;
  end?: number;
}

export interface HighlightOptions {
  lineNumbers?: boolean;
  highlightLines?: number[];
  theme?: 'dark' | 'light' | string;
}

export interface LanguageDefinition {
  name: string;
  keywords: string[];
  operators: string[];
  commentPatterns: RegExp[];
  stringPatterns: RegExp[];
  numberPatterns: RegExp[];
  functionPatterns?: RegExp[];
}

export class SyntaxHighlighter {
  private theme: string = 'dark';
  private cache: Map<string, string> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private languages: Map<string, LanguageDefinition> = new Map();

  constructor() {
    this.initializeLanguages();
  }

  private initializeLanguages(): void {
    // JavaScript/TypeScript
    this.languages.set('javascript', {
      name: 'javascript',
      keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined'],
      operators: ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '++', '--', '+=', '-=', '*=', '/=', '=>'],
      commentPatterns: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
      stringPatterns: [/"(?:[^"\\]|\\.)*"/g, /'(?:[^'\\]|\\.)*'/g, /`(?:[^`\\]|\\.)*`/g],
      numberPatterns: [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g],
      functionPatterns: [/\b(\w+)\s*(?=\()/g],
    });

    this.languages.set('typescript', {
      ...this.languages.get('javascript')!,
      name: 'typescript',
      keywords: [...this.languages.get('javascript')!.keywords, 'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract', 'implements', 'private', 'protected', 'public', 'readonly', 'as', 'is', 'keyof', 'never', 'any', 'unknown'],
    });

    // Python
    this.languages.set('python', {
      name: 'python',
      keywords: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'pass', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None'],
      operators: ['+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '>', '<=', '>=', '+=', '-=', '*=', '/='],
      commentPatterns: [/#.*$/gm],
      stringPatterns: [/"""[\s\S]*?"""/g, /'''[\s\S]*?'''/g, /"(?:[^"\\]|\\.)*"/g, /'(?:[^'\\]|\\.)*'/g],
      numberPatterns: [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g],
      functionPatterns: [/\bdef\s+(\w+)/g],
    });

    // JSON
    this.languages.set('json', {
      name: 'json',
      keywords: ['true', 'false', 'null'],
      operators: [],
      commentPatterns: [],
      stringPatterns: [/"(?:[^"\\]|\\.)*"/g],
      numberPatterns: [/-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g],
    });

    // CSS
    this.languages.set('css', {
      name: 'css',
      keywords: [],
      operators: [],
      commentPatterns: [/\/\*[\s\S]*?\*\//g],
      stringPatterns: [/"(?:[^"\\]|\\.)*"/g, /'(?:[^'\\]|\\.)*'/g],
      numberPatterns: [/\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|deg|s|ms)?\b/g],
    });
  }

  detectLanguage(code: string, hint?: string): string {
    // Check hint first
    if (hint) {
      const ext = hint.match(/\.(\w+)$/)?.[1];
      if (ext) {
        const langMap: Record<string, string> = {
          'js': 'javascript',
          'jsx': 'javascript',
          'ts': 'typescript',
          'tsx': 'typescript',
          'py': 'python',
          'json': 'json',
          'css': 'css',
          'scss': 'css',
          'sass': 'css',
        };
        if (langMap[ext]) return langMap[ext];
      }
    }

    // Pattern-based detection
    if (/^\s*{[\s\S]*}\s*$/.test(code) && /[":,{}[\]]/.test(code)) return 'json';
    if (/\b(const|let|var|function|=>)\b/.test(code)) return 'javascript';
    if (/\b(interface|type|enum|implements)\b/.test(code)) return 'typescript';
    if (/\b(def|import|print|if __name__)\b/.test(code)) return 'python';
    if (/[.#]\w+\s*{[^}]*}/.test(code)) return 'css';

    return 'plaintext';
  }

  tokenize(code: string, language: string): Token[] {
    const tokens: Token[] = [];
    const lang = this.languages.get(language);
    
    if (!lang) {
      return [{ type: 'plain', value: code }];
    }

    // Create a map to track processed ranges
    const processed = new Array(code.length).fill(false);
    
    // Process comments first
    lang.commentPatterns.forEach(pattern => {
      const matches = [...code.matchAll(new RegExp(pattern.source, pattern.flags))];
      matches.forEach(match => {
        if (match.index !== undefined) {
          tokens.push({
            type: 'comment',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
          });
          for (let i = match.index; i < match.index + match[0].length; i++) {
            processed[i] = true;
          }
        }
      });
    });

    // Process strings
    lang.stringPatterns.forEach(pattern => {
      const matches = [...code.matchAll(new RegExp(pattern.source, pattern.flags))];
      matches.forEach(match => {
        if (match.index !== undefined && !processed[match.index]) {
          tokens.push({
            type: 'string',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
          });
          for (let i = match.index; i < match.index + match[0].length; i++) {
            processed[i] = true;
          }
        }
      });
    });

    // Process numbers
    lang.numberPatterns.forEach(pattern => {
      const matches = [...code.matchAll(new RegExp(pattern.source, pattern.flags))];
      matches.forEach(match => {
        if (match.index !== undefined && !processed[match.index]) {
          tokens.push({
            type: 'number',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
          });
          for (let i = match.index; i < match.index + match[0].length; i++) {
            processed[i] = true;
          }
        }
      });
    });

    // Process keywords
    const keywordRegex = new RegExp(`\\b(${lang.keywords.join('|')})\\b`, 'g');
    const keywordMatches = [...code.matchAll(keywordRegex)];
    keywordMatches.forEach(match => {
      if (match.index !== undefined && !processed[match.index]) {
        tokens.push({
          type: 'keyword',
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
        for (let i = match.index; i < match.index + match[0].length; i++) {
          processed[i] = true;
        }
      }
    });

    // Sort tokens by start position
    tokens.sort((a, b) => (a.start || 0) - (b.start || 0));

    return tokens;
  }

  highlight(code: string, language: string, options?: HighlightOptions): string {
    const cacheKey = `${code}-${language}-${JSON.stringify(options)}-${this.theme}`;
    
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    this.cacheMisses++;
    const tokens = this.tokenize(code, language);
    const lines = code.split('\n');
    const result: string[] = [];

    lines.forEach((line, lineIndex) => {
      let highlightedLine = line;
      const lineNumber = lineIndex + 1;

      // Apply syntax highlighting
      const lineTokens = tokens.filter(token => {
        const tokenLines = code.substring(0, token.start).split('\n').length;
        return tokenLines === lineNumber;
      });

      // Skip highlighting for now - needs proper implementation
      if (lineTokens.length > 0) {
        lineTokens.forEach(token => {
          const color = this.getColorForToken(token);
          // Apply color to matched tokens
          const coloredToken = color(token.value);
          if (coloredToken !== token.value) {
            highlightedLine = coloredToken;
          }
        });
      }

      // Add line numbers if requested
      if (options?.lineNumbers) {
        highlightedLine = chalk.gray(`${lineNumber.toString().padStart(4, ' ')} │ `) + highlightedLine;
      }

      // Highlight specific lines if requested
      if (options?.highlightLines?.includes(lineNumber)) {
        highlightedLine = chalk.bgYellow.black(highlightedLine);
      }

      result.push(highlightedLine);
    });

    const highlighted = result.join('\n');
    this.cache.set(cacheKey, highlighted);
    
    return highlighted;
  }

  private getColorForToken(token: Token): (text: string) => string {
    const themes = {
      dark: {
        keyword: (t: string) => chalk.blue(t),
        string: (t: string) => chalk.green(t),
        number: (t: string) => chalk.yellow(t),
        comment: (t: string) => chalk.gray(t),
        function: (t: string) => chalk.cyan(t),
        variable: (t: string) => chalk.white(t),
        operator: (t: string) => chalk.magenta(t),
        punctuation: (t: string) => chalk.white(t),
        plain: (t: string) => chalk.white(t),
      },
      light: {
        keyword: (t: string) => chalk.blue(t),
        string: (t: string) => chalk.green(t),
        number: (t: string) => chalk.red(t),
        comment: (t: string) => chalk.gray(t),
        function: (t: string) => chalk.magenta(t),
        variable: (t: string) => chalk.black(t),
        operator: (t: string) => chalk.cyan(t),
        punctuation: (t: string) => chalk.black(t),
        plain: (t: string) => chalk.black(t),
      },
    };

    const theme = themes[this.theme as keyof typeof themes] || themes.dark;
    return theme[token.type] || theme.plain;
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.theme = theme;
    this.cache.clear(); // Clear cache when theme changes
  }

  getCacheStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
    };
  }

  extractCodeBlocks(markdown: string): Array<{ language: string; code: string; startLine: number; endLine: number }> {
    const blocks: Array<{ language: string; code: string; startLine: number; endLine: number }> = [];
    const lines = markdown.split('\n');
    let inBlock = false;
    let currentBlock: { language: string; code: string[]; startLine: number } | null = null;

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (inBlock && currentBlock) {
          blocks.push({
            language: currentBlock.language,
            code: currentBlock.code.join('\n'),
            startLine: currentBlock.startLine,
            endLine: index + 1,
          });
          currentBlock = null;
          inBlock = false;
        } else {
          const language = line.slice(3).trim() || 'plaintext';
          currentBlock = {
            language,
            code: [],
            startLine: index + 1,
          };
          inBlock = true;
        }
      } else if (inBlock && currentBlock) {
        currentBlock.code.push(line);
      }
    });

    return blocks;
  }

  extractInlineCode(text: string): string[] {
    const matches = text.match(/`([^`]+)`/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
  }
}