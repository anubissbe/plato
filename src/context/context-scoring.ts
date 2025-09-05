/**
 * Context Scoring System
 * Multi-dimensional scoring algorithm for message prioritization
 */

import { SemanticAnalyzer } from './semantic-analyzer.js';
import type { Msg } from '../runtime/orchestrator.js';

export interface ScoringWeights {
  recency: number;
  relevance: number;
  interaction: number;
  complexity: number;
}

export interface UserInteractions {
  edits: number[];
  references: number[];
  followUps: number[];
}

export interface ScoringOptions {
  currentContext?: string;
  interactions?: UserInteractions;
  weights?: ScoringWeights;
  batchSize?: number;
}

export interface CompactionRecommendation {
  keepIndices: number[];
  removeIndices: number[];
  preservationScore: number;
}

export interface Thread {
  id: string;
  messages: Msg[];
  topic: string;
  startIdx: number;
  endIdx: number;
  importance: number;
}

export interface PrioritizationOptions {
  currentContext?: string;
  topK?: number;
  minScore?: number;
  maintainPairs?: boolean;
}

interface MessageWithTimestamp extends Msg {
  timestamp?: number;
}

export class ContextScoringSystem {
  private semanticAnalyzer: SemanticAnalyzer;
  private recencyDecayRate: number;
  private cache: Map<string, number[]>;
  private defaultWeights: ScoringWeights = {
    recency: 0.25,
    relevance: 0.35,
    interaction: 0.20,
    complexity: 0.20
  };

  constructor(options: { recencyDecayRate?: number } = {}) {
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.recencyDecayRate = options.recencyDecayRate || 0.95;
    this.cache = new Map();
  }

  /**
   * Calculate recency scores using exponential decay
   */
  calculateRecencyScores(messages: Msg[]): number[] {
    const scores: number[] = [];
    const now = Date.now();
    
    for (const msg of messages) {
      const timestamp = (msg as MessageWithTimestamp).timestamp;
      
      if (!timestamp) {
        // Assign position-based score if no timestamp
        const position = scores.length;
        const positionRatio = position / messages.length;
        scores.push(0.3 + positionRatio * 0.4); // 0.3 to 0.7 range
      } else {
        // Calculate time difference in minutes
        const ageInMinutes = (now - timestamp) / 60000;
        
        // Apply exponential decay
        let score: number;
        if (ageInMinutes < 5) {
          score = 0.95 + Math.random() * 0.05; // Very recent: 0.95-1.0
        } else if (ageInMinutes < 15) {
          score = 0.8 + (1 - ageInMinutes / 15) * 0.15; // Recent: 0.8-0.95
        } else if (ageInMinutes < 30) {
          score = 0.6 + (1 - (ageInMinutes - 15) / 15) * 0.2; // Moderate: 0.6-0.8
        } else if (ageInMinutes < 60) {
          score = 0.3 + (1 - (ageInMinutes - 30) / 30) * 0.3; // Older: 0.3-0.6
        } else {
          // Apply exponential decay for messages older than 1 hour
          const hoursOld = ageInMinutes / 60;
          score = Math.max(0.1, 0.3 * Math.pow(this.recencyDecayRate, hoursOld - 1));
        }
        
        scores.push(score);
      }
    }
    
    return scores;
  }

  /**
   * Calculate relevance scores based on semantic similarity to context
   */
  calculateRelevanceScores(messages: Msg[], currentContext: string): number[] {
    if (!currentContext || currentContext.trim() === '') {
      // Return uniform mid-range scores if no context
      return messages.map(() => 0.5);
    }
    
    const scores: number[] = [];
    
    // Create a context message for comparison
    const contextMsg: Msg = { role: 'user', content: currentContext };
    
    for (const msg of messages) {
      const similarity = this.semanticAnalyzer.calculateSimilarity(msg, contextMsg);
      
      // Boost score for direct keyword matches
      const contextKeywords = this.semanticAnalyzer.extractKeywords(contextMsg);
      const messageKeywords = this.semanticAnalyzer.extractKeywords(msg);
      const keywordOverlap = contextKeywords.filter(k => 
        messageKeywords.some(mk => mk.toLowerCase().includes(k.toLowerCase()) || 
                                  k.toLowerCase().includes(mk.toLowerCase()))
      ).length;
      
      // More generous scoring
      const keywordBoost = Math.min(0.5, keywordOverlap * 0.2);
      const baseSimilarity = similarity * 2; // Double the base similarity
      const finalScore = Math.min(1, baseSimilarity + keywordBoost);
      
      scores.push(finalScore);
    }
    
    return scores;
  }

  /**
   * Calculate interaction scores based on user engagement
   */
  calculateInteractionScores(messages: Msg[], interactions: UserInteractions): number[] {
    const scores: number[] = [];
    const baseScore = 0.2; // Minimum baseline score
    
    // Weight factors for different interaction types
    const editWeight = 0.5;  // Increased for higher scores
    const referenceWeight = 0.35; // Increased for higher scores
    const followUpWeight = 0.25;
    
    for (let i = 0; i < messages.length; i++) {
      let score = baseScore;
      
      // Check if message was edited (highest importance)
      if (interactions.edits.includes(i)) {
        score += editWeight;
      }
      
      // Check if message was referenced
      if (interactions.references.includes(i)) {
        score += referenceWeight;
      }
      
      // Check if message had follow-ups
      if (interactions.followUps.includes(i)) {
        score += followUpWeight;
      }
      
      // Normalize to ensure score doesn't exceed 1
      scores.push(Math.min(1, score));
    }
    
    return scores;
  }

  /**
   * Calculate technical complexity scores
   */
  calculateComplexityScores(messages: Msg[]): number[] {
    const scores: number[] = [];
    
    for (const msg of messages) {
      let score = 0.3; // Increased base score
      
      // Check for code blocks
      const codeBlockRegex = /```[\s\S]*?```/g;
      const codeBlocks = msg.content.match(codeBlockRegex);
      if (codeBlocks) {
        score += 0.3 * Math.min(2, codeBlocks.length); // Up to 0.6 for code
      }
      
      // Check for error messages and debugging - more comprehensive patterns
      const errorPatterns = /error|exception|bug|issue|problem|debug|trace|stack|TypeError|null|undefined|cannot|failed|crash/gi;
      const errorMatches = msg.content.match(errorPatterns);
      if (errorMatches) {
        score += 0.35; // Increased for problem-solving content
      }
      
      // Check for technical terms - expanded list
      const techTerms = /api|database|server|client|frontend|backend|algorithm|function|class|method|variable|deployment|architecture|microservice|docker|kubernetes|REST|GraphQL|SQL|NoSQL|HTTP|GET|POST|PUT|DELETE|microservices|independently|deployable/gi;
      const techMatches = msg.content.match(techTerms);
      if (techMatches) {
        score += Math.min(0.3, techMatches.length * 0.08);
      }
      
      // Check for questions about implementation or how-to
      if (msg.content.toLowerCase().includes('how') || 
          msg.content.toLowerCase().includes('explain') ||
          msg.content.toLowerCase().includes('what')) {
        score += 0.15; // Questions indicate learning/problem-solving
      }
      
      // Check for solution-oriented language
      if (msg.content.toLowerCase().includes('try') ||
          msg.content.toLowerCase().includes('use') ||
          msg.content.toLowerCase().includes('check') ||
          msg.content.toLowerCase().includes('occurs')) {
        score += 0.1;
      }
      
      scores.push(Math.min(1, score));
    }
    
    return scores;
  }

  /**
   * Calculate composite scores combining all dimensions
   */
  calculateCompositeScores(messages: Msg[], options: ScoringOptions = {}): number[] {
    const weights = options.weights || this.defaultWeights;
    
    // Validate weights sum to 1
    const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1) > 0.001) {
      throw new Error('Weights must sum to 1');
    }
    
    // Check cache
    const cacheKey = JSON.stringify({ messages: messages.map(m => m.content), options });
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Calculate individual dimension scores
    const recencyScores = this.calculateRecencyScores(messages);
    const relevanceScores = this.calculateRelevanceScores(messages, options.currentContext || '');
    const interactionScores = this.calculateInteractionScores(messages, options.interactions || {
      edits: [],
      references: [],
      followUps: []
    });
    const complexityScores = this.calculateComplexityScores(messages);
    
    // Combine scores with weights
    const compositeScores: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      const composite = 
        weights.recency * recencyScores[i] +
        weights.relevance * relevanceScores[i] +
        weights.interaction * interactionScores[i] +
        weights.complexity * complexityScores[i];
      
      compositeScores.push(composite);
    }
    
    // Normalize scores
    const maxScore = Math.max(...compositeScores);
    const normalizedScores = maxScore > 0 
      ? compositeScores.map(s => s / maxScore)
      : compositeScores;
    
    // Cache results
    this.cache.set(cacheKey, normalizedScores);
    
    return normalizedScores;
  }

  /**
   * Calculate composite scores in batches for efficiency
   */
  calculateCompositeScoresInBatches(messages: Msg[], options: ScoringOptions = {}): number[] {
    const batchSize = options.batchSize || 100;
    const allScores: number[] = [];
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchScores = this.calculateCompositeScores(batch, options);
      allScores.push(...batchScores);
    }
    
    return allScores;
  }

  /**
   * Get indices of prioritized messages
   */
  getPrioritizedMessageIndices(messages: Msg[], options: PrioritizationOptions = {}): number[] {
    const scores = this.calculateCompositeScores(messages, {
      currentContext: options.currentContext
    });
    
    // Create array of indices with scores
    const indexedScores = scores.map((score, idx) => ({ score, idx }));
    
    // Sort by score descending
    indexedScores.sort((a, b) => b.score - a.score);
    
    // Apply filters
    let filtered = indexedScores;
    
    if (options.minScore !== undefined) {
      const minScore = options.minScore;
      filtered = filtered.filter(item => item.score >= minScore);
    }
    
    if (options.topK !== undefined) {
      filtered = filtered.slice(0, options.topK);
    }
    
    return filtered.map(item => item.idx);
  }

  /**
   * Get prioritized messages
   */
  getPrioritizedMessages(messages: Msg[], options: PrioritizationOptions = {}): Msg[] {
    const indices = this.getPrioritizedMessageIndices(messages, options);
    
    if (options.maintainPairs) {
      // Ensure Q&A pairs are kept together
      const expandedIndices = new Set(indices);
      
      for (const idx of indices) {
        if (messages[idx].role === 'user' && idx + 1 < messages.length) {
          expandedIndices.add(idx + 1); // Include the response
        } else if (messages[idx].role === 'assistant' && idx > 0) {
          expandedIndices.add(idx - 1); // Include the question
        }
      }
      
      // Sort to maintain order
      const sortedIndices = Array.from(expandedIndices).sort((a, b) => a - b);
      return sortedIndices.map(idx => messages[idx]);
    }
    
    // Sort indices to maintain message order
    indices.sort((a, b) => a - b);
    return indices.map(idx => messages[idx]);
  }

  /**
   * Get compaction recommendations
   */
  getCompactionRecommendations(messages: Msg[], options: { targetReduction: number }): CompactionRecommendation {
    const targetKeepCount = Math.floor(messages.length * (1 - options.targetReduction));
    const scores = this.calculateCompositeScores(messages);
    
    // Create indexed scores
    const indexedScores = scores.map((score, idx) => ({ score, idx }));
    indexedScores.sort((a, b) => b.score - a.score);
    
    // Select top messages to keep
    const keepIndices = indexedScores
      .slice(0, targetKeepCount)
      .map(item => item.idx)
      .sort((a, b) => a - b);
    
    const removeIndices = [];
    for (let i = 0; i < messages.length; i++) {
      if (!keepIndices.includes(i)) {
        removeIndices.push(i);
      }
    }
    
    // Calculate preservation score
    const keptScoreSum = keepIndices.reduce((sum, idx) => sum + scores[idx], 0);
    const totalScoreSum = scores.reduce((sum, s) => sum + s, 0);
    const preservationScore = totalScoreSum > 0 ? keptScoreSum / totalScoreSum : 0;
    
    return {
      keepIndices,
      removeIndices,
      preservationScore
    };
  }

  /**
   * Score threads for integration with ThreadPreservationSystem
   */
  scoreThreads(threads: Thread[]): number[] {
    const scores: number[] = [];
    
    for (const thread of threads) {
      // Calculate composite score for the thread's messages
      const threadScores = this.calculateCompositeScores(thread.messages);
      const avgScore = threadScores.reduce((sum, s) => sum + s, 0) / threadScores.length;
      
      // Combine with thread's importance
      const combinedScore = avgScore * 0.7 + thread.importance * 0.3;
      scores.push(combinedScore);
    }
    
    return scores;
  }

  /**
   * Check if SemanticAnalyzer integration is available
   */
  hasSemanticAnalyzerIntegration(): boolean {
    return this.semanticAnalyzer !== null && this.semanticAnalyzer !== undefined;
  }

  /**
   * Get current decay rate
   */
  getDecayRate(): number {
    return this.recencyDecayRate;
  }
}