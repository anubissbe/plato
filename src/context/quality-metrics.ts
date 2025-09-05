/**
 * Quality Metrics System for Smart Conversation Compaction
 * Provides comprehensive metrics calculation, tracking, and analysis
 */

import type { Msg } from '../runtime/orchestrator.js';

export interface QualityMetrics {
  compressionRatio: number;
  tokenReduction: number;
  messageReduction: number;
  informationPreservation: number;
  processingTime: number;
  effectivenessScore: number;
  timestamp: number;
  sessionId?: string;
}

export interface MetricsTrends {
  avgCompressionRatio: number;
  avgPreservation: number;
  avgProcessingTime: number;
  avgEffectiveness: number;
  totalSessions: number;
  lastUpdated: number;
}

export interface QualityInsights {
  currentQuality: number;
  historicalComparison: 'above' | 'below' | 'average';
  recommendation: string;
  improvementSuggestions: string[];
  confidenceScore: number;
}

/**
 * Comprehensive Quality Metrics System for evaluating compaction effectiveness
 */
export class QualityMetricsSystem {
  private metricsHistory: QualityMetrics[] = [];
  private readonly maxHistorySize = 1000; // Keep last 1000 metrics
  
  /**
   * Calculate comprehensive quality metrics for a compaction operation
   */
  calculateMetrics(originalMessages: Msg[], compactedMessages: Msg[], processingTimeMs: number = 0): QualityMetrics {
    const startTime = Date.now();
    
    // Basic reduction metrics
    const compressionRatio = this.calculateCompressionRatio(originalMessages, compactedMessages);
    const tokenReduction = this.calculateTokenReduction(originalMessages, compactedMessages);
    const messageReduction = 1 - (compactedMessages.length / originalMessages.length);
    
    // Advanced quality metrics
    const informationPreservation = this.calculateInformationPreservation(originalMessages, compactedMessages);
    const effectivenessScore = this.calculateEffectivenessScore(compressionRatio, informationPreservation);
    
    const calculationTime = Date.now() - startTime;
    const totalProcessingTime = processingTimeMs || calculationTime;

    const metrics: QualityMetrics = {
      compressionRatio,
      tokenReduction,
      messageReduction,
      informationPreservation,
      processingTime: totalProcessingTime,
      effectivenessScore,
      timestamp: Date.now()
    };

    return metrics;
  }

  /**
   * Track metrics for trend analysis and continuous improvement
   */
  trackEffectiveness(metrics: QualityMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get historical trends for performance analysis
   */
  getHistoricalTrends(): MetricsTrends {
    if (this.metricsHistory.length === 0) {
      return {
        avgCompressionRatio: 0,
        avgPreservation: 0,
        avgProcessingTime: 0,
        avgEffectiveness: 0,
        totalSessions: 0,
        lastUpdated: Date.now()
      };
    }

    const totals = this.metricsHistory.reduce((acc, m) => ({
      compression: acc.compression + m.compressionRatio,
      preservation: acc.preservation + m.informationPreservation,
      processing: acc.processing + m.processingTime,
      effectiveness: acc.effectiveness + m.effectivenessScore
    }), { compression: 0, preservation: 0, processing: 0, effectiveness: 0 });

    const count = this.metricsHistory.length;

    return {
      avgCompressionRatio: totals.compression / count,
      avgPreservation: totals.preservation / count,
      avgProcessingTime: totals.processing / count,
      avgEffectiveness: totals.effectiveness / count,
      totalSessions: count,
      lastUpdated: Date.now()
    };
  }

  /**
   * Provide actionable quality insights and recommendations
   */
  generateQualityInsights(currentMetrics: QualityMetrics): QualityInsights {
    const trends = this.getHistoricalTrends();
    const improvementSuggestions: string[] = [];
    
    // Compare current performance to historical averages
    let historicalComparison: 'above' | 'below' | 'average' = 'average';
    
    if (trends.totalSessions > 5) { // Need sufficient data for comparison
      const effectivenessDiff = currentMetrics.effectivenessScore - trends.avgEffectiveness;
      
      if (effectivenessDiff > 0.05) {
        historicalComparison = 'above';
      } else if (effectivenessDiff < -0.05) {
        historicalComparison = 'below';
      }
    }

    // Generate improvement suggestions based on metrics
    if (currentMetrics.informationPreservation < 0.8) {
      improvementSuggestions.push('Consider reducing compression ratio to preserve more context');
    }
    
    if (currentMetrics.processingTime > 1000) {
      improvementSuggestions.push('Processing time is high - consider optimizing semantic analysis');
    }
    
    if (currentMetrics.compressionRatio < 0.3) {
      improvementSuggestions.push('Compression ratio is low - consider more aggressive compaction');
    }
    
    if (currentMetrics.effectivenessScore < 0.7) {
      improvementSuggestions.push('Overall effectiveness is below target - review compaction strategy');
    }

    // Generate recommendation
    let recommendation = '';
    if (currentMetrics.effectivenessScore >= 0.85) {
      recommendation = 'Excellent compaction quality - current settings are optimal';
    } else if (currentMetrics.effectivenessScore >= 0.75) {
      recommendation = 'Good compaction quality with room for minor improvements';
    } else if (currentMetrics.effectivenessScore >= 0.65) {
      recommendation = 'Moderate quality - consider adjusting preservation thresholds';
    } else {
      recommendation = 'Below-target quality - review compaction algorithm and settings';
    }

    // Calculate confidence score based on data availability and consistency
    const confidenceScore = this.calculateConfidenceScore(currentMetrics, trends);

    return {
      currentQuality: currentMetrics.effectivenessScore,
      historicalComparison,
      recommendation,
      improvementSuggestions,
      confidenceScore
    };
  }

  /**
   * Get metrics for a specific time period
   */
  getMetricsInRange(startTime: number, endTime: number): QualityMetrics[] {
    return this.metricsHistory.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Clear metrics history (for testing or privacy)
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }

  /**
   * Export metrics data for analysis
   */
  exportMetrics(): QualityMetrics[] {
    return [...this.metricsHistory];
  }

  // Private calculation methods

  private calculateCompressionRatio(original: Msg[], compacted: Msg[]): number {
    if (original.length === 0) return 0;
    return 1 - (compacted.length / original.length);
  }

  private calculateTokenReduction(original: Msg[], compacted: Msg[]): number {
    const originalTokens = this.estimateTokens(original);
    const compactedTokens = this.estimateTokens(compacted);
    
    if (originalTokens === 0) return 0;
    return 1 - (compactedTokens / originalTokens);
  }

  private estimateTokens(messages: Msg[]): number {
    // Simple token estimation: ~4 characters per token on average
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private calculateInformationPreservation(original: Msg[], compacted: Msg[]): number {
    if (original.length === 0) return 1;
    if (compacted.length === 0) return 0;
    
    // Calculate preservation based on multiple factors
    const contentPreservation = this.calculateContentPreservation(original, compacted);
    const contextPreservation = this.calculateContextPreservation(original, compacted);
    const importancePreservation = this.calculateImportancePreservation(original, compacted);
    
    // Weighted average of preservation factors
    return (
      contentPreservation * 0.4 +
      contextPreservation * 0.3 +
      importancePreservation * 0.3
    );
  }

  private calculateContentPreservation(original: Msg[], compacted: Msg[]): number {
    // Calculate how much unique content is preserved
    const originalContent = new Set(original.map(m => m.content.toLowerCase()));
    const compactedContent = new Set(compacted.map(m => m.content.toLowerCase()));
    
    let preservedContent = 0;
    for (const content of originalContent) {
      if (compactedContent.has(content)) {
        preservedContent++;
      }
    }
    
    return preservedContent / originalContent.size;
  }

  private calculateContextPreservation(original: Msg[], compacted: Msg[]): number {
    // Check if important context patterns are preserved
    const originalPatterns = this.extractContextPatterns(original);
    const compactedPatterns = this.extractContextPatterns(compacted);
    
    if (originalPatterns.length === 0) return 1;
    
    let preservedPatterns = 0;
    for (const pattern of originalPatterns) {
      if (compactedPatterns.some(cp => cp.type === pattern.type && cp.count > 0)) {
        preservedPatterns++;
      }
    }
    
    return preservedPatterns / originalPatterns.length;
  }

  private extractContextPatterns(messages: Msg[]): Array<{ type: string; count: number }> {
    const patterns = [
      { type: 'code_blocks', count: messages.filter(m => m.content.includes('```')).length },
      { type: 'questions', count: messages.filter(m => m.content.includes('?')).length },
      { type: 'system_messages', count: messages.filter(m => m.role === 'system').length },
      { type: 'error_messages', count: messages.filter(m => 
        m.content.toLowerCase().includes('error') || 
        m.content.toLowerCase().includes('exception')
      ).length },
      { type: 'solutions', count: messages.filter(m => 
        m.content.toLowerCase().includes('solution') ||
        m.content.toLowerCase().includes('fix') ||
        m.content.toLowerCase().includes('resolved')
      ).length }
    ];
    
    return patterns.filter(p => p.count > 0);
  }

  private calculateImportancePreservation(original: Msg[], compacted: Msg[]): number {
    // Score based on preservation of high-importance message types
    const importantOriginal = original.filter(m => this.isHighImportance(m));
    const importantCompacted = compacted.filter(m => this.isHighImportance(m));
    
    if (importantOriginal.length === 0) return 1;
    
    // Count how many important messages are preserved
    let preservedImportant = 0;
    for (const important of importantOriginal) {
      if (compacted.some(c => c.content === important.content)) {
        preservedImportant++;
      }
    }
    
    return preservedImportant / importantOriginal.length;
  }

  private isHighImportance(message: Msg): boolean {
    const content = message.content.toLowerCase();
    
    return (
      message.role === 'system' ||
      content.includes('```') ||
      content.includes('error') ||
      content.includes('exception') ||
      content.includes('important') ||
      content.includes('critical') ||
      content.includes('warning') ||
      content.includes('solution') ||
      content.includes('fix') ||
      content.length > 200 // Long messages often contain important details
    );
  }

  private calculateEffectivenessScore(compressionRatio: number, informationPreservation: number): number {
    // Effectiveness balances compression achieved with information preserved
    // Formula: effectiveness = sqrt(compression * preservation) to penalize extreme values
    
    if (compressionRatio <= 0 || informationPreservation <= 0) return 0;
    
    // Apply diminishing returns to very high compression ratios
    const adjustedCompression = Math.min(compressionRatio, 0.8);
    
    // Calculate geometric mean for balanced effectiveness
    const geometricMean = Math.sqrt(adjustedCompression * informationPreservation);
    
    // Apply bonus for high preservation with good compression
    const bonus = (informationPreservation > 0.9 && compressionRatio > 0.4) ? 0.05 : 0;
    
    return Math.min(geometricMean + bonus, 1.0);
  }

  private calculateConfidenceScore(currentMetrics: QualityMetrics, trends: MetricsTrends): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence with more historical data
    if (trends.totalSessions > 10) confidence += 0.2;
    if (trends.totalSessions > 50) confidence += 0.2;
    
    // Increase confidence if current metrics are consistent with trends
    if (trends.totalSessions > 5) {
      const effectivenessDiff = Math.abs(currentMetrics.effectivenessScore - trends.avgEffectiveness);
      if (effectivenessDiff < 0.1) confidence += 0.1;
    }
    
    // Decrease confidence for extreme values that might indicate issues
    if (currentMetrics.processingTime > 2000) confidence -= 0.1;
    if (currentMetrics.effectivenessScore < 0.3) confidence -= 0.1;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

/**
 * Singleton instance for global metrics tracking
 */
export const globalQualityMetrics = new QualityMetricsSystem();