export type IndicatorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ToolOperationStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface Animation {
  name: string;
  type: 'spinner' | 'dots' | 'pulse' | 'custom';
  frames: string[];
  interval: number;
}

export interface StatusTransition {
  from: string;
  to: string;
  duration: number;
  frames: string[];
}

export interface ToolOperation {
  name: string;
  status: string;
  progress?: number;
  result?: ToolOperationStatus;
}

export class VisualIndicators {
  private streaming: boolean = false;
  private streamingProgress: number = 0;
  private error: { message: string; severity: IndicatorSeverity } | null = null;
  private toolOperations: Map<string, ToolOperation> = new Map();
  private statuses: Map<string, string> = new Map();

  // Streaming indicators
  getStreamingIndicator(): Animation {
    return {
      name: 'streaming',
      type: 'spinner',
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
    };
  }

  getTypingIndicator(): Animation {
    return {
      name: 'typing',
      type: 'dots',
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 100,
    };
  }

  startStreaming(): void {
    this.streaming = true;
    this.streamingProgress = 0;
  }

  stopStreaming(): void {
    this.streaming = false;
    this.streamingProgress = 100;
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  updateStreamingProgress(progress: number): void {
    this.streamingProgress = Math.max(0, Math.min(100, progress));
  }

  getStreamingProgress(): number {
    return this.streamingProgress;
  }

  // Error indicators
  setError(message: string, severity: IndicatorSeverity = 'error'): void {
    this.error = { message, severity };
  }

  clearError(): void {
    this.error = null;
  }

  hasError(): boolean {
    return this.error !== null;
  }

  getErrorMessage(): string | null {
    return this.error?.message || null;
  }

  getErrorIndicator(): string {
    if (!this.error) return '';
    
    switch (this.error.severity) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🚨';
    }
  }

  // Tool operation indicators
  startToolOperation(name: string, status: string): void {
    this.toolOperations.set(name, {
      name,
      status,
      progress: 0,
    });
  }

  updateToolProgress(name: string, progress: number, status?: string): void {
    const operation = this.toolOperations.get(name);
    if (operation) {
      operation.progress = progress;
      if (status) operation.status = status;
    }
  }

  completeToolOperation(name: string, result: ToolOperationStatus, status?: string): void {
    const operation = this.toolOperations.get(name);
    if (operation) {
      operation.result = result;
      operation.progress = 100;
      if (status) operation.status = status;
    }
    // Remove from active operations after completion
    setTimeout(() => this.toolOperations.delete(name), 1000);
  }

  hasActiveTools(): boolean {
    return this.toolOperations.size > 0 && 
           Array.from(this.toolOperations.values()).some(op => !op.result);
  }

  getActiveTools(): string[] {
    return Array.from(this.toolOperations.keys());
  }

  getToolStatus(name: string): string | undefined {
    return this.toolOperations.get(name)?.status;
  }

  getToolProgress(name: string): number | undefined {
    return this.toolOperations.get(name)?.progress;
  }

  getToolResult(name: string): ToolOperationStatus | undefined {
    return this.toolOperations.get(name)?.result;
  }

  getToolIcon(toolName: string): string {
    const icons: Record<string, string> = {
      'search': '🔍',
      'edit': '✏️',
      'delete': '🗑️',
      'compile': '🔨',
      'test': '🧪',
      'deploy': '🚀',
      'download': '⬇️',
      'upload': '⬆️',
      'refresh': '🔄',
      'save': '💾',
    };
    
    return icons[toolName] || '⚙️';
  }

  // Status transitions
  transitionStatus(from: string, to: string): StatusTransition {
    const transitions: Record<string, StatusTransition> = {
      'idle-loading': {
        from: 'idle',
        to: 'loading',
        duration: 300,
        frames: ['○', '◔', '◑', '◕', '●'],
      },
      'loading-idle': {
        from: 'loading',
        to: 'idle',
        duration: 300,
        frames: ['●', '◕', '◑', '◔', '○'],
      },
      'idle-error': {
        from: 'idle',
        to: 'error',
        duration: 200,
        frames: ['○', '⊗', '⊙', '⊛', '⊜', '❌'],
      },
      'loading-success': {
        from: 'loading',
        to: 'success',
        duration: 400,
        frames: ['●', '◉', '◎', '◌', '✓', '✅'],
      },
    };

    const key = `${from}-${to}`;
    return transitions[key] || {
      from,
      to,
      duration: 200,
      frames: [from, to],
    };
  }

  setStatus(key: string, value: string): void {
    this.statuses.set(key, value);
  }

  getStatus(key: string): string | undefined {
    return this.statuses.get(key);
  }
}

export class LoadingAnimations {
  private animations: Map<string, Animation> = new Map();
  private frameCount: number = 0;
  private lastFrameTime: number = Date.now();

  constructor() {
    this.initializeAnimations();
  }

  private initializeAnimations(): void {
    // Spinner animation
    this.animations.set('spinner', {
      name: 'spinner',
      type: 'spinner',
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
    });

    // Dots animation
    this.animations.set('dots', {
      name: 'dots',
      type: 'dots',
      frames: ['.', '..', '...', '....', '.....', '......'],
      interval: 200,
    });

    // Pulse animation
    this.animations.set('pulse', {
      name: 'pulse',
      type: 'pulse',
      frames: ['◯', '◔', '◑', '◕', '●', '◕', '◑', '◔'],
      interval: 150,
    });

    // Progress bar characters
    this.animations.set('progress', {
      name: 'progress',
      type: 'custom',
      frames: ['░', '▒', '▓', '█'],
      interval: 0,
    });
  }

  getSpinner(): Animation {
    return this.animations.get('spinner')!;
  }

  getDots(): Animation {
    return this.animations.get('dots')!;
  }

  getPulse(): Animation {
    return this.animations.get('pulse')!;
  }

  getProgressBar(current: number, total: number, width: number = 20): string {
    const percentage = current / total;
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.floor(percentage * 100)}%`;
  }

  getAnimation(name: string): Animation | undefined {
    return this.animations.get(name);
  }

  registerAnimation(animation: Animation): void {
    this.animations.set(animation.name, animation);
  }

  compose(animations: Animation[]): Animation {
    const frames: string[] = [];
    const maxFrames = Math.max(...animations.map(a => a.frames.length));
    
    for (let i = 0; i < maxFrames; i++) {
      const frame = animations
        .map(a => a.frames[i % a.frames.length])
        .join(' ');
      frames.push(frame);
    }

    return {
      name: 'composed',
      type: 'custom',
      frames,
      interval: Math.min(...animations.map(a => a.interval)),
    };
  }

  createFrameLimiter(targetFPS: number): { shouldRender: () => boolean } {
    const targetInterval = 1000 / targetFPS;
    let lastRenderTime = 0;

    return {
      shouldRender: () => {
        const now = Date.now();
        if (now - lastRenderTime >= targetInterval) {
          lastRenderTime = now;
          return true;
        }
        return false;
      },
    };
  }
}

export class StatusIndicators {
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private connectionQuality: number = 100;
  private inputMode: string = 'normal';
  private shortcutMode: string | null = null;
  private activities: Map<string, { id: string; label: string }> = new Map();
  private notifications: Map<string, number> = new Map();

  // Connection status
  setConnectionStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    this.connectionStatus = status;
  }

  getConnectionIndicator(): string {
    switch (this.connectionStatus) {
      case 'connected':
        return '🟢';
      case 'disconnected':
        return '🔴';
      case 'connecting':
        return '🟡';
    }
  }

  getConnectionLabel(): string {
    switch (this.connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
    }
  }

  updateConnectionQuality(quality: number): void {
    this.connectionQuality = Math.max(0, Math.min(100, quality));
  }

  getConnectionQuality(): string {
    if (this.connectionQuality >= 80) return 'excellent';
    if (this.connectionQuality >= 60) return 'good';
    if (this.connectionQuality >= 40) return 'fair';
    if (this.connectionQuality >= 20) return 'poor';
    return 'critical';
  }

  // Mode indicators
  setInputMode(mode: string): void {
    this.inputMode = mode;
  }

  getModeIndicator(): string {
    return this.inputMode.toUpperCase();
  }

  enterShortcutMode(mode: string): void {
    this.shortcutMode = mode;
  }

  exitShortcutMode(): void {
    this.shortcutMode = null;
  }

  isInShortcutMode(): boolean {
    return this.shortcutMode !== null;
  }

  getShortcutModeIndicator(): string {
    return this.shortcutMode?.toUpperCase() || '';
  }

  // Activity indicators
  addActivity(id: string, label: string): void {
    this.activities.set(id, { id, label });
  }

  removeActivity(id: string): void {
    this.activities.delete(id);
  }

  getActiveActivities(): Array<{ id: string; label: string }> {
    return Array.from(this.activities.values());
  }

  getActivitySummary(): string {
    const count = this.activities.size;
    if (count === 0) return '';
    if (count === 1) return '1 activity';
    return `${count} activities`;
  }

  // Notification badges
  setNotificationCount(type: string, count: number): void {
    if (count === 0) {
      this.notifications.delete(type);
    } else {
      this.notifications.set(type, count);
    }
  }

  getNotificationBadge(type: string): string {
    const count = this.notifications.get(type);
    if (!count || count === 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  }

  clearNotifications(type: string): void {
    this.notifications.delete(type);
  }
}