/**
 * Compaction Preview and Approval UI System
 * Provides user interface components for previewing and approving compaction operations
 */

import type { Msg } from '../runtime/orchestrator.js';
import type { QualityMetrics } from '../context/quality-metrics.js';

export interface CompactionDiff {
  type: 'kept' | 'removed' | 'summarized';
  originalIndex: number;
  content: string;
  reason: string;
  importance: number;
  messageRole: string;
}

export interface CompactionPreview {
  originalMessages: Msg[];
  compactedMessages: Msg[];
  metrics: QualityMetrics;
  diff: CompactionDiff[];
  approved: boolean;
  rejectionReason?: string;
  previewId: string;
  timestamp: number;
}

export interface PreviewOptions {
  showFullContent?: boolean;
  maxPreviewLength?: number;
  groupByType?: boolean;
  showReasons?: boolean;
}

/**
 * Generates and manages compaction previews for user approval
 */
export class CompactionPreviewSystem {
  private previews = new Map<string, CompactionPreview>();
  private previewCounter = 0;

  /**
   * Generate a comprehensive preview of the compaction operation
   */
  generatePreview(
    originalMessages: Msg[], 
    compactedMessages: Msg[], 
    metrics: QualityMetrics
  ): CompactionPreview {
    const previewId = `preview_${++this.previewCounter}_${Date.now()}`;
    
    const diff = this.generateDiff(originalMessages, compactedMessages);
    
    const preview: CompactionPreview = {
      originalMessages,
      compactedMessages,
      metrics,
      diff,
      approved: false,
      previewId,
      timestamp: Date.now()
    };

    this.previews.set(previewId, preview);
    return preview;
  }

  /**
   * Approve a compaction preview
   */
  approveCompaction(previewId: string): CompactionPreview | null {
    const preview = this.previews.get(previewId);
    if (!preview) return null;

    const approvedPreview: CompactionPreview = {
      ...preview,
      approved: true,
      rejectionReason: undefined
    };

    this.previews.set(previewId, approvedPreview);
    return approvedPreview;
  }

  /**
   * Reject a compaction preview with reason
   */
  rejectCompaction(previewId: string, reason: string): CompactionPreview | null {
    const preview = this.previews.get(previewId);
    if (!preview) return null;

    const rejectedPreview: CompactionPreview = {
      ...preview,
      approved: false,
      rejectionReason: reason
    };

    this.previews.set(previewId, rejectedPreview);
    return rejectedPreview;
  }

  /**
   * Get a preview by ID
   */
  getPreview(previewId: string): CompactionPreview | null {
    return this.previews.get(previewId) || null;
  }

  /**
   * Clear old previews (cleanup)
   */
  clearOldPreviews(maxAgeMs: number = 3600000): void { // Default 1 hour
    const cutoffTime = Date.now() - maxAgeMs;
    
    for (const [id, preview] of this.previews) {
      if (preview.timestamp < cutoffTime) {
        this.previews.delete(id);
      }
    }
  }

  /**
   * Generate a user-friendly diff showing what will be kept/removed
   */
  private generateDiff(originalMessages: Msg[], compactedMessages: Msg[]): CompactionDiff[] {
    const diff: CompactionDiff[] = [];
    const compactedContentSet = new Set(compactedMessages.map(m => m.content));
    
    originalMessages.forEach((message, index) => {
      const isKept = compactedContentSet.has(message.content);
      const importance = this.calculateMessageImportance(message, index, originalMessages);
      
      diff.push({
        type: isKept ? 'kept' : 'removed',
        originalIndex: index,
        content: this.truncateContent(message.content, 150),
        reason: this.generateDiffReason(message, isKept, importance, index),
        importance,
        messageRole: message.role
      });
    });

    return diff;
  }

  /**
   * Calculate importance score for a message
   */
  private calculateMessageImportance(message: Msg, index: number, allMessages: Msg[]): number {
    let importance = 0.5; // Base importance
    
    const content = message.content.toLowerCase();
    
    // Role-based importance
    if (message.role === 'system') importance += 0.3;
    if (message.role === 'assistant') importance += 0.1;
    
    // Content-based importance
    if (content.includes('```')) importance += 0.2; // Code blocks
    if (content.includes('error') || content.includes('exception')) importance += 0.2;
    if (content.includes('solution') || content.includes('fix')) importance += 0.15;
    if (content.includes('important') || content.includes('critical')) importance += 0.15;
    if (content.includes('?')) importance += 0.1; // Questions
    
    // Length-based importance (longer messages often more detailed)
    if (message.content.length > 200) importance += 0.1;
    if (message.content.length > 500) importance += 0.1;
    
    // Position-based importance
    if (index === 0 || index === allMessages.length - 1) importance += 0.1; // First/last
    
    // Recent messages get slight boost
    const recencyBoost = Math.max(0, (allMessages.length - index) / allMessages.length * 0.1);
    importance += recencyBoost;
    
    return Math.min(1.0, importance);
  }

  /**
   * Generate human-readable reason for keeping/removing a message
   */
  private generateDiffReason(message: Msg, isKept: boolean, importance: number, index: number): string {
    const content = message.content.toLowerCase();
    
    if (isKept) {
      if (message.role === 'system') return 'System message - always preserved';
      if (content.includes('```')) return 'Contains code block';
      if (content.includes('error')) return 'Error information';
      if (content.includes('solution') || content.includes('fix')) return 'Solution/fix content';
      if (importance > 0.8) return 'High importance content';
      if (importance > 0.6) return 'Important context';
      return 'Relevant content';
    } else {
      if (importance < 0.3) return 'Low relevance';
      if (message.content.length < 50) return 'Brief message';
      if (content.includes('hello') || content.includes('thanks')) return 'Social conversation';
      if (index > 0 && content === message.content) return 'Duplicate content';
      return 'Less critical for context';
    }
  }

  /**
   * Truncate content for preview display
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    // Try to truncate at word boundary
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
}

/**
 * Terminal UI Components for Compaction Preview Display
 */
export class CompactionPreviewTUI {
  /**
   * Render metrics in a user-friendly format
   */
  renderMetrics(metrics: QualityMetrics): string {
    const compressionPercent = (metrics.compressionRatio * 100).toFixed(1);
    const tokenReductionPercent = (metrics.tokenReduction * 100).toFixed(1);
    const preservationPercent = (metrics.informationPreservation * 100).toFixed(1);
    const effectivenessPercent = (metrics.effectivenessScore * 100).toFixed(1);

    return `
📊 Compaction Quality Metrics:
  • Compression Achieved: ${compressionPercent}% (${metrics.messageReduction > 0 ? Math.round(metrics.messageReduction * 100) + '% fewer messages' : 'no message reduction'})
  • Token Reduction: ${tokenReductionPercent}%
  • Information Preserved: ${preservationPercent}%
  • Processing Time: ${metrics.processingTime}ms
  • Overall Effectiveness: ${effectivenessPercent}%
    `.trim();
  }

  /**
   * Render detailed preview with diff visualization
   */
  renderPreview(preview: CompactionPreview, options: PreviewOptions = {}): string {
    const {
      showFullContent = false,
      maxPreviewLength = 100,
      groupByType = true,
      showReasons = true
    } = options;

    const kept = preview.diff.filter(d => d.type === 'kept');
    const removed = preview.diff.filter(d => d.type === 'removed');
    const summarized = preview.diff.filter(d => d.type === 'summarized');

    let output = `
🔍 Compaction Preview (${preview.previewId}):
  Original: ${preview.originalMessages.length} messages
  Compacted: ${preview.compactedMessages.length} messages
  Reduction: ${Math.round((1 - preview.compactedMessages.length / preview.originalMessages.length) * 100)}%
  
Quality Score: ${(preview.metrics.effectivenessScore * 100).toFixed(1)}%
`;

    if (groupByType) {
      output += `\n✅ PRESERVED (${kept.length} messages):\n`;
      kept.slice(0, 10).forEach(item => {
        output += this.renderDiffItem(item, showReasons, maxPreviewLength);
      });
      
      if (kept.length > 10) {
        output += `   ... and ${kept.length - 10} more preserved messages\n`;
      }

      output += `\n❌ REMOVED (${removed.length} messages):\n`;
      removed.slice(0, 5).forEach(item => {
        output += this.renderDiffItem(item, showReasons, maxPreviewLength);
      });
      
      if (removed.length > 5) {
        output += `   ... and ${removed.length - 5} more removed messages\n`;
      }

      if (summarized.length > 0) {
        output += `\n📝 SUMMARIZED (${summarized.length} messages):\n`;
        summarized.forEach(item => {
          output += this.renderDiffItem(item, showReasons, maxPreviewLength);
        });
      }
    } else {
      output += `\nMessage-by-Message Preview:\n`;
      preview.diff.slice(0, 15).forEach(item => {
        output += this.renderDiffItem(item, showReasons, maxPreviewLength);
      });
      
      if (preview.diff.length > 15) {
        output += `   ... and ${preview.diff.length - 15} more messages\n`;
      }
    }

    return output.trim();
  }

  /**
   * Render individual diff item
   */
  private renderDiffItem(item: CompactionDiff, showReasons: boolean, maxLength: number): string {
    const icon = item.type === 'kept' ? '✅' : item.type === 'removed' ? '❌' : '📝';
    const roleTag = item.messageRole === 'system' ? '[SYS]' : 
                   item.messageRole === 'user' ? '[USER]' : '[ASST]';
    
    let content = item.content;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }
    
    let line = `   ${icon} ${roleTag} ${content}`;
    
    if (showReasons && item.reason) {
      line += ` (${item.reason})`;
    }
    
    return line + '\n';
  }

  /**
   * Render approval prompt
   */
  renderApprovalPrompt(preview: CompactionPreview): string {
    const qualityStatus = preview.metrics.effectivenessScore >= 0.8 ? '🟢 EXCELLENT' :
                         preview.metrics.effectivenessScore >= 0.7 ? '🟡 GOOD' :
                         preview.metrics.effectivenessScore >= 0.6 ? '🟠 MODERATE' : '🔴 BELOW TARGET';

    return `
${this.renderMetrics(preview.metrics)}

Quality Assessment: ${qualityStatus}

❓ Apply this compaction?
   [y] Yes, apply compaction
   [n] No, cancel
   [s] Show detailed preview
   [r] Reject with reason
   
Your choice:`;
  }

  /**
   * Render compaction settings in user-friendly format
   */
  renderSettings(settings: any): string {
    return `
⚙️  Current Compaction Settings:
  • Auto Compaction: ${settings.autoCompaction ? 'ENABLED' : 'DISABLED'}
  • Compression Level: ${settings.compressionLevel?.toUpperCase() || 'MODERATE'}
  • Preserve Code Blocks: ${settings.preserveCodeBlocks ? 'YES' : 'NO'}
  • Preserve System Messages: ${settings.preserveSystemMessages ? 'YES' : 'NO'}
  • Quality Threshold: ${settings.qualityThreshold ? (settings.qualityThreshold * 100).toFixed(0) : '80'}%
  • Preview Required: ${settings.previewRequired ? 'YES' : 'NO'}
  • Custom Rules: ${settings.customPreservationRules?.length || 0} defined
    `.trim();
  }

  /**
   * Render feedback collection prompt
   */
  renderFeedbackPrompt(sessionId: string): string {
    return `
📋 Help us improve compaction quality!
   
Rate this compaction result (1-5 scale):
  • Overall satisfaction: ___
  • Quality of preserved content: ___
  • Information preservation: ___
  • Would you recommend this feature? (y/n): ___
  
Optional comments:
_________________________________________________
_________________________________________________
    `.trim();
  }
}

/**
 * Singleton instances for global use
 */
export const globalPreviewSystem = new CompactionPreviewSystem();
export const compactionTUI = new CompactionPreviewTUI();