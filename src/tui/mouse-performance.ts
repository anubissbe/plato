/**
 * Mouse Event Performance Optimization
 * Advanced optimization strategies for high-frequency mouse events
 */

import {
  MouseEvent,
  MouseEventType,
  MouseCoordinates,
  MouseEventProcessingOptions
} from './mouse-types.js';

/**
 * Performance optimization configuration
 */
interface MousePerformanceConfig {
  /** Enable frame-based batching */
  enableFrameBatching: boolean;
  /** Target FPS for mouse events */
  targetFPS: number;
  /** Enable coordinate caching */
  enableCoordinateCache: boolean;
  /** Cache size for coordinate lookups */
  coordinateCacheSize: number;
  /** Enable event deduplication */
  enableDeduplication: boolean;
  /** Enable predictive throttling */
  enablePredictiveThrottling: boolean;
  /** Memory pool size for event objects */
  eventPoolSize: number;
  /** Enable performance monitoring */
  enableMonitoring: boolean;
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageProcessingTime: number;
  peakProcessingTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  throttlingRate: number;
}

/**
 * Event pooling for memory optimization
 */
class MouseEventPool {
  private pool: MouseEvent[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.initializePool();
  }

  /**
   * Get event from pool or create new one
   */
  acquire(): MouseEvent {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    return this.createNewEvent();
  }

  /**
   * Return event to pool for reuse
   */
  release(event: MouseEvent): void {
    if (this.pool.length < this.maxSize) {
      // Reset event properties
      this.resetEvent(event);
      this.pool.push(event);
    }
  }

  private initializePool(): void {
    for (let i = 0; i < Math.min(this.maxSize / 2, 20); i++) {
      this.pool.push(this.createNewEvent());
    }
  }

  private createNewEvent(): MouseEvent {
    return {
      type: 'move',
      coordinates: { x: 0, y: 0 },
      button: 'left',
      modifiers: { shift: false, ctrl: false, alt: false, meta: false },
      timestamp: 0
    };
  }

  private resetEvent(event: MouseEvent): void {
    event.type = 'move';
    event.coordinates.x = 0;
    event.coordinates.y = 0;
    event.button = 'left';
    event.modifiers.shift = false;
    event.modifiers.ctrl = false;
    event.modifiers.alt = false;
    event.modifiers.meta = false;
    event.timestamp = 0;
    event.rawSequence = undefined;
    event.target = undefined;
  }
}

/**
 * Coordinate caching system
 */
class CoordinateCache {
  private cache = new Map<string, MouseCoordinates>();
  private readonly maxSize: number;
  private hitCount = 0;
  private totalRequests = 0;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached coordinates
   */
  get(key: string): MouseCoordinates | undefined {
    this.totalRequests++;
    const result = this.cache.get(key);
    if (result) {
      this.hitCount++;
    }
    return result;
  }

  /**
   * Set cached coordinates
   */
  set(key: string, coordinates: MouseCoordinates): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { ...coordinates });
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    return this.totalRequests > 0 ? this.hitCount / this.totalRequests : 0;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.totalRequests = 0;
  }
}

/**
 * Frame-based event batching
 */
class FrameBatcher {
  private eventBuffer: MouseEvent[] = [];
  private animationFrame: NodeJS.Timeout | null = null;
  private readonly targetFPS: number;
  private readonly frameInterval: number;
  private lastFrameTime = 0;

  constructor(
    targetFPS = 60,
    private processCallback: (events: MouseEvent[]) => void
  ) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
  }

  /**
   * Add event to batch
   */
  addEvent(event: MouseEvent): void {
    this.eventBuffer.push(event);
    this.scheduleProcessing();
  }

  /**
   * Force process current batch
   */
  flush(): void {
    if (this.eventBuffer.length > 0) {
      this.processBatch();
    }
  }

  private scheduleProcessing(): void {
    if (this.animationFrame !== null) return;

    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;

    if (timeSinceLastFrame >= this.frameInterval) {
      // Process immediately
      this.processBatch();
    } else {
      // Schedule for next frame
      this.animationFrame = setTimeout(() => {
        this.processBatch();
      }, this.frameInterval - timeSinceLastFrame);
    }
  }

  private processBatch(): void {
    if (this.animationFrame !== null) {
      clearTimeout(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.eventBuffer.length > 0) {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      this.lastFrameTime = performance.now();
      this.processCallback(events);
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.animationFrame !== null) {
      clearTimeout(this.animationFrame);
      this.animationFrame = null;
    }
    this.eventBuffer = [];
  }
}

/**
 * High-performance mouse event optimizer
 */
export class MousePerformanceOptimizer {
  private config: MousePerformanceConfig;
  private eventPool: MouseEventPool;
  private coordinateCache: CoordinateCache;
  private frameBatcher: FrameBatcher | null = null;
  private metrics: PerformanceMetrics;
  private lastEventsByType = new Map<MouseEventType, MouseEvent>();
  private performanceStartTime = Date.now();

  constructor(
    config: Partial<MousePerformanceConfig> = {},
    private eventProcessor?: (events: MouseEvent[]) => void
  ) {
    this.config = {
      enableFrameBatching: true,
      targetFPS: 60,
      enableCoordinateCache: true,
      coordinateCacheSize: 1000,
      enableDeduplication: true,
      enablePredictiveThrottling: true,
      eventPoolSize: 100,
      enableMonitoring: true,
      ...config
    };

    this.eventPool = new MouseEventPool(this.config.eventPoolSize);
    this.coordinateCache = new CoordinateCache(this.config.coordinateCacheSize);
    this.metrics = this.initializeMetrics();

    if (this.config.enableFrameBatching && this.eventProcessor) {
      this.frameBatcher = new FrameBatcher(
        this.config.targetFPS,
        this.eventProcessor
      );
    }
  }

  /**
   * Optimize mouse event processing
   */
  optimizeEvent(event: MouseEvent): MouseEvent[] {
    const startTime = performance.now();
    this.metrics.totalEvents++;

    try {
      // Apply deduplication if enabled
      if (this.config.enableDeduplication && this.isDuplicateEvent(event)) {
        this.metrics.droppedEvents++;
        return [];
      }

      // Apply predictive throttling
      if (this.config.enablePredictiveThrottling && this.shouldThrottleEvent(event)) {
        this.metrics.droppedEvents++;
        return [];
      }

      // Optimize coordinates if caching enabled
      if (this.config.enableCoordinateCache) {
        event.coordinates = this.optimizeCoordinates(event.coordinates);
      }

      // Update event tracking
      this.lastEventsByType.set(event.type, event);

      // Use frame batching if enabled
      if (this.frameBatcher) {
        this.frameBatcher.addEvent(event);
        this.metrics.processedEvents++;
        return []; // Events will be processed in batch
      }

      this.metrics.processedEvents++;
      return [event];
    } finally {
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);
    }
  }

  /**
   * Batch optimize multiple events
   */
  optimizeEvents(events: MouseEvent[]): MouseEvent[] {
    if (events.length === 0) return events;

    const optimizedEvents: MouseEvent[] = [];

    for (const event of events) {
      const optimized = this.optimizeEvent(event);
      optimizedEvents.push(...optimized);
    }

    return optimizedEvents;
  }

  /**
   * Check if event is duplicate of recent event
   */
  private isDuplicateEvent(event: MouseEvent): boolean {
    const lastEvent = this.lastEventsByType.get(event.type);
    if (!lastEvent) return false;

    // For move events, check if coordinates are the same
    if (event.type === 'move' && lastEvent.type === 'move') {
      return event.coordinates.x === lastEvent.coordinates.x &&
             event.coordinates.y === lastEvent.coordinates.y;
    }

    // For other events, check if they occurred too recently
    const timeDiff = event.timestamp - lastEvent.timestamp;
    return timeDiff < 16; // Less than one frame at 60fps
  }

  /**
   * Predictive throttling based on event patterns
   */
  private shouldThrottleEvent(event: MouseEvent): boolean {
    const lastEvent = this.lastEventsByType.get(event.type);
    if (!lastEvent) return false;

    const timeDiff = event.timestamp - lastEvent.timestamp;
    
    // Throttle rapid move events more aggressively
    if (event.type === 'move') {
      return timeDiff < 8; // Max 120 fps for move events
    }

    // Moderate throttling for drag events
    if (event.type === 'drag') {
      return timeDiff < 12; // Max 83 fps for drag events
    }

    return false;
  }

  /**
   * Optimize coordinates using cache
   */
  private optimizeCoordinates(coordinates: MouseCoordinates): MouseCoordinates {
    const key = `${coordinates.x},${coordinates.y}`;
    const cached = this.coordinateCache.get(key);
    
    if (cached) {
      return cached;
    }

    // Create optimized coordinate object
    const optimized = { x: coordinates.x, y: coordinates.y };
    this.coordinateCache.set(key, optimized);
    return optimized;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    if (!this.config.enableMonitoring) return;

    // Update processing times
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.processedEvents - 1) + processingTime) / 
      this.metrics.processedEvents;
    
    this.metrics.peakProcessingTime = Math.max(
      this.metrics.peakProcessingTime,
      processingTime
    );

    // Update cache hit rate
    this.metrics.cacheHitRate = this.coordinateCache.getHitRate();

    // Update throttling rate
    this.metrics.throttlingRate = 
      this.metrics.totalEvents > 0 ? 
      this.metrics.droppedEvents / this.metrics.totalEvents : 0;

    // Estimate memory usage (simplified)
    this.metrics.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * Estimate memory usage in KB
   */
  private estimateMemoryUsage(): number {
    // Rough estimate based on object counts
    const eventSize = 200; // bytes per event object
    const cacheEntrySize = 50; // bytes per cache entry
    
    const eventMemory = this.metrics.processedEvents * eventSize;
    const cacheMemory = this.coordinateCache['cache'].size * cacheEntrySize;
    
    return (eventMemory + cacheMemory) / 1024; // Convert to KB
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.coordinateCache.clear();
    this.performanceStartTime = Date.now();
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      totalEvents: 0,
      processedEvents: 0,
      droppedEvents: 0,
      averageProcessingTime: 0,
      peakProcessingTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      throttlingRate: 0
    };
  }

  /**
   * Flush any pending batched events
   */
  flush(): void {
    if (this.frameBatcher) {
      this.frameBatcher.flush();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MousePerformanceConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate frame batcher if settings changed
    if (config.enableFrameBatching !== undefined || config.targetFPS !== undefined) {
      if (this.frameBatcher) {
        this.frameBatcher.dispose();
        this.frameBatcher = null;
      }

      if (this.config.enableFrameBatching && this.eventProcessor) {
        this.frameBatcher = new FrameBatcher(
          this.config.targetFPS,
          this.eventProcessor
        );
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): MousePerformanceConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.frameBatcher) {
      this.frameBatcher.dispose();
      this.frameBatcher = null;
    }
    this.coordinateCache.clear();
    this.lastEventsByType.clear();
    this.metrics = this.initializeMetrics();
  }
}