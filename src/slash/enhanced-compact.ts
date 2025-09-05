/**
 * Enhanced Compact Command Integration
 * Integrates Quality Metrics and UI Enhancement system with existing TUI
 */

import type { Msg } from '../runtime/orchestrator.js';
import { QualityMetricsSystem, globalQualityMetrics } from '../context/quality-metrics.js';
import { CompactionPreviewSystem, CompactionPreviewTUI, globalPreviewSystem, compactionTUI } from '../ui/compaction-preview.js';
import { CompactionSettingsManager, globalCompactionSettings } from '../config/compaction-settings.js';
import { UserFeedbackCollector, globalFeedbackCollector } from '../feedback/user-feedback.js';
import { IntelligentCompactionStrategy } from '../context/intelligent-compaction.js';

export interface EnhancedCompactResult {
  success: boolean;
  message: string;
  metrics?: any;
  previewId?: string;
  requiresApproval?: boolean;
  error?: string;
}

export interface CompactCommandOptions {
  instructions?: string;
  level?: 'light' | 'moderate' | 'aggressive';
  preview?: boolean;
  force?: boolean;
  settings?: boolean;
  feedback?: boolean;
  metrics?: boolean;
}

/**
 * Enhanced compact command with quality metrics and UI integration
 */
export class EnhancedCompactCommand {
  private compactionStrategy: IntelligentCompactionStrategy;
  private metricsSystem: QualityMetricsSystem;
  private previewSystem: CompactionPreviewSystem;
  private settingsManager: CompactionSettingsManager;
  private feedbackCollector: UserFeedbackCollector;
  private tui: CompactionPreviewTUI;

  constructor() {
    this.compactionStrategy = new IntelligentCompactionStrategy();
    this.metricsSystem = globalQualityMetrics;
    this.previewSystem = globalPreviewSystem;
    this.settingsManager = globalCompactionSettings;
    this.feedbackCollector = globalFeedbackCollector;
    this.tui = compactionTUI;
  }

  /**
   * Execute enhanced compact command with full quality metrics and UI
   */
  async executeCompactCommand(
    messages: Msg[],
    options: CompactCommandOptions = {}
  ): Promise<EnhancedCompactResult> {
    try {
      // Load settings and feedback history
      await this.settingsManager.loadSettings();
      await this.feedbackCollector.loadFeedback();

      // Handle sub-commands
      if (options.settings) {
        return this.handleSettingsCommand();
      }

      if (options.feedback) {
        return this.handleFeedbackCommand();
      }

      if (options.metrics) {
        return this.handleMetricsCommand();
      }

      // Execute actual compaction
      return await this.executeCompaction(messages, options);
    } catch (error) {
      return {
        success: false,
        message: `Error executing compact command: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Execute the main compaction logic with quality metrics
   */
  private async executeCompaction(
    messages: Msg[],
    options: CompactCommandOptions
  ): Promise<EnhancedCompactResult> {
    const settings = this.settingsManager.getSettings();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine compaction parameters
    const level = options.level || settings.compressionLevel;
    const forceApply = options.force || false;
    const showPreview = options.preview !== false && (settings.previewRequired || options.preview);

    if (messages.length < 3) {
      return {
        success: false,
        message: '⚠️  Not enough messages to compact (minimum 3 required)'
      };
    }

    // Start timing for metrics
    const startTime = Date.now();

    try {
      // Execute compaction with intelligent strategy
      const compactionOptions = {
        level,
        enableRollback: true,
        useSemanticAnalysis: true,
        useThreadPreservation: true,
        useContextScoring: true,
        currentContext: options.instructions || 'general conversation',
        contentTypeWeights: {
          code: settings.preserveCodeBlocks ? 0.9 : 0.5,
          discussion: 0.6,
          error: settings.preserveErrorMessages ? 0.9 : 0.7
        }
      };

      const result = this.compactionStrategy.compact(messages, compactionOptions);
      const processingTime = Date.now() - startTime;

      // Calculate comprehensive quality metrics
      const metrics = this.metricsSystem.calculateMetrics(
        messages,
        result.preservedMessages,
        processingTime
      );

      // Track metrics for continuous improvement
      this.metricsSystem.trackEffectiveness({ ...metrics, sessionId });

      // Check if metrics meet quality threshold
      if (metrics.effectivenessScore < settings.qualityThreshold && !forceApply) {
        return {
          success: false,
          message: `❌ Quality score (${(metrics.effectivenessScore * 100).toFixed(1)}%) below threshold (${(settings.qualityThreshold * 100).toFixed(0)}%). Use --force to override.`,
          metrics
        };
      }

      // Generate preview if required
      let previewId: string | undefined;
      if (showPreview) {
        const preview = this.previewSystem.generatePreview(messages, result.preservedMessages, metrics);
        previewId = preview.previewId;

        const previewDisplay = this.tui.renderPreview(preview, {
          showFullContent: false,
          maxPreviewLength: 100,
          groupByType: true,
          showReasons: true
        });

        if (settings.confirmBeforeCompact && !forceApply) {
          return {
            success: true,
            message: `${previewDisplay}\n\n${this.tui.renderApprovalPrompt(preview)}`,
            previewId,
            requiresApproval: true,
            metrics
          };
        }
      }

      // Apply compaction
      const compactionMessage = this.generateCompactionSummary(messages, result.preservedMessages, metrics, level);

      // Collect feedback if enabled
      if (settings.collectFeedback) {
        setTimeout(() => {
          this.promptForFeedback(sessionId, metrics, messages.length, result.preservedMessages.length);
        }, 2000); // Delay to not interrupt workflow
      }

      return {
        success: true,
        message: compactionMessage,
        metrics,
        previewId
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ Compaction failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Handle settings sub-command
   */
  private handleSettingsCommand(): EnhancedCompactResult {
    const settings = this.settingsManager.getSettings();
    const presets = this.settingsManager.getPresets();
    
    let message = this.tui.renderSettings(settings);
    
    message += `\n\n📋 Available Presets:`;
    presets.forEach(preset => {
      message += `\n  • ${preset.name}: ${preset.description}`;
    });

    message += `\n\n⚙️  Change settings:`;
    message += `\n  /compact --set level=moderate`;
    message += `\n  /compact --set auto=true`;
    message += `\n  /compact --set threshold=0.8`;
    message += `\n  /compact --preset conservative`;

    return {
      success: true,
      message
    };
  }

  /**
   * Handle feedback sub-command
   */
  private handleFeedbackCommand(): EnhancedCompactResult {
    const analysis = this.feedbackCollector.generateAnalysis();
    
    let message = `📊 Compaction Feedback Summary:\n`;
    message += `  Total Responses: ${analysis.totalResponses}\n`;
    
    if (analysis.totalResponses > 0) {
      message += `  Average Ratings:\n`;
      message += `    • Satisfaction: ${analysis.averageRatings.satisfaction}/5\n`;
      message += `    • Quality: ${analysis.averageRatings.quality}/5\n`;
      message += `    • Preservation: ${analysis.averageRatings.preservation}/5\n`;
      message += `  Recommendation Rate: ${(analysis.recommendationRate * 100).toFixed(0)}%\n`;

      if (analysis.trends.strengths.length > 0) {
        message += `\n✅ Strengths:\n`;
        analysis.trends.strengths.forEach(s => message += `  • ${s}\n`);
      }

      if (analysis.trends.weaknesses.length > 0) {
        message += `\n⚠️  Areas for Improvement:\n`;
        analysis.trends.weaknesses.forEach(w => message += `  • ${w}\n`);
      }

      if (analysis.trends.recommendations.length > 0) {
        message += `\n💡 Recommendations:\n`;
        analysis.trends.recommendations.forEach(r => message += `  • ${r}\n`);
      }

      if (analysis.insights.commonIssues.length > 0) {
        message += `\n🔍 Common Issues:\n`;
        analysis.insights.commonIssues.forEach(i => message += `  • ${i}\n`);
      }

      message += `\n🎯 Optimal Compression: ${(analysis.insights.optimalCompressionRatio * 100).toFixed(0)}%`;
    } else {
      message += `\nNo feedback data available yet.`;
    }

    return {
      success: true,
      message
    };
  }

  /**
   * Handle metrics sub-command
   */
  private handleMetricsCommand(): EnhancedCompactResult {
    const trends = this.metricsSystem.getHistoricalTrends();
    
    let message = `📈 Compaction Performance Metrics:\n`;
    
    if (trends.totalSessions > 0) {
      message += `  Sessions Tracked: ${trends.totalSessions}\n`;
      message += `  Average Metrics:\n`;
      message += `    • Compression Ratio: ${(trends.avgCompressionRatio * 100).toFixed(1)}%\n`;
      message += `    • Information Preservation: ${(trends.avgPreservation * 100).toFixed(1)}%\n`;
      message += `    • Processing Time: ${trends.avgProcessingTime.toFixed(0)}ms\n`;
      message += `    • Effectiveness Score: ${(trends.avgEffectiveness * 100).toFixed(1)}%\n`;
      message += `  Last Updated: ${new Date(trends.lastUpdated).toLocaleString()}\n`;
    } else {
      message += `No metrics data available yet.`;
    }

    return {
      success: true,
      message
    };
  }

  /**
   * Handle preview approval
   */
  async handlePreviewApproval(previewId: string, approved: boolean, rejectionReason?: string): Promise<EnhancedCompactResult> {
    const preview = this.previewSystem.getPreview(previewId);
    if (!preview) {
      return {
        success: false,
        message: '❌ Preview not found or expired'
      };
    }

    if (approved) {
      this.previewSystem.approveCompaction(previewId);
      
      const compactionMessage = this.generateCompactionSummary(
        preview.originalMessages,
        preview.compactedMessages,
        preview.metrics,
        'approved'
      );

      return {
        success: true,
        message: `✅ Compaction approved and applied!\n\n${compactionMessage}`
      };
    } else {
      this.previewSystem.rejectCompaction(previewId, rejectionReason || 'User rejected');
      
      return {
        success: false,
        message: `❌ Compaction rejected${rejectionReason ? ': ' + rejectionReason : ''}`
      };
    }
  }

  /**
   * Generate comprehensive compaction summary message
   */
  private generateCompactionSummary(
    original: Msg[],
    compacted: Msg[],
    metrics: any,
    level: string
  ): string {
    const compressionPercent = (metrics.compressionRatio * 100).toFixed(1);
    const preservationPercent = (metrics.informationPreservation * 100).toFixed(1);
    const effectivenessPercent = (metrics.effectivenessScore * 100).toFixed(1);
    
    const qualityIndicator = metrics.effectivenessScore >= 0.9 ? '🟢 EXCELLENT' :
                           metrics.effectivenessScore >= 0.8 ? '🟡 GOOD' :
                           metrics.effectivenessScore >= 0.7 ? '🟠 MODERATE' : '🔴 BELOW TARGET';

    return `✅ Smart compaction completed (${level} level)

📊 Results Summary:
  • Messages: ${original.length} → ${compacted.length} (${compressionPercent}% reduction)
  • Information Preserved: ${preservationPercent}%
  • Processing Time: ${metrics.processingTime}ms
  • Quality Score: ${effectivenessPercent}% ${qualityIndicator}

🎯 Compaction focused on: ${level === 'approved' ? 'user-approved content' : 'intelligent preservation'}`;
  }

  /**
   * Prompt user for feedback (non-blocking)
   */
  private async promptForFeedback(sessionId: string, metrics: any, originalCount: number, compactedCount: number): Promise<void> {
    try {
      const prompt = this.feedbackCollector.generateFeedbackPrompt({
        sessionId,
        metrics: {
          compressionRatio: metrics.compressionRatio,
          effectivenessScore: metrics.effectivenessScore,
          originalCount,
          compactedCount
        },
        quickFeedback: true
      });

      console.log(`\n${prompt}\n`);
    } catch (error) {
      // Feedback prompt failed, continue silently
    }
  }

  /**
   * Update settings from command line arguments
   */
  async updateSettingsFromArgs(args: any): Promise<EnhancedCompactResult> {
    try {
      const updates: any = {};

      if (args.level) {
        if (['light', 'moderate', 'aggressive'].includes(args.level)) {
          updates.compressionLevel = args.level;
        } else {
          return {
            success: false,
            message: '❌ Invalid compression level. Use: light, moderate, or aggressive'
          };
        }
      }

      if (args.auto !== undefined) {
        updates.autoCompaction = args.auto === 'true' || args.auto === true;
      }

      if (args.threshold !== undefined) {
        const threshold = parseFloat(args.threshold);
        if (threshold >= 0 && threshold <= 1) {
          updates.qualityThreshold = threshold;
        } else {
          return {
            success: false,
            message: '❌ Quality threshold must be between 0.0 and 1.0'
          };
        }
      }

      const result = await this.settingsManager.updateSettings(updates);
      
      if (result.success) {
        const settings = this.settingsManager.getSettings();
        return {
          success: true,
          message: `✅ Settings updated successfully!\n\n${this.tui.renderSettings(settings)}`
        };
      } else {
        return {
          success: false,
          message: `❌ Failed to update settings: ${result.errors.join(', ')}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error updating settings: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Apply settings preset
   */
  async applySettingsPreset(presetName: string): Promise<EnhancedCompactResult> {
    try {
      const result = await this.settingsManager.applyPreset(presetName);
      
      if (result.success) {
        const settings = this.settingsManager.getSettings();
        return {
          success: true,
          message: `✅ Applied "${presetName}" preset successfully!\n\n${this.tui.renderSettings(settings)}`
        };
      } else {
        return {
          success: false,
          message: `❌ Failed to apply preset: ${result.errors.join(', ')}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error applying preset: ${error.message}`,
        error: error.message
      };
    }
  }
}

/**
 * Global enhanced compact command instance
 */
export const enhancedCompactCommand = new EnhancedCompactCommand();