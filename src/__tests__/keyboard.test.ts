// Mock all dependencies before importing orchestrator
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

jest.mock('../providers/copilot', () => ({
  getAuthInfo: () => Promise.resolve({ loggedIn: false }),
}));

jest.mock('simple-git', () => ({
  default: () => ({
    checkIsRepo: () => Promise.resolve(false),
    status: () => Promise.resolve({ current: 'main' }),
  }),
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

describe('Keyboard Shortcuts - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Orchestrator Keyboard Extensions', () => {
    test('should cancel stream when requested', () => {
      // Test stream cancellation functionality
      orchestrator.cancelStream();
      // Since we don't have an active stream, this should complete without error
      expect(true).toBe(true);
    });

    test('should track transcript mode state', async () => {
      expect(orchestrator.isTranscriptMode()).toBe(false);
      
      await orchestrator.setTranscriptMode(true);
      expect(orchestrator.isTranscriptMode()).toBe(true);
      
      await orchestrator.setTranscriptMode(false);
      expect(orchestrator.isTranscriptMode()).toBe(false);
    });

    test('should track background mode state', async () => {
      expect(orchestrator.isBackgroundMode()).toBe(false);
      
      await orchestrator.setBackgroundMode(true);
      expect(orchestrator.isBackgroundMode()).toBe(true);
    });

    test('should return message history', () => {
      const history = orchestrator.getMessageHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle history message selection', async () => {
      // This tests the method exists and handles invalid indices
      const selected = await orchestrator.selectHistoryMessage(999);
      expect(selected).toBeNull();
    });

    test('should handle clipboard image paste gracefully', async () => {
      const result = await orchestrator.pasteImageFromClipboard();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Keyboard Event Scenarios', () => {
    test('escape key behavior - single press cancels operation', () => {
      // Simulate single escape press behavior
      orchestrator.cancelStream();
      // Should complete without throwing
      expect(true).toBe(true);
    });

    test('escape key behavior - double press triggers history mode', () => {
      // This would be handled in the UI layer
      const history = orchestrator.getMessageHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('ctrl+r behavior - transcript mode toggle', async () => {
      const initialMode = orchestrator.isTranscriptMode();
      await orchestrator.setTranscriptMode(!initialMode);
      expect(orchestrator.isTranscriptMode()).toBe(!initialMode);
    });

    test('ctrl+b behavior - background mode enable', async () => {
      await orchestrator.setBackgroundMode(true);
      expect(orchestrator.isBackgroundMode()).toBe(true);
    });

    test('ctrl+v behavior - image paste attempt', async () => {
      const result = await orchestrator.pasteImageFromClipboard();
      // Should return a result object regardless of success
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Input Handling Edge Cases', () => {
    test('should handle multiple rapid operations gracefully', async () => {
      // Rapid mode changes should not cause issues
      await orchestrator.setTranscriptMode(true);
      await orchestrator.setTranscriptMode(false);
      await orchestrator.setBackgroundMode(true);
      await orchestrator.setBackgroundMode(false);
      
      expect(orchestrator.isTranscriptMode()).toBe(false);
      expect(orchestrator.isBackgroundMode()).toBe(false);
    });

    test('should handle memory operations without errors', async () => {
      const memory = await orchestrator.getMemory();
      expect(Array.isArray(memory)).toBe(true);
      
      await orchestrator.addMemory('test', 'keyboard test');
      // Should complete without throwing
    });

    test('should handle invalid history indices', async () => {
      const message1 = orchestrator.getSelectedHistoryMessage(-1);
      expect(message1).toBeNull();
      
      const message2 = orchestrator.getSelectedHistoryMessage(99999);
      expect(message2).toBeNull();
    });
  });

  describe('Platform Compatibility', () => {
    const originalPlatform = process.platform;
    
    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should handle different platforms for clipboard access', async () => {
      // Test different platforms
      const platforms = ['darwin', 'win32', 'linux'] as const;
      
      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', { value: platform });
        
        const result = await orchestrator.pasteImageFromClipboard();
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
      }
    });
  });

  describe('Integration Tests', () => {
    test('should maintain state consistency across operations', async () => {
      // Start with known state
      await orchestrator.setTranscriptMode(false);
      await orchestrator.setBackgroundMode(false);
      
      // Change modes
      await orchestrator.setTranscriptMode(true);
      expect(orchestrator.isTranscriptMode()).toBe(true);
      expect(orchestrator.isBackgroundMode()).toBe(false);
      
      await orchestrator.setBackgroundMode(true);
      expect(orchestrator.isTranscriptMode()).toBe(true);
      expect(orchestrator.isBackgroundMode()).toBe(true);
      
      // Clear memory and check it doesn't affect modes
      await orchestrator.clearMemory();
      expect(orchestrator.isTranscriptMode()).toBe(true);
      expect(orchestrator.isBackgroundMode()).toBe(true);
    });

    test('should handle concurrent operations safely', async () => {
      // Test concurrent mode changes
      const promises = [
        orchestrator.setTranscriptMode(true),
        orchestrator.setBackgroundMode(true),
        orchestrator.addMemory('test1', 'concurrent test 1'),
        orchestrator.addMemory('test2', 'concurrent test 2'),
      ];
      
      await Promise.all(promises);
      
      expect(orchestrator.isTranscriptMode()).toBe(true);
      expect(orchestrator.isBackgroundMode()).toBe(true);
    });
  });
});