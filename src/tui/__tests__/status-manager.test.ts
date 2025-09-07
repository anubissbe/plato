/**
 * Tests for StatusManager component
 * Validates conversation state tracking, metrics display, and progress indicators
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StatusManager, ConversationState, StatusMetrics } from '../status-manager.js';
import { EventEmitter } from 'events';

describe('StatusManager', () => {
  let statusManager: StatusManager;
  let mockEventEmitter: EventEmitter;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    statusManager = new StatusManager(mockEventEmitter);
  });

  describe('Conversation State Tracking', () => {
    it('should initialize with idle state', () => {
      const state = statusManager.getState();
      expect(state).toBe('idle');
    });

    it('should transition to streaming state when response starts', () => {
      statusManager.startStreaming();
      expect(statusManager.getState()).toBe('streaming');
    });

    it('should track streaming progress with character count', () => {
      statusManager.startStreaming();
      statusManager.updateStreamProgress(100, 500); // 100 chars of estimated 500
      
      const metrics = statusManager.getMetrics();
      expect(metrics.streamProgress).toBe(20); // 20% complete
      expect(metrics.charactersStreamed).toBe(100);
    });

    it('should transition to processing state for tool calls', () => {
      statusManager.startToolCall('fs_read', { path: '/test.txt' });
      expect(statusManager.getState()).toBe('processing');
      
      const metrics = statusManager.getMetrics();
      expect(metrics.activeToolCall).toBe('fs_read');
    });

    it('should track multiple tool calls in sequence', () => {
      statusManager.startToolCall('fs_read', { path: '/file1.txt' });
      statusManager.endToolCall('fs_read', { success: true });
      statusManager.startToolCall('fs_write', { path: '/file2.txt' });
      
      const metrics = statusManager.getMetrics();
      expect(metrics.toolCallHistory).toHaveLength(1);
      expect(metrics.activeToolCall).toBe('fs_write');
    });

    it('should handle error states appropriately', () => {
      statusManager.setError('Network timeout');
      expect(statusManager.getState()).toBe('error');
      
      const metrics = statusManager.getMetrics();
      expect(metrics.lastError).toBe('Network timeout');
    });

    it('should reset to idle after completion', () => {
      statusManager.startStreaming();
      statusManager.complete();
      expect(statusManager.getState()).toBe('idle');
    });
  });

  describe('Metrics Tracking', () => {
    it('should track token usage metrics', () => {
      statusManager.updateTokens(150, 50); // 150 input, 50 output
      
      const metrics = statusManager.getMetrics();
      expect(metrics.inputTokens).toBe(150);
      expect(metrics.outputTokens).toBe(50);
      expect(metrics.totalTokens).toBe(200);
    });

    it('should calculate response time accurately', async () => {
      statusManager.startStreaming();
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      statusManager.complete();
      const metrics = statusManager.getMetrics();
      
      expect(metrics.responseTime).toBeGreaterThan(90);
      expect(metrics.responseTime).toBeLessThan(150);
    });

    it('should track memory usage', () => {
      const memoryUsage = {
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 150 * 1024 * 1024 // 150MB
      };
      
      statusManager.updateMemoryUsage(memoryUsage);
      const metrics = statusManager.getMetrics();
      
      expect(metrics.memoryUsageMB).toBeCloseTo(50, 1);
      expect(metrics.memoryPercentage).toBeCloseTo(50, 1);
    });

    it('should track session statistics', () => {
      statusManager.incrementTurn();
      statusManager.updateTokens(100, 50);
      statusManager.incrementTurn();
      statusManager.updateTokens(150, 75);
      
      const metrics = statusManager.getMetrics();
      expect(metrics.sessionTurns).toBe(2);
      expect(metrics.sessionTokens).toBe(375); // 100+50+150+75
    });

    it('should calculate average response time', () => {
      statusManager.recordResponseTime(1000);
      statusManager.recordResponseTime(2000);
      statusManager.recordResponseTime(1500);
      
      const metrics = statusManager.getMetrics();
      expect(metrics.averageResponseTime).toBe(1500);
    });
  });

  describe('Event Emission', () => {
    it('should emit state change events', (done) => {
      mockEventEmitter.on('status:stateChange', (data) => {
        expect(data.oldState).toBe('idle');
        expect(data.newState).toBe('streaming');
        done();
      });
      
      statusManager.startStreaming();
    });

    it('should emit metrics update events', (done) => {
      mockEventEmitter.on('status:metricsUpdate', (metrics) => {
        expect(metrics.inputTokens).toBe(100);
        expect(metrics.outputTokens).toBe(50);
        done();
      });
      
      statusManager.updateTokens(100, 50);
    });

    it('should emit progress events during streaming', (done) => {
      mockEventEmitter.on('status:progress', (data) => {
        expect(data.percentage).toBe(50);
        expect(data.current).toBe(250);
        expect(data.total).toBe(500);
        done();
      });
      
      statusManager.startStreaming();
      statusManager.updateStreamProgress(250, 500);
    });

    it('should emit tool call events', (done) => {
      mockEventEmitter.on('status:toolCall', (data) => {
        expect(data.tool).toBe('fs_read');
        expect(data.status).toBe('start');
        done();
      });
      
      statusManager.startToolCall('fs_read', { path: '/test.txt' });
    });

    it('should emit error events', (done) => {
      mockEventEmitter.on('status:error', (data) => {
        expect(data.message).toBe('Connection failed');
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      statusManager.setError('Connection failed');
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate percentage for known total', () => {
      const progress = statusManager.calculateProgress(50, 200);
      expect(progress).toBe(25);
    });

    it('should handle zero total gracefully', () => {
      const progress = statusManager.calculateProgress(50, 0);
      expect(progress).toBe(0);
    });

    it('should cap progress at 100%', () => {
      const progress = statusManager.calculateProgress(250, 200);
      expect(progress).toBe(100);
    });

    it('should provide indeterminate progress indicator', () => {
      statusManager.setIndeterminateProgress(true);
      const metrics = statusManager.getMetrics();
      expect(metrics.indeterminateProgress).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should allow configuration of update intervals', () => {
      const config = {
        metricsUpdateInterval: 1000,
        progressUpdateInterval: 100,
        memoryCheckInterval: 5000
      };
      
      statusManager.configure(config);
      const returnedConfig = statusManager.getConfig();
      expect(returnedConfig.metricsUpdateInterval).toBe(1000);
      expect(returnedConfig.progressUpdateInterval).toBe(100);
      expect(returnedConfig.memoryCheckInterval).toBe(5000);
    });

    it('should respect disabled metrics collection', () => {
      statusManager.configure({ collectMetrics: false });
      statusManager.updateTokens(100, 50);
      
      const metrics = statusManager.getMetrics();
      expect(metrics.inputTokens).toBe(0);
      expect(metrics.outputTokens).toBe(0);
    });

    it('should allow custom metric formatters', () => {
      const formatter = (value: number) => `${value.toFixed(2)}`;
      statusManager.setMetricFormatter('responseTime', formatter);
      
      const formatted = statusManager.getFormattedMetric('responseTime', 1234.5678);
      expect(formatted).toBe('1234.57');
    });
  });

  describe('History Management', () => {
    it('should maintain conversation turn history', () => {
      statusManager.startTurn('user', 'Hello');
      statusManager.endTurn('assistant', 'Hi there');
      statusManager.startTurn('user', 'How are you?');
      statusManager.endTurn('assistant', 'I am doing well');
      
      const history = statusManager.getTurnHistory();
      expect(history).toHaveLength(2);
      expect(history[0].userMessage).toBe('Hello');
      expect(history[1].assistantResponse).toBe('I am doing well');
    });

    it('should limit history size to prevent memory leaks', () => {
      // Add 150 turns (default limit is 100)
      for (let i = 0; i < 150; i++) {
        statusManager.startTurn('user', `Message ${i}`);
        statusManager.endTurn('assistant', `Response ${i}`);
      }
      
      const history = statusManager.getTurnHistory();
      expect(history).toHaveLength(100);
      expect(history[0].userMessage).toBe('Message 50'); // First 50 should be pruned
    });

    it('should clear history on demand', () => {
      statusManager.startTurn('user', 'Hello');
      statusManager.endTurn('assistant', 'Hi');
      
      statusManager.clearHistory();
      const history = statusManager.getTurnHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('should serialize state for persistence', () => {
      statusManager.updateTokens(100, 50);
      statusManager.startStreaming();
      
      const serialized = statusManager.serialize();
      expect(serialized).toHaveProperty('state');
      expect(serialized).toHaveProperty('metrics');
      expect(serialized).toHaveProperty('history');
      expect(serialized.state).toBe('streaming');
      expect(serialized.metrics.totalTokens).toBe(150);
    });

    it('should restore from serialized state', () => {
      const savedState = {
        state: 'idle' as ConversationState,
        metrics: {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          sessionTurns: 5
        } as StatusMetrics,
        history: []
      };
      
      statusManager.restore(savedState);
      const metrics = statusManager.getMetrics();
      
      expect(statusManager.getState()).toBe('idle');
      expect(metrics.totalTokens).toBe(300);
      expect(metrics.sessionTurns).toBe(5);
    });
  });
});