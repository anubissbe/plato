/**
 * Progress Indicators for Long-running Context Operations
 * Provides real-time progress tracking and user feedback for context management operations
 */

import { EventEmitter } from 'events';

export interface ProgressState {
  id: string;
  name: string;
  current: number;
  total: number;
  percentage: number;
  phase: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  duration?: number;
  estimatedTimeRemaining?: number;
  throughput?: number; // items per second
  message?: string;
  details?: Record<string, any>;
}

export interface ProgressPhase {
  name: string;
  weight: number; // Relative weight for progress calculation
  description: string;
}

export interface ProgressOptions {
  phases?: ProgressPhase[];
  showThroughput?: boolean;
  updateInterval?: number; // milliseconds
  estimateTimeRemaining?: boolean;
}

/**
 * Progress tracker for individual operations
 */
export class ProgressTracker extends EventEmitter {
  private state: ProgressState;
  private phases: ProgressPhase[];
  private currentPhaseIndex: number = 0;
  private phaseProgress: number[] = [];
  private lastUpdate: number = 0;
  private throughputSamples: Array<{ time: number; count: number }> = [];
  private updateInterval: number;

  constructor(
    id: string,
    name: string,
    total: number,
    options: ProgressOptions = {}
  ) {
    super();
    
    this.phases = options.phases || [{ name: 'Processing', weight: 1, description: 'Processing items' }];
    this.phaseProgress = new Array(this.phases.length).fill(0);
    this.updateInterval = options.updateInterval || 100;

    this.state = {
      id,
      name,
      current: 0,
      total,
      percentage: 0,
      phase: this.phases[0].name,
      status: 'pending',
      startTime: Date.now()
    };
  }

  /**
   * Start progress tracking
   */
  start(message?: string): void {
    this.state.status = 'running';
    this.state.startTime = Date.now();
    this.state.message = message;
    this.lastUpdate = Date.now();
    
    this.emit('start', this.getState());
  }

  /**
   * Update progress
   */
  update(current: number, message?: string): void {
    if (this.state.status !== 'running') return;

    const now = Date.now();
    this.state.current = Math.min(current, this.state.total);
    this.state.message = message;

    // Update current phase progress
    if (this.currentPhaseIndex < this.phases.length) {
      const phaseTotal = this.state.total / this.phases.length;
      const phaseStart = this.currentPhaseIndex * phaseTotal;
      const phaseCurrent = Math.min(this.state.current - phaseStart, phaseTotal);
      this.phaseProgress[this.currentPhaseIndex] = Math.max(0, phaseCurrent);
    }

    // Calculate overall percentage
    this.calculateOverallProgress();

    // Update throughput
    this.updateThroughput(now);

    // Estimate time remaining
    this.estimateTimeRemaining();

    // Throttle updates
    if (now - this.lastUpdate >= this.updateInterval) {
      this.emit('update', this.getState());
      this.lastUpdate = now;
    }

    // Check if completed
    if (this.state.current >= this.state.total) {
      this.complete();
    }
  }

  /**
   * Move to next phase
   */
  nextPhase(message?: string): void {
    if (this.currentPhaseIndex < this.phases.length - 1) {
      this.currentPhaseIndex++;
      this.state.phase = this.phases[this.currentPhaseIndex].name;
      this.state.message = message || this.phases[this.currentPhaseIndex].description;
      
      this.emit('phaseChange', {
        ...this.getState(),
        phaseIndex: this.currentPhaseIndex,
        phaseName: this.state.phase
      });
    }
  }

  /**
   * Complete progress
   */
  complete(message?: string): void {
    this.state.status = 'completed';
    this.state.current = this.state.total;
    this.state.percentage = 100;
    this.state.endTime = Date.now();
    this.state.duration = this.state.endTime - this.state.startTime;
    this.state.message = message || 'Completed';
    
    this.emit('complete', this.getState());
  }

  /**
   * Mark as failed
   */
  fail(error: string): void {
    this.state.status = 'failed';
    this.state.endTime = Date.now();
    this.state.duration = this.state.endTime - this.state.startTime;
    this.state.message = error;
    
    this.emit('fail', { ...this.getState(), error });
  }

  /**
   * Cancel operation
   */
  cancel(message?: string): void {
    this.state.status = 'cancelled';
    this.state.endTime = Date.now();
    this.state.duration = this.state.endTime - this.state.startTime;
    this.state.message = message || 'Cancelled';
    
    this.emit('cancel', this.getState());
  }

  /**
   * Get current state
   */
  getState(): ProgressState {
    return { ...this.state };
  }

  /**
   * Add details to state
   */
  addDetail(key: string, value: any): void {
    if (!this.state.details) {
      this.state.details = {};
    }
    this.state.details[key] = value;
  }

  private calculateOverallProgress(): void {
    let totalWeight = 0;
    let completedWeight = 0;

    for (let i = 0; i < this.phases.length; i++) {
      const phase = this.phases[i];
      const phaseTotal = this.state.total / this.phases.length;
      const phaseCompleted = this.phaseProgress[i] || 0;
      
      totalWeight += phase.weight;
      completedWeight += (phaseCompleted / phaseTotal) * phase.weight;
    }

    this.state.percentage = Math.min(100, Math.round((completedWeight / totalWeight) * 100));
  }

  private updateThroughput(now: number): void {
    this.throughputSamples.push({ time: now, count: this.state.current });
    
    // Keep only recent samples (last 5 seconds)
    const cutoff = now - 5000;
    this.throughputSamples = this.throughputSamples.filter(sample => sample.time > cutoff);
    
    if (this.throughputSamples.length >= 2) {
      const first = this.throughputSamples[0];
      const last = this.throughputSamples[this.throughputSamples.length - 1];
      const timeDiff = (last.time - first.time) / 1000; // seconds
      const countDiff = last.count - first.count;
      
      if (timeDiff > 0) {
        this.state.throughput = countDiff / timeDiff;
      }
    }
  }

  private estimateTimeRemaining(): void {
    if (this.state.throughput && this.state.throughput > 0) {
      const remaining = this.state.total - this.state.current;
      this.state.estimatedTimeRemaining = Math.round((remaining / this.state.throughput) * 1000);
    }
  }
}

/**
 * Progress manager for multiple concurrent operations
 */
export class ProgressManager extends EventEmitter {
  private trackers: Map<string, ProgressTracker> = new Map();
  private aggregateState: {
    totalOperations: number;
    activeOperations: number;
    completedOperations: number;
    failedOperations: number;
    cancelledOperations: number;
  } = {
    totalOperations: 0,
    activeOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    cancelledOperations: 0
  };

  /**
   * Create new progress tracker
   */
  createTracker(
    id: string,
    name: string,
    total: number,
    options?: ProgressOptions
  ): ProgressTracker {
    const tracker = new ProgressTracker(id, name, total, options);
    
    // Set up event forwarding
    tracker.on('start', (state) => {
      this.aggregateState.activeOperations++;
      this.emit('trackerStart', state);
      this.emitAggregateUpdate();
    });

    tracker.on('update', (state) => {
      this.emit('trackerUpdate', state);
    });

    tracker.on('complete', (state) => {
      this.aggregateState.activeOperations--;
      this.aggregateState.completedOperations++;
      this.emit('trackerComplete', state);
      this.emitAggregateUpdate();
    });

    tracker.on('fail', (data) => {
      this.aggregateState.activeOperations--;
      this.aggregateState.failedOperations++;
      this.emit('trackerFail', data);
      this.emitAggregateUpdate();
    });

    tracker.on('cancel', (state) => {
      this.aggregateState.activeOperations--;
      this.aggregateState.cancelledOperations++;
      this.emit('trackerCancel', state);
      this.emitAggregateUpdate();
    });

    this.trackers.set(id, tracker);
    this.aggregateState.totalOperations++;
    this.emitAggregateUpdate();

    return tracker;
  }

  /**
   * Get tracker by ID
   */
  getTracker(id: string): ProgressTracker | undefined {
    return this.trackers.get(id);
  }

  /**
   * Get all active trackers
   */
  getActiveTrackers(): ProgressTracker[] {
    return Array.from(this.trackers.values())
      .filter(tracker => tracker.getState().status === 'running');
  }

  /**
   * Get all trackers
   */
  getAllTrackers(): ProgressTracker[] {
    return Array.from(this.trackers.values());
  }

  /**
   * Cancel all active operations
   */
  cancelAll(message?: string): void {
    const active = this.getActiveTrackers();
    active.forEach(tracker => tracker.cancel(message));
  }

  /**
   * Remove completed/failed/cancelled trackers
   */
  cleanup(): number {
    const toRemove: string[] = [];
    
    for (const [id, tracker] of this.trackers) {
      const status = tracker.getState().status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.trackers.delete(id));
    
    return toRemove.length;
  }

  /**
   * Get aggregate statistics
   */
  getAggregateState() {
    return { ...this.aggregateState };
  }

  private emitAggregateUpdate(): void {
    this.emit('aggregateUpdate', this.getAggregateState());
  }
}

/**
 * TUI Progress Renderer for terminal display
 */
export class TUIProgressRenderer {
  private terminalWidth: number = process.stdout.columns || 80;

  /**
   * Render single progress bar
   */
  renderProgress(state: ProgressState): string {
    const barWidth = Math.min(40, this.terminalWidth - 30);
    const filled = Math.round((state.percentage / 100) * barWidth);
    const empty = barWidth - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentage = state.percentage.toString().padStart(3);
    
    let line = `${this.getStatusIcon(state.status)} ${state.name}`;
    line += `\n  [${bar}] ${percentage}%`;
    
    if (state.message) {
      line += ` - ${state.message}`;
    }

    if (state.estimatedTimeRemaining && state.estimatedTimeRemaining > 1000) {
      const eta = this.formatDuration(state.estimatedTimeRemaining);
      line += ` (ETA: ${eta})`;
    }

    if (state.throughput && state.throughput > 0) {
      line += ` (${Math.round(state.throughput)}/s)`;
    }

    return line;
  }

  /**
   * Render multiple progress bars
   */
  renderMultiple(states: ProgressState[]): string {
    return states.map(state => this.renderProgress(state)).join('\n\n');
  }

  /**
   * Render aggregate summary
   */
  renderAggregate(aggregate: any, activeStates: ProgressState[]): string {
    let output = `\n📊 Operations: ${aggregate.totalOperations} total, `;
    output += `${aggregate.activeOperations} active, `;
    output += `${aggregate.completedOperations} completed`;
    
    if (aggregate.failedOperations > 0) {
      output += `, ${aggregate.failedOperations} failed`;
    }
    
    if (aggregate.cancelledOperations > 0) {
      output += `, ${aggregate.cancelledOperations} cancelled`;
    }

    if (activeStates.length > 0) {
      const overallProgress = activeStates.reduce((sum, state) => sum + state.percentage, 0) / activeStates.length;
      output += `\n📈 Overall progress: ${Math.round(overallProgress)}%`;
    }

    return output;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '⏹️';
      default: return '📋';
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Context-specific progress templates
 */
export class ContextProgressTemplates {
  /**
   * Progress template for file indexing
   */
  static createIndexingProgress(fileCount: number): ProgressOptions {
    return {
      phases: [
        { name: 'Scanning', weight: 0.1, description: 'Scanning for files' },
        { name: 'Analyzing', weight: 0.6, description: 'Analyzing file contents' },
        { name: 'Building Index', weight: 0.2, description: 'Building semantic index' },
        { name: 'Optimizing', weight: 0.1, description: 'Optimizing index structure' }
      ],
      showThroughput: true,
      estimateTimeRemaining: true,
      updateInterval: 250
    };
  }

  /**
   * Progress template for relevance scoring
   */
  static createScoringProgress(): ProgressOptions {
    return {
      phases: [
        { name: 'Loading', weight: 0.2, description: 'Loading file data' },
        { name: 'Scoring', weight: 0.7, description: 'Calculating relevance scores' },
        { name: 'Ranking', weight: 0.1, description: 'Ranking results' }
      ],
      showThroughput: true,
      updateInterval: 100
    };
  }

  /**
   * Progress template for content sampling
   */
  static createSamplingProgress(): ProgressOptions {
    return {
      phases: [
        { name: 'Preparation', weight: 0.1, description: 'Preparing content analysis' },
        { name: 'Sampling', weight: 0.8, description: 'Sampling file content' },
        { name: 'Optimization', weight: 0.1, description: 'Optimizing samples' }
      ],
      showThroughput: true,
      estimateTimeRemaining: true
    };
  }

  /**
   * Progress template for cache operations
   */
  static createCacheProgress(): ProgressOptions {
    return {
      phases: [
        { name: 'Cleanup', weight: 0.3, description: 'Cleaning expired entries' },
        { name: 'Optimization', weight: 0.4, description: 'Optimizing cache structure' },
        { name: 'Persistence', weight: 0.3, description: 'Saving to disk' }
      ],
      updateInterval: 500
    };
  }
}