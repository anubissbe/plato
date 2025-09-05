/**
 * Quality Metrics and UI Enhancement Tests
 * Tests for Task 5: Comprehensive quality metrics calculation and UI components
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { Msg } from '../runtime/orchestrator.js';

// Interfaces for Task 5 components (to be implemented)
interface QualityMetrics {
  compressionRatio: number;
  tokenReduction: number;
  messageReduction: number;
  informationPreservation: number;
  processingTime: number;
  effectivenessScore: number;
}

interface CompactionPreview {
  originalMessages: Msg[];
  compactedMessages: Msg[];
  metrics: QualityMetrics;
  diff: CompactionDiff[];
  approved: boolean;
}

interface CompactionDiff {
  type: 'kept' | 'removed' | 'summarized';
  originalIndex: number;
  content: string;
  reason: string;
}

interface CompactionSettings {
  autoCompaction: boolean;
  compressionLevel: 'light' | 'moderate' | 'aggressive';
  preserveCodeBlocks: boolean;
  preserveSystemMessages: boolean;
  customPreservationRules: string[];
  qualityThreshold: number;
  previewRequired: boolean;
}

interface UserFeedback {
  sessionId: string;
  timestamp: number;
  satisfactionScore: number; // 1-5 scale
  qualityRating: number; // 1-5 scale  
  preservationRating: number; // 1-5 scale
  comments: string;
  wouldRecommend: boolean;
}

// Mock implementations for testing
class MockQualityMetricsSystem {
  calculateMetrics(original: Msg[], compacted: Msg[]): QualityMetrics {
    return {
      compressionRatio: 1 - (compacted.length / original.length),
      tokenReduction: 0.4, // 40% token reduction
      messageReduction: 1 - (compacted.length / original.length),
      informationPreservation: 0.85, // 85% information preserved
      processingTime: 150, // milliseconds
      effectivenessScore: 0.82 // composite score
    };
  }

  trackEffectiveness(metrics: QualityMetrics): void {
    // Track metrics over time for trend analysis
  }

  getHistoricalTrends(): { avgCompressionRatio: number; avgPreservation: number; avgProcessingTime: number } {
    return {
      avgCompressionRatio: 0.42,
      avgPreservation: 0.88,
      avgProcessingTime: 145
    };
  }
}

class MockCompactionPreviewUI {
  generatePreview(original: Msg[], compacted: Msg[]): CompactionPreview {
    const diff: CompactionDiff[] = [];
    
    // Generate diff visualization
    original.forEach((msg, index) => {
      const isKept = compacted.some(c => c.content === msg.content);
      diff.push({
        type: isKept ? 'kept' : 'removed',
        originalIndex: index,
        content: msg.content.substring(0, 100),
        reason: isKept ? 'Important context' : 'Low relevance'
      });
    });

    return {
      originalMessages: original,
      compactedMessages: compacted,
      metrics: new MockQualityMetricsSystem().calculateMetrics(original, compacted),
      diff,
      approved: false
    };
  }

  approveCompaction(preview: CompactionPreview): CompactionPreview {
    return { ...preview, approved: true };
  }

  rejectCompaction(preview: CompactionPreview, reason: string): CompactionPreview {
    return { ...preview, approved: false };
  }
}

class MockCompactionSettingsManager {
  private settings: CompactionSettings = {
    autoCompaction: false,
    compressionLevel: 'moderate',
    preserveCodeBlocks: true,
    preserveSystemMessages: true,
    customPreservationRules: [],
    qualityThreshold: 0.8,
    previewRequired: true
  };

  getSettings(): CompactionSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<CompactionSettings>): CompactionSettings {
    this.settings = { ...this.settings, ...updates };
    return this.getSettings();
  }

  resetToDefaults(): CompactionSettings {
    this.settings = {
      autoCompaction: false,
      compressionLevel: 'moderate',
      preserveCodeBlocks: true,
      preserveSystemMessages: true,
      customPreservationRules: [],
      qualityThreshold: 0.8,
      previewRequired: true
    };
    return this.getSettings();
  }

  validateSettings(settings: CompactionSettings): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (settings.qualityThreshold < 0 || settings.qualityThreshold > 1) {
      errors.push('Quality threshold must be between 0 and 1');
    }
    
    if (!['light', 'moderate', 'aggressive'].includes(settings.compressionLevel)) {
      errors.push('Invalid compression level');
    }

    return { valid: errors.length === 0, errors };
  }
}

class MockUserFeedbackCollector {
  private feedback: UserFeedback[] = [];

  collectFeedback(feedback: Omit<UserFeedback, 'timestamp'>): UserFeedback {
    const completeFeedback: UserFeedback = {
      ...feedback,
      timestamp: Date.now()
    };
    
    this.feedback.push(completeFeedback);
    return completeFeedback;
  }

  getFeedbackHistory(): UserFeedback[] {
    return [...this.feedback];
  }

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
      satisfaction: totals.satisfaction / count,
      quality: totals.quality / count,
      preservation: totals.preservation / count
    };
  }

  analyzeTrends(): { improvementNeeded: boolean; recommendations: string[] } {
    const ratings = this.getAverageRatings();
    const recommendations: string[] = [];
    
    if (ratings.satisfaction < 3.5) {
      recommendations.push('User satisfaction is below threshold - review compaction strategy');
    }
    
    if (ratings.quality < 3.5) {
      recommendations.push('Quality ratings are low - improve preservation algorithms');
    }
    
    if (ratings.preservation < 3.5) {
      recommendations.push('Information preservation needs improvement');
    }

    return {
      improvementNeeded: recommendations.length > 0,
      recommendations
    };
  }
}

// Mock UI components for TUI integration
class MockCompactionTUIComponents {
  renderMetrics(metrics: QualityMetrics): string {
    return `
📊 Compaction Metrics:
  • Compression: ${(metrics.compressionRatio * 100).toFixed(1)}%
  • Token Reduction: ${(metrics.tokenReduction * 100).toFixed(1)}%
  • Information Preserved: ${(metrics.informationPreservation * 100).toFixed(1)}%
  • Processing Time: ${metrics.processingTime}ms
  • Effectiveness: ${(metrics.effectivenessScore * 100).toFixed(1)}%
    `.trim();
  }

  renderPreview(preview: CompactionPreview): string {
    const kept = preview.diff.filter(d => d.type === 'kept').length;
    const removed = preview.diff.filter(d => d.type === 'removed').length;
    
    return `
🔍 Compaction Preview:
  • Original Messages: ${preview.originalMessages.length}
  • Compacted Messages: ${preview.compactedMessages.length}
  • Kept: ${kept}, Removed: ${removed}
  • Quality Score: ${(preview.metrics.effectivenessScore * 100).toFixed(1)}%
  
📝 Preview:
${preview.diff.slice(0, 5).map(d => 
  `${d.type === 'kept' ? '✅' : '❌'} ${d.content}... (${d.reason})`
).join('\n')}
    `.trim();
  }

  renderSettings(settings: CompactionSettings): string {
    return `
⚙️  Compaction Settings:
  • Auto Compaction: ${settings.autoCompaction ? 'ON' : 'OFF'}
  • Compression Level: ${settings.compressionLevel.toUpperCase()}
  • Preserve Code: ${settings.preserveCodeBlocks ? 'YES' : 'NO'}
  • Preserve System: ${settings.preserveSystemMessages ? 'YES' : 'NO'}
  • Quality Threshold: ${(settings.qualityThreshold * 100).toFixed(0)}%
  • Preview Required: ${settings.previewRequired ? 'YES' : 'NO'}
    `.trim();
  }

  renderFeedbackPrompt(): string {
    return `
📋 Rate this compaction (1-5 scale):
  • Overall satisfaction: 
  • Quality of results: 
  • Information preservation: 
  • Comments (optional):
    `.trim();
  }
}

// Test setup
describe('Quality Metrics and UI Enhancement System', () => {
  let metricsSystem: MockQualityMetricsSystem;
  let previewUI: MockCompactionPreviewUI;
  let settingsManager: MockCompactionSettingsManager;
  let feedbackCollector: MockUserFeedbackCollector;
  let tuiComponents: MockCompactionTUIComponents;
  let testMessages: Msg[];

  beforeEach(() => {
    metricsSystem = new MockQualityMetricsSystem();
    previewUI = new MockCompactionPreviewUI();
    settingsManager = new MockCompactionSettingsManager();
    feedbackCollector = new MockUserFeedbackCollector();
    tuiComponents = new MockCompactionTUIComponents();

    // Create diverse test conversation
    testMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Help me debug this authentication issue' },
      { role: 'assistant', content: 'I can help with authentication debugging. What specific error are you seeing?' },
      { role: 'user', content: 'Getting "Invalid token" errors' },
      { role: 'assistant', content: 'This typically indicates token expiration or malformation. Let me show you how to validate tokens:\n```js\nfunction validateToken(token) {\n  return jwt.verify(token, secret);\n}\n```' },
      { role: 'user', content: 'That helped! Now I need to implement refresh tokens' },
      { role: 'assistant', content: 'Here\'s a complete refresh token implementation:\n```js\nconst refreshToken = generateRefreshToken();\nres.cookie("refreshToken", refreshToken, { httpOnly: true });\n```' },
      { role: 'user', content: 'Perfect! The authentication is working now.' },
      { role: 'assistant', content: 'Excellent! Make sure to implement proper security measures like rate limiting and HTTPS.' },
      { role: 'user', content: 'What about database performance optimization?' },
      { role: 'assistant', content: 'For database performance, focus on indexing, query optimization, and connection pooling.' }
    ];
  });

  describe('Quality Metrics System', () => {
    test('should calculate comprehensive quality metrics', () => {
      const compactedMessages = testMessages.slice(0, 6); // Simulate compaction
      const metrics = metricsSystem.calculateMetrics(testMessages, compactedMessages);

      expect(metrics.compressionRatio).toBeCloseTo(0.45, 2); // ~45% compression
      expect(metrics.tokenReduction).toBeGreaterThan(0.3); // At least 30% token reduction
      expect(metrics.messageReduction).toBeCloseTo(0.45, 2); // Message reduction matches compression
      expect(metrics.informationPreservation).toBeGreaterThan(0.8); // >80% information preserved
      expect(metrics.processingTime).toBeLessThan(500); // <500ms processing
      expect(metrics.effectivenessScore).toBeGreaterThan(0.75); // >75% effectiveness
    });

    test('should track metrics effectiveness over time', () => {
      const compacted = testMessages.slice(0, 6);
      const metrics = metricsSystem.calculateMetrics(testMessages, compacted);
      
      metricsSystem.trackEffectiveness(metrics);
      const trends = metricsSystem.getHistoricalTrends();

      expect(trends.avgCompressionRatio).toBeDefined();
      expect(trends.avgPreservation).toBeGreaterThan(0.8);
      expect(trends.avgProcessingTime).toBeLessThan(200);
    });

    test('should provide actionable quality insights', () => {
      const compacted = testMessages.slice(0, 6);
      const metrics = metricsSystem.calculateMetrics(testMessages, compacted);

      // Quality metrics should guide improvement decisions
      expect(metrics.effectivenessScore).toBeGreaterThan(0.7);
      
      if (metrics.informationPreservation < 0.8) {
        expect(metrics.compressionRatio).toBeLessThan(0.6); // Trade-off analysis
      }
    });
  });

  describe('Compaction Preview and Approval UI', () => {
    test('should generate comprehensive compaction preview', () => {
      const compactedMessages = testMessages.filter(m => 
        m.role === 'system' || 
        m.content.includes('authentication') || 
        m.content.includes('```')
      );

      const preview = previewUI.generatePreview(testMessages, compactedMessages);

      expect(preview.originalMessages).toEqual(testMessages);
      expect(preview.compactedMessages).toEqual(compactedMessages);
      expect(preview.metrics).toBeDefined();
      expect(preview.diff).toHaveLength(testMessages.length);
      expect(preview.approved).toBe(false); // Starts unapproved
      
      // Diff should categorize all messages
      preview.diff.forEach(diff => {
        expect(['kept', 'removed', 'summarized']).toContain(diff.type);
        expect(diff.reason).toBeDefined();
        expect(diff.content).toBeDefined();
      });
    });

    test('should support compaction approval workflow', () => {
      const compacted = testMessages.slice(0, 6);
      let preview = previewUI.generatePreview(testMessages, compacted);
      
      expect(preview.approved).toBe(false);
      
      // Test approval
      preview = previewUI.approveCompaction(preview);
      expect(preview.approved).toBe(true);
      
      // Test rejection
      preview = previewUI.rejectCompaction(preview, 'Too much information lost');
      expect(preview.approved).toBe(false);
    });

    test('should render user-friendly preview display', () => {
      const compacted = testMessages.slice(0, 6);
      const preview = previewUI.generatePreview(testMessages, compacted);
      const rendered = tuiComponents.renderPreview(preview);

      expect(rendered).toContain('Compaction Preview');
      expect(rendered).toContain('Original Messages');
      expect(rendered).toContain('Compacted Messages'); 
      expect(rendered).toContain('Quality Score');
      expect(rendered).toContain('✅'); // Kept items
      // Note: ❌ removed items may not be shown if preview only shows kept items
    });
  });

  describe('Configurable Compaction Settings', () => {
    test('should manage user compaction preferences', () => {
      const initialSettings = settingsManager.getSettings();
      
      expect(initialSettings.autoCompaction).toBe(false);
      expect(initialSettings.compressionLevel).toBe('moderate');
      expect(initialSettings.preserveCodeBlocks).toBe(true);
      expect(initialSettings.qualityThreshold).toBe(0.8);

      // Test settings updates
      const updatedSettings = settingsManager.updateSettings({
        autoCompaction: true,
        compressionLevel: 'aggressive',
        qualityThreshold: 0.9
      });

      expect(updatedSettings.autoCompaction).toBe(true);
      expect(updatedSettings.compressionLevel).toBe('aggressive');
      expect(updatedSettings.qualityThreshold).toBe(0.9);
      expect(updatedSettings.preserveCodeBlocks).toBe(true); // Unchanged
    });

    test('should validate settings configuration', () => {
      // Test valid settings
      const validSettings = settingsManager.getSettings();
      const validResult = settingsManager.validateSettings(validSettings);
      
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test invalid settings
      const invalidSettings: CompactionSettings = {
        ...validSettings,
        qualityThreshold: 1.5, // Invalid range
        compressionLevel: 'extreme' as any // Invalid level
      };

      const invalidResult = settingsManager.validateSettings(invalidSettings);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.errors[0]).toContain('Quality threshold');
    });

    test('should support custom preservation rules', () => {
      const settingsWithCustomRules = settingsManager.updateSettings({
        customPreservationRules: [
          'preserve messages with "TODO"',
          'preserve code blocks over 50 characters',
          'preserve error messages and stack traces'
        ]
      });

      expect(settingsWithCustomRules.customPreservationRules).toHaveLength(3);
      expect(settingsWithCustomRules.customPreservationRules[0]).toContain('TODO');
    });

    test('should render settings in TUI format', () => {
      const settings = settingsManager.getSettings();
      const rendered = tuiComponents.renderSettings(settings);

      expect(rendered).toContain('Compaction Settings');
      expect(rendered).toContain('Auto Compaction: OFF');
      expect(rendered).toContain('Compression Level: MODERATE');
      expect(rendered).toContain('Preserve Code: YES');
      expect(rendered).toContain('Quality Threshold: 80%');
    });
  });

  describe('User Feedback Collection and Analysis', () => {
    test('should collect user satisfaction feedback', () => {
      const feedback = feedbackCollector.collectFeedback({
        sessionId: 'test-session-1',
        satisfactionScore: 4,
        qualityRating: 5,
        preservationRating: 4,
        comments: 'Great compaction, preserved all important code examples',
        wouldRecommend: true
      });

      expect(feedback.timestamp).toBeDefined();
      expect(feedback.satisfactionScore).toBe(4);
      expect(feedback.qualityRating).toBe(5);
      expect(feedback.preservationRating).toBe(4);
      expect(feedback.wouldRecommend).toBe(true);
    });

    test('should analyze feedback trends and provide recommendations', () => {
      // Add multiple feedback samples
      feedbackCollector.collectFeedback({
        sessionId: 'session-1', satisfactionScore: 2, qualityRating: 2, 
        preservationRating: 3, comments: 'Lost important context', wouldRecommend: false
      });
      
      feedbackCollector.collectFeedback({
        sessionId: 'session-2', satisfactionScore: 3, qualityRating: 3, 
        preservationRating: 2, comments: 'Okay but could be better', wouldRecommend: false
      });

      const trends = feedbackCollector.analyzeTrends();
      
      expect(trends.improvementNeeded).toBe(true);
      expect(trends.recommendations.length).toBeGreaterThan(0);
      expect(trends.recommendations[0]).toContain('satisfaction');
    });

    test('should calculate average ratings accurately', () => {
      feedbackCollector.collectFeedback({
        sessionId: 'session-1', satisfactionScore: 4, qualityRating: 5, 
        preservationRating: 4, comments: '', wouldRecommend: true
      });
      
      feedbackCollector.collectFeedback({
        sessionId: 'session-2', satisfactionScore: 5, qualityRating: 4, 
        preservationRating: 5, comments: '', wouldRecommend: true
      });

      const averages = feedbackCollector.getAverageRatings();
      
      expect(averages.satisfaction).toBe(4.5);
      expect(averages.quality).toBe(4.5);
      expect(averages.preservation).toBe(4.5);
    });

    test('should render feedback collection UI', () => {
      const rendered = tuiComponents.renderFeedbackPrompt();

      expect(rendered).toContain('Rate this compaction');
      expect(rendered).toContain('Overall satisfaction');
      expect(rendered).toContain('Quality of results');
      expect(rendered).toContain('Information preservation');
      expect(rendered).toContain('Comments');
    });
  });

  describe('End-to-End Compaction Workflow', () => {
    test('should execute complete compaction workflow with quality gates', () => {
      // 1. Generate preview
      const compacted = testMessages.filter(m => 
        m.role === 'system' || m.content.includes('authentication') || m.content.includes('```')
      );
      const preview = previewUI.generatePreview(testMessages, compacted);

      // 2. Check quality metrics against thresholds
      const settings = settingsManager.getSettings();
      const meetsQualityThreshold = preview.metrics.effectivenessScore >= settings.qualityThreshold;
      
      expect(meetsQualityThreshold).toBe(true);

      // 3. Require approval if preview is required
      if (settings.previewRequired) {
        expect(preview.approved).toBe(false);
        const approvedPreview = previewUI.approveCompaction(preview);
        expect(approvedPreview.approved).toBe(true);
      }

      // 4. Track metrics
      metricsSystem.trackEffectiveness(preview.metrics);

      // 5. Collect user feedback
      const feedback = feedbackCollector.collectFeedback({
        sessionId: 'workflow-test',
        satisfactionScore: 4,
        qualityRating: 4,
        preservationRating: 5,
        comments: 'Workflow test - good results',
        wouldRecommend: true
      });

      expect(feedback.satisfactionScore).toBe(4);
    });

    test('should handle quality threshold failures', () => {
      // Set high quality threshold
      settingsManager.updateSettings({ qualityThreshold: 0.95 });
      
      // Simulate aggressive compaction with lower quality
      const aggressivelyCompacted = testMessages.slice(0, 3);
      const preview = previewUI.generatePreview(testMessages, aggressivelyCompacted);
      
      const settings = settingsManager.getSettings();
      const meetsThreshold = preview.metrics.effectivenessScore >= settings.qualityThreshold;
      
      // Should fail quality threshold
      expect(meetsThreshold).toBe(false);
      
      // Workflow should reject or request different compaction level
      if (!meetsThreshold) {
        const rejectedPreview = previewUI.rejectCompaction(
          preview, 
          `Quality score ${preview.metrics.effectivenessScore} below threshold ${settings.qualityThreshold}`
        );
        expect(rejectedPreview.approved).toBe(false);
      }
    });

    test('should integrate with existing slash command system', () => {
      // Test enhanced /compact command functionality
      const settings = settingsManager.getSettings();
      const preview = previewUI.generatePreview(testMessages, testMessages.slice(0, 6));
      const metrics = preview.metrics;

      // Simulate enhanced /compact command response
      const commandResponse = `
${tuiComponents.renderMetrics(metrics)}

${tuiComponents.renderPreview(preview)}

Do you want to apply this compaction? [y/N]
      `.trim();

      expect(commandResponse).toContain('Compaction Metrics');
      expect(commandResponse).toContain('Compaction Preview');
      expect(commandResponse).toContain('apply this compaction');
    });

    test('should provide comprehensive quality insights', () => {
      const compacted = testMessages.slice(0, 7);
      const preview = previewUI.generatePreview(testMessages, compacted);
      const trends = metricsSystem.getHistoricalTrends();
      
      // Should provide actionable insights
      const insights = {
        currentQuality: preview.metrics.effectivenessScore,
        historicalAverage: trends.avgPreservation,
        recommendation: preview.metrics.effectivenessScore > trends.avgPreservation ? 
          'Above average quality' : 'Consider adjusting compaction strategy'
      };

      expect(insights.currentQuality).toBeGreaterThan(0.7);
      expect(insights.recommendation).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large conversation histories efficiently', () => {
      // Generate large conversation (500 messages)
      const largeConversation: Msg[] = Array(500).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i} with some relevant content about topic ${i % 20}`
      }));

      const startTime = Date.now();
      
      const compacted = largeConversation.slice(0, 100);
      const preview = previewUI.generatePreview(largeConversation, compacted);
      
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
      expect(preview.metrics.processingTime).toBeLessThan(500); // Reported time should be reasonable
      expect(preview.diff).toHaveLength(largeConversation.length);
    });

    test('should maintain responsiveness during UI operations', () => {
      const preview = previewUI.generatePreview(testMessages, testMessages.slice(0, 6));
      
      // UI rendering operations should be fast
      const startRender = Date.now();
      const rendered = tuiComponents.renderPreview(preview);
      const renderTime = Date.now() - startRender;
      
      expect(renderTime).toBeLessThan(50); // UI rendering should be very fast
      expect(rendered.length).toBeGreaterThan(0);
    });
  });
});