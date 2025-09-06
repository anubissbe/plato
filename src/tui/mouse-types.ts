/**
 * Enhanced Mouse Event System Types
 * Comprehensive typing for mouse interactions in terminal UI
 */

export interface MouseCoordinates {
  /** 0-based x coordinate */
  x: number;
  /** 0-based y coordinate */
  y: number;
}

export interface TerminalCoordinates {
  /** 1-based terminal x coordinate */
  x: number;
  /** 1-based terminal y coordinate */
  y: number;
}

export type MouseButton = 'left' | 'right' | 'middle' | 'scroll_up' | 'scroll_down';

export type MouseEventType = 
  | 'click'
  | 'drag_start'
  | 'drag'
  | 'drag_end'
  | 'scroll'
  | 'move'
  | 'hover'
  | 'leave';

export interface MouseModifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface MouseEvent {
  /** Type of mouse event */
  type: MouseEventType;
  /** Mouse coordinates (0-based) */
  coordinates: MouseCoordinates;
  /** Button that triggered the event */
  button: MouseButton;
  /** Keyboard modifiers held during event */
  modifiers: MouseModifiers;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Raw ANSI sequence that generated this event */
  rawSequence?: string;
  /** Event target information */
  target?: MouseEventTarget;
}

export interface MouseEventTarget {
  /** Component ID that owns this coordinate space */
  componentId: string;
  /** Element type (button, text, scrollable, etc.) */
  elementType: string;
  /** Local coordinates within the target element */
  localCoordinates: MouseCoordinates;
  /** Whether this target can handle the event type */
  canHandle: boolean;
}

export interface MouseBounds {
  /** Terminal width */
  width: number;
  /** Terminal height */
  height: number;
}

export interface MouseProtocolConfig {
  /** Mouse protocol mode */
  mode: 'sgr' | 'utf8' | 'urxvt';
  /** Whether to enable mouse tracking */
  enableTracking: boolean;
  /** Whether to enable button event tracking */
  enableButtons: boolean;
  /** Whether to enable motion tracking */
  enableMotion: boolean;
  /** Whether to enable focus tracking */
  enableFocus: boolean;
}

export interface MouseEventProcessingOptions {
  /** Throttle rapid events (ms) */
  throttleMs: number;
  /** Validate coordinates against bounds */
  validateBounds: boolean;
  /** Enable event debugging */
  debug: boolean;
  /** Maximum event queue size */
  maxQueueSize: number;
}

/**
 * Mouse Event Capture System Interface
 */
export interface MouseEventCaptureSystem {
  /**
   * Parse raw ANSI mouse sequence into MouseEvent
   */
  parseMouseSequence(sequence: string): MouseEvent | null;

  /**
   * Convert terminal coordinates (1-based) to application coordinates (0-based)
   */
  mapCoordinates(terminalCoords: TerminalCoordinates): MouseCoordinates;

  /**
   * Throttle rapid mouse events to prevent flooding
   */
  throttleEvents(events: MouseEvent[]): MouseEvent[];

  /**
   * Detect event type from ANSI sequence
   */
  detectEventType(sequence: string): MouseEventType;

  /**
   * Validate coordinates against terminal bounds
   */
  validateCoordinates(coords: MouseCoordinates, bounds: MouseBounds): boolean;

  /**
   * Configure mouse protocol mode
   */
  handleProtocolMode(mode: MouseProtocolConfig['mode']): void;

  /**
   * Process event queue and return processed events
   */
  processEventQueue(): MouseEvent[];

  /**
   * Clear event queue
   */
  clearEventQueue(): void;
}

/**
 * Platform-specific mouse capabilities
 */
export interface PlatformMouseCapabilities {
  /** Platform name */
  platform: 'windows' | 'darwin' | 'linux' | 'unknown';
  /** Whether running in WSL */
  isWSL: boolean;
  /** Whether running in container */
  isContainer: boolean;
  /** Supported mouse protocols */
  supportedProtocols: MouseProtocolConfig['mode'][];
  /** Maximum coordinate values */
  maxCoordinates: MouseCoordinates;
  /** Native mouse support level */
  supportLevel: 'full' | 'partial' | 'minimal' | 'none';
}

/**
 * Mouse event handler callback types
 */
export type MouseEventHandler = (event: MouseEvent) => void | Promise<void>;

export interface MouseEventHandlers {
  onClick?: MouseEventHandler;
  onDoubleClick?: MouseEventHandler;
  onDrag?: MouseEventHandler;
  onDragStart?: MouseEventHandler;
  onDragEnd?: MouseEventHandler;
  onScroll?: MouseEventHandler;
  onMove?: MouseEventHandler;
  onHover?: MouseEventHandler;
  onLeave?: MouseEventHandler;
}

/**
 * Component registration for mouse event handling
 */
export interface MouseEventRegistration {
  /** Unique component identifier */
  componentId: string;
  /** Bounds where this component handles events */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Event handlers for this component */
  handlers: MouseEventHandlers;
  /** Priority for event handling (higher = first) */
  priority: number;
  /** Whether component is currently active */
  active: boolean;
}

/**
 * Mouse state tracking for advanced interactions
 */
export interface MouseState {
  /** Current mouse position */
  currentPosition: MouseCoordinates;
  /** Whether any button is currently pressed */
  isPressed: boolean;
  /** Currently pressed buttons */
  pressedButtons: Set<MouseButton>;
  /** Current modifiers */
  modifiers: MouseModifiers;
  /** Drag state information */
  dragState: {
    isDragging: boolean;
    startPosition: MouseCoordinates | null;
    currentPosition: MouseCoordinates | null;
    button: MouseButton | null;
  };
  /** Hover state information */
  hoverState: {
    currentTarget: MouseEventTarget | null;
    hoverStartTime: number | null;
  };
}

/**
 * Error types for mouse event system
 */
export class MouseEventError extends Error {
  constructor(
    message: string,
    public code: string,
    public sequence?: string
  ) {
    super(message);
    this.name = 'MouseEventError';
  }
}

export class MouseProtocolError extends MouseEventError {
  constructor(message: string, sequence?: string) {
    super(message, 'PROTOCOL_ERROR', sequence);
    this.name = 'MouseProtocolError';
  }
}

export class MouseBoundsError extends MouseEventError {
  constructor(message: string, coords?: MouseCoordinates) {
    super(message, 'BOUNDS_ERROR');
    this.name = 'MouseBoundsError';
  }
}

/**
 * Default configurations
 */
export const DEFAULT_MOUSE_CONFIG: MouseProtocolConfig = {
  mode: 'sgr',
  enableTracking: true,
  enableButtons: true,
  enableMotion: false, // Disabled by default to reduce noise
  enableFocus: false
};

export const DEFAULT_PROCESSING_OPTIONS: MouseEventProcessingOptions = {
  throttleMs: 16, // 60fps
  validateBounds: true,
  debug: false,
  maxQueueSize: 100
};

/**
 * ANSI escape sequences for mouse protocol control
 */
export const MOUSE_SEQUENCES = {
  // Enable mouse tracking
  ENABLE_TRACKING: '\x1b[?1000h',
  DISABLE_TRACKING: '\x1b[?1000l',
  
  // Enable button tracking
  ENABLE_BUTTONS: '\x1b[?1002h',
  DISABLE_BUTTONS: '\x1b[?1002l',
  
  // Enable SGR mode (preferred)
  ENABLE_SGR: '\x1b[?1006h',
  DISABLE_SGR: '\x1b[?1006l',
  
  // Enable UTF-8 mode
  ENABLE_UTF8: '\x1b[?1005h',
  DISABLE_UTF8: '\x1b[?1005l',
  
  // Enable urxvt mode
  ENABLE_URXVT: '\x1b[?1015h',
  DISABLE_URXVT: '\x1b[?1015l',
  
  // Focus events
  ENABLE_FOCUS: '\x1b[?1004h',
  DISABLE_FOCUS: '\x1b[?1004l'
} as const;