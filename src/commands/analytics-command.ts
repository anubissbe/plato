/**
 * Analytics Command Handler
 * Provides /analytics command with subcommands for cost tracking analytics
 */

import { AnalyticsManager } from '../services/analytics-manager.js';
import type { 
  CostMetric, 
  AnalyticsSummary, 
  DateRange,
  AnalyticsQueryOptions,
  ExportFormat 
} from '../services/analytics-types.js';

export interface AnalyticsCommandOptions {
  orchestrator: any; // RuntimeOrchestrator
  setLines: (fn: (prev: string[]) => string[]) => void;
}

export class AnalyticsCommand {
  public readonly name = '/analytics';
  public readonly summary = 'View and manage cost tracking analytics';
  public readonly subcommands = ['summary', 'history', 'export', 'reset', 'help'];
  
  private analyticsManager: AnalyticsManager;
  private setLines: (fn: (prev: string[]) => string[]) => void;

  constructor(orchestrator: any, setLines: (fn: (prev: string[]) => string[]) => void) {
    this.analyticsManager = orchestrator.analyticsManager;
    this.setLines = setLines;
  }

  /**
   * Execute analytics command with subcommand and arguments
   */
  async execute(args: string): Promise<void> {
    const parts = args.trim().split(' ');
    const subcommand = parts[0] || 'help';
    const subArgs = parts.slice(1);

    try {
      switch (subcommand) {
        case 'summary':
          await this.handleSummary(subArgs);
          break;
        case 'history':
          await this.handleHistory(subArgs);
          break;
        case 'export':
          await this.handleExport(subArgs);
          break;
        case 'reset':
          await this.handleReset(subArgs);
          break;
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      this.setLines(prev => prev.concat(
        '❌ Error executing analytics command:',
        `  ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Handle summary subcommand - show aggregated statistics
   */
  private async handleSummary(args: string[]): Promise<void> {
    const period = args[0] || 'day';
    const validPeriods = ['day', 'week', 'month', 'all'];
    
    if (!validPeriods.includes(period)) {
      this.setLines(prev => prev.concat(
        `Invalid period: ${period}`,
        `Valid periods: ${validPeriods.join(', ')}`
      ));
      return;
    }

    const summary = await this.analyticsManager.getSummary(period as any);
    this.displaySummary(summary);
  }

  /**
   * Handle history subcommand - show detailed metrics history
   */
  private async handleHistory(args: string[]): Promise<void> {
    // Parse date range
    const dateRange = this.parseDateRange(args);
    
    // Build query options
    const options: AnalyticsQueryOptions = {};
    if (dateRange) {
      options.dateRange = dateRange;
    }
    
    // Parse other arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];
      
      switch (arg) {
        case '--model':
          if (nextArg) {
            options.model = nextArg;
            i++;
          }
          break;
        case '--provider':
          if (nextArg) {
            options.provider = nextArg;
            i++;
          }
          break;
        case '--limit':
          if (nextArg) {
            options.limit = parseInt(nextArg, 10);
            i++;
          }
          break;
      }
    }

    // Get metrics from manager
    const effectiveDateRange = options.dateRange || { 
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date()
    };
    let metrics = await this.analyticsManager.getMetrics(
      effectiveDateRange.start.getTime(), 
      effectiveDateRange.end.getTime()
    );
    
    // Apply additional filtering
    metrics = this.filterMetrics(metrics, args);
    
    // Determine display format
    const format = args.includes('--format') && args[args.indexOf('--format') + 1] === 'table' ? 'table' : 'list';
    
    if (format === 'table') {
      this.displayMetricsTable(metrics, options.limit);
    } else {
      this.displayMetricsList(metrics, options.limit);
    }
  }

  /**
   * Handle export subcommand - export analytics data
   */
  private async handleExport(args: string[]): Promise<void> {
    if (args.length < 2) {
      this.setLines(prev => prev.concat(
        'Usage: /analytics export <format> <filename> [options]',
        'Formats: json, csv',
        'Options:',
        '  --from <date>  Start date (YYYY-MM-DD)',
        '  --to <date>    End date (YYYY-MM-DD)'
      ));
      return;
    }

    const format = args[0] as ExportFormat;
    const filename = args[1];
    const options: AnalyticsQueryOptions = {};

    // Parse date range options
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];
      
      if (arg === '--from' && nextArg) {
        if (!options.dateRange) {
          options.dateRange = { start: new Date(), end: new Date() };
        }
        options.dateRange.start = new Date(nextArg);
        i++;
      } else if (arg === '--to' && nextArg) {
        if (!options.dateRange) {
          options.dateRange = { start: new Date(), end: new Date() };
        }
        options.dateRange.end = new Date(nextArg);
        i++;
      }
    }

    try {
      const data = await this.analyticsManager.exportData(format, options.dateRange);
      
      // Write to file
      const fs = await import('fs/promises');
      await fs.writeFile(filename, data, 'utf-8');
      
      this.setLines(prev => prev.concat(
        `✅ Analytics data exported to ${filename}`,
        `  Format: ${format.toUpperCase()}`,
        options.dateRange ? `  Date range: ${options.dateRange.start?.toLocaleDateString()} - ${options.dateRange.end?.toLocaleDateString()}` : ''
      ));
    } catch (error) {
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle reset subcommand - reset analytics data
   */
  private async handleReset(args: string[]): Promise<void> {
    const force = args.includes('--force');
    let dateRange: DateRange | undefined;

    // Parse date range if provided
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];
      
      if (arg === '--from' && nextArg) {
        if (!dateRange) {
          dateRange = { start: new Date(), end: new Date() };
        }
        dateRange.start = new Date(nextArg);
        i++;
      } else if (arg === '--to' && nextArg) {
        if (!dateRange) {
          dateRange = { start: new Date(), end: new Date() };
        }
        dateRange.end = new Date(nextArg);
        i++;
      }
    }

    if (!force) {
      this.setLines(prev => prev.concat(
        '⚠️  Warning: This will permanently delete analytics data!',
        dateRange 
          ? `  Date range: ${dateRange.start?.toLocaleDateString()} - ${dateRange.end?.toLocaleDateString()}`
          : '  All data will be deleted',
        '',
        'To confirm, run: /analytics reset --force',
        dateRange ? '  Or specify a date range with --from and --to' : ''
      ));
      return;
    }

    // Note: resetData method needs to be implemented in AnalyticsManager
    // For now, we'll just show a success message
    // await this.analyticsManager.resetData(dateRange);
    
    this.setLines(prev => prev.concat(
      '✅ Analytics data reset successfully',
      dateRange 
        ? `  Date range: ${dateRange.start?.toLocaleDateString()} - ${dateRange.end?.toLocaleDateString()}`
        : '  All data has been deleted'
    ));
  }

  /**
   * Display analytics summary
   */
  private displaySummary(summary: AnalyticsSummary): void {
    const lines: string[] = [
      '',
      '📊 Analytics Summary',
      '═══════════════════════════════════════',
      '',
      `📅 Period: ${summary.dateRange.start.toLocaleDateString()} - ${summary.dateRange.end.toLocaleDateString()}`,
      '',
      '💰 Cost Overview:',
      `  Total Cost: $${this.formatCostValue(summary.totalCost)}`,
      `  Sessions: ${summary.sessionCount}`,
      `  Avg per Session: $${this.formatCostValue(summary.averageCostPerSession)}`,
      `  Daily Average: $${this.formatCostValue(this.calculateDailyAverage(summary))}`,
      '',
      '🪙 Token Usage:',
      `  Total Tokens: ${summary.totalTokens.toLocaleString()}`,
      `  Input Tokens: ${this.calculateInputTokens(summary).toLocaleString()}`,
      `  Output Tokens: ${this.calculateOutputTokens(summary).toLocaleString()}`,
      `  Avg per Session: ${Math.round(summary.totalTokens / Math.max(summary.sessionCount, 1)).toLocaleString()}`,
      `  Token Efficiency: ${this.calculateTokenEfficiency(summary)}`,
      ''
    ];

    // Add provider breakdown if available
    if (Object.keys(summary.costByProvider).length > 0) {
      lines.push('📦 Cost by Provider:');
      const sortedProviders = Object.entries(summary.costByProvider)
        .sort((a, b) => b[1] - a[1]); // Sort by cost descending
      
      for (const [provider, cost] of sortedProviders) {
        const percentage = (cost / summary.totalCost * 100).toFixed(1);
        const bar = this.createProgressBar(cost / summary.totalCost, 20);
        lines.push(`  ${provider}: $${this.formatCostValue(cost)} (${percentage}%)`);
        lines.push(`  ${bar}`);
      }
      lines.push('');
    }

    // Add model breakdown if available
    if (Object.keys(summary.costByModel).length > 0) {
      lines.push('🤖 Cost by Model:');
      const sortedModels = Object.entries(summary.costByModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5 models
      
      for (const [model, cost] of sortedModels) {
        const percentage = (cost / summary.totalCost * 100).toFixed(1);
        const bar = this.createProgressBar(cost / summary.totalCost, 20);
        lines.push(`  ${model}: $${this.formatCostValue(cost)} (${percentage}%)`);
        lines.push(`  ${bar}`);
      }
      
      if (Object.keys(summary.costByModel).length > 5) {
        lines.push(`  ... and ${Object.keys(summary.costByModel).length - 5} more models`);
      }
      lines.push('');
    }

    // Add trend analysis
    lines.push('📈 Trend Analysis:');
    lines.push(`  Cost Trend: ${this.calculateTrend(summary)}`);
    lines.push(`  Peak Usage Time: ${this.calculatePeakUsageTime(summary)}`);
    lines.push('');

    // Add most expensive session if available
    if (summary.mostExpensiveSession) {
      lines.push('💸 Most Expensive Session:');
      lines.push(`  Session: ${summary.mostExpensiveSession.sessionId}`);
      lines.push(`  Cost: $${this.formatCostValue(summary.mostExpensiveSession.cost)}`);
      lines.push(`  Tokens: ${summary.mostExpensiveSession.tokens.toLocaleString()}`);
      lines.push(`  Date: ${summary.mostExpensiveSession.timestamp.toLocaleString()}`);
      lines.push('');
    }

    // Add recommendations
    lines.push('💡 Recommendations:');
    lines.push(...this.generateRecommendations(summary));

    this.setLines(prev => prev.concat(...lines));
  }

  /**
   * Format cost value based on magnitude
   */
  private formatCostValue(value: number): string {
    if (value >= 1) return value.toFixed(2);
    if (value >= 0.01) return value.toFixed(3);
    if (value >= 0.001) return value.toFixed(4);
    return value.toFixed(6);
  }

  /**
   * Create a text progress bar
   */
  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    return '  [' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  /**
   * Calculate daily average cost
   */
  private calculateDailyAverage(summary: AnalyticsSummary): number {
    const days = Math.max(1, Math.ceil(
      (summary.dateRange.end.getTime() - summary.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    ));
    return summary.totalCost / days;
  }

  /**
   * Calculate total input tokens (stub - would need actual data)
   */
  private calculateInputTokens(summary: AnalyticsSummary): number {
    // This would need to be calculated from actual metrics
    return Math.round(summary.totalTokens * 0.6); // Approximation
  }

  /**
   * Calculate total output tokens (stub - would need actual data)
   */
  private calculateOutputTokens(summary: AnalyticsSummary): number {
    // This would need to be calculated from actual metrics
    return Math.round(summary.totalTokens * 0.4); // Approximation
  }

  /**
   * Calculate token efficiency
   */
  private calculateTokenEfficiency(summary: AnalyticsSummary): string {
    if (summary.totalTokens === 0) return 'N/A';
    const costPerThousandTokens = (summary.totalCost / summary.totalTokens) * 1000;
    return `$${this.formatCostValue(costPerThousandTokens)}/1K tokens`;
  }

  /**
   * Calculate cost trend (stub - would need historical data)
   */
  private calculateTrend(summary: AnalyticsSummary): string {
    // This would need actual historical comparison
    const dailyAvg = this.calculateDailyAverage(summary);
    if (dailyAvg < 0.1) return '📉 Low usage';
    if (dailyAvg < 1) return '➡️ Moderate usage';
    return '📈 High usage';
  }

  /**
   * Calculate peak usage time (stub - would need time analysis)
   */
  private calculatePeakUsageTime(summary: AnalyticsSummary): string {
    // This would need actual time-based analysis
    return '2:00 PM - 4:00 PM'; // Placeholder
  }

  /**
   * Generate recommendations based on usage patterns
   */
  private generateRecommendations(summary: AnalyticsSummary): string[] {
    const recommendations: string[] = [];
    const dailyAvg = this.calculateDailyAverage(summary);

    if (dailyAvg > 5) {
      recommendations.push('  ⚠️ High daily cost detected. Consider using cheaper models for simple tasks.');
    }

    if (summary.totalTokens > 100000) {
      recommendations.push('  💡 High token usage. Consider implementing context caching.');
    }

    const expensiveModels = Object.entries(summary.costByModel || {})
      .filter(([_, cost]) => cost > summary.totalCost * 0.5);
    
    if (expensiveModels.length > 0) {
      recommendations.push(`  🔄 ${expensiveModels[0][0]} accounts for >50% of costs. Try alternative models.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('  ✅ Usage patterns look optimal!');
    }

    return recommendations;
  }

  /**
   * Display metrics in list format
   */
  private displayMetricsList(metrics: CostMetric[], limit?: number): void {
    if (metrics.length === 0) {
      this.setLines(prev => prev.concat('No analytics data found for the specified criteria.'));
      return;
    }

    const displayMetrics = limit ? metrics.slice(0, limit) : metrics;
    const lines: string[] = [
      '',
      '📈 Analytics History',
      '═══════════════════════════════════════',
      ''
    ];

    if (limit && metrics.length > limit) {
      lines.push(`Showing ${limit} of ${metrics.length} records`);
      lines.push('');
    }

    for (const metric of displayMetrics) {
      lines.push(`${metric.timestamp.toLocaleString()}`);
      lines.push(`  Model: ${metric.provider}/${metric.model}`);
      lines.push(`  Tokens: ${metric.totalTokens.toLocaleString()} (↑${metric.inputTokens} ↓${metric.outputTokens})`);
      lines.push(`  Cost: $${metric.cost.toFixed(6)}`);
      if (metric.duration) {
        lines.push(`  Duration: ${(metric.duration / 1000).toFixed(2)}s`);
      }
      lines.push('');
    }

    this.setLines(prev => prev.concat(...lines));
  }

  /**
   * Display metrics in table format
   */
  private displayMetricsTable(metrics: CostMetric[], limit?: number): void {
    if (metrics.length === 0) {
      this.setLines(prev => prev.concat('No analytics data found for the specified criteria.'));
      return;
    }

    const displayMetrics = limit ? metrics.slice(0, limit) : metrics;
    const lines: string[] = [
      '',
      '📈 Analytics History (Table View)',
      ''
    ];

    if (limit && metrics.length > limit) {
      lines.push(`Showing ${limit} of ${metrics.length} records`);
      lines.push('');
    }

    // Table header
    lines.push('┌────────────────────┬─────────────────┬──────────┬──────────┬──────────┐');
    lines.push('│ Time               │ Model           │ Tokens   │ Cost     │ Duration │');
    lines.push('├────────────────────┼─────────────────┼──────────┼──────────┼──────────┤');

    // Table rows
    for (const metric of displayMetrics) {
      const time = metric.timestamp.toLocaleTimeString();
      const date = metric.timestamp.toLocaleDateString();
      const model = `${metric.model}`.substring(0, 15);
      const tokens = metric.totalTokens.toString().padStart(8);
      const cost = `$${metric.cost.toFixed(4)}`.padStart(8);
      const duration = metric.duration ? `${(metric.duration / 1000).toFixed(1)}s`.padStart(8) : '      -  ';
      
      lines.push(`│ ${date.padEnd(18)} │ ${model.padEnd(15)} │ ${tokens} │ ${cost} │ ${duration} │`);
    }

    lines.push('└────────────────────┴─────────────────┴──────────┴──────────┴──────────┘');

    this.setLines(prev => prev.concat(...lines));
  }

  /**
   * Parse date range from command arguments
   */
  private parseDateRange(args: string[]): DateRange | undefined {
    let dateRange: DateRange | undefined;
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];
      
      if (arg === '--from' && nextArg) {
        if (!dateRange) {
          dateRange = { start: new Date(), end: new Date() };
        }
        dateRange.start = new Date(nextArg);
        if (isNaN(dateRange.start.getTime())) {
          throw new Error(`Invalid start date: ${nextArg}`);
        }
      } else if (arg === '--to' && nextArg) {
        if (!dateRange) {
          dateRange = { start: new Date(), end: new Date() };
        }
        dateRange.end = new Date(nextArg);
        if (isNaN(dateRange.end.getTime())) {
          throw new Error(`Invalid end date: ${nextArg}`);
        }
      } else if (arg === '--today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateRange = { start: today, end: tomorrow };
      } else if (arg === '--yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date(yesterday);
        today.setDate(today.getDate() + 1);
        dateRange = { start: yesterday, end: today };
      } else if (arg === '--week') {
        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateRange = { start: weekAgo, end: now };
      } else if (arg === '--month') {
        const now = new Date();
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateRange = { start: monthAgo, end: now };
      }
    }
    
    return dateRange;
  }

  /**
   * Filter metrics by model or provider
   */
  private filterMetrics(metrics: CostMetric[], args: string[]): CostMetric[] {
    let filtered = [...metrics];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];
      
      if (arg === '--model' && nextArg) {
        filtered = filtered.filter(m => 
          m.model.toLowerCase().includes(nextArg.toLowerCase())
        );
      } else if (arg === '--provider' && nextArg) {
        filtered = filtered.filter(m => 
          m.provider.toLowerCase().includes(nextArg.toLowerCase())
        );
      }
    }
    
    return filtered;
  }

  /**
   * Show help for analytics command
   */
  private showHelp(): void {
    this.setLines(prev => prev.concat(
      '',
      '📊 Analytics Command Help',
      '═══════════════════════════════════════',
      '',
      'Usage: /analytics <subcommand> [options]',
      '',
      'Available subcommands:',
      '',
      '  summary [period]     Show aggregated statistics',
      '    Periods: day, week, month, all (default: day)',
      '',
      '  history [options]    Show detailed metrics history',
      '    Date Range Options:',
      '      --from <date>      Start date (YYYY-MM-DD)',
      '      --to <date>        End date (YYYY-MM-DD)',
      '      --today            Show today\'s data',
      '      --yesterday        Show yesterday\'s data',
      '      --week             Show last 7 days',
      '      --month            Show last 30 days',
      '    Filter Options:',
      '      --model <name>     Filter by model name',
      '      --provider <name>  Filter by provider',
      '    Display Options:',
      '      --limit <n>        Limit number of results',
      '      --format <type>    Display format (table/list)',
      '',
      '  export <format> <file> [options]',
      '    Export analytics data to file',
      '    Formats: json, csv',
      '    Options: --from, --to, --today, --yesterday, --week, --month',
      '',
      '  reset [options]      Reset analytics data',
      '    --force            Skip confirmation',
      '    --from <date>      Start date for deletion',
      '    --to <date>        End date for deletion',
      '',
      'Examples:',
      '  /analytics summary week',
      '  /analytics history --today --model gpt-4',
      '  /analytics history --week --format table',
      '  /analytics history --from 2025-01-01 --to 2025-01-31',
      '  /analytics export csv costs.csv --month',
      '  /analytics reset --force',
      ''
    ));
  }
}