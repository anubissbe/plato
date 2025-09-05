/**
 * User Feedback Collection and Analysis System
 * Collects user satisfaction data and provides insights for improvement
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface UserFeedback {
  sessionId: string;
  timestamp: number;
  
  // Core ratings (1-5 scale)
  satisfactionScore: number;
  qualityRating: number;
  preservationRating: number;
  
  // Additional feedback
  comments: string;
  wouldRecommend: boolean;
  
  // Context information
  originalMessageCount: number;
  compactedMessageCount: number;
  compressionRatio: number;
  effectivenessScore: number;
  
  // User preferences observed
  userPreferences?: {
    preferredCompressionLevel?: string;
    mostValuedFeature?: string;
    leastValuedFeature?: string;
  };
}

export interface FeedbackAnalysis {
  totalResponses: number;
  averageRatings: {
    satisfaction: number;
    quality: number;
    preservation: number;
  };
  recommendationRate: number;
  
  trends: {
    improvementNeeded: boolean;
    recommendations: string[];
    strengths: string[];
    weaknesses: string[];
  };
  
  insights: {
    optimalCompressionRatio: number;
    preferredSettings: any;
    commonIssues: string[];
  };
}

export interface FeedbackPrompt {
  sessionId: string;
  metrics: {
    compressionRatio: number;
    effectivenessScore: number;
    originalCount: number;
    compactedCount: number;
  };
  quickFeedback?: boolean;
}

/**
 * Collects and analyzes user feedback for continuous improvement
 */
export class UserFeedbackCollector {
  private feedback: UserFeedback[] = [];
  private readonly feedbackFile: string;
  private readonly maxFeedbackHistory = 1000;

  constructor(dataDir?: string) {
    const configDir = dataDir || path.join(os.homedir(), '.plato');
    this.feedbackFile = path.join(configDir, 'compaction-feedback.json');
  }

  /**
   * Collect feedback from user
   */
  async collectFeedback(feedback: Omit<UserFeedback, 'timestamp'>): Promise<UserFeedback> {
    const completeFeedback: UserFeedback = {
      ...feedback,
      timestamp: Date.now()
    };

    // Validate feedback
    this.validateFeedback(completeFeedback);
    
    this.feedback.push(completeFeedback);
    
    // Maintain history limit
    if (this.feedback.length > this.maxFeedbackHistory) {
      this.feedback = this.feedback.slice(-this.maxFeedbackHistory);
    }
    
    // Save to disk
    await this.saveFeedback();
    
    return completeFeedback;
  }

  /**
   * Load feedback history from disk
   */
  async loadFeedback(): Promise<void> {
    try {
      const data = await fs.readFile(this.feedbackFile, 'utf8');
      const loaded = JSON.parse(data);
      
      if (Array.isArray(loaded)) {
        this.feedback = loaded.filter(f => this.isValidFeedback(f));
      }
    } catch (error) {
      // File doesn't exist or is invalid, start with empty feedback
      this.feedback = [];
    }
  }

  /**
   * Save feedback to disk
   */
  async saveFeedback(): Promise<void> {
    try {
      const dir = path.dirname(this.feedbackFile);
      await fs.mkdir(dir, { recursive: true });
      
      const data = JSON.stringify(this.feedback, null, 2);
      await fs.writeFile(this.feedbackFile, data, 'utf8');
    } catch (error) {
      console.warn(`Failed to save feedback: ${error.message}`);
    }
  }

  /**
   * Get feedback history
   */
  getFeedbackHistory(limit?: number): UserFeedback[] {
    const history = [...this.feedback].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Calculate average ratings
   */
  getAverageRatings(): { satisfaction: number; quality: number; preservation: number } {
    if (this.feedback.length === 0) {
      return { satisfaction: 0, quality: 0, preservation: 0 };
    }

    const totals = this.feedback.reduce((acc, f) => ({
      satisfaction: acc.satisfaction + f.satisfactionScore,
      quality: acc.quality + f.qualityRating,
      preservation: acc.preservation + f.preservationRating
    }), { satisfaction: 0, quality: 0, preservation: 0 });

    const count = this.feedback.length;
    return {
      satisfaction: Math.round((totals.satisfaction / count) * 10) / 10,
      quality: Math.round((totals.quality / count) * 10) / 10,
      preservation: Math.round((totals.preservation / count) * 10) / 10
    };
  }

  /**
   * Analyze feedback trends and provide recommendations
   */
  analyzeTrends(): FeedbackAnalysis['trends'] {
    const ratings = this.getAverageRatings();
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Identify areas needing improvement
    if (ratings.satisfaction < 3.5) {
      recommendations.push('User satisfaction is below target - review overall experience');
      weaknesses.push('User satisfaction');
    } else if (ratings.satisfaction >= 4.0) {
      strengths.push('High user satisfaction');
    }
    
    if (ratings.quality < 3.5) {
      recommendations.push('Quality ratings are low - improve compaction algorithms');
      weaknesses.push('Compaction quality');
    } else if (ratings.quality >= 4.0) {
      strengths.push('Good quality perception');
    }
    
    if (ratings.preservation < 3.5) {
      recommendations.push('Information preservation needs improvement');
      weaknesses.push('Information preservation');
    } else if (ratings.preservation >= 4.0) {
      strengths.push('Effective information preservation');
    }

    // Analyze recommendation rate
    const recommendRate = this.getRecommendationRate();
    if (recommendRate < 0.7) {
      recommendations.push('Low recommendation rate - focus on user value proposition');
      weaknesses.push('User advocacy');
    } else if (recommendRate >= 0.8) {
      strengths.push('High user advocacy');
    }

    // Analyze recent trends
    const recentFeedback = this.feedback.slice(-10);
    if (recentFeedback.length >= 5) {
      const recentAvg = recentFeedback.reduce((acc, f) => acc + f.satisfactionScore, 0) / recentFeedback.length;
      const overallAvg = ratings.satisfaction;
      
      if (recentAvg > overallAvg + 0.3) {
        strengths.push('Recent improvements in satisfaction');
      } else if (recentAvg < overallAvg - 0.3) {
        recommendations.push('Recent decline in satisfaction - investigate changes');
        weaknesses.push('Recent satisfaction trend');
      }
    }

    return {
      improvementNeeded: recommendations.length > 0,
      recommendations,
      strengths,
      weaknesses
    };
  }

  /**
   * Generate comprehensive feedback analysis
   */
  generateAnalysis(): FeedbackAnalysis {
    const averageRatings = this.getAverageRatings();
    const trends = this.analyzeTrends();
    const insights = this.generateInsights();

    return {
      totalResponses: this.feedback.length,
      averageRatings,
      recommendationRate: this.getRecommendationRate(),
      trends,
      insights
    };
  }

  /**
   * Generate actionable insights from feedback data
   */
  private generateInsights(): FeedbackAnalysis['insights'] {
    if (this.feedback.length < 5) {
      return {
        optimalCompressionRatio: 0.4,
        preferredSettings: {},
        commonIssues: ['Insufficient feedback data for insights']
      };
    }

    // Find optimal compression ratio based on satisfaction
    const compressionSatisfaction = new Map<number, number[]>();
    this.feedback.forEach(f => {
      const ratio = Math.round(f.compressionRatio * 10) / 10; // Round to 0.1
      if (!compressionSatisfaction.has(ratio)) {
        compressionSatisfaction.set(ratio, []);
      }
      compressionSatisfaction.get(ratio)!.push(f.satisfactionScore);
    });

    let optimalRatio = 0.4;
    let highestAvgSatisfaction = 0;
    
    compressionSatisfaction.forEach((scores, ratio) => {
      const avgSatisfaction = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avgSatisfaction > highestAvgSatisfaction && scores.length >= 3) {
        highestAvgSatisfaction = avgSatisfaction;
        optimalRatio = ratio;
      }
    });

    // Analyze user preferences
    const preferredSettings: any = {};
    const preferences = this.feedback.map(f => f.userPreferences).filter(Boolean);
    
    if (preferences.length > 0) {
      // Most valued features
      const mostValued = preferences.map(p => p.mostValuedFeature).filter(Boolean);
      const valuedCounts = this.countFrequency(mostValued);
      if (valuedCounts.length > 0) {
        preferredSettings.mostValuedFeature = valuedCounts[0].item;
      }
      
      // Preferred compression levels
      const compLevels = preferences.map(p => p.preferredCompressionLevel).filter(Boolean);
      const levelCounts = this.countFrequency(compLevels);
      if (levelCounts.length > 0) {
        preferredSettings.preferredCompressionLevel = levelCounts[0].item;
      }
    }

    // Identify common issues from comments
    const commonIssues = this.extractCommonIssues();

    return {
      optimalCompressionRatio: optimalRatio,
      preferredSettings,
      commonIssues
    };
  }

  /**
   * Extract common issues from feedback comments
   */
  private extractCommonIssues(): string[] {
    const comments = this.feedback
      .map(f => f.comments.toLowerCase().trim())
      .filter(c => c.length > 10);

    if (comments.length < 3) return [];

    const issues: string[] = [];
    
    // Look for common complaint patterns
    const patterns = [
      { pattern: /lost.*important|missing.*context|removed.*needed/i, issue: 'Important context lost' },
      { pattern: /too.*aggressive|too.*much.*removed/i, issue: 'Compression too aggressive' },
      { pattern: /slow|takes.*long|performance/i, issue: 'Performance concerns' },
      { pattern: /confusing|unclear|hard.*understand/i, issue: 'User experience issues' },
      { pattern: /preview.*unclear|diff.*confusing/i, issue: 'Preview interface unclear' },
      { pattern: /code.*lost|code.*removed|missing.*code/i, issue: 'Code preservation issues' },
      { pattern: /error.*lost|error.*missing/i, issue: 'Error information not preserved' }
    ];

    patterns.forEach(({ pattern, issue }) => {
      const matchingComments = comments.filter(c => pattern.test(c));
      if (matchingComments.length >= 2) {
        issues.push(issue);
      }
    });

    return issues;
  }

  /**
   * Get recommendation rate (% who would recommend)
   */
  private getRecommendationRate(): number {
    if (this.feedback.length === 0) return 0;
    
    const recommendCount = this.feedback.filter(f => f.wouldRecommend).length;
    return Math.round((recommendCount / this.feedback.length) * 100) / 100;
  }

  /**
   * Count frequency of items in array
   */
  private countFrequency<T>(items: T[]): Array<{ item: T; count: number }> {
    const counts = new Map<T, number>();
    items.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate a feedback prompt for the user
   */
  generateFeedbackPrompt(context: FeedbackPrompt): string {
    const { sessionId, metrics, quickFeedback } = context;
    
    if (quickFeedback) {
      return `
📊 Quick Feedback (Session: ${sessionId.substring(0, 8)}...):
Compressed ${metrics.originalCount} → ${metrics.compactedCount} messages (${Math.round(metrics.compressionRatio * 100)}%)
Quality Score: ${Math.round(metrics.effectivenessScore * 100)}%

Rate this compaction (1-5): ___
Would recommend? (y/n): ___
      `.trim();
    }

    return `
📋 Feedback Survey (Session: ${sessionId.substring(0, 8)}...):

Compaction Results:
• Original Messages: ${metrics.originalCount}
• Compacted Messages: ${metrics.compactedCount}  
• Compression: ${Math.round(metrics.compressionRatio * 100)}%
• Quality Score: ${Math.round(metrics.effectivenessScore * 100)}%

Please rate (1-5 scale):
• Overall satisfaction: ___
• Quality of preserved content: ___
• Information preservation accuracy: ___

• Would you recommend this feature? (y/n): ___

Comments (optional):
_________________________________________________
_________________________________________________

Most valuable aspect: ________________________
Least valuable aspect: ______________________
    `.trim();
  }

  /**
   * Parse user feedback input from string
   */
  parseFeedbackInput(input: string, context: FeedbackPrompt): Partial<UserFeedback> {
    const lines = input.split('\n').map(l => l.trim());
    const feedback: Partial<UserFeedback> = {
      sessionId: context.sessionId,
      originalMessageCount: context.metrics.originalCount,
      compactedMessageCount: context.metrics.compactedCount,
      compressionRatio: context.metrics.compressionRatio,
      effectivenessScore: context.metrics.effectivenessScore,
      comments: ''
    };

    // Parse ratings (look for numbers 1-5)
    const ratingPattern = /(\d)/g;
    const ratings = input.match(ratingPattern)?.map(n => parseInt(n)).filter(n => n >= 1 && n <= 5) || [];
    
    if (ratings.length >= 1) feedback.satisfactionScore = ratings[0];
    if (ratings.length >= 2) feedback.qualityRating = ratings[1];
    if (ratings.length >= 3) feedback.preservationRating = ratings[2];

    // Parse recommendation (y/n)
    const recommendMatch = input.match(/recommend.*?(y|n)/i);
    if (recommendMatch) {
      feedback.wouldRecommend = recommendMatch[1].toLowerCase() === 'y';
    }

    // Extract comments
    const commentLines = lines.filter(l => 
      l.length > 20 && 
      !l.includes('___') && 
      !l.includes('rate') &&
      !l.includes('recommend')
    );
    
    if (commentLines.length > 0) {
      feedback.comments = commentLines.join(' ');
    }

    return feedback;
  }

  /**
   * Validate feedback data
   */
  private validateFeedback(feedback: UserFeedback): void {
    if (feedback.satisfactionScore < 1 || feedback.satisfactionScore > 5) {
      throw new Error('Satisfaction score must be between 1 and 5');
    }
    
    if (feedback.qualityRating < 1 || feedback.qualityRating > 5) {
      throw new Error('Quality rating must be between 1 and 5');
    }
    
    if (feedback.preservationRating < 1 || feedback.preservationRating > 5) {
      throw new Error('Preservation rating must be between 1 and 5');
    }
    
    if (!feedback.sessionId || feedback.sessionId.length < 5) {
      throw new Error('Valid session ID is required');
    }
  }

  /**
   * Check if feedback object is valid
   */
  private isValidFeedback(feedback: any): feedback is UserFeedback {
    return (
      feedback &&
      typeof feedback.satisfactionScore === 'number' &&
      typeof feedback.qualityRating === 'number' &&
      typeof feedback.preservationRating === 'number' &&
      typeof feedback.sessionId === 'string' &&
      typeof feedback.timestamp === 'number' &&
      feedback.satisfactionScore >= 1 && feedback.satisfactionScore <= 5 &&
      feedback.qualityRating >= 1 && feedback.qualityRating <= 5 &&
      feedback.preservationRating >= 1 && feedback.preservationRating <= 5
    );
  }

  /**
   * Clear feedback history
   */
  async clearHistory(): Promise<void> {
    this.feedback = [];
    await this.saveFeedback();
  }
}

/**
 * Global feedback collector instance
 */
export const globalFeedbackCollector = new UserFeedbackCollector();