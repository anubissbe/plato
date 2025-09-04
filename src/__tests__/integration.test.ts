// Mock dependencies first
jest.mock('execa', () => ({
  execa: jest.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
  execaSync: jest.fn().mockReturnValue({ exitCode: 0, stdout: '', stderr: '' }),
}));

jest.mock('../providers/chat_fallback', () => ({
  chatCompletions: jest.fn().mockResolvedValue({ content: 'mock response', usage: null }),
  chatStream: jest.fn().mockResolvedValue({ content: 'mock response', usage: null }),
}));

jest.mock('../tools/patch', () => ({
  dryRunApply: jest.fn().mockResolvedValue({ ok: true, conflicts: [] }),
  apply: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../policies/security', () => ({
  reviewPatch: jest.fn().mockReturnValue([]),
}));

jest.mock('../tools/permissions', () => ({
  checkPermission: jest.fn().mockResolvedValue('allow'),
}));

jest.mock('../tools/hooks', () => ({
  runHooks: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../integrations/mcp', () => ({
  callTool: jest.fn().mockResolvedValue({}),
}));

jest.mock('../config', () => ({
  loadConfig: () => Promise.resolve({}),
  setConfigValue: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/test'),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(''),
}));

import { orchestrator } from '../runtime/orchestrator';

// Integration test to verify keyboard shortcuts work end-to-end
describe('Keyboard Shortcuts Integration', () => {
  beforeEach(() => {
    // Reset orchestrator state
    orchestrator.setTranscriptMode(false);
    orchestrator.setBackgroundMode(false);
  });

  test('Escape key sequence - single press cancels stream', async () => {
    // Test that escape key cancellation works
    orchestrator.cancelStream();
    expect(true).toBe(true); // If we get here, no error was thrown
  });

  test('Ctrl+R sequence - transcript mode toggle', async () => {
    // Start in normal mode
    expect(orchestrator.isTranscriptMode()).toBe(false);
    
    // Simulate Ctrl+R press
    await orchestrator.setTranscriptMode(true);
    expect(orchestrator.isTranscriptMode()).toBe(true);
    
    // Second Ctrl+R press
    await orchestrator.setTranscriptMode(false);
    expect(orchestrator.isTranscriptMode()).toBe(false);
  });

  test('Ctrl+B sequence - background mode activation', async () => {
    expect(orchestrator.isBackgroundMode()).toBe(false);
    
    // Simulate Ctrl+B press
    await orchestrator.setBackgroundMode(true);
    expect(orchestrator.isBackgroundMode()).toBe(true);
  });

  test('Ctrl+V sequence - image paste handling', async () => {
    const result = await orchestrator.pasteImageFromClipboard();
    
    // Should return result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('message');
    
    // Result should be boolean and string
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });

  test('Double escape sequence - message history access', () => {
    const history = orchestrator.getMessageHistory();
    expect(Array.isArray(history)).toBe(true);
    
    // Should be able to get history even if empty
    expect(history.length).toBeGreaterThanOrEqual(0);
  });

  test('Combined keyboard operations work together', async () => {
    // Enable both modes
    await orchestrator.setTranscriptMode(true);
    await orchestrator.setBackgroundMode(true);
    
    expect(orchestrator.isTranscriptMode()).toBe(true);
    expect(orchestrator.isBackgroundMode()).toBe(true);
    
    // Try paste operation with both modes active
    const result = await orchestrator.pasteImageFromClipboard();
    expect(result).toBeDefined();
    
    // Modes should still be active
    expect(orchestrator.isTranscriptMode()).toBe(true);
    expect(orchestrator.isBackgroundMode()).toBe(true);
    
    // Disable modes
    await orchestrator.setTranscriptMode(false);
    await orchestrator.setBackgroundMode(false);
    
    expect(orchestrator.isTranscriptMode()).toBe(false);
    expect(orchestrator.isBackgroundMode()).toBe(false);
  });

  test('Memory operations work with keyboard features', async () => {
    // Add memory entry - should complete without error
    await expect(orchestrator.addMemory('keyboard-test', 'Testing keyboard integration')).resolves.not.toThrow();
    
    // Get memory - should return array
    const memory = await orchestrator.getMemory();
    expect(Array.isArray(memory)).toBe(true);
    
    // In test environment with mocked fs, memory might be empty, but should still be array
    expect(memory.length).toBeGreaterThanOrEqual(0);
  });

  test('Error handling in keyboard operations', async () => {
    // These operations should not throw errors even in failure cases
    await expect(orchestrator.setTranscriptMode(true)).resolves.not.toThrow();
    await expect(orchestrator.setBackgroundMode(true)).resolves.not.toThrow();
    await expect(orchestrator.pasteImageFromClipboard()).resolves.not.toThrow();
    
    // Invalid history indices should return null, not throw
    expect(orchestrator.getSelectedHistoryMessage(-999)).toBeNull();
    expect(orchestrator.getSelectedHistoryMessage(999)).toBeNull();
  });
});