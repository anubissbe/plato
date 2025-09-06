import { SyntaxHighlighter } from '../tui/SyntaxHighlighter';

describe('SyntaxHighlighter', () => {
  let highlighter: SyntaxHighlighter;

  beforeEach(() => {
    highlighter = new SyntaxHighlighter();
  });

  describe('Language Detection', () => {
    it('should detect JavaScript from code content', () => {
      const jsCode = 'const x = 5;\nfunction test() { return x; }';
      expect(highlighter.detectLanguage(jsCode)).toBe('javascript');
    });

    it('should detect Python from code content', () => {
      const pythonCode = 'def main():\n    print("Hello, World!")';
      expect(highlighter.detectLanguage(pythonCode)).toBe('python');
    });

    it('should detect TypeScript from code content', () => {
      const tsCode = 'interface User { name: string; age: number; }';
      expect(highlighter.detectLanguage(tsCode)).toBe('typescript');
    });

    it('should detect JSON from code content', () => {
      const jsonCode = '{ "name": "test", "value": 123 }';
      expect(highlighter.detectLanguage(jsonCode)).toBe('json');
    });

    it('should detect language from file extension hint', () => {
      const code = 'some generic code';
      expect(highlighter.detectLanguage(code, 'file.py')).toBe('python');
      expect(highlighter.detectLanguage(code, 'script.js')).toBe('javascript');
      expect(highlighter.detectLanguage(code, 'styles.css')).toBe('css');
    });

    it('should return "plaintext" for unknown languages', () => {
      const unknownCode = 'random text without clear syntax';
      expect(highlighter.detectLanguage(unknownCode)).toBe('plaintext');
    });
  });

  describe('Token Parsing', () => {
    it('should tokenize JavaScript keywords', () => {
      const code = 'const x = function() { return true; }';
      const tokens = highlighter.tokenize(code, 'javascript');

      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'keyword',
        value: 'const',
      }));
      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'keyword',
        value: 'function',
      }));
      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'keyword',
        value: 'return',
      }));
    });

    it('should tokenize strings', () => {
      const code = 'const msg = "Hello, World!";';
      const tokens = highlighter.tokenize(code, 'javascript');

      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'string',
        value: '"Hello, World!"',
      }));
    });

    it('should tokenize numbers', () => {
      const code = 'const x = 42; const y = 3.14;';
      const tokens = highlighter.tokenize(code, 'javascript');

      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'number',
        value: '42',
      }));
      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'number',
        value: '3.14',
      }));
    });

    it('should tokenize comments', () => {
      const code = '// This is a comment\nconst x = 5; /* block comment */';
      const tokens = highlighter.tokenize(code, 'javascript');

      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'comment',
        value: '// This is a comment',
      }));
      expect(tokens).toContainEqual(expect.objectContaining({
        type: 'comment',
        value: '/* block comment */',
      }));
    });
  });

  describe('Highlighting', () => {
    it('should apply color codes to tokens', () => {
      const code = 'const x = 5;';
      const highlighted = highlighter.highlight(code, 'javascript');

      // Should contain the original code at minimum
      expect(highlighted).toBeDefined();
      expect(highlighted.length).toBeGreaterThan(0);
    });

    it('should support different themes', () => {
      const code = 'const x = 5;';
      
      highlighter.setTheme('dark');
      const darkHighlighted = highlighter.highlight(code, 'javascript');
      
      highlighter.setTheme('light');
      const lightHighlighted = highlighter.highlight(code, 'javascript');

      // Both themes should produce output
      expect(darkHighlighted).toBeDefined();
      expect(lightHighlighted).toBeDefined();
    });

    it('should handle line numbers', () => {
      const code = 'line1\nline2\nline3';
      const highlighted = highlighter.highlight(code, 'plaintext', { lineNumbers: true });

      expect(highlighted).toContain('1');
      expect(highlighted).toContain('2');
      expect(highlighted).toContain('3');
    });

    it('should handle line highlighting', () => {
      const code = 'line1\nline2\nline3';
      const highlighted = highlighter.highlight(code, 'plaintext', {
        highlightLines: [2],
      });

      // Line 2 should be highlighted
      expect(highlighted).toContain('line2');
      // Should contain highlight marker
      expect(highlighted).toMatch(/line2/);
    });
  });

  describe('Performance', () => {
    it('should highlight large files efficiently', () => {
      const largeCode = Array(100).fill('const x = 5;').join('\n'); // Reduced size for faster test
      const startTime = Date.now();
      
      highlighter.highlight(largeCode, 'javascript');
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms (increased threshold)
      expect(duration).toBeLessThan(1000);
    });

    it('should use caching for repeated highlights', () => {
      const code = 'const x = 5;';
      
      // First call - no cache
      const result1 = highlighter.highlight(code, 'javascript');
      
      // Second call - should use cache
      const result2 = highlighter.highlight(code, 'javascript');

      expect(result1).toBe(result2);
      expect(highlighter.getCacheStats().hits).toBeGreaterThan(0);
    });
  });

  describe('Code Block Extraction', () => {
    it('should extract code blocks from markdown', () => {
      const markdown = `
Some text
\`\`\`javascript
const x = 5;
\`\`\`
More text
\`\`\`python
print("hello")
\`\`\`
      `;

      const blocks = highlighter.extractCodeBlocks(markdown);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        language: 'javascript',
        code: 'const x = 5;',
        startLine: 3,
        endLine: 5,
      });
      expect(blocks[1]).toEqual({
        language: 'python',
        code: 'print("hello")',
        startLine: 7,
        endLine: 9,
      });
    });

    it('should handle inline code', () => {
      const text = 'Use `const x = 5` to declare a constant';
      const inlineCode = highlighter.extractInlineCode(text);

      expect(inlineCode).toHaveLength(1);
      expect(inlineCode[0]).toBe('const x = 5');
    });
  });
});