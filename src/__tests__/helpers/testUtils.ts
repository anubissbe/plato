/**
 * General test utilities
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * Create a temporary directory for testing
 */
export async function createTempDir(): Promise<string> {
  const tempBase = tmpdir();
  const randomName = `plato-test-${randomBytes(8).toString('hex')}`;
  const tempPath = join(tempBase, randomName);
  await fs.mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Wait for a condition to be true
 */
export function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = async () => {
      try {
        const result = await condition();
        if (result) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, interval);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    check();
  });
}

/**
 * Capture console output during test execution
 */
export class ConsoleCapture {
  private originalLog!: typeof console.log;
  private originalError!: typeof console.error;
  private originalWarn!: typeof console.warn;
  private captured: { type: string; args: any[] }[] = [];

  start() {
    this.originalLog = console.log;
    this.originalError = console.error;
    this.originalWarn = console.warn;
    
    console.log = (...args) => {
      this.captured.push({ type: 'log', args });
    };
    
    console.error = (...args) => {
      this.captured.push({ type: 'error', args });
    };
    
    console.warn = (...args) => {
      this.captured.push({ type: 'warn', args });
    };
  }

  stop() {
    console.log = this.originalLog;
    console.error = this.originalError;
    console.warn = this.originalWarn;
  }

  getOutput(): string[] {
    return this.captured.map(entry => 
      entry.args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ')
    );
  }

  clear() {
    this.captured = [];
  }
}

/**
 * Mock stdin for testing interactive prompts
 */
export class MockStdin {
  private listeners: Array<(data: Buffer) => void> = [];

  on(event: string, listener: (data: Buffer) => void) {
    if (event === 'data') {
      this.listeners.push(listener);
    }
  }

  send(input: string) {
    const buffer = Buffer.from(input);
    this.listeners.forEach(listener => listener(buffer));
  }

  sendSequence(inputs: string[], delay = 100): Promise<void> {
    return inputs.reduce((promise, input, index) => {
      return promise.then(() => 
        new Promise(resolve => {
          setTimeout(() => {
            this.send(input);
            resolve(undefined);
          }, delay * index);
        })
      );
    }, Promise.resolve());
  }
}

/**
 * Create a mock function that returns different values on successive calls
 */
export function mockSequence<T>(...values: T[]): jest.Mock<T> {
  let index = 0;
  return jest.fn(() => {
    const value = values[index % values.length];
    index++;
    return value;
  });
}

/**
 * Assert that an async function throws
 */
export async function expectAsync(promise: Promise<any>) {
  return {
    async toThrow(expected?: string | RegExp | Error) {
      try {
        await promise;
        throw new Error('Expected promise to throw');
      } catch (error: any) {
        if (expected) {
          if (typeof expected === 'string') {
            expect(error.message).toContain(expected);
          } else if (expected instanceof RegExp) {
            expect(error.message).toMatch(expected);
          } else {
            expect(error).toEqual(expected);
          }
        }
      }
    },
  };
}