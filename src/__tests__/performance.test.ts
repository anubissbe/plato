import { PerformanceMonitor } from '../tui/PerformanceMonitor';
import { RenderOptimizer } from '../tui/RenderOptimizer';
import { MemoryManager } from '../tui/MemoryManager';
import { VirtualScroller } from '../tui/VirtualScroller';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('Metrics Collection', () => {
    it('should track render times', () => {
      monitor.startMeasure('render');
      // Simulate render work
      const work = Array(1000).fill(0).reduce((a, b) => a + Math.random(), 0);
      monitor.endMeasure('render');

      const metrics = monitor.getMetrics('render');
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.count).toBe(1);
    });

    it('should calculate average performance', () => {
      for (let i = 0; i < 10; i++) {
        monitor.startMeasure('operation');
        // Simulate varying work
        const work = Array(100 * (i + 1)).fill(0).reduce((a, b) => a + Math.random(), 0);
        monitor.endMeasure('operation');
      }

      const metrics = monitor.getMetrics('operation');
      expect(metrics.count).toBe(10);
      expect(metrics.average).toBeGreaterThan(0);
      expect(metrics.min).toBeLessThanOrEqual(metrics.max);
    });

    it('should track memory usage', () => {
      const initialMemory = monitor.getMemoryUsage();
      
      // Allocate some memory
      const bigArray = new Array(10000).fill('x'.repeat(100));
      
      const currentMemory = monitor.getMemoryUsage();
      expect(currentMemory.heapUsed).toBeGreaterThanOrEqual(initialMemory.heapUsed);
    });

    it('should detect performance bottlenecks', () => {
      // Simulate slow operation
      monitor.startMeasure('slow-op');
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait
      }
      monitor.endMeasure('slow-op');

      const bottlenecks = monitor.getBottlenecks(50); // Operations over 50ms
      expect(bottlenecks).toContain('slow-op');
    });
  });

  describe('FPS Monitoring', () => {
    it('should track frame rate', (done) => {
      monitor.startFPSMonitoring();
      
      // Simulate frame rendering
      let frameCount = 0;
      const renderFrame = () => {
        frameCount++;
        monitor.recordFrame();
        if (frameCount < 60) {
          setTimeout(renderFrame, 16); // ~60 FPS
        } else {
          const fps = monitor.getCurrentFPS();
          expect(fps).toBeGreaterThan(30);
          expect(fps).toBeLessThanOrEqual(70);
          monitor.stopFPSMonitoring();
          done();
        }
      };
      renderFrame();
    });

    it('should detect frame drops', (done) => {
      monitor.startFPSMonitoring();
      
      // Simulate irregular frame rendering
      let frameCount = 0;
      const renderFrame = () => {
        frameCount++;
        monitor.recordFrame();
        if (frameCount < 30) {
          // Simulate frame drop every 5th frame
          const delay = frameCount % 5 === 0 ? 100 : 16;
          setTimeout(renderFrame, delay);
        } else {
          const drops = monitor.getFrameDrops();
          expect(drops).toBeGreaterThan(0);
          monitor.stopFPSMonitoring();
          done();
        }
      };
      renderFrame();
    });
  });

  describe('Thresholds and Alerts', () => {
    it('should trigger alerts for slow operations', () => {
      const alertCallback = jest.fn();
      monitor.setThreshold('render', 50, alertCallback);

      monitor.startMeasure('render');
      // Simulate slow render
      const start = Date.now();
      while (Date.now() - start < 60) {
        // Busy wait
      }
      monitor.endMeasure('render');

      expect(alertCallback).toHaveBeenCalledWith(expect.objectContaining({
        metric: 'render',
        duration: expect.any(Number),
        threshold: 50,
      }));
    });

    it('should track performance budget', () => {
      monitor.setPerformanceBudget({
        render: 16, // 60 FPS
        update: 8,
        interaction: 100,
      });

      monitor.startMeasure('render');
      setTimeout(() => {
        monitor.endMeasure('render');
        const violations = monitor.getBudgetViolations();
        expect(violations).toBeDefined();
      }, 20);
    });
  });
});

describe('RenderOptimizer', () => {
  let optimizer: RenderOptimizer;

  beforeEach(() => {
    optimizer = new RenderOptimizer();
  });

  describe('Render Batching', () => {
    it('should batch multiple updates', (done) => {
      let renderCount = 0;
      const render = jest.fn(() => renderCount++);

      optimizer.batchUpdate('update1', render);
      optimizer.batchUpdate('update2', render);
      optimizer.batchUpdate('update3', render);

      // All updates should be batched into one render
      setTimeout(() => {
        expect(render).toHaveBeenCalledTimes(1);
        done();
      }, 20);
    });

    it('should debounce rapid updates', (done) => {
      const update = jest.fn();
      const debouncedUpdate = optimizer.debounce(update, 50);

      // Rapid calls
      debouncedUpdate();
      debouncedUpdate();
      debouncedUpdate();
      debouncedUpdate();

      // Should only execute once after delay
      setTimeout(() => {
        expect(update).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });

    it('should throttle continuous updates', (done) => {
      const update = jest.fn();
      const throttledUpdate = optimizer.throttle(update, 50);

      // Continuous calls
      const interval = setInterval(throttledUpdate, 10);

      setTimeout(() => {
        clearInterval(interval);
        // Should be called approximately every 50ms
        expect(update.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(update.mock.calls.length).toBeLessThanOrEqual(5);
        done();
      }, 200);
    });
  });

  describe('Render Prioritization', () => {
    it('should prioritize high priority updates', (done) => {
      const results: string[] = [];
      
      optimizer.scheduleUpdate('low', () => results.push('low'), 'low');
      optimizer.scheduleUpdate('high', () => results.push('high'), 'high');
      optimizer.scheduleUpdate('normal', () => results.push('normal'), 'normal');

      setTimeout(() => {
        expect(results).toEqual(['high', 'normal', 'low']);
        done();
      }, 50);
    });

    it('should use requestIdleCallback for low priority', () => {
      const idleCallback = jest.fn();
      optimizer.scheduleIdleTask(idleCallback);

      // Simulate idle time
      if (typeof requestIdleCallback !== 'undefined') {
        expect(idleCallback).not.toHaveBeenCalled(); // Not called immediately
      }
    });
  });

  describe('Render Caching', () => {
    it('should cache expensive computations', () => {
      let computeCount = 0;
      const expensiveCompute = (input: string) => {
        computeCount++;
        return input.toUpperCase();
      };

      const cached = optimizer.memoize(expensiveCompute);

      expect(cached('test')).toBe('TEST');
      expect(cached('test')).toBe('TEST'); // From cache
      expect(computeCount).toBe(1);

      expect(cached('other')).toBe('OTHER');
      expect(computeCount).toBe(2);
    });

    it('should invalidate cache when needed', () => {
      const compute = jest.fn((x: number) => x * 2);
      const cached = optimizer.memoize(compute);

      cached(5);
      cached(5);
      expect(compute).toHaveBeenCalledTimes(1);

      optimizer.invalidateCache(cached);
      cached(5);
      expect(compute).toHaveBeenCalledTimes(2);
    });
  });
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager();
  });

  describe('Memory Tracking', () => {
    it('should track object allocations', () => {
      const obj1 = { data: new Array(1000).fill('x') };
      const obj2 = { data: new Array(2000).fill('y') };

      memoryManager.track('obj1', obj1);
      memoryManager.track('obj2', obj2);

      const stats = memoryManager.getStats();
      expect(stats.trackedObjects).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should detect memory leaks', () => {
      // Simulate leak by not releasing references
      for (let i = 0; i < 100; i++) {
        memoryManager.track(`leak${i}`, new Array(1000).fill(i));
      }

      const leaks = memoryManager.detectLeaks();
      expect(leaks.potentialLeaks).toHaveLength(100);
    });

    it('should cleanup released objects', () => {
      const obj = { data: 'test' };
      memoryManager.track('temp', obj);
      
      memoryManager.release('temp');
      
      const stats = memoryManager.getStats();
      expect(stats.trackedObjects).toBe(0);
    });
  });

  describe('Memory Optimization', () => {
    it('should implement object pooling', () => {
      const pool = memoryManager.createPool('buffers', () => new ArrayBuffer(1024));
      
      const buffer1 = pool.acquire();
      const buffer2 = pool.acquire();
      
      expect(buffer1).toBeInstanceOf(ArrayBuffer);
      expect(buffer2).toBeInstanceOf(ArrayBuffer);
      expect(buffer1).not.toBe(buffer2);
      
      pool.release(buffer1);
      const buffer3 = pool.acquire();
      expect(buffer3).toBe(buffer1); // Reused from pool
    });

    it('should limit pool size', () => {
      const pool = memoryManager.createPool('limited', () => ({}), { maxSize: 2 });
      
      const obj1 = pool.acquire();
      const obj2 = pool.acquire();
      const obj3 = pool.acquire(); // Should create new, pool is full
      
      pool.release(obj1);
      pool.release(obj2);
      pool.release(obj3); // Should not be added to pool
      
      expect(pool.size()).toBe(2);
    });

    it('should garbage collect unused objects', () => {
      memoryManager.setGCThreshold(1000); // 1KB
      
      // Allocate memory
      for (let i = 0; i < 10; i++) {
        memoryManager.track(`gc${i}`, new Array(200).fill('x'));
      }
      
      // Mark some as unused
      for (let i = 0; i < 5; i++) {
        memoryManager.markUnused(`gc${i}`);
      }
      
      memoryManager.runGC();
      
      const stats = memoryManager.getStats();
      expect(stats.trackedObjects).toBe(5);
    });
  });

  describe('Memory Limits', () => {
    it('should enforce memory limits', () => {
      memoryManager.setMemoryLimit(10000); // 10KB limit
      
      const allocate = () => {
        for (let i = 0; i < 100; i++) {
          memoryManager.track(`alloc${i}`, new Array(1000).fill('x'));
        }
      };
      
      expect(allocate).toThrow('Memory limit exceeded');
    });

    it('should provide memory pressure warnings', () => {
      const warningCallback = jest.fn();
      memoryManager.onMemoryPressure(warningCallback);
      memoryManager.setMemoryLimit(10000);
      
      // Allocate 80% of limit
      memoryManager.track('large', new Array(8000).fill('x'));
      
      expect(warningCallback).toHaveBeenCalledWith(expect.objectContaining({
        usage: expect.any(Number),
        limit: 10000,
        percentage: expect.any(Number),
      }));
    });
  });
});

describe('VirtualScroller', () => {
  let scroller: VirtualScroller;

  beforeEach(() => {
    scroller = new VirtualScroller({
      itemHeight: 50,
      containerHeight: 500,
      totalItems: 1000,
    });
  });

  describe('Virtualization', () => {
    it('should calculate visible items', () => {
      const visible = scroller.getVisibleItems();
      expect(visible.startIndex).toBe(0);
      expect(visible.endIndex).toBe(10); // 500 / 50 = 10 items
      expect(visible.count).toBe(10);
    });

    it('should update visible range on scroll', () => {
      scroller.scrollTo(250); // Scroll down 5 items
      
      const visible = scroller.getVisibleItems();
      expect(visible.startIndex).toBe(5);
      expect(visible.endIndex).toBe(15);
    });

    it('should include buffer for smooth scrolling', () => {
      scroller.setBuffer(2); // 2 items above and below
      
      const visible = scroller.getVisibleItemsWithBuffer();
      expect(visible.startIndex).toBe(0); // Can't go below 0
      expect(visible.endIndex).toBe(12); // 10 visible + 2 buffer
    });

    it('should handle variable item heights', () => {
      const variableScroller = new VirtualScroller({
        getItemHeight: (index) => index % 2 === 0 ? 50 : 100,
        containerHeight: 500,
        totalItems: 100,
      });
      
      const visible = variableScroller.getVisibleItems();
      expect(visible.count).toBeGreaterThan(0);
      expect(visible.count).toBeLessThan(100);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeScroller = new VirtualScroller({
        itemHeight: 20,
        containerHeight: 500,
        totalItems: 100000,
      });
      
      const start = performance.now();
      largeScroller.scrollTo(50000);
      const visible = largeScroller.getVisibleItems();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10); // Should be very fast
      expect(visible.count).toBe(25); // 500 / 20
    });

    it('should cache position calculations', () => {
      const calculateSpy = jest.spyOn(scroller as any, 'calculatePositions');
      
      scroller.getItemPosition(100);
      scroller.getItemPosition(100); // Same item
      
      expect(calculateSpy).toHaveBeenCalledTimes(1);
    });

    it('should recycle DOM elements', () => {
      const pool = scroller.getElementPool();
      
      // Simulate scrolling
      scroller.scrollTo(0);
      const elements1 = scroller.getVisibleElements();
      
      scroller.scrollTo(1000);
      const elements2 = scroller.getVisibleElements();
      
      // Elements should be recycled from pool
      expect(pool.recycled).toBeGreaterThan(0);
    });
  });

  describe('Smooth Scrolling', () => {
    it('should support smooth scroll animations', (done) => {
      scroller.smoothScrollTo(500, {
        duration: 100,
        easing: 'ease-in-out',
      });
      
      setTimeout(() => {
        const position = scroller.getScrollPosition();
        expect(position).toBeCloseTo(500, 0);
        done();
      }, 150);
    });

    it('should handle scroll momentum', () => {
      scroller.applyMomentum(100); // Initial velocity
      
      const positions: number[] = [];
      for (let i = 0; i < 10; i++) {
        scroller.updateMomentum();
        positions.push(scroller.getScrollPosition());
      }
      
      // Positions should show deceleration
      for (let i = 1; i < positions.length; i++) {
        const delta = positions[i] - positions[i - 1];
        if (i > 1) {
          const prevDelta = positions[i - 1] - positions[i - 2];
          expect(delta).toBeLessThanOrEqual(prevDelta);
        }
      }
    });
  });
});