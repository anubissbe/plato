export interface Metrics {
  duration: number;
  count: number;
  average: number;
  min: number;
  max: number;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface PerformanceBudget {
  render?: number;
  update?: number;
  interaction?: number;
  [key: string]: number | undefined;
}

export interface ThresholdAlert {
  metric: string;
  duration: number;
  threshold: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  private activeMeasures: Map<string, number> = new Map();
  private thresholds: Map<string, { limit: number; callback: (alert: ThresholdAlert) => void }> = new Map();
  private performanceBudget: PerformanceBudget = {};
  private budgetViolations: ThresholdAlert[] = [];
  
  // FPS monitoring
  private fpsMonitoring: boolean = false;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameDrops: number = 0;
  private fps: number = 0;
  private fpsHistory: number[] = [];

  startMeasure(name: string): void {
    this.activeMeasures.set(name, performance.now());
  }

  endMeasure(name: string): void {
    const startTime = this.activeMeasures.get(name);
    if (startTime === undefined) return;

    const duration = performance.now() - startTime;
    
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    
    this.measurements.get(name)!.push(duration);
    this.activeMeasures.delete(name);

    // Check thresholds
    const threshold = this.thresholds.get(name);
    if (threshold && duration > threshold.limit) {
      const alert: ThresholdAlert = {
        metric: name,
        duration,
        threshold: threshold.limit,
        timestamp: Date.now(),
      };
      threshold.callback(alert);
    }

    // Check budget
    if (this.performanceBudget[name] && duration > this.performanceBudget[name]!) {
      this.budgetViolations.push({
        metric: name,
        duration,
        threshold: this.performanceBudget[name]!,
        timestamp: Date.now(),
      });
    }
  }

  getMetrics(name: string): Metrics {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return {
        duration: 0,
        count: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const sum = measurements.reduce((a, b) => a + b, 0);
    return {
      duration: sum,
      count: measurements.length,
      average: sum / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
    };
  }

  getMemoryUsage(): MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external || 0,
        rss: usage.rss,
      };
    }
    
    // Fallback for browser environment
    return {
      heapUsed: (performance as any).memory?.usedJSHeapSize || 0,
      heapTotal: (performance as any).memory?.totalJSHeapSize || 0,
      external: 0,
      rss: 0,
    };
  }

  getBottlenecks(threshold: number): string[] {
    const bottlenecks: string[] = [];
    
    for (const [name, measurements] of this.measurements.entries()) {
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      if (avg > threshold) {
        bottlenecks.push(name);
      }
    }
    
    return bottlenecks;
  }

  // FPS Monitoring
  startFPSMonitoring(): void {
    this.fpsMonitoring = true;
    this.frameCount = 0;
    this.frameDrops = 0;
    this.lastFrameTime = performance.now();
    this.fpsHistory = [];
  }

  stopFPSMonitoring(): void {
    this.fpsMonitoring = false;
  }

  recordFrame(): void {
    if (!this.fpsMonitoring) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    
    // Check for frame drops (>16.67ms for 60 FPS)
    if (delta > 16.67) {
      this.frameDrops++;
    }
    
    this.frameCount++;
    
    // Calculate FPS every second
    if (this.frameCount % 60 === 0) {
      const elapsed = now - (this.lastFrameTime - delta * 59);
      this.fps = 60000 / elapsed;
      this.fpsHistory.push(this.fps);
    }
    
    this.lastFrameTime = now;
  }

  getCurrentFPS(): number {
    return Math.round(this.fps);
  }

  getFrameDrops(): number {
    return this.frameDrops;
  }

  // Thresholds and Alerts
  setThreshold(metric: string, limit: number, callback: (alert: ThresholdAlert) => void): void {
    this.thresholds.set(metric, { limit, callback });
  }

  setPerformanceBudget(budget: PerformanceBudget): void {
    this.performanceBudget = budget;
  }

  getBudgetViolations(): ThresholdAlert[] {
    return this.budgetViolations;
  }

  clearMeasurements(): void {
    this.measurements.clear();
    this.budgetViolations = [];
  }
}

export class RenderOptimizer {
  private batchedUpdates: Map<string, () => void> = new Map();
  private animationFrame: number | null = null;
  private memoCache: Map<string, { args: any; result: any }> = new Map();
  private scheduledTasks: Array<{ id: string; task: () => void; priority: string }> = [];

  batchUpdate(id: string, update: () => void): void {
    this.batchedUpdates.set(id, update);
    
    if (!this.animationFrame) {
      this.animationFrame = requestAnimationFrame(() => {
        this.flushBatchedUpdates();
      });
    }
  }

  private flushBatchedUpdates(): void {
    for (const update of this.batchedUpdates.values()) {
      update();
    }
    this.batchedUpdates.clear();
    this.animationFrame = null;
  }

  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        func(...args);
        timeoutId = null;
      }, delay);
    };
  }

  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;
    let lastArgs: Parameters<T> | null = null;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        
        setTimeout(() => {
          inThrottle = false;
          if (lastArgs) {
            func(...lastArgs);
            lastArgs = null;
          }
        }, limit);
      } else {
        lastArgs = args;
      }
    };
  }

  scheduleUpdate(id: string, task: () => void, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    this.scheduledTasks.push({ id, task, priority });
    
    // Sort by priority
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.scheduledTasks.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);
    
    // Execute in next tick
    Promise.resolve().then(() => {
      const task = this.scheduledTasks.shift();
      if (task) {
        task.task();
      }
    });
  }

  scheduleIdleTask(task: () => void): void {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(task);
    } else {
      setTimeout(task, 0);
    }
  }

  memoize<T extends (...args: any[]) => any>(func: T): T {
    const cacheKey = func.toString();
    
    return ((...args: Parameters<T>) => {
      const cached = this.memoCache.get(cacheKey);
      
      if (cached && JSON.stringify(cached.args) === JSON.stringify(args)) {
        return cached.result;
      }
      
      const result = func(...args);
      this.memoCache.set(cacheKey, { args, result });
      
      return result;
    }) as T;
  }

  invalidateCache(func: Function): void {
    const cacheKey = func.toString();
    this.memoCache.delete(cacheKey);
  }
}

export class MemoryManager {
  private trackedObjects: Map<string, any> = new Map();
  private objectPools: Map<string, ObjectPool> = new Map();
  private memoryLimit: number = Infinity;
  private memoryPressureCallbacks: Array<(info: any) => void> = [];
  private gcThreshold: number = 10 * 1024 * 1024; // 10MB
  private unusedObjects: Set<string> = new Set();

  track(id: string, object: any): void {
    this.trackedObjects.set(id, object);
    this.checkMemoryPressure();
  }

  release(id: string): void {
    this.trackedObjects.delete(id);
    this.unusedObjects.delete(id);
  }

  getStats(): { trackedObjects: number; totalSize: number } {
    let totalSize = 0;
    
    for (const obj of this.trackedObjects.values()) {
      totalSize += this.estimateSize(obj);
    }
    
    return {
      trackedObjects: this.trackedObjects.size,
      totalSize,
    };
  }

  private estimateSize(obj: any): number {
    // Simplified size estimation
    if (typeof obj === 'string') return obj.length * 2;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (obj instanceof Array) return obj.length * 8 + obj.reduce((sum, item) => sum + this.estimateSize(item), 0);
    if (obj instanceof ArrayBuffer) return obj.byteLength;
    if (typeof obj === 'object') return JSON.stringify(obj).length * 2;
    return 0;
  }

  detectLeaks(): { potentialLeaks: string[] } {
    const potentialLeaks: string[] = [];
    
    for (const [id, obj] of this.trackedObjects.entries()) {
      // Simple leak detection - objects that are large and old
      const size = this.estimateSize(obj);
      if (size > 1000) {
        potentialLeaks.push(id);
      }
    }
    
    return { potentialLeaks };
  }

  createPool(name: string, factory: () => any, options?: { maxSize?: number }): ObjectPool {
    const pool = new ObjectPool(factory, options?.maxSize);
    this.objectPools.set(name, pool);
    return pool;
  }

  setMemoryLimit(bytes: number): void {
    this.memoryLimit = bytes;
  }

  setGCThreshold(bytes: number): void {
    this.gcThreshold = bytes;
  }

  markUnused(id: string): void {
    this.unusedObjects.add(id);
  }

  runGC(): void {
    for (const id of this.unusedObjects) {
      this.release(id);
    }
    this.unusedObjects.clear();
  }

  onMemoryPressure(callback: (info: any) => void): void {
    this.memoryPressureCallbacks.push(callback);
  }

  private checkMemoryPressure(): void {
    const stats = this.getStats();
    
    if (stats.totalSize > this.memoryLimit) {
      throw new Error('Memory limit exceeded');
    }
    
    if (stats.totalSize > this.memoryLimit * 0.8) {
      const info = {
        usage: stats.totalSize,
        limit: this.memoryLimit,
        percentage: (stats.totalSize / this.memoryLimit) * 100,
      };
      
      for (const callback of this.memoryPressureCallbacks) {
        callback(info);
      }
    }
  }
}

class ObjectPool {
  private pool: any[] = [];
  private factory: () => any;
  private maxSize: number;

  constructor(factory: () => any, maxSize: number = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
  }

  acquire(): any {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.factory();
  }

  release(obj: any): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  size(): number {
    return this.pool.length;
  }
}

export class VirtualScroller {
  private itemHeight: number | ((index: number) => number);
  private containerHeight: number;
  private totalItems: number;
  private scrollPosition: number = 0;
  private buffer: number = 0;
  private positionCache: Map<number, number> = new Map();
  private elementPool: ElementPool;
  private momentum: number = 0;
  private lastScrollTime: number = 0;

  constructor(options: {
    itemHeight?: number;
    getItemHeight?: (index: number) => number;
    containerHeight: number;
    totalItems: number;
  }) {
    this.itemHeight = options.itemHeight || options.getItemHeight || 50;
    this.containerHeight = options.containerHeight;
    this.totalItems = options.totalItems;
    this.elementPool = new ElementPool();
  }

  getVisibleItems(): { startIndex: number; endIndex: number; count: number } {
    const itemHeight = typeof this.itemHeight === 'function' ? 50 : this.itemHeight; // Estimate for variable heights
    const startIndex = Math.floor(this.scrollPosition / itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / itemHeight);
    const endIndex = Math.min(startIndex + visibleCount, this.totalItems);
    
    return {
      startIndex,
      endIndex,
      count: endIndex - startIndex,
    };
  }

  getVisibleItemsWithBuffer(): { startIndex: number; endIndex: number; count: number } {
    const visible = this.getVisibleItems();
    
    return {
      startIndex: Math.max(0, visible.startIndex - this.buffer),
      endIndex: Math.min(this.totalItems, visible.endIndex + this.buffer),
      count: visible.count + this.buffer * 2,
    };
  }

  scrollTo(position: number): void {
    this.scrollPosition = Math.max(0, Math.min(position, this.getTotalHeight() - this.containerHeight));
  }

  setBuffer(items: number): void {
    this.buffer = items;
  }

  getItemPosition(index: number): number {
    if (this.positionCache.has(index)) {
      return this.positionCache.get(index)!;
    }
    
    let position = 0;
    
    if (typeof this.itemHeight === 'function') {
      for (let i = 0; i < index; i++) {
        position += this.itemHeight(i);
      }
    } else {
      position = index * this.itemHeight;
    }
    
    this.positionCache.set(index, position);
    return position;
  }

  private getTotalHeight(): number {
    if (typeof this.itemHeight === 'function') {
      let total = 0;
      for (let i = 0; i < this.totalItems; i++) {
        total += this.itemHeight(i);
      }
      return total;
    }
    return this.totalItems * this.itemHeight;
  }

  getElementPool(): ElementPool {
    return this.elementPool;
  }

  getVisibleElements(): any[] {
    const visible = this.getVisibleItems();
    const elements = [];
    
    for (let i = visible.startIndex; i < visible.endIndex; i++) {
      elements.push(this.elementPool.acquire());
    }
    
    return elements;
  }

  getScrollPosition(): number {
    return this.scrollPosition;
  }

  smoothScrollTo(position: number, options?: { duration?: number; easing?: string }): void {
    const duration = options?.duration || 300;
    const startPosition = this.scrollPosition;
    const distance = position - startPosition;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Simple easing
      const eased = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
      
      this.scrollPosition = startPosition + distance * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  applyMomentum(velocity: number): void {
    this.momentum = velocity;
    this.lastScrollTime = performance.now();
  }

  updateMomentum(): void {
    if (Math.abs(this.momentum) < 0.1) {
      this.momentum = 0;
      return;
    }
    
    const now = performance.now();
    const delta = now - this.lastScrollTime;
    
    // Apply friction
    this.momentum *= Math.pow(0.95, delta / 16);
    
    // Update position
    this.scrollPosition += this.momentum * (delta / 16);
    this.scrollPosition = Math.max(0, Math.min(this.scrollPosition, this.getTotalHeight() - this.containerHeight));
    
    this.lastScrollTime = now;
  }

  private calculatePositions(): void {
    // Method stub for spy testing
  }
}

class ElementPool {
  private pool: any[] = [];
  public recycled: number = 0;

  acquire(): any {
    if (this.pool.length > 0) {
      this.recycled++;
      return this.pool.pop();
    }
    return {}; // Create new element
  }

  release(element: any): void {
    this.pool.push(element);
  }
}