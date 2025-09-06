/**
 * Mouse Preferences Persistence
 * Handles session persistence and cross-session state management for mouse settings
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { MouseSettings } from '../config/mouse-settings.js';
import type { MouseEvent, MouseCoordinates } from '../tui/mouse-types.js';

/**
 * Session mouse preferences
 */
export interface MouseSessionPreferences {
  /** Last known mouse position */
  lastPosition?: MouseCoordinates;
  /** User proficiency level */
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced';
  /** Feature usage statistics */
  featureUsage: Record<string, number>;
  /** Last active timestamp */
  lastActive: string;
  /** Session start time */
  sessionStart: string;
  /** Total mouse events in session */
  totalEvents: number;
  /** Dismissed guidance messages */
  dismissedGuidance: string[];
  /** User preferences learned from behavior */
  learnedPreferences: Partial<MouseSettings>;
  /** Performance metrics */
  performanceMetrics: {
    averageResponseTime: number;
    errorRate: number;
    doubleClickAccuracy: number;
    dragAccuracy: number;
  };
}

/**
 * Cross-session mouse history
 */
export interface MouseHistoryEntry {
  /** Session identifier */
  sessionId: string;
  /** Session timestamp */
  timestamp: string;
  /** Settings used in session */
  settings: MouseSettings;
  /** Performance metrics */
  metrics: MouseSessionPreferences['performanceMetrics'];
  /** Feature usage count */
  featureUsage: Record<string, number>;
  /** Session duration in milliseconds */
  duration: number;
}

/**
 * Mouse preferences storage
 */
export interface MousePreferencesStorage {
  /** Current session preferences */
  session: MouseSessionPreferences;
  /** Historical data across sessions */
  history: MouseHistoryEntry[];
  /** Global learned preferences */
  globalPreferences: Partial<MouseSettings>;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Version for migration compatibility */
  version: string;
}

/**
 * Default session preferences
 */
const DEFAULT_SESSION_PREFERENCES: MouseSessionPreferences = {
  proficiencyLevel: 'beginner',
  featureUsage: {},
  lastActive: new Date().toISOString(),
  sessionStart: new Date().toISOString(),
  totalEvents: 0,
  dismissedGuidance: [],
  learnedPreferences: {},
  performanceMetrics: {
    averageResponseTime: 0,
    errorRate: 0,
    doubleClickAccuracy: 0,
    dragAccuracy: 0,
  },
};

/**
 * Mouse Preferences Manager
 */
export class MousePreferencesManager {
  private readonly preferencesPath: string;
  private readonly sessionPath: string;
  private storage: MousePreferencesStorage;
  private sessionId: string;
  private eventBuffer: MouseEvent[] = [];
  private lastSaveTime: number = 0;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(configDir?: string) {
    const baseDir = configDir || join(homedir(), '.config', 'plato');
    this.preferencesPath = join(baseDir, 'mouse-preferences.json');
    this.sessionPath = join(baseDir, 'mouse-session.json');
    this.sessionId = this.generateSessionId();
    
    this.storage = this.loadStorage();
    this.startAutoSave();
  }

  /**
   * Load preferences from storage
   */
  loadPreferences(): MouseSessionPreferences {
    return { ...this.storage.session };
  }

  /**
   * Save current preferences
   */
  savePreferences(preferences?: Partial<MouseSessionPreferences>): void {
    if (preferences) {
      this.storage.session = {
        ...this.storage.session,
        ...preferences,
        lastActive: new Date().toISOString(),
      };
    }
    
    this.saveStorage();
  }

  /**
   * Update preferences with partial data
   */
  updatePreferences(updates: Partial<MouseSessionPreferences>): void {
    this.storage.session = {
      ...this.storage.session,
      ...updates,
      lastActive: new Date().toISOString(),
    };
    
    this.debouncedSave();
  }

  /**
   * Record mouse event for learning and metrics
   */
  recordMouseEvent(event: MouseEvent): void {
    this.eventBuffer.push(event);
    this.storage.session.totalEvents++;
    this.storage.session.lastPosition = event.coordinates;
    this.storage.session.lastActive = new Date(event.timestamp).toISOString();
    
    // Update feature usage
    this.updateFeatureUsage(event);
    
    // Update proficiency level
    this.updateProficiencyLevel();
    
    // Process events periodically
    if (this.eventBuffer.length >= 10) {
      this.processEventBuffer();
    }
    
    this.debouncedSave();
  }

  /**
   * Mark guidance message as dismissed
   */
  dismissGuidance(guidanceId: string): void {
    if (!this.storage.session.dismissedGuidance.includes(guidanceId)) {
      this.storage.session.dismissedGuidance.push(guidanceId);
      this.debouncedSave();
    }
  }

  /**
   * Check if guidance was dismissed
   */
  isGuidanceDismissed(guidanceId: string): boolean {
    return this.storage.session.dismissedGuidance.includes(guidanceId);
  }

  /**
   * Learn preferences from user behavior
   */
  learnFromBehavior(behaviorData: {
    featureUsage: Record<string, number>;
    errorPatterns: string[];
    successPatterns: string[];
  }): Partial<MouseSettings> {
    const learned: Partial<MouseSettings> = {};
    
    // Learn double-click speed preference
    if (behaviorData.featureUsage['double_click_success'] && 
        behaviorData.featureUsage['double_click_failure']) {
      const successRate = behaviorData.featureUsage['double_click_success'] / 
        (behaviorData.featureUsage['double_click_success'] + behaviorData.featureUsage['double_click_failure']);
      
      if (successRate < 0.7) {
        learned.doubleClickSpeed = Math.min(800, (this.storage.session.learnedPreferences.doubleClickSpeed || 500) + 100);
      }
    }
    
    // Learn drag threshold preference
    if (behaviorData.errorPatterns.includes('accidental_drag')) {
      learned.dragThreshold = Math.min(10, (this.storage.session.learnedPreferences.dragThreshold || 3) + 1);
    }
    
    // Learn hover delay preference  
    if (behaviorData.errorPatterns.includes('tooltip_interference')) {
      learned.hoverDelay = Math.min(1000, (this.storage.session.learnedPreferences.hoverDelay || 100) + 100);
    }
    
    // Update learned preferences
    this.storage.session.learnedPreferences = {
      ...this.storage.session.learnedPreferences,
      ...learned,
    };
    
    this.debouncedSave();
    return learned;
  }

  /**
   * Get recommended settings based on learning
   */
  getRecommendedSettings(): Partial<MouseSettings> {
    const global = this.storage.globalPreferences;
    const session = this.storage.session.learnedPreferences;
    
    // Combine global and session learned preferences
    const recommended = { ...global, ...session };
    
    // Apply proficiency-based recommendations
    if (this.storage.session.proficiencyLevel === 'beginner') {
      recommended.hoverDelay = Math.max(recommended.hoverDelay || 100, 200);
      recommended.doubleClickSpeed = Math.max(recommended.doubleClickSpeed || 500, 600);
    } else if (this.storage.session.proficiencyLevel === 'advanced') {
      recommended.hoverDelay = Math.min(recommended.hoverDelay || 100, 50);
      recommended.doubleClickSpeed = Math.min(recommended.doubleClickSpeed || 500, 300);
    }
    
    return recommended;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    duration: number;
    totalEvents: number;
    eventsPerMinute: number;
    featureUsage: Record<string, number>;
    proficiencyLevel: string;
    performanceMetrics: MouseSessionPreferences['performanceMetrics'];
  } {
    const sessionStart = new Date(this.storage.session.sessionStart).getTime();
    const now = Date.now();
    const duration = now - sessionStart;
    const minutes = duration / (1000 * 60);
    
    return {
      duration,
      totalEvents: this.storage.session.totalEvents,
      eventsPerMinute: minutes > 0 ? this.storage.session.totalEvents / minutes : 0,
      featureUsage: { ...this.storage.session.featureUsage },
      proficiencyLevel: this.storage.session.proficiencyLevel,
      performanceMetrics: { ...this.storage.session.performanceMetrics },
    };
  }

  /**
   * Get historical usage patterns
   */
  getUsageHistory(days: number = 30): MouseHistoryEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.storage.history.filter(entry => 
      new Date(entry.timestamp) > cutoffDate
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * End current session and save to history
   */
  endSession(): void {
    const sessionEnd = Date.now();
    const sessionStart = new Date(this.storage.session.sessionStart).getTime();
    
    // Process any remaining events
    if (this.eventBuffer.length > 0) {
      this.processEventBuffer();
    }
    
    // Create history entry
    const historyEntry: MouseHistoryEntry = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      settings: this.storage.session.learnedPreferences as MouseSettings,
      metrics: { ...this.storage.session.performanceMetrics },
      featureUsage: { ...this.storage.session.featureUsage },
      duration: sessionEnd - sessionStart,
    };
    
    // Add to history
    this.storage.history.push(historyEntry);
    
    // Trim history to last 100 sessions
    if (this.storage.history.length > 100) {
      this.storage.history = this.storage.history.slice(-100);
    }
    
    // Update global preferences from session learning
    this.updateGlobalPreferences();
    
    // Save final state
    this.saveStorage();
    
    // Stop auto-save
    this.stopAutoSave();
  }

  /**
   * Reset session data (for testing or new session)
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.storage.session = {
      ...DEFAULT_SESSION_PREFERENCES,
      sessionStart: new Date().toISOString(),
    };
    this.eventBuffer = [];
    this.saveStorage();
  }

  /**
   * Clear all stored data
   */
  clearAllData(): void {
    this.storage = {
      session: { ...DEFAULT_SESSION_PREFERENCES },
      history: [],
      globalPreferences: {},
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };
    this.eventBuffer = [];
    this.saveStorage();
  }

  /**
   * Load storage from disk
   */
  private loadStorage(): MousePreferencesStorage {
    let storage: MousePreferencesStorage;
    
    try {
      if (existsSync(this.preferencesPath)) {
        const content = readFileSync(this.preferencesPath, 'utf-8');
        storage = JSON.parse(content);
        
        // Migrate if necessary
        storage = this.migrateStorage(storage);
      } else {
        storage = this.createDefaultStorage();
      }
    } catch (error) {
      console.warn('Failed to load mouse preferences:', error);
      storage = this.createDefaultStorage();
    }
    
    // Load session preferences separately
    try {
      if (existsSync(this.sessionPath)) {
        const sessionContent = readFileSync(this.sessionPath, 'utf-8');
        const sessionData = JSON.parse(sessionContent);
        storage.session = { ...storage.session, ...sessionData };
      }
    } catch (error) {
      console.warn('Failed to load session preferences:', error);
    }
    
    return storage;
  }

  /**
   * Save storage to disk
   */
  private saveStorage(): void {
    try {
      // Ensure directory exists
      const dir = dirname(this.preferencesPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // Update timestamp
      this.storage.lastUpdated = new Date().toISOString();
      
      // Save main preferences
      writeFileSync(
        this.preferencesPath,
        JSON.stringify(this.storage, null, 2),
        'utf-8'
      );
      
      // Save session separately for faster access
      writeFileSync(
        this.sessionPath,
        JSON.stringify(this.storage.session, null, 2),
        'utf-8'
      );
      
      this.lastSaveTime = Date.now();
    } catch (error) {
      console.error('Failed to save mouse preferences:', error);
    }
  }

  /**
   * Debounced save to avoid excessive disk writes
   */
  private debouncedSave(): void {
    const now = Date.now();
    if (now - this.lastSaveTime > 5000) { // Save at most every 5 seconds
      this.saveStorage();
    }
  }

  /**
   * Create default storage structure
   */
  private createDefaultStorage(): MousePreferencesStorage {
    return {
      session: { ...DEFAULT_SESSION_PREFERENCES },
      history: [],
      globalPreferences: {},
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Migrate storage format if needed
   */
  private migrateStorage(storage: any): MousePreferencesStorage {
    // Handle version migrations here
    if (!storage.version) {
      storage.version = '1.0.0';
    }
    
    // Ensure all required fields exist
    if (!storage.session) {
      storage.session = { ...DEFAULT_SESSION_PREFERENCES };
    }
    if (!storage.history) {
      storage.history = [];
    }
    if (!storage.globalPreferences) {
      storage.globalPreferences = {};
    }
    
    return storage;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update feature usage from mouse event
   */
  private updateFeatureUsage(event: MouseEvent): void {
    const featureMap: Record<string, string> = {
      click: 'click',
      drag_start: 'drag',
      drag: 'drag',
      drag_end: 'drag',
      scroll: 'scroll',
      hover: 'hover',
    };
    
    const feature = featureMap[event.type];
    if (feature) {
      this.storage.session.featureUsage[feature] = 
        (this.storage.session.featureUsage[feature] || 0) + 1;
    }
    
    // Track button usage
    this.storage.session.featureUsage[`button_${event.button}`] = 
      (this.storage.session.featureUsage[`button_${event.button}`] || 0) + 1;
  }

  /**
   * Update user proficiency level based on usage patterns
   */
  private updateProficiencyLevel(): void {
    const usage = this.storage.session.featureUsage;
    const totalEvents = this.storage.session.totalEvents;
    
    // Count distinct feature types used
    const featuresUsed = Object.keys(usage).filter(key => 
      !key.startsWith('button_') && usage[key] > 0
    ).length;
    
    // Determine proficiency
    if (totalEvents > 100 && featuresUsed >= 4) {
      this.storage.session.proficiencyLevel = 'advanced';
    } else if (totalEvents > 20 && featuresUsed >= 2) {
      this.storage.session.proficiencyLevel = 'intermediate';
    } else {
      this.storage.session.proficiencyLevel = 'beginner';
    }
  }

  /**
   * Process buffered events for metrics calculation
   */
  private processEventBuffer(): void {
    if (this.eventBuffer.length === 0) return;
    
    // Calculate response times
    const responseTimes = this.calculateResponseTimes();
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      this.storage.session.performanceMetrics.averageResponseTime = 
        (this.storage.session.performanceMetrics.averageResponseTime + avgResponseTime) / 2;
    }
    
    // Calculate accuracy metrics
    this.calculateAccuracyMetrics();
    
    // Clear buffer
    this.eventBuffer = [];
  }

  /**
   * Calculate response times from event buffer
   */
  private calculateResponseTimes(): number[] {
    const times: number[] = [];
    
    for (let i = 1; i < this.eventBuffer.length; i++) {
      const timeDiff = this.eventBuffer[i].timestamp - this.eventBuffer[i - 1].timestamp;
      if (timeDiff > 0 && timeDiff < 5000) { // Ignore very long pauses
        times.push(timeDiff);
      }
    }
    
    return times;
  }

  /**
   * Calculate accuracy metrics from events
   */
  private calculateAccuracyMetrics(): void {
    // This would analyze event patterns to determine accuracy
    // For now, use placeholder calculations
    const clickEvents = this.eventBuffer.filter(e => e.type === 'click');
    const dragEvents = this.eventBuffer.filter(e => e.type.startsWith('drag'));
    
    // Simplified accuracy calculations
    this.storage.session.performanceMetrics.doubleClickAccuracy = 
      Math.min(1.0, clickEvents.length / Math.max(1, this.eventBuffer.length));
    
    this.storage.session.performanceMetrics.dragAccuracy = 
      Math.min(1.0, dragEvents.length / Math.max(1, this.eventBuffer.length));
  }

  /**
   * Update global preferences from session data
   */
  private updateGlobalPreferences(): void {
    // Merge session learnings into global preferences with weight decay
    const sessionLearned = this.storage.session.learnedPreferences;
    const global = this.storage.globalPreferences;
    
    for (const [key, value] of Object.entries(sessionLearned)) {
      if (typeof value === 'number' && typeof global[key as keyof MouseSettings] === 'number') {
        // Average with existing global preference
        (global as any)[key] = ((global as any)[key] + value) / 2;
      } else {
        // Direct assignment for non-numeric values
        (global as any)[key] = value;
      }
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.debouncedSave();
    }, 30000); // Auto-save every 30 seconds
  }

  /**
   * Stop auto-save interval
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
}

/**
 * Create mouse preferences manager instance
 */
export function createMousePreferencesManager(
  configDir?: string
): MousePreferencesManager {
  return new MousePreferencesManager(configDir);
}

/**
 * Global instance for convenience
 */
let globalManager: MousePreferencesManager | undefined;

/**
 * Get global mouse preferences manager
 */
export function getMousePreferencesManager(): MousePreferencesManager {
  if (!globalManager) {
    globalManager = new MousePreferencesManager();
  }
  return globalManager;
}
