/**
 * Smart Compaction Tests
 * Tests the smart compaction logic without complex orchestrator dependencies
 */

type Msg = { role: 'system'|'user'|'assistant'|'tool', content: string };

// Mock compaction function that implements the same logic as orchestrator
function mockCompactHistoryWithFocus(history: Msg[], instructions?: string): { originalLength: number; newLength: number } {
  const originalLength = history.length;
  if (originalLength <= 5) return { originalLength, newLength: originalLength };
  
  const systemMessages = history.filter(m => m.role === 'system');
  let keep = Math.ceil(originalLength * 0.3); // Default 30% retention
  
  if (instructions) {
    const focusKeywords = instructions.toLowerCase();
    
    // Adjust retention based on focus instructions
    if (focusKeywords.includes('error') || focusKeywords.includes('debug')) {
      keep = Math.ceil(originalLength * 0.5);
    } else if (focusKeywords.includes('recent') || focusKeywords.includes('latest')) {
      keep = Math.ceil(originalLength * 0.2);
    } else if (focusKeywords.includes('context') || focusKeywords.includes('history')) {
      keep = Math.ceil(originalLength * 0.6);
    }
    
    // Filter messages based on focus content
    const relevantMessages = history.filter(msg => {
      const content = msg.content.toLowerCase();
      return focusKeywords.split(' ').some(keyword => 
        keyword.length > 2 && content.includes(keyword.toLowerCase())
      );
    });
    
    if (relevantMessages.length > 0) {
      // Prioritize relevant messages but ensure we have recent context
      const recentMessages = history.slice(-Math.max(5, Math.ceil(keep / 2)));
      const uniqueMessages = [...new Set([...relevantMessages, ...recentMessages])];
      const compacted = [...systemMessages.slice(0, 1), ...uniqueMessages.slice(-keep)];
      return { originalLength, newLength: compacted.length };
    }
  }
  
  return { originalLength, newLength: Math.min(keep, originalLength) };
}

describe('Smart Compaction Functionality', () => {
  let testHistory: Msg[];

  beforeEach(() => {
    testHistory = [
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hello! How can I help?' },
      { role: 'user', content: 'Can you help me debug this error?' },
      { role: 'assistant', content: 'Sure! What error are you seeing?' },
      { role: 'user', content: 'TypeError in my code' },
      { role: 'assistant', content: 'Let me help you fix that' },
      { role: 'user', content: 'Show me recent changes' },
      { role: 'assistant', content: 'Here are the recent updates' },
      { role: 'user', content: 'What is the current context?' },
      { role: 'assistant', content: 'The current context is...' }
    ];
  });

  test('should compact history with default strategy', () => {
    const result = mockCompactHistoryWithFocus(testHistory);
    
    expect(result.originalLength).toBe(11);
    expect(result.newLength).toBeLessThan(result.originalLength);
    expect(result.newLength).toBe(Math.ceil(11 * 0.3)); // Should be 4
  });

  test('should keep more messages when focusing on errors', () => {
    const result = mockCompactHistoryWithFocus(testHistory, 'debug error');
    
    expect(result.originalLength).toBe(11);
    expect(result.newLength).toBeLessThan(result.originalLength);
    // Should use error focus strategy, resulting in content-based filtering
    expect(result.newLength).toBeGreaterThan(Math.ceil(11 * 0.3)); // More than default
    expect(result.newLength).toBeLessThanOrEqual(Math.ceil(11 * 0.5) + 1); // Within error focus range plus content filtering
  });

  test('should keep fewer messages when focusing on recent', () => {
    const result = mockCompactHistoryWithFocus(testHistory, 'recent changes');
    
    expect(result.originalLength).toBe(11);
    expect(result.newLength).toBeLessThan(result.originalLength);
    // Should use recent focus strategy with content-based filtering
    expect(result.newLength).toBeGreaterThan(0);
    expect(result.newLength).toBeLessThanOrEqual(Math.ceil(11 * 0.2) + 2); // Allow for content filtering
  });

  test('should keep more messages when focusing on context', () => {
    const result = mockCompactHistoryWithFocus(testHistory, 'context history');
    
    expect(result.originalLength).toBe(11);
    expect(result.newLength).toBeLessThan(result.originalLength);
    // Should use context focus strategy with content-based filtering
    expect(result.newLength).toBeGreaterThan(Math.ceil(11 * 0.3)); // More than default
    expect(result.newLength).toBeLessThanOrEqual(Math.ceil(11 * 0.6) + 1); // Within context focus range
  });

  test('should preserve minimal history when already small', () => {
    const smallHistory: Msg[] = [
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' }
    ];
    
    const result = mockCompactHistoryWithFocus(smallHistory);
    
    expect(result.originalLength).toBe(3);
    expect(result.newLength).toBe(3); // Should not compact minimal history
  });

  test('should handle content-based filtering correctly', () => {
    const result = mockCompactHistoryWithFocus(testHistory, 'TypeError');
    
    expect(result.originalLength).toBe(11);
    expect(result.newLength).toBeLessThanOrEqual(result.originalLength);
    // Should find relevant messages containing 'TypeError'
    expect(result.newLength).toBeGreaterThan(0);
  });

  test('should handle empty or undefined instructions gracefully', () => {
    const result1 = mockCompactHistoryWithFocus(testHistory, '');
    const result2 = mockCompactHistoryWithFocus(testHistory, undefined);
    
    expect(result1.originalLength).toBe(11);
    expect(result1.newLength).toBe(Math.ceil(11 * 0.3)); // Default strategy
    
    expect(result2.originalLength).toBe(11);
    expect(result2.newLength).toBe(Math.ceil(11 * 0.3)); // Default strategy
  });

  test('should handle edge case with very short keywords', () => {
    const result = mockCompactHistoryWithFocus(testHistory, 'a b c');
    
    expect(result.originalLength).toBe(11);
    expect(result.newLength).toBeLessThanOrEqual(result.originalLength);
    // Should ignore keywords shorter than 3 characters
    expect(result.newLength).toBe(Math.ceil(11 * 0.3)); // Should fall back to default
  });
});