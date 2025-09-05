/**
 * Thread-Aware Preservation System
 * Identifies and preserves conversation threads to maintain logical flow during compaction
 */

import type { Msg } from '../runtime/orchestrator.js';

export interface Thread {
  id: string;
  topic: string;
  messages: Msg[];
  startIndex: number;
  endIndex: number;
  importanceScore: number;
  keywords: string[];
}

export interface ThreadRelationships {
  dependencies: Array<{
    dependent: string;
    prerequisite: string;
  }>;
  references: Array<{
    from: string;
    to: string;
    type: 'explicit' | 'implicit';
  }>;
}

export interface PreservationOptions {
  threshold?: number;
  maxThreads?: number;
  preserveDependencies?: boolean;
  preserveCompleteThreads?: boolean;
  recencyWeight?: number;
}

export interface CompactionOptions {
  targetReduction: number;
  preserveThreadCoherence?: boolean;
  preserveCompleteThreads?: boolean;
}

export interface CompactionResult {
  messages: Msg[];
  preservedThreads: Thread[];
  coherenceScore: number;
  reductionAchieved: number;
}

export class ThreadPreservationSystem {
  private readonly stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'how', 'what', 'when', 'where', 'why', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'can', 'need', 'dare', 'ought', 'used', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);

  /**
   * Identifies conversation threads from a sequence of messages
   */
  identifyThreads(messages: Msg[]): Thread[] {
    if (messages.length === 0) return [];

    const threads: Thread[] = [];
    const boundaries = this.detectThreadBoundaries(messages);
    let startIdx = 0;

    // Filter out system messages
    const conversationMessages = messages.filter(m => m.role !== 'system');
    if (conversationMessages.length === 0) return [];

    for (let i = 0; i <= boundaries.length; i++) {
      const endIdx = i < boundaries.length ? boundaries[i] : conversationMessages.length;
      
      if (endIdx > startIdx) {
        const threadMessages = conversationMessages.slice(startIdx, endIdx);
        const keywords = this.extractThreadKeywords(threadMessages);
        const topic = this.determineThreadTopic(threadMessages, keywords);
        
        threads.push({
          id: `thread-${threads.length + 1}`,
          topic,
          messages: threadMessages,
          startIndex: startIdx,
          endIndex: endIdx - 1,
          importanceScore: 0,
          keywords
        });
      }
      
      startIdx = endIdx;
    }

    // Calculate importance scores
    const scores = this.scoreThreadImportance(threads);
    threads.forEach((thread, idx) => {
      thread.importanceScore = scores[idx];
    });

    return threads;
  }

  /**
   * Detects boundaries between conversation threads
   */
  detectThreadBoundaries(messages: Msg[]): number[] {
    const boundaries: number[] = [];
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    for (let i = 1; i < conversationMessages.length; i++) {
      const prevMsg = conversationMessages[i - 1];
      const currMsg = conversationMessages[i];
      
      // Check for natural breaks
      if (this.isNaturalBreak(prevMsg, currMsg)) {
        boundaries.push(i);
        continue;
      }
      
      // Check for topic switches - be more conservative
      if (this.isTopicSwitch(prevMsg, currMsg)) {
        boundaries.push(i);
        continue;
      }
      
      // Check for conversation restarts
      if (this.isConversationRestart(prevMsg, currMsg)) {
        boundaries.push(i);
      }
    }
    
    return boundaries;
  }

  /**
   * Scores the importance of threads
   */
  scoreThreadImportance(threads: Thread[]): number[] {
    return threads.map(thread => {
      let score = 0;
      
      // Length factor (longer threads indicate more engagement)
      score += Math.min(thread.messages.length * 0.05, 0.3);
      
      // Question factor (threads with questions are important)
      const questionCount = thread.messages.filter(m => 
        m.content.includes('?') || 
        m.content.toLowerCase().includes('how') ||
        m.content.toLowerCase().includes('what') ||
        m.content.toLowerCase().includes('why')
      ).length;
      score += Math.min(questionCount * 0.15, 0.3);
      
      // Code factor (threads with code examples are valuable)
      const hasCode = thread.messages.some(m => m.content.includes('```'));
      if (hasCode) score += 0.25;
      
      // Problem-solving factor
      const problemKeywords = ['fix', 'bug', 'error', 'issue', 'problem', 'critical'];
      const hasProblem = thread.messages.some(m => 
        problemKeywords.some(keyword => m.content.toLowerCase().includes(keyword))
      );
      if (hasProblem) score += 0.15;
      
      return Math.min(score, 1.0);
    });
  }

  /**
   * Maps relationships between threads
   */
  mapThreadRelationships(threads: Thread[]): ThreadRelationships {
    const relationships: ThreadRelationships = {
      dependencies: [],
      references: []
    };
    
    for (let i = 0; i < threads.length; i++) {
      for (let j = i + 1; j < threads.length; j++) {
        const thread1 = threads[i];
        const thread2 = threads[j];
        
        // Check for references
        if (this.threadsReference(thread1, thread2)) {
          relationships.references.push({
            from: thread2.id,
            to: thread1.id,
            type: this.isExplicitReference(thread2, thread1) ? 'explicit' : 'implicit'
          });
        }
        
        // Check for dependencies
        if (this.threadDependsOn(thread2, thread1)) {
          relationships.dependencies.push({
            dependent: thread2.id,
            prerequisite: thread1.id
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Preserves threads based on importance and options
   */
  preserveThreads(threads: Thread[], options: PreservationOptions = {}): Thread[] {
    const {
      threshold = 0.5,
      maxThreads = Infinity,
      preserveDependencies = true,
      recencyWeight = 0
    } = options;
    
    // Apply recency weighting if specified
    let scoredThreads = threads.map((thread, idx) => {
      let adjustedScore = thread.importanceScore;
      if (recencyWeight > 0) {
        const recencyBonus = (idx / threads.length) * recencyWeight;
        adjustedScore = thread.importanceScore * (1 - recencyWeight) + recencyBonus;
      }
      return { ...thread, importanceScore: adjustedScore };
    });
    
    // Sort by importance
    scoredThreads.sort((a, b) => b.importanceScore - a.importanceScore);
    
    // Select threads above threshold
    let preserved = scoredThreads.filter(t => t.importanceScore >= threshold);
    
    // If we have important threads, ensure we preserve at least one
    if (preserved.length === 0 && scoredThreads.length > 0) {
      // Take the most important thread even if below threshold
      preserved.push(scoredThreads[0]);
    }
    
    // Preserve dependencies if requested
    if (preserveDependencies) {
      const relationships = this.mapThreadRelationships(threads);
      const preservedIds = new Set(preserved.map(t => t.id));
      
      for (const dep of relationships.dependencies) {
        if (preservedIds.has(dep.dependent) && !preservedIds.has(dep.prerequisite)) {
          const prerequisite = threads.find(t => t.id === dep.prerequisite);
          if (prerequisite) {
            preserved.push(prerequisite);
            preservedIds.add(dep.prerequisite);
          }
        }
      }
    }
    
    // Apply max threads limit
    if (preserved.length > maxThreads) {
      preserved = preserved.slice(0, maxThreads);
    }
    
    // Sort back to original order
    preserved.sort((a, b) => a.startIndex - b.startIndex);
    
    return preserved;
  }

  /**
   * Compacts messages while preserving thread coherence
   */
  compactWithThreadPreservation(messages: Msg[], options: CompactionOptions): CompactionResult {
    const { targetReduction, preserveThreadCoherence = true, preserveCompleteThreads = false } = options;
    
    // Identify threads
    const threads = this.identifyThreads(messages);
    
    // Calculate target message count
    const targetCount = Math.floor(messages.length * (1 - targetReduction));
    
    // Determine importance threshold to achieve target
    let threshold = 0.3;
    let preserved = this.preserveThreads(threads, { threshold, preserveCompleteThreads });
    let messageCount = this.countMessagesInThreads(preserved);
    
    // Binary search for optimal threshold
    let lowThreshold = 0.0;
    let highThreshold = 1.0;
    let attempts = 0;
    
    while (attempts < 15) {
      const systemCount = messages.filter(m => m.role === 'system').length;
      const currentTotal = messageCount + systemCount;
      
      // Allow within 10% of target
      const tolerance = Math.max(2, Math.floor(targetCount * 0.1));
      if (Math.abs(currentTotal - targetCount) <= tolerance) {
        break; // Close enough
      }
      
      if (currentTotal < targetCount) {
        // Need more messages, lower threshold
        highThreshold = threshold;
        threshold = (lowThreshold + highThreshold) / 2;
      } else {
        // Too many messages, raise threshold
        lowThreshold = threshold;
        threshold = (lowThreshold + highThreshold) / 2;
      }
      
      preserved = this.preserveThreads(threads, { threshold, preserveCompleteThreads });
      messageCount = this.countMessagesInThreads(preserved);
      attempts++;
    }
    
    // Reconstruct message sequence
    const compactedMessages: Msg[] = [];
    const systemMessages = messages.filter(m => m.role === 'system');
    
    // Add system messages first
    compactedMessages.push(...systemMessages);
    
    // Add preserved thread messages
    for (const thread of preserved) {
      compactedMessages.push(...thread.messages);
    }
    
    // Calculate coherence score
    const coherenceScore = this.calculateCoherenceScore(compactedMessages, messages);
    
    return {
      messages: compactedMessages,
      preservedThreads: preserved,
      coherenceScore,
      reductionAchieved: 1 - (compactedMessages.length / messages.length)
    };
  }

  // Private helper methods

  private extractThreadKeywords(messages: Msg[]): string[] {
    const wordFreq = new Map<string, number>();
    
    for (const msg of messages) {
      const words = msg.content.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !this.stopWords.has(word));
      
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    
    // Get top keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private determineThreadTopic(messages: Msg[], keywords: string[]): string {
    // Use keywords and first user message to determine topic
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'general';
    
    // Extract key phrases from first message
    const content = firstUserMsg.content.toLowerCase();
    
    // Check for common topics
    if (content.includes('database')) return 'database';
    if (content.includes('api')) return 'api';
    if (content.includes('auth')) return 'authentication';
    if (content.includes('react') || content.includes('component')) return 'react';
    if (content.includes('endpoint')) return 'api';
    if (content.includes('test')) return 'testing';
    if (content.includes('bug') || content.includes('error')) return 'debugging';
    
    // Use most frequent keyword as topic
    if (keywords.length > 0) {
      return keywords[0];
    }
    
    return 'general';
  }

  private isNaturalBreak(prev: Msg, curr: Msg): boolean {
    const breakIndicators = ['thanks', 'thank you', 'goodbye', 'bye', 'done', 'that\'s all'];
    const prevLower = prev.content.toLowerCase();
    const currLower = curr.content.toLowerCase();
    
    // Check if previous message indicates end
    const prevEnds = breakIndicators.some(indicator => prevLower.includes(indicator));
    
    // Check if current message indicates new start
    const currStarts = currLower.includes('new question') || 
                      currLower.includes('different topic') ||
                      currLower.includes('switching topics') ||
                      currLower.includes('another question');
    
    return prevEnds && (curr.role === 'user' || currStarts);
  }

  private isTopicSwitch(prev: Msg, curr: Msg): boolean {
    // Extract keywords from both messages
    const prevWords = this.extractKeywords(prev.content);
    const currWords = this.extractKeywords(curr.content);
    
    // If the messages are clearly related (e.g., follow-up questions), don't split
    const followUpIndicators = ['show me', 'example', 'how about', 'what about', 'can you'];
    if (followUpIndicators.some(ind => curr.content.toLowerCase().includes(ind))) {
      return false;
    }
    
    // Calculate overlap
    const overlap = prevWords.filter(w => currWords.includes(w)).length;
    const similarity = overlap / Math.max(prevWords.length, currWords.length, 1);
    
    // Topic switch if similarity is very low and it's a clear new topic
    return similarity < 0.1 && curr.role === 'user';
  }

  private isConversationRestart(prev: Msg, curr: Msg): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
    const currLower = curr.content.toLowerCase();
    
    return greetings.some(greeting => currLower.startsWith(greeting)) && 
           curr.role === 'user' && 
           prev.role === 'assistant';
  }

  private extractKeywords(content: string): string[] {
    return content.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.stopWords.has(word));
  }

  private threadsReference(thread1: Thread, thread2: Thread): boolean {
    // Check if thread2 references keywords from thread1
    const thread1Keywords = new Set(thread1.keywords);
    
    for (const msg of thread2.messages) {
      const words = this.extractKeywords(msg.content);
      if (words.some(w => thread1Keywords.has(w))) {
        return true;
      }
      
      // Check for explicit references
      if (msg.content.toLowerCase().includes('earlier') ||
          msg.content.toLowerCase().includes('before') ||
          msg.content.toLowerCase().includes('previously') ||
          msg.content.toLowerCase().includes('going back')) {
        return true;
      }
    }
    
    return false;
  }

  private isExplicitReference(from: Thread, to: Thread): boolean {
    return from.messages.some(msg => 
      msg.content.toLowerCase().includes('going back') ||
      msg.content.toLowerCase().includes('as mentioned') ||
      msg.content.toLowerCase().includes('earlier') ||
      msg.content.toLowerCase().includes('previously')
    );
  }

  private threadDependsOn(dependent: Thread, prerequisite: Thread): boolean {
    // Check if dependent thread explicitly mentions dependency
    for (const msg of dependent.messages) {
      const content = msg.content.toLowerCase();
      
      // Check for explicit dependency phrases
      if (content.includes('now that') && content.includes('ready')) {
        // "Now that the database is ready" pattern
        return true;
      }
      
      // More flexible dependency detection
      const dependencyPhrases = [
        'now that',
        'after',
        'since',
        'based on',
        'using the',
        'with the'
      ];
      
      const hasDependencyPhrase = dependencyPhrases.some(phrase => content.includes(phrase));
      
      if (hasDependencyPhrase) {
        // Check if it references prerequisite keywords or topic
        const hasReference = prerequisite.keywords.some(keyword => 
          content.includes(keyword.toLowerCase())
        ) || content.includes(prerequisite.topic.toLowerCase());
        
        if (hasReference) return true;
      }
    }
    
    return false;
  }

  private countMessagesInThreads(threads: Thread[]): number {
    return threads.reduce((sum, thread) => sum + thread.messages.length, 0);
  }

  private calculateCoherenceScore(compacted: Msg[], original: Msg[]): number {
    // Check conversation flow integrity
    let flowScore = 1.0;
    
    for (let i = 0; i < compacted.length - 1; i++) {
      if (compacted[i].role === 'user' && compacted[i + 1].role !== 'assistant') {
        flowScore -= 0.05;
      }
    }
    
    // Check information preservation
    const preservationRatio = compacted.length / original.length;
    const preservationScore = Math.min(preservationRatio + 0.5, 1.0);
    
    // Combined score
    return (flowScore + preservationScore) / 2;
  }
}