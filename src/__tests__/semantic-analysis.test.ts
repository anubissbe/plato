/**
 * Semantic Analysis Engine Tests
 * Tests for intelligent conversation compaction with semantic understanding
 */

import { SemanticAnalyzer } from '../context/semantic-analyzer.js';
import type { Msg } from '../runtime/orchestrator.js';

// Test data for semantic analysis
const createTestMessages = (): Msg[] => [
  { role: 'system', content: 'You are a helpful coding assistant.' },
  { role: 'user', content: 'Help me implement a React component for user authentication' },
  { role: 'assistant', content: 'I can help you create a login component with React hooks and form validation.' },
  { role: 'user', content: 'What libraries should I use for form handling?' },
  { role: 'assistant', content: 'For form handling, I recommend using react-hook-form with yup for validation.' },
  { role: 'user', content: 'How do I handle API authentication errors?' },
  { role: 'assistant', content: 'You can use try-catch blocks with specific error handling for 401/403 responses.' },
  { role: 'user', content: 'Can you show me a TypeScript example?' },
  { role: 'assistant', content: 'Here is a TypeScript interface for your auth component:\n```typescript\ninterface AuthProps {\n  onLogin: (credentials: LoginData) => void;\n  loading: boolean;\n}\n```' },
  { role: 'user', content: 'What about testing this component?' },
  { role: 'assistant', content: 'You can test the auth component using Jest and React Testing Library with mock API responses.' }
];

describe('SemanticAnalyzer', () => {
  let analyzer: SemanticAnalyzer;
  let testMessages: Msg[];

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
    testMessages = createTestMessages();
  });

  describe('keyword extraction', () => {
    test('should extract keywords from message content', () => {
      const message = { role: 'user' as const, content: 'Help me implement a React authentication component with TypeScript' };
      const keywords = analyzer.extractKeywords(message);
      
      expect(keywords).toContain('react');
      expect(keywords).toContain('authentication');
      expect(keywords).toContain('component');
      expect(keywords).toContain('typescript');
      expect(keywords.length).toBeGreaterThan(0);
    });

    test('should handle code blocks in messages', () => {
      const message = { 
        role: 'assistant' as const, 
        content: 'Here is a function:\n```javascript\nfunction authenticate(user) {\n  return token;\n}\n```'
      };
      const keywords = analyzer.extractKeywords(message);
      
      expect(keywords).toContain('function');
      expect(keywords).toContain('authenticate');
      expect(keywords).toContain('javascript');
      expect(keywords.length).toBeGreaterThan(0);
    });

    test('should handle empty or minimal content gracefully', () => {
      const emptyMessage = { role: 'user' as const, content: '' };
      const minimalMessage = { role: 'user' as const, content: 'ok' };
      
      const emptyKeywords = analyzer.extractKeywords(emptyMessage);
      const minimalKeywords = analyzer.extractKeywords(minimalMessage);
      
      expect(emptyKeywords).toEqual([]);
      expect(minimalKeywords.length).toBeLessThanOrEqual(1);
    });
  });

  describe('semantic similarity calculation', () => {
    test('should calculate similarity between related messages', () => {
      const msg1 = { role: 'user' as const, content: 'How do I create a React component?' };
      const msg2 = { role: 'user' as const, content: 'Help me build a React component for forms' };
      
      const similarity = analyzer.calculateSimilarity(msg1, msg2);
      
      expect(similarity).toBeGreaterThan(0.5); // Should be similar due to 'React component'
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    test('should calculate low similarity for unrelated messages', () => {
      const msg1 = { role: 'user' as const, content: 'How do I create a React component?' };
      const msg2 = { role: 'user' as const, content: 'What is the weather today?' };
      
      const similarity = analyzer.calculateSimilarity(msg1, msg2);
      
      expect(similarity).toBeLessThan(0.3); // Should be dissimilar
      expect(similarity).toBeGreaterThanOrEqual(0.0);
    });

    test('should handle identical messages correctly', () => {
      const msg1 = { role: 'user' as const, content: 'Hello world' };
      const msg2 = { role: 'user' as const, content: 'Hello world' };
      
      const similarity = analyzer.calculateSimilarity(msg1, msg2);
      
      expect(similarity).toBe(1.0); // Should be identical
    });

    test('should handle empty messages gracefully', () => {
      const msg1 = { role: 'user' as const, content: '' };
      const msg2 = { role: 'user' as const, content: 'Hello world' };
      
      const similarity = analyzer.calculateSimilarity(msg1, msg2);
      
      expect(similarity).toBe(0.0); // Empty content should have no similarity
    });
  });

  describe('topic clustering', () => {
    test('should identify conversation topics', () => {
      const topics = analyzer.identifyTopics(testMessages);
      
      expect(topics).toContain('react');
      expect(topics).toContain('authentication');
      expect(topics).toContain('typescript');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.length).toBeLessThan(testMessages.length); // Topics should be fewer than messages
    });

    test('should group messages by topic clusters', () => {
      const clusters = analyzer.clusterByTopic(testMessages);
      
      expect(clusters.size).toBeGreaterThan(0);
      expect(clusters.size).toBeLessThan(testMessages.length);
      
      // Verify all messages are assigned to clusters
      const totalMessages = Array.from(clusters.values()).reduce((sum, msgs) => sum + msgs.length, 0);
      expect(totalMessages).toBe(testMessages.length - 1); // Excluding system message
    });

    test('should handle single message conversations', () => {
      const singleMessage = [testMessages[0]]; // Just system message
      const topics = analyzer.identifyTopics(singleMessage);
      const clusters = analyzer.clusterByTopic(singleMessage);
      
      expect(topics.length).toBe(0); // System message should not generate topics
      expect(clusters.size).toBe(0);
    });
  });

  describe('conversation flow analysis', () => {
    test('should detect natural breakpoints in conversation', () => {
      const breakpoints = analyzer.detectBreakpoints(testMessages);
      
      expect(breakpoints.length).toBeGreaterThan(0);
      expect(breakpoints.every(bp => bp >= 0 && bp < testMessages.length)).toBe(true);
    });

    test('should identify context switches', () => {
      const contextSwitches = analyzer.detectContextSwitches(testMessages);
      
      expect(contextSwitches.length).toBeGreaterThan(0);
      expect(contextSwitches.every(cs => cs >= 0 && cs < testMessages.length)).toBe(true);
    });

    test('should handle conversation without clear breaks', () => {
      const coherentMessages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Tell me about React' },
        { role: 'assistant' as const, content: 'React is a JavaScript library' },
        { role: 'user' as const, content: 'What are React hooks?' },
        { role: 'assistant' as const, content: 'Hooks are functions that let you use state' }
      ];
      
      const breakpoints = analyzer.detectBreakpoints(coherentMessages);
      const contextSwitches = analyzer.detectContextSwitches(coherentMessages);
      
      // Should have minimal breaks for coherent conversation
      expect(breakpoints.length).toBeLessThan(coherentMessages.length / 2);
      expect(contextSwitches.length).toBeLessThan(coherentMessages.length / 2);
    });
  });

  describe('importance scoring', () => {
    test('should assign importance scores to messages', () => {
      const scores = analyzer.scoreImportance(testMessages);
      
      expect(scores.length).toBe(testMessages.length);
      expect(scores.every(score => score >= 0 && score <= 1)).toBe(true);
    });

    test('should score code-containing messages higher', () => {
      const codeMessage = { 
        role: 'assistant' as const, 
        content: 'Here is the code:\n```typescript\ninterface User { id: string; }\n```' 
      };
      const textMessage = { role: 'assistant' as const, content: 'This is just regular text explanation.' };
      
      const messages = [codeMessage, textMessage];
      const scores = analyzer.scoreImportance(messages);
      
      expect(scores[0]).toBeGreaterThan(scores[1]); // Code message should score higher
    });

    test('should score user questions appropriately', () => {
      const questionMessage = { role: 'user' as const, content: 'How do I implement authentication?' };
      const statementMessage = { role: 'user' as const, content: 'That makes sense, thanks.' };
      
      const messages = [questionMessage, statementMessage];
      const scores = analyzer.scoreImportance(messages);
      
      expect(scores[0]).toBeGreaterThan(scores[1]); // Question should score higher
    });

    test('should handle edge cases in scoring', () => {
      const edgeCases = [
        { role: 'system' as const, content: '' },
        { role: 'user' as const, content: 'a' },
        { role: 'assistant' as const, content: '```\n\n```' }, // Empty code block
        { role: 'tool' as const, content: 'Tool execution result' }
      ];
      
      const scores = analyzer.scoreImportance(edgeCases);
      
      expect(scores.length).toBe(edgeCases.length);
      expect(scores.every(score => score >= 0 && score <= 1)).toBe(true);
      expect(scores.every(score => !isNaN(score))).toBe(true);
    });
  });

  describe('integration and accuracy benchmarks', () => {
    test('should maintain >90% accuracy in topic identification', () => {
      // Test with known conversation patterns
      const authConversation = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Help me with user authentication in React' },
        { role: 'assistant' as const, content: 'I can help with React authentication using JWT tokens' },
        { role: 'user' as const, content: 'How do I validate JWT tokens?' },
        { role: 'assistant' as const, content: 'You can validate JWT tokens using libraries like jsonwebtoken' }
      ];
      
      const topics = analyzer.identifyTopics(authConversation);
      
      // Should identify core authentication-related topics
      const expectedTopics = ['authentication', 'react', 'jwt', 'token'];
      const identifiedCount = expectedTopics.filter(topic => 
        topics.some(identified => identified.includes(topic) || topic.includes(identified))
      ).length;
      
      const accuracy = identifiedCount / expectedTopics.length;
      expect(accuracy).toBeGreaterThan(0.9); // >90% accuracy
    });

    test('should provide consistent similarity calculations', () => {
      const msg1 = { role: 'user' as const, content: 'How do I create a React component?' };
      const msg2 = { role: 'user' as const, content: 'Help me build a React component' };
      
      // Multiple calculations should yield same result
      const similarity1 = analyzer.calculateSimilarity(msg1, msg2);
      const similarity2 = analyzer.calculateSimilarity(msg1, msg2);
      const similarity3 = analyzer.calculateSimilarity(msg2, msg1); // Order shouldn't matter
      
      expect(similarity1).toBe(similarity2);
      expect(similarity1).toBe(similarity3);
      expect(similarity1).toBeGreaterThan(0.7); // Should be highly similar
    });

    test('should handle performance requirements for large conversations', () => {
      // Generate large conversation for performance testing
      const largeConversation: Msg[] = [];
      for (let i = 0; i < 100; i++) {
        largeConversation.push({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i} about React development and authentication patterns` 
        });
      }
      
      const startTime = Date.now();
      
      const topics = analyzer.identifyTopics(largeConversation);
      const clusters = analyzer.clusterByTopic(largeConversation);
      const scores = analyzer.scoreImportance(largeConversation);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(topics.length).toBeGreaterThan(0);
      expect(clusters.size).toBeGreaterThan(0);
      expect(scores.length).toBe(largeConversation.length);
    });
  });
});