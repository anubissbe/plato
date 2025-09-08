/**
 * Analytics Service Types
 * 
 * Defines the data models and interfaces for the cost tracking and analytics system
 * Based on technical specification requirements
 */

/**
 * Cost metric for a single AI interaction
 * Tracks token usage, cost, and performance data for analytics
 */
export interface CostMetric {
  /** Timestamp when the metric was recorded (Unix timestamp in milliseconds) */
  timestamp: number;
  
  /** Unique identifier for the conversation session */
  sessionId: string;
  
  /** AI model used for the interaction (e.g., 'gpt-3.5-turbo', 'gpt-4') */
  model: string;
  
  /** Number of tokens in the input/prompt */
  inputTokens: number;
  
  /** Number of tokens in the generated output */
  outputTokens: number;
  
  /** Calculated cost in USD for this interaction */
  cost: number;
  
  /** AI provider used ('copilot', 'openai', 'claude') */
  provider: 'copilot' | 'openai' | 'claude';
  
  /** Optional command that triggered this interaction (e.g., '/analyze', '/build') */
  command?: string;
  
  /** Duration of the interaction in milliseconds */
  duration: number;
}

/**
 * Aggregated analytics summary for a specific time period
 * Provides high-level cost and usage insights
 */
export interface AnalyticsSummary {
  /** Time period for this summary */
  period: 'day' | 'week' | 'month';
  
  /** Start of the period (Unix timestamp in milliseconds) */
  startDate: number;
  
  /** End of the period (Unix timestamp in milliseconds) */
  endDate: number;
  
  /** Total cost for all interactions in this period */
  totalCost: number;
  
  /** Total tokens (input + output) used in this period */
  totalTokens: number;
  
  /** Number of unique sessions in this period */
  sessionCount: number;
  
  /** Average cost per session in this period */
  avgCostPerSession: number;
  
  /** Cost and token breakdown by model */
  modelBreakdown: Record<string, {
    /** Total cost for this model */
    cost: number;
    /** Total tokens for this model */
    tokens: number;
  }>;
}

/**
 * Configuration options for the AnalyticsManager
 */
export interface AnalyticsManagerOptions {
  /** Directory path for analytics data storage (default: '.plato/analytics') */
  dataDir?: string;
  
  /** Enable automatic saving of metrics (default: true) */
  autoSave?: boolean;
  
  /** Interval in milliseconds for auto-save operations (default: 30000ms) */
  saveInterval?: number;
  
  /** Number of months to retain data before cleanup (default: 6) */
  retentionMonths?: number;
  
  /** Maximum number of metrics to keep in memory before flushing to disk (default: 100) */
  batchSize?: number;
  
  /** Enable caching of frequently accessed summaries (default: true) */
  enableCache?: boolean;
  
  /** Maximum time to wait before flushing batch (in milliseconds, default: 5000ms) */
  maxBatchWaitTime?: number;
  
  /** Enable intelligent batching based on I/O patterns (default: true) */
  intelligentBatching?: boolean;
  
  /** Target batch write duration in milliseconds for performance optimization (default: 50ms) */
  targetBatchDuration?: number;
}

/**
 * Pricing configuration for different AI providers
 */
export interface TokenPricing {
  /** Cost per input token in USD */
  input: number;
  
  /** Cost per output token in USD */
  output: number;
}

/**
 * Provider pricing configuration
 */
export type ProviderPricing = Record<string, TokenPricing>;

/**
 * Analytics export format options
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Date range for analytics queries and exports
 */
export type DateRange = [number, number];

/**
 * Analytics query options for filtering and grouping data
 */
export interface AnalyticsQueryOptions {
  /** Start date for the query (Unix timestamp) */
  startDate?: number;
  
  /** End date for the query (Unix timestamp) */
  endDate?: number;
  
  /** Filter by specific session ID */
  sessionId?: string;
  
  /** Filter by specific model name */
  model?: string;
  
  /** Filter by specific provider */
  provider?: 'copilot' | 'openai' | 'claude';
  
  /** Filter by specific command */
  command?: string;
  
  /** Maximum number of results to return */
  limit?: number;
  
  /** Number of results to skip (for pagination) */
  offset?: number;
  
  /** Sort order for results */
  sortBy?: 'timestamp' | 'cost' | 'duration';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Analytics table display options for UI components
 */
export interface AnalyticsTableProps {
  /** Array of cost metrics to display */
  metrics: CostMetric[];
  
  /** How to group the displayed data */
  groupBy: 'session' | 'day' | 'model';
  
  /** Whether to show detailed information */
  showDetails: boolean;
  
  /** Optional callback when a row is selected */
  onRowSelect?: (metric: CostMetric) => void;
}

/**
 * Storage structure for analytics data files
 */
export interface AnalyticsDataFile {
  /** File format version for migration support */
  version: string;
  
  /** Month this file represents (YYYY-MM format) */
  month: string;
  
  /** Array of cost metrics for this month */
  metrics: CostMetric[];
  
  /** File metadata */
  metadata: {
    /** When this file was created */
    createdAt: number;
    
    /** When this file was last updated */
    updatedAt: number;
    
    /** Number of metrics in this file */
    count: number;
    
    /** Total cost for all metrics in this file */
    totalCost: number;
  };
}

/**
 * Analytics index structure for fast lookups
 */
export interface AnalyticsIndex {
  /** Index format version */
  version: string;
  
  /** Available data files and their metadata */
  files: Record<string, {
    /** File path relative to analytics directory */
    path: string;
    
    /** Number of metrics in this file */
    count: number;
    
    /** Date range covered by this file */
    dateRange: [number, number];
    
    /** Total cost for metrics in this file */
    totalCost: number;
    
    /** Last modification time */
    lastModified: number;
  }>;
  
  /** Index metadata */
  metadata: {
    /** When this index was created */
    createdAt: number;
    
    /** When this index was last updated */
    updatedAt: number;
    
    /** Total number of metrics across all files */
    totalMetrics: number;
    
    /** Total cost across all files */
    totalCost: number;
  };
}

/**
 * Performance metrics for analytics operations
 */
export interface PerformanceMetrics {
  /** Query response time in milliseconds */
  queryTime: number;
  
  /** Number of files accessed */
  filesAccessed: number;
  
  /** Amount of data read in bytes */
  bytesRead: number;
  
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  
  /** Memory usage in bytes */
  memoryUsage: number;
}

/**
 * Validation error for invalid metrics
 */
export class MetricValidationError extends Error {
  constructor(
    message: string,
    public field: keyof CostMetric,
    public value: any
  ) {
    super(message);
    this.name = 'MetricValidationError';
  }
}

/**
 * Type guards for runtime type checking
 */
export const TypeGuards = {
  /**
   * Check if an object is a valid CostMetric
   */
  isCostMetric(obj: any): obj is CostMetric {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      typeof obj.timestamp === 'number' &&
      typeof obj.sessionId === 'string' &&
      typeof obj.model === 'string' &&
      typeof obj.inputTokens === 'number' &&
      typeof obj.outputTokens === 'number' &&
      typeof obj.cost === 'number' &&
      ['copilot', 'openai', 'claude'].includes(obj.provider) &&
      typeof obj.duration === 'number' &&
      obj.timestamp > 0 &&
      obj.inputTokens >= 0 &&
      obj.outputTokens >= 0 &&
      obj.cost >= 0 &&
      obj.duration >= 0
    );
  },
  
  /**
   * Check if an object is a valid AnalyticsSummary
   */
  isAnalyticsSummary(obj: any): obj is AnalyticsSummary {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      ['day', 'week', 'month'].includes(obj.period) &&
      typeof obj.startDate === 'number' &&
      typeof obj.endDate === 'number' &&
      typeof obj.totalCost === 'number' &&
      typeof obj.totalTokens === 'number' &&
      typeof obj.sessionCount === 'number' &&
      typeof obj.avgCostPerSession === 'number' &&
      typeof obj.modelBreakdown === 'object'
    );
  }
};