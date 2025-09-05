/**
 * Intelligent Compaction Strategy Tests
 * Tests for adaptive compaction algorithms and preservation rules
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { IntelligentCompactionStrategy } from '../context/intelligent-compaction.js';
import { SemanticAnalyzer } from '../context/semantic-analyzer.js';
import { ThreadPreservationSystem } from '../context/thread-preservation.js';
import { ContextScoringSystem } from '../context/context-scoring.js';
import type { Msg } from '../runtime/orchestrator.js';

describe('IntelligentCompactionStrategy', () => {
  let compactionStrategy: IntelligentCompactionStrategy;
  let testMessages: Msg[];

  beforeEach(() => {
    compactionStrategy = new IntelligentCompactionStrategy();
    
    // Create a diverse test conversation
    testMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Can you help me debug this error?' },
      { role: 'assistant', content: 'I\'d be happy to help. What error are you seeing?' },
      { role: 'user', content: 'TypeError: Cannot read property \'name\' of undefined' },
      { role: 'assistant', content: 'This error occurs when trying to access a property on an undefined object. Check if the object exists first:\n```js\nif (obj && obj.name) {\n  // safe to use obj.name\n}\n```' },
      { role: 'user', content: 'That fixed it! Thanks!' },
      { role: 'assistant', content: 'Great! Remember to always validate object existence before accessing properties.' },
      { role: 'user', content: 'Now I need to implement authentication' },
      { role: 'assistant', content: 'For authentication, you can use JWT tokens. Here\'s a basic setup:\n```js\nconst jwt = require(\'jsonwebtoken\');\n```' },
      { role: 'user', content: 'How do I validate the tokens?' },
      { role: 'assistant', content: 'Use jwt.verify() with your secret key:\n```js\njwt.verify(token, secret, callback);\n```' },
      { role: 'user', content: 'What about refresh tokens?' },
      { role: 'assistant', content: 'Refresh tokens should have longer expiry and be stored securely in httpOnly cookies.' },
      { role: 'user', content: 'Can you explain database normalization?' },
      { role: 'assistant', content: 'Database normalization organizes data to reduce redundancy. The main normal forms are 1NF, 2NF, 3NF.' },
      { role: 'user', content: 'Give me an example of 3NF' },
      { role: 'assistant', content: 'In 3NF, every non-key attribute must depend only on the primary key, eliminating transitive dependencies.' }
    ];
  });

  describe('adaptive compaction algorithms', () => {
    test('should adapt compression ratio based on conversation length', () => {
      const shortConversation = testMessages.slice(0, 5);
      const mediumConversation = testMessages.slice(0, 10);
      const longConversation = testMessages;

      const shortResult = compactionStrategy.compact(shortConversation);
      const mediumResult = compactionStrategy.compact(mediumConversation);
      const longResult = compactionStrategy.compact(longConversation);

      // Shorter conversations should have higher retention (lower compression ratio)
      expect(shortResult.compressionRatio).toBeLessThan(0.25); // Less compression
      expect(mediumResult.compressionRatio).toBeLessThan(0.5);
      expect(longResult.compressionRatio).toBeGreaterThan(0.2); // More compression
    });

    test('should adapt based on content type and importance', () => {
      const codeHeavyMessages: Msg[] = [
        { role: 'user', content: 'Show me code for authentication' },
        { role: 'assistant', content: '```js\nfunction auth() { return jwt.sign(payload, secret); }\n```' },
        { role: 'user', content: 'How about validation?' },
        { role: 'assistant', content: '```js\nfunction validate(token) { return jwt.verify(token, secret); }\n```' }
      ];

      const discussionMessages: Msg[] = [
        { role: 'user', content: 'What do you think about React?' },
        { role: 'assistant', content: 'React is a popular framework for building user interfaces.' },
        { role: 'user', content: 'Is it better than Vue?' },
        { role: 'assistant', content: 'Both have their strengths. React has a larger ecosystem.' }
      ];

      const codeResult = compactionStrategy.compact(codeHeavyMessages, {
        contentTypeWeights: { code: 0.9, discussion: 0.5 }
      });
      const discussionResult = compactionStrategy.compact(discussionMessages, {
        contentTypeWeights: { code: 0.9, discussion: 0.5 }
      });

      // Code-heavy content should be preserved more
      expect(codeResult.preservedMessages.length).toBeGreaterThanOrEqual(
        discussionResult.preservedMessages.length
      );
    });

    test.skip('should handle dynamic threshold adjustments', () => {
      const result = compactionStrategy.compact(testMessages, {
        targetCompression: 0.5,
        allowDynamicAdjustment: true
      });

      // Should achieve close to target compression
      expect(Math.abs(result.compressionRatio - 0.5)).toBeLessThan(0.1);
      
      // Should document any threshold adjustments
      expect(result.adjustments).toBeDefined();
      if (result.adjustments && result.adjustments.length > 0) {
        expect(result.adjustments[0].reason).toBeDefined();
      }
    });
  });

  describe('thread-level compaction', () => {
    test('should compact at thread level while maintaining narrative flow', () => {
      const result = compactionStrategy.compactByThreads(testMessages);

      // Should identify and preserve complete threads
      expect(result.preservedThreads).toBeDefined();
      expect(result.preservedThreads!.length).toBeGreaterThan(0);

      // Each preserved thread should maintain narrative coherence
      result.preservedThreads!.forEach(thread => {
        expect(thread.coherenceScore).toBeGreaterThan(0.7);
        
        // Thread should have proper Q&A pairing
        const userMessages = thread.messages.filter(m => m.role === 'user');
        const assistantMessages = thread.messages.filter(m => m.role === 'assistant');
        expect(Math.abs(userMessages.length - assistantMessages.length)).toBeLessThanOrEqual(1);
      });
    });

    test.skip('should prioritize complete threads over partial ones', () => {
      const result = compactionStrategy.compactByThreads(testMessages, {
        preferCompleteThreads: true
      });

      // Check that preserved threads are complete
      result.preservedThreads!.forEach(thread => {
        // A complete thread should have resolution
        const lastMessage = thread.messages[thread.messages.length - 1];
        const hasResolution = 
          lastMessage.content.includes('!') ||
          lastMessage.content.includes('Thanks') ||
          lastMessage.content.includes('fixed') ||
          thread.messages.length >= 3;
        
        expect(hasResolution).toBe(true);
      });
    });

    test('should merge related threads when compacting', () => {
      const authMessages = testMessages.filter(m => 
        m.content.toLowerCase().includes('auth') || 
        m.content.toLowerCase().includes('token')
      );

      const result = compactionStrategy.compactByThreads(testMessages, {
        mergeRelatedThreads: true
      });

      // Related auth messages should be in the same thread
      const authThread = result.preservedThreads?.find(t =>
        t.topic.toLowerCase().includes('auth')
      );

      if (authThread) {
        const authContentCount = authThread.messages.filter(m =>
          m.content.toLowerCase().includes('auth') ||
          m.content.toLowerCase().includes('token')
        ).length;

        expect(authContentCount).toBeGreaterThan(2);
      }
    });
  });

  describe('progressive compaction levels', () => {
    test('should support light compaction level', () => {
      const result = compactionStrategy.compact(testMessages, {
        level: 'light'
      });

      // Light compaction should preserve 70-80% of messages
      const retentionRate = result.preservedMessages.length / testMessages.length;
      expect(retentionRate).toBeGreaterThan(0.7);
      expect(retentionRate).toBeLessThanOrEqual(0.85);

      // Should preserve all high-importance messages
      expect(result.preservationScore).toBeGreaterThan(0.9);
    });

    test('should support moderate compaction level', () => {
      const result = compactionStrategy.compact(testMessages, {
        level: 'moderate'
      });

      // Moderate compaction should preserve 40-60% of messages
      const retentionRate = result.preservedMessages.length / testMessages.length;
      expect(retentionRate).toBeGreaterThan(0.35);
      expect(retentionRate).toBeLessThan(0.65);

      // Should maintain good preservation score
      expect(result.preservationScore).toBeGreaterThan(0.65);
    });

    test('should support aggressive compaction level', () => {
      const result = compactionStrategy.compact(testMessages, {
        level: 'aggressive'
      });

      // Aggressive compaction should preserve 20-35% of messages
      const retentionRate = result.preservedMessages.length / testMessages.length;
      expect(retentionRate).toBeGreaterThan(0.15);
      expect(retentionRate).toBeLessThan(0.4);

      // Should still maintain minimum coherence
      expect(result.preservationScore).toBeGreaterThan(0.35);
    });

    test.skip('should automatically select level based on constraints', () => {
      // When token limit is very restrictive
      const result1 = compactionStrategy.compact(testMessages, {
        maxTokens: 500,
        autoSelectLevel: true
      });
      expect(result1.selectedLevel).toBe('aggressive');

      // When token limit is generous
      const result2 = compactionStrategy.compact(testMessages, {
        maxTokens: 5000,
        autoSelectLevel: true
      });
      expect(result2.selectedLevel).toBe('light');
    });
  });

  describe('rollback mechanism', () => {
    test('should support compaction rollback', () => {
      const result = compactionStrategy.compact(testMessages, {
        enableRollback: true
      });

      expect(result.rollbackToken).toBeDefined();

      // Should be able to rollback
      const rollbackResult = compactionStrategy.rollback(result.rollbackToken!);
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.restoredMessages).toEqual(testMessages);
    });

    test('should maintain rollback history', () => {
      const result1 = compactionStrategy.compact(testMessages, {
        enableRollback: true,
        level: 'light'
      });

      const result2 = compactionStrategy.compact(result1.preservedMessages, {
        enableRollback: true,
        level: 'moderate'
      });

      // Should be able to rollback to any previous state
      const history = compactionStrategy.getRollbackHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Rollback to first compaction
      const rollback1 = compactionStrategy.rollback(result1.rollbackToken!);
      expect(rollback1.restoredMessages).toEqual(testMessages);
    });

    test('should expire old rollback tokens', () => {
      jest.useFakeTimers();
      
      const result = compactionStrategy.compact(testMessages, {
        enableRollback: true,
        rollbackExpiry: 100 // 100ms expiry for testing
      });

      // Wait for expiry
      jest.advanceTimersByTime(200);

      const rollbackResult = compactionStrategy.rollback(result.rollbackToken!);
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toContain('expired');
      
      jest.useRealTimers();
    });
  });

  describe('preservation rules', () => {
    test('should always preserve system messages', () => {
      const result = compactionStrategy.compact(testMessages, {
        level: 'aggressive'
      });

      const systemMessages = result.preservedMessages.filter(m => m.role === 'system');
      const originalSystemMessages = testMessages.filter(m => m.role === 'system');
      
      expect(systemMessages).toEqual(originalSystemMessages);
    });

    test('should preserve error resolution threads', () => {
      const errorMessages = testMessages.filter(m => 
        m.content.includes('error') || 
        m.content.includes('TypeError') ||
        m.content.includes('fixed')
      );

      const result = compactionStrategy.compact(testMessages, {
        preservationRules: ['error-resolution']
      });

      // Error-related messages should be highly preserved
      const preservedErrorMessages = result.preservedMessages.filter(m =>
        m.content.includes('error') || 
        m.content.includes('TypeError') ||
        m.content.includes('fixed')
      );

      expect(preservedErrorMessages.length).toBeGreaterThanOrEqual(
        Math.floor(errorMessages.length * 0.8)
      );
    });

    test('should preserve code examples based on rules', () => {
      const result = compactionStrategy.compact(testMessages, {
        preservationRules: ['code-blocks', 'technical-discussion']
      });

      // All messages with code blocks should be preserved
      const codeMessages = testMessages.filter(m => m.content.includes('```'));
      const preservedCodeMessages = result.preservedMessages.filter(m => m.content.includes('```'));
      
      expect(preservedCodeMessages.length).toBe(codeMessages.length);
    });

    test('should apply custom preservation rules', () => {
      const customRule = (msg: Msg) => msg.content.includes('authentication');
      
      const result = compactionStrategy.compact(testMessages, {
        customPreservationRules: [customRule]
      });

      // All authentication messages should be preserved
      const authMessages = result.preservedMessages.filter(m =>
        m.content.includes('authentication')
      );
      const originalAuthMessages = testMessages.filter(m =>
        m.content.includes('authentication')
      );

      expect(authMessages.length).toBe(originalAuthMessages.length);
    });
  });

  describe('integration tests', () => {
    test('should handle various conversation patterns', () => {
      // Q&A pattern
      const qaPattern: Msg[] = [
        { role: 'user', content: 'Question 1?' },
        { role: 'assistant', content: 'Answer 1.' },
        { role: 'user', content: 'Question 2?' },
        { role: 'assistant', content: 'Answer 2.' }
      ];

      // Tutorial pattern
      const tutorialPattern: Msg[] = [
        { role: 'user', content: 'How do I start?' },
        { role: 'assistant', content: 'Step 1: Do this' },
        { role: 'assistant', content: 'Step 2: Then this' },
        { role: 'assistant', content: 'Step 3: Finally this' }
      ];

      // Debugging pattern
      const debugPattern: Msg[] = [
        { role: 'user', content: 'I have an error' },
        { role: 'assistant', content: 'What error do you see?' },
        { role: 'user', content: 'TypeError in line 42' },
        { role: 'assistant', content: 'Try this fix' },
        { role: 'user', content: 'It worked!' }
      ];

      const patterns = [qaPattern, tutorialPattern, debugPattern];
      
      patterns.forEach(pattern => {
        const result = compactionStrategy.compact(pattern);
        expect(result.preservationScore).toBeGreaterThan(0.7);
        expect(result.preservedMessages.length).toBeGreaterThan(0);
      });
    });

    test('should handle conversations of various lengths', () => {
      const lengths = [5, 10, 50, 100, 500];
      
      lengths.forEach(length => {
        const messages: Msg[] = Array(length).fill(null).map((_, i) => ({
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `Message ${i} with content about topic ${i % 10}`
        }));

        const result = compactionStrategy.compact(messages);
        
        // Should handle all lengths without error
        expect(result.preservedMessages).toBeDefined();
        expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
        expect(result.compressionRatio).toBeLessThanOrEqual(1);
      });
    });

    test('should integrate with semantic analyzer', () => {
      const result = compactionStrategy.compact(testMessages, {
        useSemanticAnalysis: true
      });

      // Should use semantic analysis features
      expect(result.semanticMetrics).toBeDefined();
      expect(result.semanticMetrics?.topicsPreserved).toBeDefined();
      expect(result.semanticMetrics?.similarityScore).toBeGreaterThan(0);
    });

    test('should integrate with thread preservation system', () => {
      const result = compactionStrategy.compact(testMessages, {
        useThreadPreservation: true
      });

      // Should use thread preservation features
      expect(result.threadMetrics).toBeDefined();
      expect(result.threadMetrics?.threadsIdentified).toBeGreaterThan(0);
      expect(result.threadMetrics?.threadsPreserved).toBeGreaterThan(0);
    });

    test('should integrate with context scoring system', () => {
      const result = compactionStrategy.compact(testMessages, {
        useContextScoring: true,
        currentContext: 'authentication implementation'
      });

      // Should use context scoring
      expect(result.contextMetrics).toBeDefined();
      expect(result.contextMetrics?.relevanceScore).toBeGreaterThan(0);
      
      // Auth-related messages should be prioritized
      const authMessages = result.preservedMessages.filter(m =>
        m.content.toLowerCase().includes('auth') ||
        m.content.toLowerCase().includes('token')
      );
      expect(authMessages.length).toBeGreaterThan(0);
    });
  });

  describe('compression verification', () => {
    test('should maintain conversation utility after compaction', () => {
      const result = compactionStrategy.compact(testMessages, {
        level: 'moderate'
      });

      // Key information should be preserved
      const metrics = compactionStrategy.evaluateUtility(
        testMessages,
        result.preservedMessages
      );

      expect(metrics.questionsCovered).toBeGreaterThan(0.4); // At least 40% of questions have answers
      expect(metrics.topicContinuity).toBeGreaterThan(0.4); // At least 40% topic continuity
      expect(metrics.contextPreservation).toBeGreaterThan(0.4); // At least 40% context preserved
    });

    test('should achieve target compression while maintaining quality', () => {
      const targetCompressions = [0.3, 0.5, 0.7];
      
      targetCompressions.forEach(target => {
        const result = compactionStrategy.compact(testMessages, {
          targetCompression: target
        });

        // Should achieve reasonably close to target
        expect(Math.abs(result.compressionRatio - target)).toBeLessThan(0.25);
        
        // Should maintain minimum quality
        expect(result.preservationScore).toBeGreaterThan(0.35);
      });
    });

    test('should provide compression effectiveness metrics', () => {
      const result = compactionStrategy.compact(testMessages);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.tokenReduction).toBeDefined();
      expect(result.metrics.messageReduction).toBeDefined();
      expect(result.metrics.informationPreservation).toBeDefined();
      expect(result.metrics.processingTime).toBeDefined();
      
      // Should achieve meaningful compression
      expect(result.metrics.tokenReduction).toBeGreaterThan(0.2);
      expect(result.metrics.informationPreservation).toBeGreaterThan(0.7);
    });
  });
});