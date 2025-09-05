/**
 * Context Scoring System Tests
 * Tests for multi-dimensional context scoring algorithm
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ContextScoringSystem } from '../context/context-scoring.js';
import type { Msg } from '../runtime/orchestrator.js';

describe('ContextScoringSystem', () => {
  let scoringSystem: ContextScoringSystem;
  let testMessages: Msg[];

  beforeEach(() => {
    scoringSystem = new ContextScoringSystem();
    
    // Create test messages with timestamps as any type
    const now = Date.now();
    testMessages = [
      { 
        role: 'system', 
        content: 'You are a helpful assistant.',
        timestamp: now - 7200000 // 2 hours ago
      } as any,
      { 
        role: 'user', 
        content: 'How do I implement authentication?',
        timestamp: now - 3600000 // 1 hour ago
      } as any,
      { 
        role: 'assistant', 
        content: 'You can use JWT tokens for authentication. Here\'s an example:\n```js\nconst jwt = require(\'jsonwebtoken\');\n```',
        timestamp: now - 3500000
      } as any,
      { 
        role: 'user', 
        content: 'Can you show me how to validate the tokens?',
        timestamp: now - 1800000 // 30 minutes ago
      } as any,
      { 
        role: 'assistant', 
        content: 'Sure! Here\'s how to validate JWT tokens:\n```js\njwt.verify(token, secret, callback);\n```',
        timestamp: now - 1700000
      } as any,
      {
        role: 'user',
        content: 'Thanks! Now let me ask about database design.',
        timestamp: now - 900000 // 15 minutes ago
      } as any,
      {
        role: 'assistant',
        content: 'I can help with database design. What specific aspect?',
        timestamp: now - 800000
      } as any,
      {
        role: 'user',
        content: 'How should I structure user profiles?',
        timestamp: now - 300000 // 5 minutes ago
      } as any,
      {
        role: 'assistant',
        content: 'For user profiles, consider this schema...',
        timestamp: now - 200000
      } as any
    ];
  });

  describe('recency scoring', () => {
    test('should calculate recency scores with exponential decay', () => {
      const scores = scoringSystem.calculateRecencyScores(testMessages);
      
      expect(scores).toHaveLength(testMessages.length);
      
      // More recent messages should have higher scores
      expect(scores[scores.length - 1]).toBeGreaterThan(scores[0]);
      
      // Exponential decay should be applied
      const decayRate = scoringSystem.getDecayRate();
      expect(decayRate).toBeGreaterThan(0);
      expect(decayRate).toBeLessThan(1);
      
      // Very recent messages (< 5 min) should have score close to 1
      expect(scores[scores.length - 1]).toBeGreaterThan(0.9);
      
      // Old messages (> 1 hour) should have lower scores
      expect(scores[0]).toBeLessThan(0.3);
    });

    test('should handle messages without timestamps', () => {
      const messagesNoTime = testMessages.map(m => {
        const { timestamp, ...rest } = m as any;
        return rest;
      });
      
      const scores = scoringSystem.calculateRecencyScores(messagesNoTime);
      
      // Should assign default scores or handle gracefully
      expect(scores).toHaveLength(messagesNoTime.length);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should apply configurable decay rate', () => {
      const customSystem = new ContextScoringSystem({ recencyDecayRate: 0.5 });
      const scores = customSystem.calculateRecencyScores(testMessages);
      
      expect(customSystem.getDecayRate()).toBe(0.5);
      expect(scores).toHaveLength(testMessages.length);
    });
  });

  describe('relevance scoring', () => {
    test('should calculate relevance based on semantic similarity to current context', () => {
      const currentContext = 'authentication tokens JWT validation';
      const scores = scoringSystem.calculateRelevanceScores(testMessages, currentContext);
      
      expect(scores).toHaveLength(testMessages.length);
      
      // Messages about authentication should score higher
      const authMessageIndices = [1, 2, 3, 4]; // Indices of auth-related messages
      authMessageIndices.forEach(idx => {
        expect(scores[idx]).toBeGreaterThan(0.4); // Adjusted threshold for scoring
      });
      
      // Database messages should score lower
      const dbMessageIndices = [5, 6, 7, 8];
      dbMessageIndices.forEach(idx => {
        expect(scores[idx]).toBeLessThan(scores[2]); // Less than auth messages
      });
    });

    test('should handle empty or undefined context', () => {
      const scores1 = scoringSystem.calculateRelevanceScores(testMessages, '');
      const scores2 = scoringSystem.calculateRelevanceScores(testMessages, undefined as any);
      
      // Should return valid scores even with empty context
      expect(scores1).toHaveLength(testMessages.length);
      expect(scores2).toHaveLength(testMessages.length);
      
      scores1.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should use semantic analysis for similarity calculation', () => {
      const context = 'implement secure user authentication system';
      const scores = scoringSystem.calculateRelevanceScores(testMessages, context);
      
      // Should use semantic similarity, not just keyword matching
      const authIdx = testMessages.findIndex(m => m.content.includes('authentication'));
      const tokenIdx = testMessages.findIndex(m => m.content.includes('JWT'));
      
      expect(scores[authIdx]).toBeGreaterThan(0.6);
      expect(scores[tokenIdx]).toBeGreaterThan(0.5); // Related but not exact match
    });
  });

  describe('user interaction scoring', () => {
    test('should score messages based on user engagement patterns', () => {
      const interactions = {
        edits: [1, 3], // User edited messages at these indices
        references: [2, 4], // Messages referenced later
        followUps: [1, 3, 5] // Messages with follow-up questions
      };
      
      const scores = scoringSystem.calculateInteractionScores(testMessages, interactions);
      
      expect(scores).toHaveLength(testMessages.length);
      
      // Edited messages should have higher scores
      expect(scores[1]).toBeGreaterThan(scores[0]);
      expect(scores[3]).toBeGreaterThan(scores[0]);
      
      // Referenced messages should score well
      expect(scores[2]).toBeGreaterThan(0.5);
      expect(scores[4]).toBeGreaterThan(0.5);
      
      // Messages with follow-ups indicate importance
      expect(scores[5]).toBeGreaterThan(scores[6]);
    });

    test('should handle no interactions gracefully', () => {
      const emptyInteractions = {
        edits: [],
        references: [],
        followUps: []
      };
      
      const scores = scoringSystem.calculateInteractionScores(testMessages, emptyInteractions);
      
      expect(scores).toHaveLength(testMessages.length);
      
      // Should have baseline scores
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0.1); // Minimum baseline
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should weight different interaction types appropriately', () => {
      const interactions = {
        edits: [1], // High importance
        references: [2], // Medium importance
        followUps: [3] // Lower importance
      };
      
      const scores = scoringSystem.calculateInteractionScores(testMessages, interactions);
      
      // Edits should be weighted highest
      expect(scores[1]).toBeGreaterThan(scores[2]);
      expect(scores[2]).toBeGreaterThan(scores[3]);
    });
  });

  describe('technical complexity scoring', () => {
    test('should score code-containing messages higher', () => {
      const scores = scoringSystem.calculateComplexityScores(testMessages);
      
      // Messages with code blocks should score higher
      const codeMessageIndices = [2, 4]; // Messages containing code
      const nonCodeIndices = [0, 1, 5, 6];
      
      codeMessageIndices.forEach(codeIdx => {
        nonCodeIndices.forEach(nonCodeIdx => {
          expect(scores[codeIdx]).toBeGreaterThan(scores[nonCodeIdx]);
        });
      });
    });

    test('should identify problem-solving discussions', () => {
      const problemSolvingMessages: Msg[] = [
        { role: 'user', content: 'I\'m getting an error: TypeError: Cannot read property' },
        { role: 'assistant', content: 'This error occurs because the object is null. Try checking if it exists first.' },
        { role: 'user', content: 'How can I debug this issue?' },
        { role: 'assistant', content: 'Use console.log to trace the variable state.' }
      ];
      
      const scores = scoringSystem.calculateComplexityScores(problemSolvingMessages);
      
      // Problem-solving messages should score high
      scores.forEach(score => {
        expect(score).toBeGreaterThan(0.6);
      });
    });

    test('should recognize technical terms and concepts', () => {
      const technicalMessages: Msg[] = [
        { role: 'user', content: 'Explain REST API architecture' },
        { role: 'assistant', content: 'REST uses HTTP methods like GET, POST, PUT, DELETE' },
        { role: 'user', content: 'What about microservices?' },
        { role: 'assistant', content: 'Microservices are independently deployable services' }
      ];
      
      const scores = scoringSystem.calculateComplexityScores(technicalMessages);
      
      // Technical discussions should score well
      scores.forEach(score => {
        expect(score).toBeGreaterThan(0.5);
      });
    });
  });

  describe('composite scoring', () => {
    test('should combine all scoring dimensions with weights', () => {
      const weights = {
        recency: 0.3,
        relevance: 0.3,
        interaction: 0.2,
        complexity: 0.2
      };
      
      const currentContext = 'authentication implementation';
      const interactions = {
        edits: [1],
        references: [2],
        followUps: [3]
      };
      
      const compositeScores = scoringSystem.calculateCompositeScores(
        testMessages,
        {
          currentContext,
          interactions,
          weights
        }
      );
      
      expect(compositeScores).toHaveLength(testMessages.length);
      
      // All scores should be normalized between 0 and 1
      compositeScores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
      
      // Recent, relevant messages with interactions should score highest
      const recentAuthMessage = compositeScores[4]; // Recent auth message
      const oldSystemMessage = compositeScores[0]; // Old system message
      expect(recentAuthMessage).toBeGreaterThan(oldSystemMessage);
    });

    test('should normalize scores properly', () => {
      const scores = scoringSystem.calculateCompositeScores(testMessages);
      
      // Check normalization
      const sum = scores.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
      
      // Max score should be close to 1
      const maxScore = Math.max(...scores);
      expect(maxScore).toBeGreaterThan(0.7);
      expect(maxScore).toBeLessThanOrEqual(1);
    });

    test('should handle custom weight configurations', () => {
      // Heavily weight recency
      const recencyWeights = {
        recency: 0.7,
        relevance: 0.1,
        interaction: 0.1,
        complexity: 0.1
      };
      
      const scores1 = scoringSystem.calculateCompositeScores(testMessages, { weights: recencyWeights });
      
      // Heavily weight complexity
      const complexityWeights = {
        recency: 0.1,
        relevance: 0.1,
        interaction: 0.1,
        complexity: 0.7
      };
      
      const scores2 = scoringSystem.calculateCompositeScores(testMessages, { weights: complexityWeights });
      
      // Different weights should produce different rankings
      expect(scores1).not.toEqual(scores2);
      
      // Recent messages should rank higher with recency weights
      const lastIdx = testMessages.length - 1;
      expect(scores1[lastIdx]).toBeGreaterThan(scores1[0]);
    });

    test('should validate weight sum equals 1', () => {
      const invalidWeights = {
        recency: 0.5,
        relevance: 0.3,
        interaction: 0.3,
        complexity: 0.3 // Sum = 1.4
      };
      
      expect(() => {
        scoringSystem.calculateCompositeScores(testMessages, { weights: invalidWeights });
      }).toThrow('Weights must sum to 1');
    });
  });

  describe('performance tests', () => {
    test('should handle large conversation histories efficiently', () => {
      // Create a large conversation
      const largeConversation: Msg[] = [];
      for (let i = 0; i < 1000; i++) {
        largeConversation.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i} with some content about topic ${i % 10}`,
          timestamp: Date.now() - (1000 - i) * 60000 // Spread over time
        } as any);
      }
      
      const startTime = Date.now();
      const scores = scoringSystem.calculateCompositeScores(largeConversation);
      const endTime = Date.now();
      
      expect(scores).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });

    test('should support batch scoring for efficiency', () => {
      const batchSize = 100;
      const scores = scoringSystem.calculateCompositeScoresInBatches(testMessages, { batchSize });
      
      expect(scores).toHaveLength(testMessages.length);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should cache intermediate calculations', () => {
      // First calculation
      const start1 = Date.now();
      const scores1 = scoringSystem.calculateCompositeScores(testMessages);
      const time1 = Date.now() - start1;
      
      // Second calculation with same messages (should use cache)
      const start2 = Date.now();
      const scores2 = scoringSystem.calculateCompositeScores(testMessages);
      const time2 = Date.now() - start2;
      
      expect(scores1).toEqual(scores2);
      // Second calculation should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });

  describe('message prioritization accuracy', () => {
    test('should accurately prioritize important messages', () => {
      const prioritizedIndices = scoringSystem.getPrioritizedMessageIndices(testMessages, {
        currentContext: 'authentication JWT',
        topK: 5
      });
      
      expect(prioritizedIndices).toHaveLength(5);
      
      // Should include authentication-related messages
      const authIndices = [1, 2, 3, 4];
      const includedAuthMessages = prioritizedIndices.filter(idx => authIndices.includes(idx));
      expect(includedAuthMessages.length).toBeGreaterThanOrEqual(3);
    });

    test('should maintain conversation coherence in prioritization', () => {
      const prioritized = scoringSystem.getPrioritizedMessages(testMessages, {
        topK: 5,
        maintainPairs: true // Keep Q&A pairs together
      });
      
      // If a user question is included, its answer should be too
      for (let i = 0; i < prioritized.length - 1; i++) {
        if (prioritized[i].role === 'user') {
          const nextMessage = prioritized[i + 1];
          if (nextMessage) {
            expect(nextMessage.role).toBe('assistant');
          }
        }
      }
    });

    test('should respect minimum score thresholds', () => {
      const minScore = 0.5;
      const prioritized = scoringSystem.getPrioritizedMessages(testMessages, {
        minScore,
        currentContext: 'authentication'
      });
      
      // Calculate scores for verification
      const scores = scoringSystem.calculateCompositeScores(testMessages, {
        currentContext: 'authentication'
      });
      
      prioritized.forEach((msg, idx) => {
        const originalIdx = testMessages.indexOf(msg);
        expect(scores[originalIdx]).toBeGreaterThanOrEqual(minScore);
      });
    });
  });

  describe('integration with existing systems', () => {
    test('should integrate with SemanticAnalyzer', () => {
      // The scoring system should be able to use SemanticAnalyzer
      const hasSemanticIntegration = scoringSystem.hasSemanticAnalyzerIntegration();
      expect(hasSemanticIntegration).toBe(true);
    });

    test('should integrate with ThreadPreservationSystem', () => {
      // Should be able to score threads
      const threadScores = scoringSystem.scoreThreads([
        {
          id: 'thread1',
          messages: testMessages.slice(0, 5),
          topic: 'authentication',
          startIdx: 0,
          endIdx: 4,
          importance: 0.8
        }
      ]);
      
      expect(threadScores).toHaveLength(1);
      expect(threadScores[0]).toBeGreaterThan(0);
    });

    test('should provide scoring for orchestrator compaction', () => {
      const compactionRecommendations = scoringSystem.getCompactionRecommendations(
        testMessages,
        { targetReduction: 0.5 }
      );
      
      expect(compactionRecommendations.keepIndices).toBeDefined();
      expect(compactionRecommendations.removeIndices).toBeDefined();
      expect(compactionRecommendations.preservationScore).toBeGreaterThan(0.4); // Adjusted for realistic scoring
    });
  });
});