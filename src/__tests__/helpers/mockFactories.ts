/**
 * Mock factories for common test objects
 */

export const mockSession = {
  create: (overrides = {}) => ({
    id: 'test-session-123',
    messages: [],
    model: 'gpt-4',
    provider: 'copilot',
    timestamp: Date.now(),
    ...overrides,
  }),
  
  withMessages: (messages: any[]) => ({
    id: 'test-session-123',
    messages,
    model: 'gpt-4',
    provider: 'copilot',
    timestamp: Date.now(),
  }),
};

export const mockConfig = {
  create: (overrides = {}) => ({
    provider: 'copilot',
    model: 'gpt-4',
    applyMode: 'auto',
    mouseMode: true,
    outputStyle: 'default',
    ...overrides,
  }),
};

export const mockCommand = {
  create: (name: string, overrides = {}) => ({
    name,
    summary: `Test command ${name}`,
    handler: jest.fn(),
    ...overrides,
  }),
};

export const mockProvider = {
  createCopilot: () => ({
    authenticate: jest.fn().mockResolvedValue({ token: 'mock-token' }),
    getModels: jest.fn().mockResolvedValue(['gpt-4', 'gpt-3.5-turbo']),
    complete: jest.fn().mockResolvedValue({
      content: 'Mock response',
      model: 'gpt-4',
    }),
  }),
};

export const mockFileSystem = {
  createFile: (path: string, content: string) => ({
    path,
    content,
    stats: {
      size: content.length,
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false,
    },
  }),
  
  createDirectory: (path: string) => ({
    path,
    stats: {
      size: 0,
      mtime: new Date(),
      isFile: () => false,
      isDirectory: () => true,
    },
  }),
};

export const mockGitStatus = {
  create: (overrides = {}) => ({
    current: 'main',
    tracking: 'origin/main',
    ahead: 0,
    behind: 0,
    modified: [],
    created: [],
    deleted: [],
    renamed: [],
    conflicted: [],
    ...overrides,
  }),
};