/**
 * Thread-Aware Preservation Integration Tests
 * Tests the integration of thread preservation with the orchestrator
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ThreadPreservationSystem } from '../../context/thread-preservation.js';
import { orchestrator } from '../../runtime/orchestrator.js';
import type { Msg } from '../../runtime/orchestrator.js';

describe('Thread Preservation Integration', () => {
  let threadSystem: ThreadPreservationSystem;

  beforeEach(() => {
    threadSystem = new ThreadPreservationSystem();
    // Clear orchestrator history before each test
    const history = orchestrator.getHistory();
    history.length = 0;
  });

  test('should integrate thread preservation with orchestrator compaction', async () => {
    // Create a conversation with multiple threads
    const history = orchestrator.getHistory();
    
    // Simulate a multi-thread conversation
    const conversationMessages: Msg[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      // Thread 1: Authentication discussion
      { role: 'user', content: 'How do I implement JWT authentication?' },
      { role: 'assistant', content: 'You can use the jsonwebtoken library for JWT authentication.' },
      { role: 'user', content: 'What about refresh tokens?' },
      { role: 'assistant', content: 'Refresh tokens should be stored securely and have longer expiry.' },
      // Thread 2: Database setup
      { role: 'user', content: 'I need to set up PostgreSQL' },
      { role: 'assistant', content: 'Install PostgreSQL and use the pg library for Node.js.' },
      { role: 'user', content: 'How do I create tables?' },
      { role: 'assistant', content: 'Use CREATE TABLE SQL statements or an ORM like Sequelize.' },
      // Thread 3: Going back to auth
      { role: 'user', content: 'Back to authentication - how do I validate tokens?' },
      { role: 'assistant', content: 'Use jwt.verify() to validate tokens against your secret.' }
    ];

    // Add messages to orchestrator history
    conversationMessages.forEach(msg => history.push(msg));

    // Use thread preservation system to compact
    const compactionResult = threadSystem.compactWithThreadPreservation(
      history,
      {
        targetReduction: 0.4,
        preserveThreadCoherence: true
      }
    );

    // Verify compaction results
    expect(compactionResult.messages.length).toBeLessThan(conversationMessages.length);
    expect(compactionResult.preservedThreads.length).toBeGreaterThan(0);
    expect(compactionResult.coherenceScore).toBeGreaterThan(0.8);
    
    // Verify important threads are preserved
    const preservedContent = compactionResult.messages.map(m => m.content).join(' ');
    expect(preservedContent).toContain('JWT');
    expect(preservedContent).toContain('authentication');
  });

  test('should work with orchestrator semantic compaction', async () => {
    // Use the orchestrator's semantic compaction method
    const history = orchestrator.getHistory();
    
    // Add test messages
    const messages: Msg[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Tell me about React hooks' },
      { role: 'assistant', content: 'React hooks are functions that let you use state.' },
      { role: 'user', content: 'What is useState?' },
      { role: 'assistant', content: 'useState is a hook for managing component state.' },
      { role: 'user', content: 'Now explain Python decorators' },
      { role: 'assistant', content: 'Python decorators modify function behavior.' }
    ];
    
    messages.forEach(msg => history.push(msg));
    
    // Use orchestrator's semantic compaction
    const result = orchestrator.compactHistoryWithSemanticAnalysis(0.5);
    
    // Verify the compaction worked
    expect(result.originalLength).toBe(messages.length);
    expect(result.newLength).toBeLessThan(messages.length);
    expect(result.preservationScore).toBeGreaterThan(0.7);
  });

  test('should preserve thread relationships during compaction', () => {
    const messages: Msg[] = [
      { role: 'system', content: 'Assistant ready.' },
      { role: 'user', content: 'Set up the database first' },
      { role: 'assistant', content: 'Database is configured.' },
      { role: 'user', content: 'Great! Now that the database is ready, create the API endpoints' },
      { role: 'assistant', content: 'API endpoints created with database integration.' },
      { role: 'user', content: 'Perfect. Add authentication to the API' },
      { role: 'assistant', content: 'Authentication added to all API endpoints.' }
    ];

    // Identify threads and their relationships
    const threads = threadSystem.identifyThreads(messages);
    const relationships = threadSystem.mapThreadRelationships(threads);
    
    // Compact while preserving dependencies
    const preserved = threadSystem.preserveThreads(threads, {
      threshold: 0.6,
      preserveDependencies: true
    });
    
    // Verify thread preservation maintains relationships
    expect(preserved.length).toBeGreaterThan(0);
    
    // If we preserve the API thread, we should also preserve the database thread
    const hasApiThread = preserved.some(t => t.topic.includes('api'));
    const hasDbThread = preserved.some(t => t.topic.includes('database'));
    
    if (hasApiThread) {
      expect(hasDbThread || preserved.length === 1).toBe(true);
    }
  });

  test('should handle real-world conversation patterns', () => {
    // Simulate a realistic debugging session
    const debugSession: Msg[] = [
      { role: 'system', content: 'Debug assistant ready.' },
      { role: 'user', content: 'My app is crashing with a null pointer exception' },
      { role: 'assistant', content: 'Let me help debug that. Where is the error occurring?' },
      { role: 'user', content: 'In the user authentication module' },
      { role: 'assistant', content: 'Check if the user object is defined before accessing properties.' },
      { role: 'user', content: 'Found it! The user was undefined. Fixed now.' },
      { role: 'assistant', content: 'Great! Make sure to add null checks.' },
      { role: 'user', content: 'Thanks! Now I have a different issue with the database connection' },
      { role: 'assistant', content: 'What database error are you seeing?' },
      { role: 'user', content: 'Connection timeout after 30 seconds' },
      { role: 'assistant', content: 'Check your connection string and network settings.' }
    ];

    const threads = threadSystem.identifyThreads(debugSession);
    
    // Should identify separate threads for different issues
    expect(threads.length).toBeGreaterThanOrEqual(2);
    
    // Score importance - debugging threads should score high
    const scores = threadSystem.scoreThreadImportance(threads);
    expect(scores.every(score => score > 0.3)).toBe(true);
    
    // Compact the session
    const compacted = threadSystem.compactWithThreadPreservation(debugSession, {
      targetReduction: 0.3,
      preserveThreadCoherence: true
    });
    
    // Should preserve both problem-solution pairs
    expect(compacted.preservedThreads.length).toBeGreaterThanOrEqual(1);
    expect(compacted.coherenceScore).toBeGreaterThan(0.8);
  });
});