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
      stdin: process.stdin,
      setRawMode: jest.fn(),
      isRawModeSupported: false,
    })),
  }));
} catch {
  // Ink module not used in this test
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