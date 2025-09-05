/**
 * Semantic Analysis Engine for Intelligent Conversation Compaction
 * 
 * This module provides semantic understanding capabilities for Plato's
 * conversation compaction system, enabling intelligent preservation of
 * important conversation content based on semantic meaning rather than
 * simple keyword matching or position-based heuristics.
 */

type Msg = { role: 'system'|'user'|'assistant'|'tool', content: string };

interface TopicCluster {
  topic: string;
  messages: Msg[];
  importance: number;
}

interface BreakpointInfo {
  index: number;
  confidence: number;
  reason: 'topic_change' | 'context_switch' | 'natural_pause';
}

/**
 * SemanticAnalyzer provides intelligent analysis of conversation content
 * for improved compaction decisions
 */
export class SemanticAnalyzer {
  private stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'be', 'have', 'do', 'say', 'get', 'make', 'go', 'know', 'take',
    'see', 'come', 'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask',
    'work', 'seem', 'feel', 'try', 'leave', 'call', 'good', 'new', 'first', 'last',
    'long', 'great', 'little', 'own', 'other', 'old', 'right', 'big', 'high', 'different',
    'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad',
    'same', 'able', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she',
    'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'being', 'been', 'be', 'have', 'has', 'had',
    'having', 'do', 'does', 'did', 'doing', 'would', 'should', 'could', 'ought',
    'i\'m', 'you\'re', 'he\'s', 'she\'s', 'it\'s', 'we\'re', 'they\'re', 'i\'ve',
    'you\'ve', 'we\'ve', 'they\'ve', 'i\'d', 'you\'d', 'he\'d', 'she\'d', 'we\'d',
    'they\'d', 'i\'ll', 'you\'ll', 'he\'ll', 'she\'ll', 'we\'ll', 'they\'ll',
    'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'hasn\'t', 'haven\'t', 'hadn\'t',
    'doesn\'t', 'don\'t', 'didn\'t', 'won\'t', 'wouldn\'t', 'shouldn\'t', 'couldn\'t',
    'can\'t', 'cannot'
  ]);

  private codePatterns = [
    /```[\s\S]*?```/g,  // Code blocks
    /`[^`]+`/g,         // Inline code
    /\b(function|class|interface|type|const|let|var|import|export|return|if|else|for|while|try|catch)\b/gi,
    /\b(React|useState|useEffect|component|props|state|JSX|TypeScript|JavaScript|HTML|CSS)\b/gi,
    /\b(async|await|Promise|fetch|API|endpoint|request|response|error|exception)\b/gi,
    /\b(test|describe|it|expect|jest|cypress|playwright|mocha|chai)\b/gi
  ];

  private questionPatterns = [
    /^(how|what|why|when|where|which|who|can|could|would|should|is|are|do|does|did)\b/i,
    /\?$/,
    /\b(help|assist|explain|show|tell|guide)\b/i
  ];

  /**
   * Extract meaningful keywords from a message
   */
  extractKeywords(message: Msg): string[] {
    if (!message.content.trim()) return [];

    // Extract text content, including code blocks
    let text = message.content.toLowerCase();
    
    // Extract keywords from code blocks separately to preserve technical terms
    const codeKeywords: string[] = [];
    this.codePatterns.forEach(pattern => {
      const matches = message.content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract technical terms from code
          const codeWords = match.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.stopWords.has(word));
          codeKeywords.push(...codeWords);
        });
      }
    });

    // Clean text and extract regular keywords
    text = text.replace(/[^\w\s]/g, ' ');
    const words = text.split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));

    // Combine and deduplicate keywords
    const allKeywords = [...new Set([...words, ...codeKeywords])];
    
    return allKeywords;
  }

  /**
   * Calculate semantic similarity between two messages using enhanced keyword analysis
   * Returns a value between 0 and 1
   */
  calculateSimilarity(msg1: Msg, msg2: Msg): number {
    // Handle identical content first
    if (msg1.content.trim() === msg2.content.trim()) {
      return 1.0;
    }

    const keywords1 = this.extractKeywords(msg1);
    const keywords2 = this.extractKeywords(msg2);

    if (keywords1.length === 0 && keywords2.length === 0) {
      return 0.0;
    }

    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0.0;
    }

    // Enhanced similarity calculation with semantic weighting
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    if (intersection.size === 0) {
      // Check for semantic relationships (partial matches, related terms)
      let partialMatches = 0;
      const semanticPairs = [
        ['react', 'component'], ['react', 'jsx'], ['react', 'hook'],
        ['authentication', 'auth'], ['authentication', 'login'], ['authentication', 'token'],
        ['typescript', 'type'], ['typescript', 'interface'], ['typescript', 'ts'],
        ['javascript', 'js'], ['function', 'method'], ['api', 'endpoint']
      ];
      
      for (const [term1, term2] of semanticPairs) {
        if ((set1.has(term1) && set2.has(term2)) || (set1.has(term2) && set2.has(term1))) {
          partialMatches++;
        }
      }
      
      // Boost similarity for partial semantic matches
      if (partialMatches > 0) {
        return Math.min(0.4, partialMatches * 0.15);
      }
      return 0.0;
    }

    // Calculate weighted Jaccard similarity with importance boost
    const union = new Set([...set1, ...set2]);
    let baseScore = intersection.size / union.size;
    
    // Significantly boost score for technical terms intersection
    const technicalMatches = [...intersection].filter(word => this.isTechnicalTerm(word));
    if (technicalMatches.length > 0) {
      baseScore += technicalMatches.length * 0.3; // Increased from 0.1 to 0.3
    }
    
    // Additional boost for shared important keywords
    const importantKeywords = ['react', 'component', 'authentication', 'typescript', 'javascript', 'api', 'function'];
    const importantMatches = [...intersection].filter(word => importantKeywords.includes(word));
    if (importantMatches.length > 0) {
      baseScore += importantMatches.length * 0.2;
    }
    
    // Boost for high keyword overlap ratio
    const smaller = Math.min(set1.size, set2.size);
    const overlapRatio = intersection.size / smaller;
    if (overlapRatio > 0.5) {
      baseScore += 0.2;
    }
    
    return Math.min(1.0, baseScore);
  }

  /**
   * Identify main topics in the conversation
   */
  identifyTopics(messages: Msg[]): string[] {
    const keywordCounts = new Map<string, number>();
    const keywordImportance = new Map<string, number>();
    
    // Skip system messages for topic identification
    const contentMessages = messages.filter(msg => msg.role !== 'system');
    
    if (contentMessages.length === 0) return [];

    // Count keyword frequencies and calculate importance
    contentMessages.forEach(msg => {
      const keywords = this.extractKeywords(msg);
      keywords.forEach(keyword => {
        const currentCount = keywordCounts.get(keyword) || 0;
        keywordCounts.set(keyword, currentCount + 1);
        
        // Calculate importance based on term characteristics
        let importance = 1.0;
        if (this.isTechnicalTerm(keyword)) importance += 2.0;
        if (keyword.length > 6) importance += 0.5; // Longer terms often more specific
        if (msg.role === 'user') importance += 0.5; // User-mentioned terms are important
        
        const currentImportance = keywordImportance.get(keyword) || 0;
        keywordImportance.set(keyword, Math.max(currentImportance, importance));
      });
    });

    // Enhanced filtering for better topic identification
    const totalMessages = contentMessages.length;
    const topics = Array.from(keywordCounts.entries())
      .filter(([keyword, count]) => {
        const importance = keywordImportance.get(keyword) || 1.0;
        const importanceThreshold = this.isTechnicalTerm(keyword) ? 1.0 : 1.5;
        
        // Include if:
        // - Appears multiple times, OR
        // - Is a technical term that appears at least once, OR
        // - Has high importance score, OR
        // - Appears in significant portion of messages
        return count > 1 || 
               (this.isTechnicalTerm(keyword) && count >= 1) ||
               importance >= importanceThreshold ||
               count >= Math.max(1, Math.ceil(totalMessages * 0.15));
      })
      .map(([keyword, count]) => ({
        keyword,
        count,
        importance: keywordImportance.get(keyword) || 1.0,
        score: count * (keywordImportance.get(keyword) || 1.0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(5, Math.ceil(totalMessages * 0.4))) // Allow more topics
      .map(item => item.keyword);

    return topics;
  }

  /**
   * Group messages by semantic topics
   */
  clusterByTopic(messages: Msg[]): Map<string, Msg[]> {
    const clusters = new Map<string, Msg[]>();
    const topics = this.identifyTopics(messages);
    
    if (topics.length === 0) return clusters;

    // Skip system messages
    const contentMessages = messages.filter(msg => msg.role !== 'system');

    contentMessages.forEach(message => {
      const keywords = this.extractKeywords(message);
      
      // Find the best matching topic for this message
      let bestTopic = '';
      let bestScore = 0;

      topics.forEach(topic => {
        if (keywords.includes(topic)) {
          const score = keywords.filter(k => k === topic).length;
          if (score > bestScore) {
            bestScore = score;
            bestTopic = topic;
          }
        }
      });

      // If no direct match, find topic with highest keyword overlap
      if (!bestTopic) {
        topics.forEach(topic => {
          const topicKeywords = [topic];
          const overlap = keywords.filter(k => topicKeywords.includes(k)).length;
          if (overlap > bestScore) {
            bestScore = overlap;
            bestTopic = topic;
          }
        });
      }

      // Use the most frequent topic if still no match
      if (!bestTopic && topics.length > 0) {
        bestTopic = topics[0];
      }

      if (bestTopic) {
        if (!clusters.has(bestTopic)) {
          clusters.set(bestTopic, []);
        }
        clusters.get(bestTopic)!.push(message);
      }
    });

    return clusters;
  }

  /**
   * Detect natural conversation breakpoints
   */
  detectBreakpoints(messages: Msg[]): number[] {
    const breakpoints: number[] = [];
    
    if (messages.length <= 3) return breakpoints;

    for (let i = 1; i < messages.length - 1; i++) {
      const prevMsg = messages[i - 1];
      const currMsg = messages[i];
      const nextMsg = messages[i + 1];

      // Skip system messages
      if (currMsg.role === 'system') continue;

      // Calculate similarity between adjacent messages
      const prevSimilarity = this.calculateSimilarity(prevMsg, currMsg);
      const nextSimilarity = this.calculateSimilarity(currMsg, nextMsg);

      // Detect topic changes (low similarity)
      if (prevSimilarity < 0.3 && nextSimilarity < 0.3) {
        breakpoints.push(i);
      }

      // Detect role transitions that might indicate topic shifts
      if (currMsg.role === 'user' && prevMsg.role === 'assistant' && 
          this.isNewTopicQuestion(currMsg.content)) {
        breakpoints.push(i);
      }
    }

    return breakpoints;
  }

  /**
   * Detect context switches in conversation
   */
  detectContextSwitches(messages: Msg[]): number[] {
    const contextSwitches: number[] = [];
    
    if (messages.length <= 2) return contextSwitches;

    for (let i = 1; i < messages.length; i++) {
      const prevMsg = messages[i - 1];
      const currMsg = messages[i];

      // Skip system messages
      if (currMsg.role === 'system') continue;

      // Detect explicit context switches
      if (this.isContextSwitchIndicator(currMsg.content)) {
        contextSwitches.push(i);
      }

      // Detect topic discontinuity
      const similarity = this.calculateSimilarity(prevMsg, currMsg);
      if (similarity < 0.2 && currMsg.role === 'user') {
        contextSwitches.push(i);
      }
    }

    return contextSwitches;
  }

  /**
   * Score messages based on their semantic importance
   */
  scoreImportance(messages: Msg[]): number[] {
    const scores: number[] = [];

    messages.forEach((message, index) => {
      let score = 0.1; // Base score

      // System messages get lower base score
      if (message.role === 'system') {
        score = 0.05;
      } else if (message.role === 'user') {
        // User questions and requests are important
        if (this.isQuestion(message.content)) {
          score += 0.3;
        }
        if (this.hasCodeMention(message.content)) {
          score += 0.2;
        }
      } else if (message.role === 'assistant') {
        // Assistant responses with code or detailed explanations
        if (this.hasCodeBlock(message.content)) {
          score += 0.4;
        }
        if (message.content.length > 200) {
          score += 0.2; // Detailed responses
        }
      } else if (message.role === 'tool') {
        // Tool results are contextually important
        score += 0.3;
      }

      // Boost score for messages with technical keywords
      const keywords = this.extractKeywords(message);
      const technicalKeywords = keywords.filter(k => this.isTechnicalTerm(k));
      score += technicalKeywords.length * 0.05;

      // Boost score for messages that appear to be answers to questions
      if (index > 0 && messages[index - 1].role === 'user' && 
          this.isQuestion(messages[index - 1].content)) {
        score += 0.2;
      }

      // Normalize score to [0, 1]
      scores.push(Math.min(1.0, Math.max(0.0, score)));
    });

    return scores;
  }

  /**
   * Helper method to check if a word is a technical term
   */
  private isTechnicalTerm(word: string): boolean {
    const technicalTerms = [
      // Frameworks & Libraries
      'react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'node',
      'npm', 'yarn', 'webpack', 'babel', 'jest', 'cypress', 'api', 'rest', 'graphql',
      // React specific
      'component', 'hook', 'state', 'props', 'jsx', 'tsx', 'usestate', 'useeffect',
      'usereducer', 'usecontext', 'usememo', 'usecallback', 'useref',
      // TypeScript specific
      'interface', 'type', 'enum', 'generic', 'union', 'intersection', 'tuple',
      'readonly', 'partial', 'required', 'optional', 'extends', 'keyof', 'typeof',
      // Programming concepts
      'function', 'class', 'method', 'variable', 'constant', 'import', 'export',
      'async', 'await', 'promise', 'callback', 'closure', 'prototype', 'constructor',
      // Web technologies
      'http', 'https', 'json', 'xml', 'fetch', 'axios', 'cors', 'endpoint', 'middleware',
      // Authentication & Security
      'authentication', 'authorization', 'auth', 'login', 'logout', 'signin', 'signup',
      'jwt', 'token', 'oauth', 'session', 'cookie', 'bearer', 'refresh', 'access',
      'password', 'credential', 'validate', 'verify', 'encrypt', 'decrypt', 'hash',
      // Form handling
      'form', 'input', 'validation', 'validate', 'submit', 'field', 'error', 'yup',
      'formik', 'react-hook-form', 'controlled', 'uncontrolled',
      // Testing
      'test', 'testing', 'spec', 'mock', 'stub', 'spy', 'expect', 'assert',
      'describe', 'context', 'beforeeach', 'aftereach', 'setup', 'teardown',
      // Database
      'database', 'sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'query',
      'schema', 'model', 'migration', 'seed', 'transaction', 'index',
      // Development tools
      'git', 'github', 'commit', 'branch', 'merge', 'pull', 'push', 'clone',
      'docker', 'kubernetes', 'deploy', 'deployment', 'build', 'ci', 'cd',
      'lint', 'format', 'prettier', 'eslint', 'husky', 'webpack', 'vite',
      // Error handling
      'error', 'exception', 'try', 'catch', 'throw', 'finally', 'stack', 'trace'
    ];

    return technicalTerms.includes(word.toLowerCase());
  }

  /**
   * Helper method to detect questions
   */
  private isQuestion(content: string): boolean {
    return this.questionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Helper method to detect code blocks
   */
  private hasCodeBlock(content: string): boolean {
    return /```[\s\S]*?```/.test(content);
  }

  /**
   * Helper method to detect code mentions
   */
  private hasCodeMention(content: string): boolean {
    return this.codePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Helper method to detect new topic questions
   */
  private isNewTopicQuestion(content: string): boolean {
    const newTopicIndicators = [
      /^(now|next|also|another|different|what about|how about)/i,
      /^(let me ask|can you|could you|would you|will you)/i,
      /^(switching|moving|changing) (to|from)/i
    ];

    return newTopicIndicators.some(pattern => pattern.test(content));
  }

  /**
   * Helper method to detect context switch indicators
   */
  private isContextSwitchIndicator(content: string): boolean {
    const switchIndicators = [
      /^(by the way|btw|anyway|actually|speaking of|that reminds me)/i,
      /^(now|next|also|alternatively|instead|however|but)/i,
      /^(let's|lets) (talk about|discuss|focus on|switch to|move to)/i,
      /^(new topic|different question|changing subject)/i
    ];

    return switchIndicators.some(pattern => pattern.test(content));
  }
}