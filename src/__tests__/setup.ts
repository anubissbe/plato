// Global test setup
import '@testing-library/jest-dom';

// Mock process.stdout to prevent test output interference
Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
Object.defineProperty(process.stdout, 'rows', { value: 24, writable: true });

// Disable console output during tests unless debugging
const originalConsole = console;
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Keep the original console available for debugging
(global as any).originalConsole = originalConsole;