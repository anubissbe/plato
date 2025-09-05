/**
 * Intelligent Compaction Strategy
 * Adaptive compaction algorithms with thread preservation and rollback support
 */

import { SemanticAnalyzer } from './semantic-analyzer.js';
import { ThreadPreservationSystem, Thread as TPSThread } from './thread-preservation.js';
import { ContextScoringSystem } from './context-scoring.js';
import type { Msg } from '../runtime/orchestrator.js';

export type CompactionLevel = 'light' | 'moderate' | 'aggressive';

export interface CompactionOptions {
  level?: CompactionLevel;
  targetCompression?: number;
  allowDynamicAdjustment?: boolean;
  contentTypeWeights?: Record<string, number>;
  preferCompleteThreads?: boolean;
  mergeRelatedThreads?: boolean;
  enableRollback?: boolean;
  rollbackExpiry?: number;
  maxTokens?: number;
  autoSelectLevel?: boolean;
  preservationRules?: string[];
  customPreservationRules?: Array<(msg: Msg) => boolean>;
  useSemanticAnalysis?: boolean;
  useThreadPreservation?: boolean;
  useContextScoring?: boolean;
  currentContext?: string;
}

export interface CompactionResult {
  preservedMessages: Msg[];
  removedMessages: Msg[];
  compressionRatio: number;
  preservationScore: number;
  selectedLevel?: CompactionLevel;
  rollbackToken?: string;
  adjustments?: Array<{ type: string; reason: string; value: any }>;
  preservedThreads?: Thread[];
  semanticMetrics?: {
    topicsPreserved: string[];
    topicsRemoved: string[];
    similarityScore: number;
  };
  threadMetrics?: {
    threadsIdentified: number;
    threadsPreserved: number;
    coherenceScore: number;
  };
  contextMetrics?: {
    relevanceScore: number;
    contextAlignment: number;
  };
  metrics: {
    tokenReduction: number;
    messageReduction: number;
    informationPreservation: number;
    processingTime: number;
  };
}

export interface Thread {
  id: string;
  messages: Msg[];
  topic: string;
  coherenceScore: number;
  importance: number;
}

export interface RollbackResult {
  success: boolean;
  restoredMessages?: Msg[];
  error?: string;
}

export interface UtilityMetrics {
  questionsCovered: number;
  topicContinuity: number;
  contextPreservation: number;
}

interface RollbackEntry {
  token: string;
  originalMessages: Msg[];
  timestamp: number;
  expiry?: number;
}

export class IntelligentCompactionStrategy {
  private semanticAnalyzer: SemanticAnalyzer;
  private threadSystem: ThreadPreservationSystem;
  private contextScoring: ContextScoringSystem;
  private rollbackHistory: Map<string, RollbackEntry>;
  
  constructor() {
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.threadSystem = new ThreadPreservationSystem();
    this.contextScoring = new ContextScoringSystem();
    this.rollbackHistory = new Map();
  }

  /**
   * Main compaction method with adaptive algorithms
   */
  compact(messages: Msg[], options: CompactionOptions = {}): CompactionResult {
    const startTime = Date.now();
    const originalMessages = [...messages];
    
    // Handle empty or minimal conversations
    if (messages.length <= 3) {
      return this.createResult(messages, [], originalMessages, startTime);
    }

    // Determine compaction level
    const level = this.determineCompactionLevel(messages, options);
    
    // Apply compaction based on level
    let result: CompactionResult;
    
    if (options.preferCompleteThreads || options.mergeRelatedThreads) {
      result = this.compactByThreadsInternal(messages, { ...options, level });
    } else {
      result = this.compactByLevel(messages, level, options);
    }

    // Handle rollback if enabled
    if (options.enableRollback) {
      const rollbackToken = this.generateRollbackToken();
      this.storeRollbackEntry(rollbackToken, originalMessages, options.rollbackExpiry);
      result.rollbackToken = rollbackToken;
    }

    // Add semantic metrics if enabled
    if (options.useSemanticAnalysis) {
      result.semanticMetrics = this.calculateSemanticMetrics(
        originalMessages,
        result.preservedMessages
      );
    }

    // Add thread metrics if enabled
    if (options.useThreadPreservation) {
      result.threadMetrics = this.calculateThreadMetrics(
        originalMessages,
        result.preservedMessages
      );
    }

    // Add context metrics if enabled
    if (options.useContextScoring && options.currentContext) {
      result.contextMetrics = this.calculateContextMetrics(
        result.preservedMessages,
        options.currentContext
      );
    }

    result.selectedLevel = level;
    result.metrics.processingTime = Date.now() - startTime;
    
    return result;
  }

  /**
   * Compact messages at thread level
   */
  compactByThreads(messages: Msg[], options: CompactionOptions = {}): CompactionResult {
    return this.compactByThreadsInternal(messages, options);
  }

  private compactByThreadsInternal(messages: Msg[], options: CompactionOptions): CompactionResult {
    const startTime = Date.now();
    const threads = this.threadSystem.identifyThreads(messages);
    
    // Score and rank threads
    const scoredThreads = threads.map(thread => ({
      thread,
      score: this.threadSystem.scoreThreadImportance([thread])[0],
      coherence: this.calculateThreadCoherence(thread)
    }));

    // Sort by importance and coherence
    scoredThreads.sort((a, b) => {
      if (options.preferCompleteThreads) {
        // Prioritize complete threads
        const aComplete = this.isCompleteThread(a.thread);
        const bComplete = this.isCompleteThread(b.thread);
        if (aComplete !== bComplete) return bComplete ? 1 : -1;
      }
      return (b.score * b.coherence) - (a.score * a.coherence);
    });

    // Merge related threads if requested
    if (options.mergeRelatedThreads) {
      this.mergeRelatedThreads(scoredThreads);
    }

    // Determine how many threads to keep
    const level = options.level || this.determineCompactionLevel(messages, options);
    const retentionRate = this.getRetentionRate(level);
    const targetMessages = Math.max(3, Math.floor(messages.length * retentionRate));

    // Select threads to preserve
    const preservedThreads: Thread[] = [];
    const preservedMessages: Msg[] = [];
    let messageCount = 0;

    for (const { thread, coherence } of scoredThreads) {
      if (messageCount >= targetMessages) break;
      
      preservedThreads.push({
        id: thread.id,
        messages: thread.messages,
        topic: thread.topic,
        coherenceScore: coherence,
        importance: thread.importanceScore
      });
      
      preservedMessages.push(...thread.messages);
      messageCount += thread.messages.length;
    }

    // Remove duplicates and sort by original order
    const uniqueMessages = this.deduplicateMessages(preservedMessages, messages);
    const removedMessages = messages.filter(m => !uniqueMessages.includes(m));

    return {
      preservedMessages: uniqueMessages,
      removedMessages,
      compressionRatio: removedMessages.length / messages.length,
      preservationScore: this.calculatePreservationScore(messages, uniqueMessages),
      preservedThreads,
      threadMetrics: {
        threadsIdentified: threads.length,
        threadsPreserved: preservedThreads.length,
        coherenceScore: this.averageCoherence(preservedThreads)
      },
      metrics: {
        tokenReduction: this.calculateTokenReduction(messages, uniqueMessages),
        messageReduction: removedMessages.length / messages.length,
        informationPreservation: this.calculateInformationPreservation(messages, uniqueMessages),
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Compact based on compression level
   */
  private compactByLevel(messages: Msg[], level: CompactionLevel, options: CompactionOptions): CompactionResult {
    const startTime = Date.now();
    const retentionRate = this.getRetentionRate(level);
    const targetMessages = Math.max(3, Math.floor(messages.length * retentionRate));

    // Always preserve system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Score messages
    const scores = options.useContextScoring && options.currentContext
      ? this.contextScoring.calculateCompositeScores(messages, { currentContext: options.currentContext })
      : this.semanticAnalyzer.scoreImportance(messages);

    // Apply preservation rules
    const preservedIndices = new Set<number>();
    
    // Add system messages
    messages.forEach((msg, idx) => {
      if (msg.role === 'system') preservedIndices.add(idx);
    });

    // Apply custom preservation rules
    if (options.preservationRules) {
      this.applyPreservationRules(messages, options.preservationRules, preservedIndices);
    }

    if (options.customPreservationRules) {
      messages.forEach((msg, idx) => {
        if (options.customPreservationRules!.some(rule => rule(msg))) {
          preservedIndices.add(idx);
        }
      });
    }

    // Apply content type weights
    if (options.contentTypeWeights) {
      this.applyContentTypeWeights(messages, scores, options.contentTypeWeights);
    }

    // Select top scoring messages
    const scoredMessages = messages
      .map((msg, idx) => ({ msg, idx, score: scores[idx] }))
      .filter(item => !preservedIndices.has(item.idx))
      .sort((a, b) => b.score - a.score);

    const remainingBudget = targetMessages - preservedIndices.size;
    scoredMessages
      .slice(0, Math.max(0, remainingBudget))
      .forEach(item => preservedIndices.add(item.idx));

    // Dynamic adjustment if enabled
    if (options.allowDynamicAdjustment && options.targetCompression) {
      const adjustments = this.dynamicallyAdjust(
        messages,
        preservedIndices,
        options.targetCompression
      );
      if (adjustments.length > 0) {
        return {
          ...this.compactByLevel(messages, level, { ...options, allowDynamicAdjustment: false }),
          adjustments
        };
      }
    }

    // Build final message list
    const preservedMessages = Array.from(preservedIndices)
      .sort((a, b) => a - b)
      .map(idx => messages[idx]);
    
    const removedMessages = messages.filter((_, idx) => !preservedIndices.has(idx));

    return {
      preservedMessages,
      removedMessages,
      compressionRatio: removedMessages.length / messages.length,
      preservationScore: this.calculatePreservationScore(messages, preservedMessages),
      metrics: {
        tokenReduction: this.calculateTokenReduction(messages, preservedMessages),
        messageReduction: removedMessages.length / messages.length,
        informationPreservation: this.calculateInformationPreservation(messages, preservedMessages),
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Determine compaction level based on constraints
   */
  private determineCompactionLevel(messages: Msg[], options: CompactionOptions): CompactionLevel {
    if (options.level) return options.level;

    if (options.autoSelectLevel && options.maxTokens) {
      const currentTokens = this.estimateTokenCount(messages);
      const ratio = options.maxTokens / currentTokens;
      
      if (ratio < 0.3) return 'aggressive';
      if (ratio < 0.6) return 'moderate';
      return 'light';
    }

    if (options.targetCompression) {
      if (options.targetCompression > 0.65) return 'aggressive';
      if (options.targetCompression > 0.4) return 'moderate';
      return 'light';
    }

    // Default based on conversation length
    if (messages.length > 100) return 'aggressive';
    if (messages.length > 30) return 'moderate';
    return 'light';
  }

  /**
   * Get retention rate for compaction level
   */
  private getRetentionRate(level: CompactionLevel): number {
    switch (level) {
      case 'light': return 0.8;  // Keep 80% for light compression
      case 'moderate': return 0.5; // Keep 50% for moderate
      case 'aggressive': return 0.25; // Keep 25% for aggressive
    }
  }

  /**
   * Apply preservation rules
   */
  private applyPreservationRules(messages: Msg[], rules: string[], preservedIndices: Set<number>) {
    rules.forEach(rule => {
      switch (rule) {
        case 'error-resolution':
          messages.forEach((msg, idx) => {
            if (msg.content.toLowerCase().includes('error') ||
                msg.content.toLowerCase().includes('fixed') ||
                msg.content.toLowerCase().includes('typeerror') ||
                msg.content.toLowerCase().includes('exception')) {
              preservedIndices.add(idx);
            }
          });
          break;
        
        case 'code-blocks':
          messages.forEach((msg, idx) => {
            if (msg.content.includes('```')) {
              preservedIndices.add(idx);
            }
          });
          break;
        
        case 'technical-discussion':
          messages.forEach((msg, idx) => {
            const technicalTerms = /api|database|function|class|authentication|server|client/gi;
            if (technicalTerms.test(msg.content)) {
              preservedIndices.add(idx);
            }
          });
          break;
      }
    });
  }

  /**
   * Apply content type weights to scores
   */
  private applyContentTypeWeights(messages: Msg[], scores: number[], weights: Record<string, number>) {
    messages.forEach((msg, idx) => {
      if (msg.content.includes('```') && weights.code) {
        scores[idx] *= weights.code;
      } else if (weights.discussion) {
        scores[idx] *= weights.discussion;
      }
    });
  }

  /**
   * Dynamically adjust compaction to meet target
   */
  private dynamicallyAdjust(
    messages: Msg[], 
    preservedIndices: Set<number>,
    targetCompression: number
  ): Array<{ type: string; reason: string; value: any }> {
    const currentCompression = 1 - (preservedIndices.size / messages.length);
    const adjustments: Array<{ type: string; reason: string; value: any }> = [];

    if (Math.abs(currentCompression - targetCompression) > 0.1) {
      if (currentCompression < targetCompression) {
        // Need more compression
        const toRemove = Math.floor((targetCompression - currentCompression) * messages.length);
        adjustments.push({
          type: 'increase-compression',
          reason: 'Below target compression',
          value: toRemove
        });
      } else {
        // Need less compression
        const toAdd = Math.floor((currentCompression - targetCompression) * messages.length);
        adjustments.push({
          type: 'decrease-compression',
          reason: 'Above target compression',
          value: toAdd
        });
      }
    }

    return adjustments;
  }

  /**
   * Rollback to previous state
   */
  rollback(token: string): RollbackResult {
    const entry = this.rollbackHistory.get(token);
    
    if (!entry) {
      return { success: false, error: 'Rollback token not found' };
    }

    if (entry.expiry && Date.now() > entry.timestamp + entry.expiry) {
      this.rollbackHistory.delete(token);
      return { success: false, error: 'Rollback token expired' };
    }

    return {
      success: true,
      restoredMessages: entry.originalMessages
    };
  }

  /**
   * Get rollback history
   */
  getRollbackHistory(): RollbackEntry[] {
    // Clean expired entries
    const now = Date.now();
    for (const [token, entry] of this.rollbackHistory.entries()) {
      if (entry.expiry && now > entry.timestamp + entry.expiry) {
        this.rollbackHistory.delete(token);
      }
    }
    
    return Array.from(this.rollbackHistory.values());
  }

  /**
   * Evaluate utility of compacted conversation
   */
  evaluateUtility(original: Msg[], compacted: Msg[]): UtilityMetrics {
    // Questions covered
    const originalQuestions = original.filter(m => m.role === 'user' && m.content.includes('?'));
    const compactedQuestions = compacted.filter(m => m.role === 'user' && m.content.includes('?'));
    const questionsCovered = compactedQuestions.length / Math.max(1, originalQuestions.length);

    // Topic continuity
    const originalTopics = this.semanticAnalyzer.identifyTopics(original);
    const compactedTopics = this.semanticAnalyzer.identifyTopics(compacted);
    const topicContinuity = compactedTopics.length / Math.max(1, originalTopics.length);

    // Context preservation
    const contextPreservation = this.calculateInformationPreservation(original, compacted);

    return {
      questionsCovered,
      topicContinuity,
      contextPreservation
    };
  }

  // Helper methods

  private calculateThreadCoherence(thread: any): number {
    // Simple coherence based on message pairing
    const userMessages = thread.messages.filter((m: Msg) => m.role === 'user').length;
    const assistantMessages = thread.messages.filter((m: Msg) => m.role === 'assistant').length;
    const pairBalance = 1 - Math.abs(userMessages - assistantMessages) / Math.max(userMessages, assistantMessages, 1);
    
    return Math.min(1, pairBalance * 0.8 + 0.2); // Base score of 0.2
  }

  private isCompleteThread(thread: any): boolean {
    if (thread.messages.length < 2) return false;
    
    const lastMessage = thread.messages[thread.messages.length - 1];
    return lastMessage.content.includes('!') ||
           lastMessage.content.toLowerCase().includes('thanks') ||
           lastMessage.content.toLowerCase().includes('fixed') ||
           lastMessage.content.toLowerCase().includes('great') ||
           thread.messages.length >= 3;
  }

  private mergeRelatedThreads(scoredThreads: any[]) {
    // Simple merge based on topic similarity
    for (let i = 0; i < scoredThreads.length - 1; i++) {
      for (let j = i + 1; j < scoredThreads.length; j++) {
        const similarity = this.calculateTopicSimilarity(
          scoredThreads[i].thread.topic,
          scoredThreads[j].thread.topic
        );
        
        if (similarity > 0.7) {
          // Merge thread j into thread i
          scoredThreads[i].thread.messages.push(...scoredThreads[j].thread.messages);
          scoredThreads.splice(j, 1);
          j--;
        }
      }
    }
  }

  private calculateTopicSimilarity(topic1: string, topic2: string): number {
    const words1 = topic1.toLowerCase().split(/\s+/);
    const words2 = topic2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private deduplicateMessages(messages: Msg[], originalOrder: Msg[]): Msg[] {
    const seen = new Set<string>();
    const unique: Msg[] = [];
    
    for (const msg of messages) {
      const key = `${msg.role}:${msg.content}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(msg);
      }
    }
    
    // Sort by original order
    return unique.sort((a, b) => {
      const aIdx = originalOrder.indexOf(a);
      const bIdx = originalOrder.indexOf(b);
      return aIdx - bIdx;
    });
  }

  private averageCoherence(threads: Thread[]): number {
    if (threads.length === 0) return 0;
    const sum = threads.reduce((acc, t) => acc + t.coherenceScore, 0);
    return sum / threads.length;
  }

  private calculatePreservationScore(original: Msg[], preserved: Msg[]): number {
    const originalImportance = this.semanticAnalyzer.scoreImportance(original);
    const preservedIndices = original.map((msg, idx) => preserved.includes(msg) ? idx : -1)
                                    .filter(idx => idx !== -1);
    
    const preservedImportance = preservedIndices.reduce((sum, idx) => sum + originalImportance[idx], 0);
    const totalImportance = originalImportance.reduce((sum, score) => sum + score, 0);
    
    return totalImportance > 0 ? preservedImportance / totalImportance : 0;
  }

  private calculateTokenReduction(original: Msg[], preserved: Msg[]): number {
    const originalTokens = this.estimateTokenCount(original);
    const preservedTokens = this.estimateTokenCount(preserved);
    
    return (originalTokens - preservedTokens) / originalTokens;
  }

  private calculateInformationPreservation(original: Msg[], preserved: Msg[]): number {
    // Use semantic analyzer to calculate information preservation
    const originalTopics = this.semanticAnalyzer.identifyTopics(original);
    const preservedTopics = this.semanticAnalyzer.identifyTopics(preserved);
    
    const topicPreservation = preservedTopics.length / Math.max(1, originalTopics.length);
    const messagePreservation = preserved.length / original.length;
    
    // Weighted combination
    return topicPreservation * 0.6 + messagePreservation * 0.4;
  }

  private estimateTokenCount(messages: Msg[]): number {
    // Rough estimation: ~4 chars per token
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private generateRollbackToken(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private storeRollbackEntry(token: string, messages: Msg[], expiry?: number) {
    this.rollbackHistory.set(token, {
      token,
      originalMessages: [...messages],
      timestamp: Date.now(),
      expiry
    });
  }

  private createResult(preserved: Msg[], removed: Msg[], original: Msg[], startTime: number): CompactionResult {
    return {
      preservedMessages: preserved,
      removedMessages: removed,
      compressionRatio: removed.length / original.length,
      preservationScore: this.calculatePreservationScore(original, preserved),
      metrics: {
        tokenReduction: this.calculateTokenReduction(original, preserved),
        messageReduction: removed.length / original.length,
        informationPreservation: this.calculateInformationPreservation(original, preserved),
        processingTime: Date.now() - startTime
      }
    };
  }

  private calculateSemanticMetrics(original: Msg[], preserved: Msg[]) {
    const originalTopics = this.semanticAnalyzer.identifyTopics(original);
    const preservedTopics = this.semanticAnalyzer.identifyTopics(preserved);
    const removedTopics = originalTopics.filter(t => !preservedTopics.includes(t));
    
    // Calculate similarity score
    let totalSimilarity = 0;
    for (let i = 0; i < preserved.length - 1; i++) {
      totalSimilarity += this.semanticAnalyzer.calculateSimilarity(preserved[i], preserved[i + 1]);
    }
    const avgSimilarity = preserved.length > 1 ? totalSimilarity / (preserved.length - 1) : 1;

    return {
      topicsPreserved: preservedTopics,
      topicsRemoved: removedTopics,
      similarityScore: avgSimilarity
    };
  }

  private calculateThreadMetrics(original: Msg[], preserved: Msg[]) {
    const originalThreads = this.threadSystem.identifyThreads(original);
    const preservedThreads = this.threadSystem.identifyThreads(preserved);
    
    const coherenceScores = preservedThreads.map(t => this.calculateThreadCoherence(t));
    const avgCoherence = coherenceScores.length > 0
      ? coherenceScores.reduce((a, b) => a + b, 0) / coherenceScores.length
      : 0;

    return {
      threadsIdentified: originalThreads.length,
      threadsPreserved: preservedThreads.length,
      coherenceScore: avgCoherence
    };
  }

  private calculateContextMetrics(preserved: Msg[], context: string) {
    const contextMsg: Msg = { role: 'user', content: context };
    const scores = this.contextScoring.calculateRelevanceScores(preserved, context);
    const avgRelevance = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate context alignment
    const keywords = this.semanticAnalyzer.extractKeywords(contextMsg);
    let alignmentScore = 0;
    
    preserved.forEach(msg => {
      const msgKeywords = this.semanticAnalyzer.extractKeywords(msg);
      const overlap = keywords.filter(k => msgKeywords.includes(k)).length;
      alignmentScore += overlap / Math.max(keywords.length, 1);
    });
    
    return {
      relevanceScore: avgRelevance,
      contextAlignment: alignmentScore / preserved.length
    };
  }
}