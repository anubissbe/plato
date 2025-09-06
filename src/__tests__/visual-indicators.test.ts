import { VisualIndicators, LoadingAnimations, StatusIndicators } from '../tui/VisualIndicators';

describe('VisualIndicators', () => {
  let indicators: VisualIndicators;

  beforeEach(() => {
    indicators = new VisualIndicators();
  });

  describe('Streaming Indicators', () => {
    it('should show streaming animation', () => {
      const animation = indicators.getStreamingIndicator();
      expect(animation).toBeDefined();
      expect(animation.frames).toBeInstanceOf(Array);
      expect(animation.frames.length).toBeGreaterThan(0);
    });

    it('should update streaming progress', () => {
      indicators.startStreaming();
      expect(indicators.isStreaming()).toBe(true);

      // Simulate progress updates
      for (let i = 0; i <= 100; i += 10) {
        indicators.updateStreamingProgress(i);
        expect(indicators.getStreamingProgress()).toBe(i);
      }

      indicators.stopStreaming();
      expect(indicators.isStreaming()).toBe(false);
    });

    it('should provide typing indicator', () => {
      const typing = indicators.getTypingIndicator();
      expect(typing.frames).toContain('⠋');
      expect(typing.frames).toContain('⠙');
      expect(typing.frames).toContain('⠹');
    });
  });

  describe('Error Indicators', () => {
    it('should show error state', () => {
      indicators.setError('Connection failed');
      expect(indicators.hasError()).toBe(true);
      expect(indicators.getErrorMessage()).toBe('Connection failed');
      expect(indicators.getErrorIndicator()).toBe('❌');
    });

    it('should clear error state', () => {
      indicators.setError('Some error');
      indicators.clearError();
      
      expect(indicators.hasError()).toBe(false);
      expect(indicators.getErrorMessage()).toBeNull();
    });

    it('should support error severity levels', () => {
      indicators.setError('Warning', 'warning');
      expect(indicators.getErrorIndicator()).toBe('⚠️');

      indicators.setError('Critical', 'critical');
      expect(indicators.getErrorIndicator()).toBe('🚨');

      indicators.setError('Info', 'info');
      expect(indicators.getErrorIndicator()).toBe('ℹ️');
    });
  });

  describe('Tool Operation Indicators', () => {
    it('should track tool operations', () => {
      indicators.startToolOperation('search', 'Searching for files...');
      
      expect(indicators.hasActiveTools()).toBe(true);
      expect(indicators.getActiveTools()).toContain('search');
      expect(indicators.getToolStatus('search')).toBe('Searching for files...');
    });

    it('should update tool progress', () => {
      indicators.startToolOperation('compile', 'Compiling...');
      indicators.updateToolProgress('compile', 50, 'Half way done');

      const progress = indicators.getToolProgress('compile');
      expect(progress).toBe(50);
      expect(indicators.getToolStatus('compile')).toBe('Half way done');
    });

    it('should complete tool operations', () => {
      indicators.startToolOperation('test', 'Running tests...');
      indicators.completeToolOperation('test', 'success', 'All tests passed');

      expect(indicators.hasActiveTools()).toBe(false);
      expect(indicators.getToolResult('test')).toBe('success');
      expect(indicators.getToolStatus('test')).toBe('All tests passed');
    });

    it('should provide tool-specific icons', () => {
      expect(indicators.getToolIcon('search')).toBe('🔍');
      expect(indicators.getToolIcon('edit')).toBe('✏️');
      expect(indicators.getToolIcon('delete')).toBe('🗑️');
      expect(indicators.getToolIcon('compile')).toBe('🔨');
      expect(indicators.getToolIcon('test')).toBe('🧪');
    });
  });

  describe('Status Transitions', () => {
    it('should animate status transitions', () => {
      const transition = indicators.transitionStatus('idle', 'loading');
      
      expect(transition).toBeDefined();
      expect(transition.duration).toBeGreaterThan(0);
      expect(transition.frames).toBeInstanceOf(Array);
    });

    it('should support multiple concurrent statuses', () => {
      indicators.setStatus('primary', 'loading');
      indicators.setStatus('secondary', 'idle');

      expect(indicators.getStatus('primary')).toBe('loading');
      expect(indicators.getStatus('secondary')).toBe('idle');
    });
  });
});

describe('LoadingAnimations', () => {
  let animations: LoadingAnimations;

  beforeEach(() => {
    animations = new LoadingAnimations();
  });

  describe('Animation Types', () => {
    it('should provide spinner animation', () => {
      const spinner = animations.getSpinner();
      expect(spinner.type).toBe('spinner');
      expect(spinner.frames).toContain('⠋');
      expect(spinner.interval).toBeGreaterThan(0);
    });

    it('should provide progress bar animation', () => {
      const progressBar = animations.getProgressBar(50, 100);
      expect(progressBar).toContain('█');
      expect(progressBar).toContain('░');
    });

    it('should provide dots animation', () => {
      const dots = animations.getDots();
      expect(dots.frames).toContain('.');
      expect(dots.frames).toContain('..');
      expect(dots.frames).toContain('...');
    });

    it('should provide pulse animation', () => {
      const pulse = animations.getPulse();
      expect(pulse.frames).toContain('◯');
      expect(pulse.frames).toContain('●');
    });
  });

  describe('Custom Animations', () => {
    it('should register custom animations', () => {
      const customAnimation = {
        name: 'custom',
        type: 'custom' as const,
        frames: ['frame1', 'frame2', 'frame3'],
        interval: 100,
      };

      animations.registerAnimation(customAnimation);
      expect(animations.getAnimation('custom')).toEqual(customAnimation);
    });

    it('should support animation composition', () => {
      const composed = animations.compose([
        animations.getSpinner(),
        animations.getDots(),
      ]);

      expect(composed.frames.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should limit frame rate', () => {
      const animation = animations.getSpinner();
      const limiter = animations.createFrameLimiter(30); // 30 FPS

      const startTime = Date.now();
      let frameCount = 0;

      // Run for 100ms
      while (Date.now() - startTime < 100) {
        if (limiter.shouldRender()) {
          frameCount++;
        }
      }

      // Should be approximately 3 frames at 30 FPS
      expect(frameCount).toBeLessThanOrEqual(4);
      expect(frameCount).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('StatusIndicators', () => {
  let status: StatusIndicators;

  beforeEach(() => {
    status = new StatusIndicators();
  });

  describe('Connection Status', () => {
    it('should indicate connection states', () => {
      status.setConnectionStatus('connected');
      expect(status.getConnectionIndicator()).toBe('🟢');
      expect(status.getConnectionLabel()).toBe('Connected');

      status.setConnectionStatus('disconnected');
      expect(status.getConnectionIndicator()).toBe('🔴');
      expect(status.getConnectionLabel()).toBe('Disconnected');

      status.setConnectionStatus('connecting');
      expect(status.getConnectionIndicator()).toBe('🟡');
      expect(status.getConnectionLabel()).toBe('Connecting...');
    });

    it('should track connection quality', () => {
      status.updateConnectionQuality(100);
      expect(status.getConnectionQuality()).toBe('excellent');

      status.updateConnectionQuality(50);
      expect(status.getConnectionQuality()).toBe('fair');

      status.updateConnectionQuality(10);
      expect(status.getConnectionQuality()).toBe('critical');
    });
  });

  describe('Mode Indicators', () => {
    it('should show current input mode', () => {
      status.setInputMode('normal');
      expect(status.getModeIndicator()).toBe('NORMAL');

      status.setInputMode('insert');
      expect(status.getModeIndicator()).toBe('INSERT');

      status.setInputMode('command');
      expect(status.getModeIndicator()).toBe('COMMAND');

      status.setInputMode('visual');
      expect(status.getModeIndicator()).toBe('VISUAL');
    });

    it('should indicate keyboard shortcut mode', () => {
      status.enterShortcutMode('ctrl');
      expect(status.isInShortcutMode()).toBe(true);
      expect(status.getShortcutModeIndicator()).toBe('CTRL');

      status.exitShortcutMode();
      expect(status.isInShortcutMode()).toBe(false);
    });
  });

  describe('Activity Indicators', () => {
    it('should track active processes', () => {
      status.addActivity('saving', 'Saving file...');
      status.addActivity('compiling', 'Compiling code...');

      const activities = status.getActiveActivities();
      expect(activities).toHaveLength(2);
      expect(activities).toContainEqual({
        id: 'saving',
        label: 'Saving file...',
      });

      status.removeActivity('saving');
      expect(status.getActiveActivities()).toHaveLength(1);
    });

    it('should provide activity summary', () => {
      status.addActivity('task1', 'Task 1');
      status.addActivity('task2', 'Task 2');

      const summary = status.getActivitySummary();
      expect(summary).toBe('2 activities');
    });
  });

  describe('Notification Badges', () => {
    it('should display notification counts', () => {
      status.setNotificationCount('messages', 5);
      expect(status.getNotificationBadge('messages')).toBe('5');

      status.setNotificationCount('errors', 0);
      expect(status.getNotificationBadge('errors')).toBe('');

      status.setNotificationCount('warnings', 99);
      expect(status.getNotificationBadge('warnings')).toBe('99');

      status.setNotificationCount('updates', 100);
      expect(status.getNotificationBadge('updates')).toBe('99+');
    });

    it('should clear notifications', () => {
      status.setNotificationCount('messages', 5);
      status.clearNotifications('messages');
      expect(status.getNotificationBadge('messages')).toBe('');
    });
  });
});