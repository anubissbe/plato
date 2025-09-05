/**
 * Custom Jest matchers for Plato-specific assertions
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCommand(): R;
      toMatchClaudeCodeFormat(): R;
      toHaveSessionStructure(): R;
      toBeWithinTokenLimit(limit: number): R;
    }
  }
}

export const customMatchers = {
  toBeValidCommand(received: any) {
    const pass = 
      typeof received === 'object' &&
      typeof received.name === 'string' &&
      received.name.startsWith('/') &&
      typeof received.summary === 'string';

    return {
      pass,
      message: () =>
        pass
          ? expect.stringContaining('Expected not to be a valid command')
          : expect.stringContaining('Expected to be a valid command with name starting with / and summary'),
    };
  },

  toMatchClaudeCodeFormat(received: string) {
    // Check for common Claude Code output patterns
    const patterns = [
      /✻ Welcome to/,  // Welcome message
      /📝 Writing/,    // File write indicator
      /✓ Wrote \d+ lines?/,  // Write confirmation
      /❌|✅|⚠️|ℹ️|🔄/,  // Status indicators
    ];

    const pass = patterns.some(pattern => pattern.test(received));

    return {
      pass,
      message: () =>
        pass
          ? expect.stringContaining('Expected not to match Claude Code format')
          : expect.stringContaining('Expected to match Claude Code output format'),
    };
  },

  toHaveSessionStructure(received: any) {
    const requiredFields = ['id', 'messages', 'model', 'provider'];
    const pass = 
      typeof received === 'object' &&
      requiredFields.every(field => field in received) &&
      Array.isArray(received.messages);

    return {
      pass,
      message: () =>
        pass
          ? expect.stringContaining('Expected not to have session structure')
          : expect.stringContaining('Expected to have session structure with id, messages, model, and provider'),
    };
  },

  toBeWithinTokenLimit(received: string, limit: number) {
    // Simple token estimation (rough approximation)
    const estimatedTokens = received.split(/\s+/).length * 1.3;
    const pass = estimatedTokens <= limit;

    return {
      pass,
      message: () =>
        pass
          ? expect.stringContaining(`Expected to exceed token limit of ${limit}`)
          : expect.stringContaining(`Expected to be within token limit of ${limit}, but estimated ${Math.round(estimatedTokens)} tokens`),
    };
  },
};

// Register custom matchers
expect.extend(customMatchers);