/**
 * StatusManager - Core status and metrics tracking system
 * Manages conversation state, metrics collection, and progress tracking
 */

import { EventEmitter } from 'events';

export type ConversationState = 'idle' | 'streaming' | 'processing' | 'error' | 'waiting';

export interface StatusMetrics {
  // Token metrics
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  
  // Performance metrics
  responseTime: number;
  averageResponseTime: number;
  
  // Memory metrics
  memoryUsageMB: number;
  memoryPercentage: number;
  
  // Session metrics
  sessionTurns: number;
  sessionTokens: number;
  
  // Streaming metrics
  streamProgress: number;
  charactersStreamed: number;
  
  // Tool call metrics
  activeToolCall: string | null;
  toolCallHistory: ToolCallRecord[];
  
  // Error state
  lastError: string | null;
  
  // Progress indicators
  indeterminateProgress: boolean;
}

export interface ToolCallRecord {
  tool: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  error?: string;
  params?: any;
}

export interface TurnRecord {
  startTime: number;
  endTime?: number;
  userMessage: string;
  assistantResponse?: string;
  metrics?: Partial<StatusMetrics>;
}

export interface StatusConfig {
  metricsUpdateInterval?: number;
  progressUpdateInterval?: number;
  memoryCheckInterval?: number;
  collectMetrics?: boolean;
  maxHistorySize?: number;
}

export interface SerializedState {
  state: ConversationState;
  metrics: StatusMetrics;
  history: TurnRecord[];
  config?: StatusConfig;
}

type MetricFormatter = (value: number) => string;

export class StatusManager {
  private state: ConversationState = 'idle';
  private metrics: StatusMetrics;
  private eventEmitter: EventEmitter;
  private config: StatusConfig;
  private turnHistory: TurnRecord[] = [];
  private currentTurn: TurnRecord | null = null;
  private responseTimes: number[] = [];
  private streamStartTime: number | null = null;
  private toolCallStartTime: number | null = null;
  private metricFormatters: Map<string, MetricFormatter> = new Map();
  private memoryCheckTimer?: NodeJS.Timeout;

  constructor(eventEmitter: EventEmitter, config?: StatusConfig) {
    this.eventEmitter = eventEmitter;
    this.config = {
      metricsUpdateInterval: 500,
      progressUpdateInterval: 100,
      memoryCheckInterval: 5000,
      collectMetrics: true,
      maxHistorySize: 100,
      ...config
    };
    
    this.metrics = this.initializeMetrics();
    
    if (this.config.collectMetrics && this.config.memoryCheckInterval) {
      this.startMemoryMonitoring();
    }
  }

  private initializeMetrics(): StatusMetrics {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      responseTime: 0,
      averageResponseTime: 0,
      memoryUsageMB: 0,
      memoryPercentage: 0,
      sessionTurns: 0,
      sessionTokens: 0,
      streamProgress: 0,
      charactersStreamed: 0,
      activeToolCall: null,
      toolCallHistory: [],
      lastError: null,
      indeterminateProgress: false
    };
  }

  private startMemoryMonitoring(): void {
    const checkMemory = () => {
      const usage = process.memoryUsage();
      this.updateMemoryUsage({
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss
      });
    };
    
    this.memoryCheckTimer = setInterval(checkMemory, this.config.memoryCheckInterval);
    checkMemory(); // Initial check
  }

  public getState(): ConversationState {
    return this.state;
  }

  public getMetrics(): StatusMetrics {
    return { ...this.metrics };
  }

  public getConfig(): StatusConfig {
    return { ...this.config };
  }

  public configure(config: Partial<StatusConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart memory monitoring if interval changed
    if (config.memoryCheckInterval !== undefined && this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      if (this.config.collectMetrics) {
        this.startMemoryMonitoring();
      }
    }
  }

  private setState(newState: ConversationState): void {
    const oldState = this.state;
    this.state = newState;
    
    this.eventEmitter.emit('status:stateChange', {
      oldState,
      newState,
      timestamp: Date.now()
    });
  }

  private updateMetrics(updates: Partial<StatusMetrics>): void {
    this.metrics = { ...this.metrics, ...updates };
    
    this.eventEmitter.emit('status:metricsUpdate', this.metrics);
  }

  // Streaming management
  public startStreaming(): void {
    this.setState('streaming');
    this.streamStartTime = Date.now();
    this.metrics.streamProgress = 0;
    this.metrics.charactersStreamed = 0;
    this.updateMetrics({ indeterminateProgress: false });
  }

  public updateStreamProgress(current: number, total: number): void {
    const progress = this.calculateProgress(current, total);
    
    this.updateMetrics({
      streamProgress: progress,
      charactersStreamed: current
    });
    
    this.eventEmitter.emit('status:progress', {
      percentage: progress,
      current,
      total,
      type: 'streaming'
    });
  }

  public complete(): void {
    if (this.streamStartTime) {
      const responseTime = Date.now() - this.streamStartTime;
      this.recordResponseTime(responseTime);
      this.streamStartTime = null;
    }
    
    this.setState('idle');
    this.updateMetrics({
      streamProgress: 100,
      indeterminateProgress: false
    });
  }

  // Tool call management
  public startToolCall(tool: string, params?: any): void {
    this.setState('processing');
    this.toolCallStartTime = Date.now();
    
    const toolCall: ToolCallRecord = {
      tool,
      startTime: this.toolCallStartTime,
      params
    };
    
    this.updateMetrics({
      activeToolCall: tool
    });
    
    this.eventEmitter.emit('status:toolCall', {
      tool,
      status: 'start',
      params
    });
  }

  public endToolCall(tool: string, result: { success: boolean; error?: string }): void {
    if (this.toolCallStartTime) {
      const endTime = Date.now();
      const duration = endTime - this.toolCallStartTime;
      
      const toolCall: ToolCallRecord = {
        tool,
        startTime: this.toolCallStartTime,
        endTime,
        success: result.success,
        error: result.error
      };
      
      this.metrics.toolCallHistory.push(toolCall);
      this.toolCallStartTime = null;
    }
    
    this.updateMetrics({
      activeToolCall: null
    });
    
    this.setState('idle');
    
    this.eventEmitter.emit('status:toolCall', {
      tool,
      status: 'end',
      ...result
    });
  }

  // Token tracking
  public updateTokens(input: number, output: number): void {
    if (!this.config.collectMetrics) return;
    
    this.updateMetrics({
      inputTokens: this.metrics.inputTokens + input,
      outputTokens: this.metrics.outputTokens + output,
      totalTokens: this.metrics.totalTokens + input + output,
      sessionTokens: this.metrics.sessionTokens + input + output
    });
  }

  // Memory tracking
  public updateMemoryUsage(usage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  }): void {
    const usedMB = usage.heapUsed / (1024 * 1024);
    const totalMB = usage.heapTotal / (1024 * 1024);
    const percentage = (usage.heapUsed / usage.heapTotal) * 100;
    
    this.updateMetrics({
      memoryUsageMB: Math.round(usedMB * 10) / 10,
      memoryPercentage: Math.round(percentage)
    });
  }

  // Response time tracking
  public recordResponseTime(ms: number): void {
    this.responseTimes.push(ms);
    
    // Keep only last 50 response times
    if (this.responseTimes.length > 50) {
      this.responseTimes.shift();
    }
    
    const average = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    this.updateMetrics({
      responseTime: ms,
      averageResponseTime: Math.round(average)
    });
  }

  // Turn management
  public incrementTurn(): void {
    this.updateMetrics({
      sessionTurns: this.metrics.sessionTurns + 1
    });
  }

  public startTurn(role: 'user' | 'assistant', message: string): void {
    if (role === 'user') {
      this.currentTurn = {
        startTime: Date.now(),
        userMessage: message
      };
      this.incrementTurn();
    }
  }

  public endTurn(role: 'user' | 'assistant', message: string): void {
    if (role === 'assistant' && this.currentTurn) {
      this.currentTurn.endTime = Date.now();
      this.currentTurn.assistantResponse = message;
      this.currentTurn.metrics = { ...this.metrics };
      
      this.turnHistory.push(this.currentTurn);
      this.currentTurn = null;
      
      // Prune history if too large
      if (this.turnHistory.length > this.config.maxHistorySize!) {
        this.turnHistory = this.turnHistory.slice(-this.config.maxHistorySize!);
      }
    }
  }

  public getTurnHistory(): TurnRecord[] {
    return [...this.turnHistory];
  }

  public clearHistory(): void {
    this.turnHistory = [];
    this.currentTurn = null;
  }

  // Error handling
  public setError(message: string): void {
    this.setState('error');
    this.updateMetrics({ lastError: message });
    
    this.eventEmitter.emit('status:error', {
      message,
      timestamp: Date.now()
    });
  }

  // Progress calculation
  public calculateProgress(current: number, total: number): number {
    if (total === 0) return 0;
    const percentage = (current / total) * 100;
    return Math.min(100, Math.max(0, Math.round(percentage)));
  }

  public setIndeterminateProgress(value: boolean): void {
    this.updateMetrics({ indeterminateProgress: value });
  }

  // Formatting
  public setMetricFormatter(metric: string, formatter: MetricFormatter): void {
    this.metricFormatters.set(metric, formatter);
  }

  public getFormattedMetric(metric: string, value: number): string {
    const formatter = this.metricFormatters.get(metric);
    return formatter ? formatter(value) : value.toString();
  }

  // Persistence
  public serialize(): SerializedState {
    return {
      state: this.state,
      metrics: { ...this.metrics },
      history: [...this.turnHistory],
      config: { ...this.config }
    };
  }

  public restore(data: SerializedState): void {
    this.state = data.state;
    this.metrics = { ...data.metrics };
    this.turnHistory = [...data.history];
    
    if (data.config) {
      this.configure(data.config);
    }
  }

  // Cleanup
  public destroy(): void {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
    }
  }
}