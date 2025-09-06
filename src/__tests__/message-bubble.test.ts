import { MessageBubble } from '../tui/MessageBubble';

describe('MessageBubble', () => {
  describe('Component Structure', () => {
    it('should create message bubble with required properties', () => {
      const bubble = new MessageBubble({
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      });

      expect(bubble.role).toBe('user');
      expect(bubble.content).toBe('Test message');
      expect(bubble.timestamp).toBeInstanceOf(Date);
    });

    it('should support different roles', () => {
      const userBubble = new MessageBubble({ role: 'user', content: 'User message', timestamp: new Date() });
      const assistantBubble = new MessageBubble({ role: 'assistant', content: 'Assistant message', timestamp: new Date() });
      const systemBubble = new MessageBubble({ role: 'system', content: 'System message', timestamp: new Date() });

      expect(userBubble.role).toBe('user');
      expect(assistantBubble.role).toBe('assistant');
      expect(systemBubble.role).toBe('system');
    });

    it('should format timestamps correctly', () => {
      const date = new Date('2025-01-06T10:30:00');
      const bubble = new MessageBubble({
        role: 'user',
        content: 'Test',
        timestamp: date,
      });

      expect(bubble.getFormattedTime()).toMatch(/10:30/);
      expect(bubble.getRelativeTime()).toBeDefined();
    });
  });

  describe('Role Indicators', () => {
    it('should provide correct role indicators', () => {
      const userBubble = new MessageBubble({ role: 'user', content: 'Test', timestamp: new Date() });
      const assistantBubble = new MessageBubble({ role: 'assistant', content: 'Test', timestamp: new Date() });
      const systemBubble = new MessageBubble({ role: 'system', content: 'Test', timestamp: new Date() });

      expect(userBubble.getRoleIndicator()).toBe('👤');
      expect(assistantBubble.getRoleIndicator()).toBe('🤖');
      expect(systemBubble.getRoleIndicator()).toBe('⚙️');
    });

    it('should provide correct role colors', () => {
      const userBubble = new MessageBubble({ role: 'user', content: 'Test', timestamp: new Date() });
      const assistantBubble = new MessageBubble({ role: 'assistant', content: 'Test', timestamp: new Date() });

      expect(userBubble.getRoleColor()).toBe('blue');
      expect(assistantBubble.getRoleColor()).toBe('green');
    });
  });

  describe('Content Formatting', () => {
    it('should handle multiline content', () => {
      const bubble = new MessageBubble({
        role: 'user',
        content: 'Line 1\nLine 2\nLine 3',
        timestamp: new Date(),
      });

      const lines = bubble.getContentLines();
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
    });

    it('should truncate long content when needed', () => {
      const longContent = 'A'.repeat(1000);
      const bubble = new MessageBubble({
        role: 'user',
        content: longContent,
        timestamp: new Date(),
      });

      const truncated = bubble.getTruncatedContent(100);
      expect(truncated.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(truncated).toContain('...');
    });

    it('should detect and mark code blocks', () => {
      const contentWithCode = 'Here is some code:\n```javascript\nconsole.log("test");\n```';
      const bubble = new MessageBubble({
        role: 'assistant',
        content: contentWithCode,
        timestamp: new Date(),
      });

      expect(bubble.hasCodeBlocks()).toBe(true);
      const codeBlocks = bubble.getCodeBlocks();
      expect(codeBlocks).toHaveLength(1);
      expect(codeBlocks[0].language).toBe('javascript');
      expect(codeBlocks[0].code).toContain('console.log');
    });
  });

  describe('Status Indicators', () => {
    it('should support status indicators', () => {
      const bubble = new MessageBubble({
        role: 'assistant',
        content: 'Processing...',
        timestamp: new Date(),
        status: 'streaming',
      });

      expect(bubble.status).toBe('streaming');
      expect(bubble.getStatusIndicator()).toBe('⏳');
    });

    it('should handle different status types', () => {
      const streamingBubble = new MessageBubble({ role: 'assistant', content: 'Test', timestamp: new Date(), status: 'streaming' });
      const completeBubble = new MessageBubble({ role: 'assistant', content: 'Test', timestamp: new Date(), status: 'complete' });
      const errorBubble = new MessageBubble({ role: 'assistant', content: 'Test', timestamp: new Date(), status: 'error' });

      expect(streamingBubble.getStatusIndicator()).toBe('⏳');
      expect(completeBubble.getStatusIndicator()).toBe('✅');
      expect(errorBubble.getStatusIndicator()).toBe('❌');
    });
  });

  describe('Metadata', () => {
    it('should support metadata attachments', () => {
      const bubble = new MessageBubble({
        role: 'assistant',
        content: 'Test',
        timestamp: new Date(),
        metadata: {
          model: 'gpt-4',
          tokens: 150,
          toolCalls: ['search', 'calculate'],
        },
      });

      expect(bubble.metadata?.model).toBe('gpt-4');
      expect(bubble.metadata?.tokens).toBe(150);
      expect(bubble.metadata?.toolCalls).toContain('search');
    });

    it('should format metadata for display', () => {
      const bubble = new MessageBubble({
        role: 'assistant',
        content: 'Test',
        timestamp: new Date(),
        metadata: {
          model: 'gpt-4',
          tokens: 150,
        },
      });

      const formattedMeta = bubble.getFormattedMetadata();
      expect(formattedMeta).toContain('gpt-4');
      expect(formattedMeta).toContain('150');
    });
  });
});