/**
 * Component Registration System
 * Manages registration and tracking of clickable components in terminal UI
 */

import { MouseEvent } from './mouse-types.js';
import { 
  ClickableComponent, 
  ComponentBounds, 
  ComponentValidator,
  ComponentState 
} from './interactive-components.js';

/**
 * Component registration result
 */
export interface RegistrationResult {
  /** Whether registration was successful */
  success: boolean;
  /** Error message if registration failed */
  error?: string;
  /** Warnings about the registration */
  warnings?: string[];
}

/**
 * Component query options
 */
export interface ComponentQuery {
  /** Component type filter */
  type?: ClickableComponent['type'] | ClickableComponent['type'][];
  /** Enabled state filter */
  enabled?: boolean;
  /** Visible state filter */
  visible?: boolean;
  /** Minimum priority */
  minPriority?: number;
  /** Maximum priority */
  maxPriority?: number;
  /** Bounds intersection check */
  intersectsBounds?: ComponentBounds;
  /** Contains point check */
  containsPoint?: { x: number; y: number };
}

/**
 * Spatial index for efficient component lookup
 */
interface SpatialNode {
  bounds: ComponentBounds;
  components: Set<string>;
  children?: SpatialNode[];
}

/**
 * Component change event
 */
export interface ComponentChangeEvent {
  type: 'added' | 'updated' | 'removed' | 'enabled' | 'disabled' | 'moved';
  componentId: string;
  component?: ClickableComponent;
  previousComponent?: ClickableComponent;
  timestamp: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total registered components */
  totalComponents: number;
  /** Enabled components */
  enabledComponents: number;
  /** Visible components */
  visibleComponents: number;
  /** Components by type */
  componentsByType: Record<string, number>;
  /** Spatial index depth */
  spatialIndexDepth: number;
  /** Average lookup time (ms) */
  averageLookupTime: number;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Enable spatial indexing for performance */
  enableSpatialIndex: boolean;
  /** Maximum spatial index depth */
  maxSpatialDepth: number;
  /** Minimum components per spatial node */
  minComponentsPerNode: number;
  /** Enable change event tracking */
  enableChangeEvents: boolean;
  /** Maximum change events to keep */
  maxChangeEvents: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default registry configuration
 */
const DEFAULT_REGISTRY_CONFIG: RegistryConfig = {
  enableSpatialIndex: true,
  maxSpatialDepth: 4,
  minComponentsPerNode: 4,
  enableChangeEvents: true,
  maxChangeEvents: 100,
  enablePerformanceMonitoring: true,
  debug: false
};

/**
 * Component change listener
 */
export type ComponentChangeListener = (event: ComponentChangeEvent) => void | Promise<void>;

/**
 * Component Registry System
 * Manages registration, lookup, and spatial indexing of interactive components
 */
export class ComponentRegistry {
  private components = new Map<string, ClickableComponent>();
  private config: RegistryConfig;
  private spatialIndex: SpatialNode | null = null;
  private changeEvents: ComponentChangeEvent[] = [];
  private changeListeners: ComponentChangeListener[] = [];
  private lookupTimes: number[] = [];
  private terminalBounds: ComponentBounds = { x: 0, y: 0, width: 80, height: 24 };

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
    
    if (this.config.enableSpatialIndex) {
      this.rebuildSpatialIndex();
    }
  }

  /**
   * Register a new component
   */
  register(component: ClickableComponent): RegistrationResult {
    try {
      // Validate component
      const validation = ComponentValidator.validate(component);
      if (!validation.valid) {
        return {
          success: false,
          error: `Component validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Check for duplicate ID
      if (this.components.has(component.id)) {
        return {
          success: false,
          error: `Component with ID '${component.id}' already exists`
        };
      }

      // Check for overlapping components with same priority
      const warnings = this.checkForOverlaps(component);

      // Register component
      this.components.set(component.id, { ...component });

      // Update spatial index
      if (this.config.enableSpatialIndex) {
        this.addToSpatialIndex(component);
      }

      // Fire change event
      if (this.config.enableChangeEvents) {
        this.fireChangeEvent({
          type: 'added',
          componentId: component.id,
          component: { ...component },
          timestamp: Date.now()
        });
      }

      if (this.config.debug) {
        console.debug(`[ComponentRegistry] Registered component: ${component.id} (${component.type})`);
      }

      return {
        success: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `Registration failed: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Unregister a component
   */
  unregister(componentId: string): boolean {
    const component = this.components.get(componentId);
    if (!component) {
      return false;
    }

    // Remove from registry
    this.components.delete(componentId);

    // Update spatial index
    if (this.config.enableSpatialIndex) {
      this.removeFromSpatialIndex(component);
    }

    // Fire change event
    if (this.config.enableChangeEvents) {
      this.fireChangeEvent({
        type: 'removed',
        componentId,
        previousComponent: component,
        timestamp: Date.now()
      });
    }

    if (this.config.debug) {
      console.debug(`[ComponentRegistry] Unregistered component: ${componentId}`);
    }

    return true;
  }

  /**
   * Update an existing component
   */
  update(componentId: string, updates: Partial<ClickableComponent>): RegistrationResult {
    const existingComponent = this.components.get(componentId);
    if (!existingComponent) {
      return {
        success: false,
        error: `Component '${componentId}' not found`
      };
    }

    // Create updated component
    const updatedComponent: ClickableComponent = {
      ...existingComponent,
      ...updates,
      id: componentId // Prevent ID changes
    };

    // Validate updated component
    const validation = ComponentValidator.validate(updatedComponent);
    if (!validation.valid) {
      return {
        success: false,
        error: `Updated component validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Check for overlaps if bounds changed
    const warnings = updates.bounds ? this.checkForOverlaps(updatedComponent) : [];

    // Update component
    const previousComponent = { ...existingComponent };
    this.components.set(componentId, updatedComponent);

    // Update spatial index if bounds changed
    if (this.config.enableSpatialIndex && updates.bounds) {
      this.removeFromSpatialIndex(previousComponent);
      this.addToSpatialIndex(updatedComponent);
    }

    // Fire change event
    if (this.config.enableChangeEvents) {
      this.fireChangeEvent({
        type: 'updated',
        componentId,
        component: updatedComponent,
        previousComponent,
        timestamp: Date.now()
      });
    }

    if (this.config.debug) {
      console.debug(`[ComponentRegistry] Updated component: ${componentId}`);
    }

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Find component at specific coordinates
   */
  findAt(x: number, y: number): ClickableComponent | null {
    const startTime = this.config.enablePerformanceMonitoring ? performance.now() : 0;
    
    try {
      if (this.config.enableSpatialIndex && this.spatialIndex) {
        return this.findAtUsingSpatialIndex(x, y);
      } else {
        return this.findAtLinearSearch(x, y);
      }
    } finally {
      if (this.config.enablePerformanceMonitoring) {
        const lookupTime = performance.now() - startTime;
        this.updateLookupTime(lookupTime);
      }
    }
  }

  /**
   * Find component using spatial index
   */
  private findAtUsingSpatialIndex(x: number, y: number): ClickableComponent | null {
    if (!this.spatialIndex) return null;

    const candidates = new Set<string>();
    this.searchSpatialIndex(this.spatialIndex, x, y, candidates);

    // Find highest priority component from candidates
    let bestMatch: ClickableComponent | null = null;
    let highestPriority = -1;

    for (const componentId of candidates) {
      const component = this.components.get(componentId);
      if (component && 
          component.isEnabled && 
          component.isVisible &&
          ComponentBounds.contains(component.bounds, x, y) &&
          component.priority > highestPriority) {
        bestMatch = component;
        highestPriority = component.priority;
      }
    }

    return bestMatch;
  }

  /**
   * Search spatial index recursively
   */
  private searchSpatialIndex(
    node: SpatialNode,
    x: number,
    y: number,
    results: Set<string>
  ): void {
    // Check if point is in node bounds
    if (!ComponentBounds.contains(node.bounds, x, y)) {
      return;
    }

    // Add components in this node
    for (const componentId of node.components) {
      results.add(componentId);
    }

    // Search children
    if (node.children) {
      for (const child of node.children) {
        this.searchSpatialIndex(child, x, y, results);
      }
    }
  }

  /**
   * Find component using linear search
   */
  private findAtLinearSearch(x: number, y: number): ClickableComponent | null {
    let bestMatch: ClickableComponent | null = null;
    let highestPriority = -1;

    for (const component of this.components.values()) {
      if (component.isEnabled && 
          component.isVisible &&
          ComponentBounds.contains(component.bounds, x, y) &&
          component.priority > highestPriority) {
        bestMatch = component;
        highestPriority = component.priority;
      }
    }

    return bestMatch;
  }

  /**
   * Query components by criteria
   */
  query(criteria: ComponentQuery = {}): ClickableComponent[] {
    const results: ClickableComponent[] = [];

    for (const component of this.components.values()) {
      if (this.matchesCriteria(component, criteria)) {
        results.push(component);
      }
    }

    // Sort by priority (descending)
    return results.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if component matches query criteria
   */
  private matchesCriteria(component: ClickableComponent, criteria: ComponentQuery): boolean {
    // Type filter
    if (criteria.type !== undefined) {
      const types = Array.isArray(criteria.type) ? criteria.type : [criteria.type];
      if (!types.includes(component.type)) {
        return false;
      }
    }

    // Enabled filter
    if (criteria.enabled !== undefined && component.isEnabled !== criteria.enabled) {
      return false;
    }

    // Visible filter
    if (criteria.visible !== undefined && component.isVisible !== criteria.visible) {
      return false;
    }

    // Priority filters
    if (criteria.minPriority !== undefined && component.priority < criteria.minPriority) {
      return false;
    }
    if (criteria.maxPriority !== undefined && component.priority > criteria.maxPriority) {
      return false;
    }

    // Bounds intersection
    if (criteria.intersectsBounds && !ComponentBounds.overlaps(component.bounds, criteria.intersectsBounds)) {
      return false;
    }

    // Contains point
    if (criteria.containsPoint && !ComponentBounds.contains(component.bounds, criteria.containsPoint.x, criteria.containsPoint.y)) {
      return false;
    }

    return true;
  }

  /**
   * Get component by ID
   */
  get(componentId: string): ClickableComponent | undefined {
    return this.components.get(componentId);
  }

  /**
   * Check if component exists
   */
  has(componentId: string): boolean {
    return this.components.has(componentId);
  }

  /**
   * Get all component IDs
   */
  getComponentIds(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get all components
   */
  getAllComponents(): ClickableComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Enable/disable component
   */
  setEnabled(componentId: string, enabled: boolean): boolean {
    const component = this.components.get(componentId);
    if (!component) return false;

    const wasEnabled = component.isEnabled;
    component.isEnabled = enabled;

    // Fire change event
    if (this.config.enableChangeEvents && wasEnabled !== enabled) {
      this.fireChangeEvent({
        type: enabled ? 'enabled' : 'disabled',
        componentId,
        component: { ...component },
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Set component visibility
   */
  setVisible(componentId: string, visible: boolean): boolean {
    const component = this.components.get(componentId);
    if (!component) return false;

    component.isVisible = visible;
    return true;
  }

  /**
   * Move component to new position
   */
  move(componentId: string, newBounds: ComponentBounds): RegistrationResult {
    const component = this.components.get(componentId);
    if (!component) {
      return {
        success: false,
        error: `Component '${componentId}' not found`
      };
    }

    // Validate new bounds
    if (!ComponentBounds.isValid(newBounds)) {
      return {
        success: false,
        error: 'Invalid bounds specified'
      };
    }

    const oldBounds = component.bounds;
    component.bounds = newBounds;

    // Update spatial index
    if (this.config.enableSpatialIndex) {
      this.removeFromSpatialIndex({ ...component, bounds: oldBounds });
      this.addToSpatialIndex(component);
    }

    // Fire change event
    if (this.config.enableChangeEvents) {
      this.fireChangeEvent({
        type: 'moved',
        componentId,
        component: { ...component },
        timestamp: Date.now()
      });
    }

    return { success: true };
  }

  /**
   * Clear all components
   */
  clear(): void {
    const componentIds = Array.from(this.components.keys());
    
    this.components.clear();
    this.spatialIndex = null;
    
    if (this.config.enableSpatialIndex) {
      this.rebuildSpatialIndex();
    }

    // Fire change events for all removed components
    if (this.config.enableChangeEvents) {
      for (const componentId of componentIds) {
        this.fireChangeEvent({
          type: 'removed',
          componentId,
          timestamp: Date.now()
        });
      }
    }

    if (this.config.debug) {
      console.debug(`[ComponentRegistry] Cleared ${componentIds.length} components`);
    }
  }

  /**
   * Check for overlapping components
   */
  private checkForOverlaps(component: ClickableComponent): string[] {
    const warnings: string[] = [];
    
    for (const other of this.components.values()) {
      if (other.id !== component.id &&
          other.priority === component.priority &&
          ComponentBounds.overlaps(component.bounds, other.bounds)) {
        warnings.push(`Overlaps with component '${other.id}' at same priority level`);
      }
    }

    return warnings;
  }

  /**
   * Build spatial index for efficient lookups
   */
  private rebuildSpatialIndex(): void {
    if (!this.config.enableSpatialIndex) return;

    this.spatialIndex = {
      bounds: this.terminalBounds,
      components: new Set(this.components.keys())
    };

    if (this.components.size > this.config.minComponentsPerNode) {
      this.subdivideSpatialIndex(this.spatialIndex, 0);
    }

    if (this.config.debug) {
      console.debug(`[ComponentRegistry] Rebuilt spatial index with ${this.components.size} components`);
    }
  }

  /**
   * Subdivide spatial index node
   */
  private subdivideSpatialIndex(node: SpatialNode, depth: number): void {
    if (depth >= this.config.maxSpatialDepth || node.components.size <= this.config.minComponentsPerNode) {
      return;
    }

    const { bounds } = node;
    const midX = bounds.x + Math.floor(bounds.width / 2);
    const midY = bounds.y + Math.floor(bounds.height / 2);

    // Create quadrants
    node.children = [
      // Top-left
      {
        bounds: { x: bounds.x, y: bounds.y, width: midX - bounds.x, height: midY - bounds.y },
        components: new Set()
      },
      // Top-right
      {
        bounds: { x: midX, y: bounds.y, width: bounds.x + bounds.width - midX, height: midY - bounds.y },
        components: new Set()
      },
      // Bottom-left
      {
        bounds: { x: bounds.x, y: midY, width: midX - bounds.x, height: bounds.y + bounds.height - midY },
        components: new Set()
      },
      // Bottom-right
      {
        bounds: { x: midX, y: midY, width: bounds.x + bounds.width - midX, height: bounds.y + bounds.height - midY },
        components: new Set()
      }
    ];

    // Distribute components to children
    for (const componentId of node.components) {
      const component = this.components.get(componentId);
      if (!component) continue;

      for (const child of node.children) {
        if (ComponentBounds.overlaps(component.bounds, child.bounds)) {
          child.components.add(componentId);
        }
      }
    }

    // Recursively subdivide children
    for (const child of node.children) {
      this.subdivideSpatialIndex(child, depth + 1);
    }
  }

  /**
   * Add component to spatial index
   */
  private addToSpatialIndex(component: ClickableComponent): void {
    if (!this.spatialIndex) return;

    // For now, just rebuild the index
    // TODO: Implement incremental updates for better performance
    this.rebuildSpatialIndex();
  }

  /**
   * Remove component from spatial index
   */
  private removeFromSpatialIndex(component: ClickableComponent): void {
    if (!this.spatialIndex) return;

    // For now, just rebuild the index
    // TODO: Implement incremental updates for better performance
    this.rebuildSpatialIndex();
  }

  /**
   * Fire component change event
   */
  private fireChangeEvent(event: ComponentChangeEvent): void {
    this.changeEvents.push(event);

    // Limit event history
    if (this.changeEvents.length > this.config.maxChangeEvents) {
      this.changeEvents.shift();
    }

    // Notify listeners
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        if (this.config.debug) {
          console.error('[ComponentRegistry] Error in change listener:', error);
        }
      }
    }
  }

  /**
   * Update lookup time statistics
   */
  private updateLookupTime(time: number): void {
    this.lookupTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.lookupTimes.length > 100) {
      this.lookupTimes.shift();
    }
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: ComponentChangeListener): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: ComponentChangeListener): void {
    const index = this.changeListeners.indexOf(listener);
    if (index >= 0) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Set terminal bounds for spatial indexing
   */
  setTerminalBounds(width: number, height: number): void {
    this.terminalBounds = { x: 0, y: 0, width, height };
    
    if (this.config.enableSpatialIndex) {
      this.rebuildSpatialIndex();
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const componentsByType: Record<string, number> = {};
    let enabledComponents = 0;
    let visibleComponents = 0;

    for (const component of this.components.values()) {
      componentsByType[component.type] = (componentsByType[component.type] || 0) + 1;
      if (component.isEnabled) enabledComponents++;
      if (component.isVisible) visibleComponents++;
    }

    const averageLookupTime = this.lookupTimes.length > 0 
      ? this.lookupTimes.reduce((sum, time) => sum + time, 0) / this.lookupTimes.length
      : 0;

    return {
      totalComponents: this.components.size,
      enabledComponents,
      visibleComponents,
      componentsByType,
      spatialIndexDepth: this.calculateSpatialIndexDepth(),
      averageLookupTime
    };
  }

  /**
   * Calculate spatial index depth
   */
  private calculateSpatialIndexDepth(): number {
    if (!this.spatialIndex) return 0;

    const calculateDepth = (node: SpatialNode): number => {
      if (!node.children) return 1;
      return 1 + Math.max(...node.children.map(calculateDepth));
    };

    return calculateDepth(this.spatialIndex);
  }

  /**
   * Get change events
   */
  getChangeEvents(): ComponentChangeEvent[] {
    return [...this.changeEvents];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RegistryConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Rebuild spatial index if settings changed
    if (config.enableSpatialIndex !== undefined || 
        config.maxSpatialDepth !== undefined || 
        config.minComponentsPerNode !== undefined) {
      this.rebuildSpatialIndex();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RegistryConfig {
    return { ...this.config };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      stats: this.getStats(),
      changeEventsCount: this.changeEvents.length,
      changeListenersCount: this.changeListeners.length,
      lookupTimesCount: this.lookupTimes.length,
      hasSpatialIndex: this.spatialIndex !== null
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.components.clear();
    this.spatialIndex = null;
    this.changeEvents = [];
    this.changeListeners = [];
    this.lookupTimes = [];
  }
}