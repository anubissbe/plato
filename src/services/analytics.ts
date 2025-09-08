/**
 * Analytics Service - Main Entry Point
 * 
 * Combines CostCalculator and AnalyticsManager for comprehensive cost tracking
 * and analytics functionality as specified in the technical requirements
 */

export { CostCalculator } from './cost-calculator.js';
export { AnalyticsManager } from './analytics-manager.js';
export * from './analytics-types.js';

import { CostCalculator } from './cost-calculator.js';
import { AnalyticsManager } from './analytics-manager.js';
import { 
  CostMetric, 
  AnalyticsSummary, 
  AnalyticsManagerOptions,
  AnalyticsQueryOptions,
  ExportFormat,
  DateRange,
  ProviderPricing,
  TokenPricing
} from './analytics-types.js';

/**
 * Main Analytics Service - Unified interface for cost tracking
 * 
 * Provides high-level analytics operations by coordinating between
 * CostCalculator and AnalyticsManager components
 */
export class AnalyticsService {
  private costCalculator: CostCalculator;
  private analyticsManager: AnalyticsManager;
  private initialized: boolean = false;

  constructor(
    costCalculatorOptions?: { pricing?: Partial<ProviderPricing> },
    analyticsManagerOptions?: AnalyticsManagerOptions
  ) {
    this.costCalculator = new CostCalculator(costCalculatorOptions?.pricing);
    this.analyticsManager = new AnalyticsManager(analyticsManagerOptions);
  }

  /**
   * Initialize the analytics service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.analyticsManager.initialize();
    this.initialized = true;
  }

  /**
   * Record a new AI interaction with automatic cost calculation
   * 
   * @param interaction - Details of the AI interaction
   * @returns Promise that resolves when the metric is recorded
   */
  async recordInteraction(interaction: {
    sessionId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    provider: 'copilot' | 'openai' | 'claude';
    command?: string;
    duration: number;
  }): Promise<CostMetric> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Calculate cost for this interaction
    const cost = this.costCalculator.calculateCost(
      interaction.provider,
      interaction.model,
      interaction.inputTokens,
      interaction.outputTokens
    );

    // Create cost metric
    const metric: CostMetric = {
      timestamp: Date.now(),
      sessionId: interaction.sessionId,
      model: interaction.model,
      inputTokens: interaction.inputTokens,
      outputTokens: interaction.outputTokens,
      cost,
      provider: interaction.provider,
      command: interaction.command,
      duration: interaction.duration
    };

    // Record the metric
    await this.analyticsManager.recordMetric(metric);

    return metric;
  }

  /**
   * Get cost metrics for a date range
   */
  async getMetrics(startDate: number, endDate: number, options?: AnalyticsQueryOptions): Promise<CostMetric[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.analyticsManager.getMetrics(startDate, endDate, options);
  }

  /**
   * Generate analytics summary for a period
   */
  async getSummary(period: 'day' | 'week' | 'month', date?: Date): Promise<AnalyticsSummary> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.analyticsManager.getSummary(period, date);
  }

  /**
   * Export analytics data
   */
  async exportData(format: ExportFormat, dateRange?: DateRange): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.analyticsManager.exportData(format, dateRange);
  }

  /**
   * Get current cost calculation for a hypothetical interaction
   */
  calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    return this.costCalculator.calculateCost(provider, model, inputTokens, outputTokens);
  }

  /**
   * Compare costs across providers
   */
  compareProviderCosts(inputTokens: number, outputTokens: number) {
    return this.costCalculator.compareProviderCosts(inputTokens, outputTokens);
  }

  /**
   * Get batch performance statistics
   */
  getBatchStats() {
    return this.analyticsManager.getBatchStats();
  }

  /**
   * Get the underlying analytics manager instance
   */
  getAnalyticsManager() {
    return this.analyticsManager;
  }

  /**
   * Get current session cost (metrics from today for a specific session)
   */
  async getCurrentSessionCost(sessionId: string): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();
    const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;

    const sessionMetrics = await this.analyticsManager.getMetrics(startOfDay, endOfDay, {
      sessionId
    });

    return sessionMetrics.reduce((total, metric) => total + metric.cost, 0);
  }

  /**
   * Get today's total cost across all sessions
   */
  async getTodayTotalCost(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const summary = await this.analyticsManager.getSummary('day');
    return summary.totalCost;
  }

  /**
   * Get cost breakdown for the current session
   */
  async getSessionBreakdown(sessionId: string): Promise<{
    totalCost: number;
    totalTokens: number;
    interactions: number;
    avgCostPerInteraction: number;
    modelBreakdown: Record<string, { cost: number; tokens: number; interactions: number }>;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();
    const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;

    const sessionMetrics = await this.analyticsManager.getMetrics(startOfDay, endOfDay, {
      sessionId
    });

    const totalCost = sessionMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = sessionMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const interactions = sessionMetrics.length;

    // Generate model breakdown
    const modelBreakdown: Record<string, { cost: number; tokens: number; interactions: number }> = {};
    for (const metric of sessionMetrics) {
      if (!modelBreakdown[metric.model]) {
        modelBreakdown[metric.model] = { cost: 0, tokens: 0, interactions: 0 };
      }
      modelBreakdown[metric.model].cost += metric.cost;
      modelBreakdown[metric.model].tokens += metric.inputTokens + metric.outputTokens;
      modelBreakdown[metric.model].interactions += 1;
    }

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalTokens,
      interactions,
      avgCostPerInteraction: interactions > 0 ? Math.round((totalCost / interactions) * 10000) / 10000 : 0,
      modelBreakdown
    };
  }

  /**
   * Update pricing for a provider
   */
  updatePricing(provider: string, pricing: TokenPricing): void {
    this.costCalculator.updatePricing(provider, pricing);
  }

  /**
   * Get current pricing for a provider
   */
  getPricing(provider: string): TokenPricing | undefined {
    return this.costCalculator.getPricing(provider);
  }

  /**
   * Check if provider is supported
   */
  isProviderSupported(provider: string): boolean {
    return this.costCalculator.isProviderSupported(provider);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return this.analyticsManager.getPerformanceStats();
  }

  /**
   * Clean up old data
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.analyticsManager.cleanup();
  }

  /**
   * Flush any pending data
   */
  async flush(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.analyticsManager.flush();
  }

  /**
   * Shutdown the analytics service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.analyticsManager.shutdown();
    this.initialized = false;
  }
}

/**
 * Create a default analytics service instance
 * Used by other parts of the application
 */
export function createDefaultAnalyticsService(options?: {
  dataDir?: string;
  autoSave?: boolean;
  retentionMonths?: number;
}): AnalyticsService {
  return new AnalyticsService(
    undefined, // Use default pricing
    {
      dataDir: options?.dataDir || '.plato/analytics',
      autoSave: options?.autoSave !== false,
      retentionMonths: options?.retentionMonths || 6
    }
  );
}