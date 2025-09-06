import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FileAnalyzer, SymbolExtractor, SemanticIndex } from '../../../context/semantic-index';
import { FileIndex, SymbolInfo, SymbolType, ImportGraph } from '../../../context/types';

describe('FileAnalyzer', () => {
  let analyzer: FileAnalyzer;

  beforeEach(() => {
    analyzer = new FileAnalyzer();
  });

  describe('analyzeFile', () => {
    it('should analyze TypeScript file and extract symbols', async () => {
      const filePath = 'test.ts';
      const content = `
        export class TestClass {
          constructor(private value: string) {}
          
          public getValue(): string {
            return this.value;
          }
        }
        
        export function testFunction(param: number): number {
          return param * 2;
        }
        
        export const TEST_CONSTANT = 'test';
        
        export interface TestInterface {
          id: string;
          name: string;
        }
        
        export type TestType = string | number;
      `;

      const result = await analyzer.analyzeFile(filePath, content);

      expect(result.path).toBe(filePath);
      expect(result.symbols).toHaveLength(5);
      expect(result.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'TestClass',
            type: SymbolType.Class,
            exported: true,
            line: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'testFunction',
            type: SymbolType.Function,
            exported: true,
            line: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'TEST_CONSTANT',
            type: SymbolType.Variable,
            exported: true,
            line: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'TestInterface',
            type: SymbolType.Interface,
            exported: true,
            line: expect.any(Number)
          }),
          expect.objectContaining({
            name: 'TestType',
            type: SymbolType.Type,
            exported: true,
            line: expect.any(Number)
          })
        ])
      );
    });

    it('should extract imports from TypeScript file', async () => {
      const filePath = 'test.ts';
      const content = `
        import { Component } from 'react';
        import * as fs from 'fs';
        import path from 'path';
        import type { Config } from './config';
        import './styles.css';
        
        export class MyComponent extends Component {}
      `;

      const result = await analyzer.analyzeFile(filePath, content);

      expect(result.imports).toEqual([
        'react',
        'fs',
        'path',
        './config',
        './styles.css'
      ]);
    });

    it('should extract exports from TypeScript file', async () => {
      const filePath = 'test.ts';
      const content = `
        export { foo, bar } from './utils';
        export * from './types';
        export default class DefaultClass {}
        export const value = 42;
      `;

      const result = await analyzer.analyzeFile(filePath, content);

      expect(result.exports).toContain('foo');
      expect(result.exports).toContain('bar');
      expect(result.exports).toContain('default');
      expect(result.exports).toContain('value');
    });

    it('should calculate file hash for change detection', async () => {
      const filePath = 'test.ts';
      const content = 'export const value = 42;';
      
      const result1 = await analyzer.analyzeFile(filePath, content);
      const result2 = await analyzer.analyzeFile(filePath, content);
      const result3 = await analyzer.analyzeFile(filePath, content + '\n');

      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).not.toBe(result3.hash);
    });

    it('should handle JavaScript files', async () => {
      const filePath = 'test.js';
      const content = `
        function myFunction() {
          return 'hello';
        }
        
        const myVariable = 42;
        
        class MyClass {
          constructor() {}
        }
        
        module.exports = { myFunction, MyClass };
      `;

      const result = await analyzer.analyzeFile(filePath, content);

      expect(result.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'myFunction',
            type: SymbolType.Function
          }),
          expect.objectContaining({
            name: 'myVariable',
            type: SymbolType.Variable
          }),
          expect.objectContaining({
            name: 'MyClass',
            type: SymbolType.Class
          })
        ])
      );
    });

    it('should handle Python files', async () => {
      const filePath = 'test.py';
      const content = `
        import os
        from typing import List, Optional
        
        class MyClass:
            def __init__(self, value: str):
                self.value = value
            
            def get_value(self) -> str:
                return self.value
        
        def my_function(param: int) -> int:
            return param * 2
        
        MY_CONSTANT = "test"
      `;

      const result = await analyzer.analyzeFile(filePath, content);

      expect(result.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'MyClass',
            type: SymbolType.Class
          }),
          expect.objectContaining({
            name: 'my_function',
            type: SymbolType.Function
          }),
          expect.objectContaining({
            name: 'MY_CONSTANT',
            type: SymbolType.Variable
          })
        ])
      );
      
      expect(result.imports).toContain('os');
      expect(result.imports).toContain('typing');
    });

    it('should handle unsupported file types gracefully', async () => {
      const filePath = 'test.txt';
      const content = 'This is plain text';

      const result = await analyzer.analyzeFile(filePath, content);

      expect(result.path).toBe(filePath);
      expect(result.symbols).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
    });
  });
});

describe('SymbolExtractor', () => {
  let extractor: SymbolExtractor;

  beforeEach(() => {
    extractor = new SymbolExtractor();
  });

  describe('extractSymbols', () => {
    it('should extract nested class members', () => {
      const content = `
        class OuterClass {
          private innerValue: string;
          
          constructor() {
            this.innerValue = '';
          }
          
          public outerMethod(): void {
            class InnerClass {
              innerMethod() {}
            }
          }
        }
      `;

      const symbols = extractor.extractSymbols(content, 'typescript');

      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'OuterClass',
            type: SymbolType.Class,
            members: expect.arrayContaining([
              expect.objectContaining({
                name: 'innerValue',
                type: SymbolType.Property
              }),
              expect.objectContaining({
                name: 'outerMethod',
                type: SymbolType.Method
              })
            ])
          })
        ])
      );
    });

    it('should extract arrow functions', () => {
      const content = `
        const arrowFunc = (x: number) => x * 2;
        export const asyncArrow = async () => {
          return await fetch('/api');
        };
      `;

      const symbols = extractor.extractSymbols(content, 'typescript');

      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'arrowFunc',
            type: SymbolType.Function,
            exported: false
          }),
          expect.objectContaining({
            name: 'asyncArrow',
            type: SymbolType.Function,
            exported: true
          })
        ])
      );
    });

    it('should extract enum symbols', () => {
      const content = `
        export enum Color {
          Red = 'red',
          Green = 'green',
          Blue = 'blue'
        }
      `;

      const symbols = extractor.extractSymbols(content, 'typescript');

      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Color',
            type: SymbolType.Enum,
            exported: true
          })
        ])
      );
    });

    it('should extract namespace symbols', () => {
      const content = `
        namespace Utils {
          export function helper() {}
          export const VALUE = 42;
        }
      `;

      const symbols = extractor.extractSymbols(content, 'typescript');

      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Utils',
            type: SymbolType.Namespace
          })
        ])
      );
    });
  });

  describe('language detection', () => {
    it('should auto-detect TypeScript from file extension', () => {
      const language = extractor.detectLanguage('file.ts');
      expect(language).toBe('typescript');
    });

    it('should auto-detect JavaScript from file extension', () => {
      const language = extractor.detectLanguage('file.js');
      expect(language).toBe('javascript');
    });

    it('should auto-detect Python from file extension', () => {
      const language = extractor.detectLanguage('file.py');
      expect(language).toBe('python');
    });

    it('should auto-detect Go from file extension', () => {
      const language = extractor.detectLanguage('file.go');
      expect(language).toBe('go');
    });

    it('should return unknown for unsupported extensions', () => {
      const language = extractor.detectLanguage('file.xyz');
      expect(language).toBe('unknown');
    });
  });
});

describe('SemanticIndex', () => {
  let index: SemanticIndex;

  beforeEach(() => {
    index = new SemanticIndex();
  });

  describe('addFile', () => {
    it('should add file to index', async () => {
      const fileIndex: FileIndex = {
        path: 'test.ts',
        symbols: [
          {
            name: 'TestClass',
            type: SymbolType.Class,
            line: 1,
            exported: true
          }
        ],
        imports: ['react'],
        exports: ['TestClass'],
        hash: 'abc123',
        size: 1024
      };

      await index.addFile(fileIndex);

      expect(index.hasFile('test.ts')).toBe(true);
      expect(index.getFile('test.ts')).toEqual(fileIndex);
    });

    it('should update existing file in index', async () => {
      const fileIndex1: FileIndex = {
        path: 'test.ts',
        symbols: [],
        imports: [],
        exports: [],
        hash: 'abc123',
        size: 1024
      };

      const fileIndex2: FileIndex = {
        ...fileIndex1,
        hash: 'def456',
        size: 2048
      };

      await index.addFile(fileIndex1);
      await index.addFile(fileIndex2);

      expect(index.getFile('test.ts')).toEqual(fileIndex2);
    });

    it('should update symbol references', async () => {
      const fileIndex: FileIndex = {
        path: 'test.ts',
        symbols: [
          {
            name: 'TestClass',
            type: SymbolType.Class,
            line: 1,
            exported: true
          }
        ],
        imports: [],
        exports: ['TestClass'],
        hash: 'abc123',
        size: 1024
      };

      await index.addFile(fileIndex);

      const references = index.getSymbolReferences('TestClass');
      expect(references).toEqual([
        {
          file: 'test.ts',
          line: 1,
          type: SymbolType.Class,
          exported: true
        }
      ]);
    });
  });

  describe('removeFile', () => {
    it('should remove file from index', async () => {
      const fileIndex: FileIndex = {
        path: 'test.ts',
        symbols: [
          {
            name: 'TestClass',
            type: SymbolType.Class,
            line: 1,
            exported: true
          }
        ],
        imports: [],
        exports: ['TestClass'],
        hash: 'abc123',
        size: 1024
      };

      await index.addFile(fileIndex);
      expect(index.hasFile('test.ts')).toBe(true);

      index.removeFile('test.ts');
      expect(index.hasFile('test.ts')).toBe(false);
    });

    it('should remove symbol references when file is removed', async () => {
      const fileIndex: FileIndex = {
        path: 'test.ts',
        symbols: [
          {
            name: 'TestClass',
            type: SymbolType.Class,
            line: 1,
            exported: true
          }
        ],
        imports: [],
        exports: ['TestClass'],
        hash: 'abc123',
        size: 1024
      };

      await index.addFile(fileIndex);
      expect(index.getSymbolReferences('TestClass')).toHaveLength(1);

      index.removeFile('test.ts');
      expect(index.getSymbolReferences('TestClass')).toEqual([]);
    });
  });

  describe('buildImportGraph', () => {
    it('should build import graph from file imports', async () => {
      const file1: FileIndex = {
        path: 'a.ts',
        symbols: [],
        imports: ['./b', './c'],
        exports: [],
        hash: 'hash1',
        size: 100
      };

      const file2: FileIndex = {
        path: 'b.ts',
        symbols: [],
        imports: ['./c'],
        exports: [],
        hash: 'hash2',
        size: 200
      };

      const file3: FileIndex = {
        path: 'c.ts',
        symbols: [],
        imports: [],
        exports: [],
        hash: 'hash3',
        size: 300
      };

      await index.addFile(file1);
      await index.addFile(file2);
      await index.addFile(file3);

      const graph = index.buildImportGraph();

      expect(graph.get('a.ts')).toEqual({
        imports: ['./b', './c'],
        importedBy: []
      });

      expect(graph.get('b.ts')).toEqual({
        imports: ['./c'],
        importedBy: ['a.ts']
      });

      expect(graph.get('c.ts')).toEqual({
        imports: [],
        importedBy: ['a.ts', 'b.ts']
      });
    });

    it('should handle circular dependencies', async () => {
      const file1: FileIndex = {
        path: 'a.ts',
        symbols: [],
        imports: ['./b'],
        exports: [],
        hash: 'hash1',
        size: 100
      };

      const file2: FileIndex = {
        path: 'b.ts',
        symbols: [],
        imports: ['./a'],
        exports: [],
        hash: 'hash2',
        size: 200
      };

      await index.addFile(file1);
      await index.addFile(file2);

      const graph = index.buildImportGraph();

      expect(graph.get('a.ts')).toEqual({
        imports: ['./b'],
        importedBy: ['b.ts']
      });

      expect(graph.get('b.ts')).toEqual({
        imports: ['./a'],
        importedBy: ['a.ts']
      });
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize index', async () => {
      const fileIndex: FileIndex = {
        path: 'test.ts',
        symbols: [
          {
            name: 'TestClass',
            type: SymbolType.Class,
            line: 1,
            exported: true
          }
        ],
        imports: ['react'],
        exports: ['TestClass'],
        hash: 'abc123',
        size: 1024
      };

      await index.addFile(fileIndex);

      const serialized = index.serialize();
      const newIndex = SemanticIndex.deserialize(serialized);

      expect(newIndex.hasFile('test.ts')).toBe(true);
      expect(newIndex.getFile('test.ts')).toEqual(fileIndex);
      expect(newIndex.getSymbolReferences('TestClass')).toEqual(
        index.getSymbolReferences('TestClass')
      );
    });
  });
});