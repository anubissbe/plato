/**
 * Jest setup file for global test configuration
 * This runs before all test suites
 */

// Suppress console output during tests unless explicitly needed
const originalConsole = { ...console };

beforeAll(() => {
  // Silence console methods during tests
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep error for debugging failed tests
  console.error = originalConsole.error;
});

afterAll(() => {
  // Restore original console
  Object.assign(console, originalConsole);
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PLATO_TEST_MODE = 'true';

// Setup fs mocks with proper implementations
import { tmpdir } from 'os';
import path from 'path';

// Mock fs/promises with actual implementations where needed
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn(),
  rename: jest.fn(),
  copyFile: jest.fn(),
  appendFile: jest.fn(),
  realpath: jest.fn(),
  mkdtemp: jest.fn(async (prefix: string) => {
    const tempPath = path.join(tmpdir(), `${prefix}${Math.random().toString(36).substr(2, 9)}`);
    // Actually create the directory for tests that chdir into it
    const fs = require('fs');
    fs.mkdirSync(tempPath, { recursive: true });
    return tempPath;
  }),
}));

// Mock execa for command execution
jest.mock('execa', () => ({
  execaCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
  execa: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
}));

// Mock terminal-specific functionality that doesn't work in tests
// We check if the module exists before mocking
try {
  jest.mock('ink', () => ({
    render: jest.fn(),
    Box: jest.fn(),
    Text: jest.fn(),
    useApp: jest.fn(() => ({ exit: jest.fn() })),
    useInput: jest.fn(),
    useStdin: jest.fn(() => ({
      stdin: {
        ...process.stdin,
        setRawMode: jest.fn(),
        isRaw: false,
        write: jest.fn(),
      },
      setRawMode: jest.fn(),
      isRawModeSupported: false,
    })),
  }));
} catch {
  // Ink module not used in this test
}

// Prevent mouse mode terminal escape sequences in tests
if (process.env.NODE_ENV === 'test') {
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: any, ...args: any[]) => {
    // Filter out mouse mode escape sequences
    if (typeof chunk === 'string') {
      const filtered = chunk.replace(/\x1b\[\?1000[hl]|\x1b\[\?1002[hl]|\x1b\[\?1006[hl]|\x1b\[\?1005[hl]|\x1b\[\?1015[hl]|\x1b\[\?1004[hl]/g, '');
      if (filtered !== chunk) {
        return true; // Silently ignore mouse escape sequences
      }
    }
    return originalWrite(chunk, ...args);
  }) as any;
}

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  waitFor: (condition: () => boolean, timeout = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for condition'));
        }
      }, 100);
    });
  },
  
  // Mock file system helpers
  mockFs: {
    setup: () => {
      jest.mock('fs/promises');
    },
    restore: () => {
      jest.unmock('fs/promises');
    },
  },
};

// Extend Jest matchers with jest-extended
import 'jest-extended/all';

// TypeScript declarations for global test utilities
declare global {
  var testUtils: {
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
    mockFs: {
      setup: () => void;
      restore: () => void;
    };
  };
}

export {};