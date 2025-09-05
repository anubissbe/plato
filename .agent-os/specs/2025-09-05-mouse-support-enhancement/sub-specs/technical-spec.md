# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-mouse-support-enhancement/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Technical Requirements

### Mouse Event Capture Integration with Existing Raw Mode Input System

**Current Architecture Integration**
- Build on existing `useStdin` and raw mode handling in `keyboard-handler.tsx` (lines 31, 108-135)
- Extend ANSI mouse protocol support beyond current basic implementation (lines 115-119)
- Integrate with current `mouseMode` state management system (KeyboardState interface, line 22)
- Leverage existing cross-platform terminal detection patterns and WSL compatibility

**Enhanced Mouse Protocol Implementation**
```typescript
interface MouseEvent {
  type: 'click' | 'drag' | 'wheel' | 'hover' | 'release';
  button: 'left' | 'right' | 'middle' | 'wheel-up' | 'wheel-down';
  position: { x: number; y: number; column: number; row: number };
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
  timestamp: number;
}

interface EnhancedMouseState extends KeyboardState {
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
  selection: TextSelection | null;
  hoverElement: UIElement | null;
  scrollPosition: number;
  wheelSensitivity: number;
  clickFeedbackTimeout: NodeJS.Timeout | null;
}
```

**ANSI Mouse Protocol Extensions**
Current implementation enables basic mouse tracking. Enhancements required:
- Extend SGR (1006) mouse mode parsing for extended coordinates beyond 223x223
- Add UTF-8 (1005) and urxvt (1015) mode support for broader terminal compatibility
- Implement button state tracking for drag operations
- Add wheel scroll event parsing with configurable sensitivity

```typescript
// Enhanced mouse protocol parsing for stdin data handler
private parseMouseEvent(data: Buffer): MouseEvent | null {
  const seq = data.toString('utf8');
  
  // SGR Extended Mouse Mode: \x1b[<button;x;y;M/m
  const sgrMatch = seq.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (sgrMatch) {
    const buttonCode = parseInt(sgrMatch[1]);
    const isRelease = sgrMatch[4] === 'm';
    
    return {
      type: isRelease ? 'release' : this.determineEventType(buttonCode),
      button: this.parseButtonCode(buttonCode),
      position: {
        x: parseInt(sgrMatch[2]) - 1, // Convert to 0-based
        y: parseInt(sgrMatch[3]) - 1,
        column: parseInt(sgrMatch[2]) - 1,
        row: parseInt(sgrMatch[3]) - 1
      },
      modifiers: this.parseModifiers(buttonCode),
      timestamp: Date.now()
    };
  }
  
  // UTF-8 Mouse Mode fallback for broader compatibility
  // Basic mouse mode fallback for legacy terminals
  return null;
}
```

### Ink React Component Mouse Event Handling

**Component-Level Mouse Integration**
Building on Ink's React architecture, implement mouse event handling at the component level:
- Extend existing Box and Text components with mouse event props
- Create custom `useMouse()` hook for mouse event handling within Ink components
- Implement `MouseProvider` context for mouse state management across component tree
- Build coordinate mapping system between terminal coordinates and React component hierarchy

```typescript
// Custom hook for mouse events in Ink components
export function useMouse(elementRef: RefObject<any>) {
  const { mouseState, registerMouseHandler } = useMouseContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  
  useEffect(() => {
    const bounds = getElementBounds(elementRef.current);
    
    const handler = (event: MouseEvent) => {
      if (isWithinBounds(event.position, bounds)) {
        switch (event.type) {
          case 'hover':
            setIsHovered(true);
            return true;
          case 'click':
            setIsClicked(true);
            setTimeout(() => setIsClicked(false), 150); // Click feedback duration
            return handleMouseEvent(event);
        }
      } else if (isHovered) {
        setIsHovered(false);
      }
      return false;
    };
    
    return registerMouseHandler(handler);
  }, []);
  
  return {
    isHovered,
    isClicked,
    onClick: (callback: MouseEventCallback) => {},
    onHover: (callback: HoverCallback) => {},
    onDrag: (callback: DragCallback) => {}
  };
}

// Enhanced interactive components
export function InteractiveButton({ children, onClick, disabled }: InteractiveButtonProps) {
  const buttonRef = useRef(null);
  const mouse = useMouse(buttonRef);
  
  useEffect(() => {
    if (!disabled) {
      mouse.onClick((event) => {
        onClick?.(event);
      });
    }
  }, [onClick, disabled]);
  
  const borderColor = disabled ? 'gray' : 
                     mouse.isClicked ? 'green' : 
                     mouse.isHovered ? 'cyan' : 'white';
  
  return (
    <Box ref={buttonRef} borderStyle="single" borderColor={borderColor} paddingX={1}>
      {children}
    </Box>
  );
}
```

### Cross-Platform Terminal Mouse Support

**Platform Detection and Compatibility Matrix**
```typescript
interface PlatformMouseConfig {
  platform: 'windows' | 'linux' | 'darwin';
  terminal: string;
  mouseProtocols: ('sgr' | 'utf8' | 'urxvt' | 'basic')[];
  capabilities: {
    sgrExtended: boolean;
    utf8Coordinates: boolean;
    wheelEvents: boolean;
    dragEvents: boolean;
    rightClick: boolean;
    coordinateLimit: number;
  };
}

class MousePlatformAdapter {
  static detect(): PlatformMouseConfig {
    const platform = process.platform;
    const termProgram = process.env.TERM_PROGRAM || 'unknown';
    const isWSL = process.env.WSL_DISTRO_NAME !== undefined;
    const terminalType = process.env.TERM || 'unknown';
    
    if (platform === 'win32' || isWSL) {
      return {
        platform: 'windows',
        terminal: termProgram || (isWSL ? 'wsl' : 'cmd'),
        mouseProtocols: isWSL ? ['utf8', 'basic'] : ['sgr', 'utf8', 'basic'],
        capabilities: {
          sgrExtended: !isWSL && termProgram === 'WindowsTerminal',
          utf8Coordinates: true,
          wheelEvents: true,
          dragEvents: !isWSL, // WSL has limited drag support
          rightClick: !isWSL,
          coordinateLimit: isWSL ? 223 : 32767
        }
      };
    }
    
    if (platform === 'darwin') {
      return {
        platform: 'darwin',
        terminal: termProgram,
        mouseProtocols: ['sgr', 'utf8', 'urxvt', 'basic'],
        capabilities: {
          sgrExtended: ['iTerm.app', 'Terminal'].includes(termProgram),
          utf8Coordinates: true,
          wheelEvents: true,
          dragEvents: true,
          rightClick: true,
          coordinateLimit: 32767
        }
      };
    }
    
    // Linux configuration
    return {
      platform: 'linux',
      terminal: termProgram || terminalType,
      mouseProtocols: ['sgr', 'utf8', 'basic'],
      capabilities: {
        sgrExtended: ['gnome-terminal', 'konsole', 'xterm'].includes(termProgram),
        utf8Coordinates: true,
        wheelEvents: true,
        dragEvents: true,
        rightClick: true,
        coordinateLimit: 32767
      }
    };
  }
}
```

**Terminal Emulator Specific Handling**
- **Windows Terminal**: Full SGR mouse support with high DPI scaling awareness
- **WSL environments**: UTF-8 mouse mode only, limited to basic click events
- **iTerm2/Terminal.app**: Full mouse protocol support with native macOS clipboard integration
- **GNOME Terminal/Konsole**: Standard SGR mouse mode with X11 clipboard integration
- **tmux/screen**: Mouse pass-through mode for nested terminal sessions

### Text Selection Algorithms with Character-Level Precision

**Advanced Text Selection Engine**
```typescript
interface TextSelection {
  start: TextPosition;
  end: TextPosition;
  text: string;
  type: 'character' | 'word' | 'line' | 'block';
  messageSpan: { startMessage: number; endMessage: number };
}

interface TextPosition {
  row: number;
  column: number;
  messageIndex: number; // For multi-message selection in conversation
  charOffset: number; // Absolute character position in content
  virtualColumn: number; // For handling wrapped lines
}

class AdvancedSelectionEngine {
  private content: ConversationMessage[];
  private selection: TextSelection | null = null;
  private wordBoundaryRegex = /[\s\p{P}\p{S}]/u; // Unicode word boundaries
  
  startSelection(position: TextPosition, selectionType: SelectionType = 'character') {
    this.selection = {
      start: this.snapToSelectionType(position, selectionType),
      end: this.snapToSelectionType(position, selectionType),
      text: '',
      type: selectionType,
      messageSpan: { startMessage: position.messageIndex, endMessage: position.messageIndex }
    };
    
    this.updateSelectionText();
  }
  
  updateSelection(position: TextPosition) {
    if (!this.selection) return;
    
    this.selection.end = this.snapToSelectionType(position, this.selection.type);
    this.selection.messageSpan.endMessage = Math.max(
      this.selection.messageSpan.endMessage,
      position.messageIndex
    );
    
    this.updateSelectionText();
  }
  
  private snapToSelectionType(pos: TextPosition, type: SelectionType): TextPosition {
    switch (type) {
      case 'word':
        return this.snapToWordBoundary(pos);
      case 'line':
        return this.snapToLineBoundary(pos);
      case 'block':
        return this.snapToBlockBoundary(pos); // For code blocks
      default:
        return pos;
    }
  }
  
  private snapToWordBoundary(pos: TextPosition): TextPosition {
    const line = this.getLineContent(pos);
    let startCol = pos.column;
    let endCol = pos.column;
    
    // Find word start boundary
    while (startCol > 0 && !this.wordBoundaryRegex.test(line[startCol - 1])) {
      startCol--;
    }
    
    // Find word end boundary
    while (endCol < line.length && !this.wordBoundaryRegex.test(line[endCol])) {
      endCol++;
    }
    
    return { ...pos, column: startCol };
  }
  
  private updateSelectionText() {
    if (!this.selection) return;
    
    this.selection.text = this.extractTextBetweenPositions(
      this.selection.start,
      this.selection.end
    );
  }
  
  private extractTextBetweenPositions(start: TextPosition, end: TextPosition): string {
    // Ensure start comes before end
    if (this.comparePositions(start, end) > 0) {
      [start, end] = [end, start];
    }
    
    let result = '';
    
    // Handle single message selection
    if (start.messageIndex === end.messageIndex) {
      const message = this.content[start.messageIndex];
      const lines = message.content.split('\n');
      
      if (start.row === end.row) {
        // Single line selection
        result = lines[start.row].slice(start.column, end.column);
      } else {
        // Multi-line selection within message
        result = lines[start.row].slice(start.column) + '\n';
        for (let r = start.row + 1; r < end.row; r++) {
          result += lines[r] + '\n';
        }
        result += lines[end.row].slice(0, end.column);
      }
    } else {
      // Multi-message selection
      for (let msgIdx = start.messageIndex; msgIdx <= end.messageIndex; msgIdx++) {
        const message = this.content[msgIdx];
        const lines = message.content.split('\n');
        
        if (msgIdx === start.messageIndex) {
          // First message - from start position to end
          result += lines[start.row].slice(start.column) + '\n';
          for (let r = start.row + 1; r < lines.length; r++) {
            result += lines[r] + '\n';
          }
        } else if (msgIdx === end.messageIndex) {
          // Last message - from start to end position
          for (let r = 0; r < end.row; r++) {
            result += lines[r] + '\n';
          }
          result += lines[end.row].slice(0, end.column);
        } else {
          // Middle messages - entire content
          result += message.content + '\n';
        }
        
        if (msgIdx < end.messageIndex) {
          result += '\n---\n'; // Message separator
        }
      }
    }
    
    return result;
  }
}
```

**Visual Selection Highlighting with Terminal Colors**
```typescript
class SelectionRenderer {
  private readonly SELECTION_BG = '\x1b[47m'; // White background
  private readonly SELECTION_FG = '\x1b[30m'; // Black text
  private readonly SELECTION_BG_REVERSE = '\x1b[7m'; // Reverse video
  private readonly RESET = '\x1b[0m';
  private readonly CURSOR_SAVE = '\x1b[s';
  private readonly CURSOR_RESTORE = '\x1b[u';
  
  renderWithSelection(content: string, selection: TextSelection | null): string {
    if (!selection) return content;
    
    const lines = content.split('\n');
    return lines.map((line, row) => {
      return this.renderLineWithSelection(line, row, selection);
    }).join('\n');
  }
  
  private renderLineWithSelection(line: string, row: number, selection: TextSelection): string {
    const selectionRange = this.getSelectionRangeForLine(row, selection);
    
    if (!selectionRange) return line;
    
    const { start, end } = selectionRange;
    
    // Handle ANSI color codes in the line
    const segments = this.parseANSISegments(line);
    let result = '';
    let currentCol = 0;
    
    for (const segment of segments) {
      if (segment.type === 'text') {
        const segmentStart = currentCol;
        const segmentEnd = currentCol + segment.text.length;
        
        if (segmentEnd <= start || segmentStart >= end) {
          // Outside selection
          result += segment.text;
        } else {
          // Overlaps with selection
          const beforeSelection = Math.max(0, start - segmentStart);
          const afterSelection = Math.max(0, segmentEnd - end);
          
          if (beforeSelection > 0) {
            result += segment.text.slice(0, beforeSelection);
          }
          
          result += this.SELECTION_BG + this.SELECTION_FG;
          result += segment.text.slice(beforeSelection, segment.text.length - afterSelection);
          result += this.RESET;
          
          if (afterSelection > 0) {
            result += segment.text.slice(segment.text.length - afterSelection);
          }
        }
        
        currentCol = segmentEnd;
      } else {
        // ANSI escape sequence
        result += segment.text;
      }
    }
    
    return result;
  }
  
  private parseANSISegments(line: string): Array<{type: 'text' | 'ansi', text: string}> {
    const segments = [];
    const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
    let lastIndex = 0;
    let match;
    
    while ((match = ansiRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', text: line.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'ansi', text: match[0] });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < line.length) {
      segments.push({ type: 'text', text: line.slice(lastIndex) });
    }
    
    return segments;
  }
}
```

### Scrolling Mechanics with Configurable Sensitivity

**Advanced Viewport Management**
```typescript
interface ViewportState {
  totalLines: number;
  visibleLines: number;
  scrollTop: number;
  scrollBottom: number;
  maxScroll: number;
  scrollVelocity: number;
  isScrolling: boolean;
}

class ScrollController {
  private viewport: ViewportState;
  private scrollSensitivity: number = 3; // Lines per wheel event
  private smoothScrolling: boolean = true;
  private scrollAnimation: number | null = null;
  private scrollMomentum: number = 0;
  private lastScrollTime: number = 0;
  
  constructor(private onViewportUpdate: (viewport: ViewportState) => void) {
    this.viewport = {
      totalLines: 0,
      visibleLines: process.stdout.rows - 4, // Account for UI elements
      scrollTop: 0,
      scrollBottom: 0,
      maxScroll: 0,
      scrollVelocity: 0,
      isScrolling: false
    };
  }
  
  handleWheelEvent(event: MouseEvent) {
    const now = Date.now();
    const timeDelta = now - this.lastScrollTime;
    this.lastScrollTime = now;
    
    let scrollDelta = 0;
    if (event.button === 'wheel-up') {
      scrollDelta = -this.scrollSensitivity;
    } else if (event.button === 'wheel-down') {
      scrollDelta = this.scrollSensitivity;
    }
    
    // Implement momentum scrolling
    if (timeDelta < 100) { // Rapid scroll events
      this.scrollMomentum += scrollDelta * 0.1;
      scrollDelta += this.scrollMomentum;
    } else {
      this.scrollMomentum = 0;
    }
    
    if (this.smoothScrolling) {
      this.animatedScroll(scrollDelta);
    } else {
      this.instantScroll(scrollDelta);
    }
  }
  
  private animatedScroll(totalDelta: number) {
    if (this.scrollAnimation) {
      cancelAnimationFrame(this.scrollAnimation);
    }
    
    this.viewport.isScrolling = true;
    const startTime = Date.now();
    const duration = 150; // ms
    const startScroll = this.viewport.scrollTop;
    const targetScroll = this.clampScroll(startScroll + totalDelta);
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentScroll = startScroll + (targetScroll - startScroll) * easedProgress;
      this.setScrollPosition(currentScroll);
      
      if (progress < 1) {
        this.scrollAnimation = requestAnimationFrame(animate);
      } else {
        this.viewport.isScrolling = false;
        this.scrollAnimation = null;
        this.onViewportUpdate(this.viewport);
      }
    };
    
    animate();
  }
  
  private instantScroll(delta: number) {
    const newScrollTop = this.clampScroll(this.viewport.scrollTop + delta);
    this.setScrollPosition(newScrollTop);
  }
  
  private setScrollPosition(scrollTop: number) {
    this.viewport.scrollTop = scrollTop;
    this.viewport.scrollBottom = scrollTop + this.viewport.visibleLines;
    this.onViewportUpdate(this.viewport);
  }
  
  private clampScroll(scrollTop: number): number {
    return Math.max(0, Math.min(scrollTop, this.viewport.maxScroll));
  }
  
  updateContentSize(totalLines: number) {
    this.viewport.totalLines = totalLines;
    this.viewport.maxScroll = Math.max(0, totalLines - this.viewport.visibleLines);
    
    // Adjust current scroll position if content shrunk
    if (this.viewport.scrollTop > this.viewport.maxScroll) {
      this.setScrollPosition(this.viewport.maxScroll);
    }
  }
}
```

### Visual Feedback Systems for Hover States and Interactions

**Comprehensive Hover State Management**
```typescript
interface HoverState {
  element: UIElement | null;
  position: { x: number; y: number };
  timestamp: number;
  isActive: boolean;
}

interface UIElement {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  type: 'button' | 'link' | 'text' | 'input' | 'menu-item';
  interactive: boolean;
  onHover?: (isHovered: boolean, position: { x: number; y: number }) => void;
  onClick?: (event: MouseEvent) => void;
}

class HoverManager {
  private currentHover: HoverState | null = null;
  private hoverDelay: number = 200; // ms before hover activates
  private hoverTimeout: NodeJS.Timeout | null = null;
  private elements: Map<string, UIElement> = new Map();
  
  registerElement(element: UIElement) {
    this.elements.set(element.id, element);
  }
  
  unregisterElement(id: string) {
    this.elements.delete(id);
    if (this.currentHover?.element?.id === id) {
      this.clearHover();
    }
  }
  
  updateHover(position: { x: number; y: number }) {
    const element = this.findElementAtPosition(position);
    
    if (element !== this.currentHover?.element) {
      this.clearHoverTimeout();
      
      if (this.currentHover?.element) {
        this.triggerHoverEnd(this.currentHover.element);
      }
      
      if (element && element.interactive) {
        this.hoverTimeout = setTimeout(() => {
          this.triggerHoverStart(element, position);
        }, this.hoverDelay);
      }
    }
  }
  
  private findElementAtPosition(position: { x: number; y: number }): UIElement | null {
    for (const element of this.elements.values()) {
      const { bounds } = element;
      if (position.x >= bounds.x && 
          position.x < bounds.x + bounds.width &&
          position.y >= bounds.y && 
          position.y < bounds.y + bounds.height) {
        return element;
      }
    }
    return null;
  }
  
  private triggerHoverStart(element: UIElement, position: { x: number; y: number }) {
    this.currentHover = { 
      element, 
      position, 
      timestamp: Date.now(), 
      isActive: true 
    };
    
    element.onHover?.(true, position);
    this.setCursorStyle(element.type);
  }
  
  private triggerHoverEnd(element: UIElement) {
    element.onHover?.(false, { x: 0, y: 0 });
    this.setCursorStyle('default');
  }
  
  private setCursorStyle(elementType: UIElement['type'] | 'default') {
    // Terminal cursor style changes (limited support)
    switch (elementType) {
      case 'button':
      case 'link':
      case 'menu-item':
        // Some terminals support changing cursor to hand
        process.stdout.write('\x1b[?12h'); // Enable blinking cursor
        break;
      case 'text':
      case 'input':
        process.stdout.write('\x1b[?12l'); // Disable blinking cursor
        break;
      default:
        process.stdout.write('\x1b[?12l');
    }
  }
}
```

**Click Feedback Animation System**
```typescript
interface RippleEffect {
  center: { x: number; y: number };
  radius: number;
  maxRadius: number;
  opacity: number;
  startTime: number;
  duration: number;
}

class ClickFeedbackRenderer {
  private activeRipples: RippleEffect[] = [];
  private animationFrame: number | null = null;
  
  showClickFeedback(position: { x: number; y: number }, elementType: UIElement['type']) {
    const ripple = this.createRippleEffect(position, elementType);
    this.activeRipples.push(ripple);
    
    if (!this.animationFrame) {
      this.startAnimation();
    }
  }
  
  private createRippleEffect(position: { x: number; y: number }, elementType: UIElement['type']): RippleEffect {
    const maxRadius = elementType === 'button' ? 6 : 4;
    const duration = elementType === 'button' ? 300 : 200;
    
    return {
      center: position,
      radius: 0,
      maxRadius,
      opacity: 1.0,
      startTime: Date.now(),
      duration
    };
  }
  
  private startAnimation() {
    const animate = () => {
      const now = Date.now();
      const activeRipples = [];
      
      for (const ripple of this.activeRipples) {
        const elapsed = now - ripple.startTime;
        const progress = Math.min(elapsed / ripple.duration, 1);
        
        if (progress < 1) {
          ripple.radius = ripple.maxRadius * this.easeOut(progress);
          ripple.opacity = 1 - progress;
          this.renderRipple(ripple);
          activeRipples.push(ripple);
        }
      }
      
      this.activeRipples = activeRipples;
      
      if (this.activeRipples.length > 0) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.animationFrame = null;
      }
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }
  
  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
  
  private renderRipple(ripple: RippleEffect) {
    // Terminal-based ripple effect using unicode characters
    const { center, radius, opacity } = ripple;
    const chars = ['·', '∘', '○', '◯'];
    const charIndex = Math.min(Math.floor(radius / 2), chars.length - 1);
    const char = chars[charIndex];
    
    // Position cursor and draw ripple character with fade
    const alpha = Math.floor(opacity * 255);
    const color = `\x1b[38;2;${alpha};${alpha};${alpha}m`; // RGB color
    
    process.stdout.write(`\x1b[${center.y};${center.x}H${color}${char}\x1b[0m`);
  }
}
```

### Performance Considerations for Mouse Event Processing

**Event Throttling and Optimization**
```typescript
class MouseEventOptimizer {
  private mouseMoveThrottle: number = 16; // ~60fps
  private wheelDebounce: number = 10;
  private hoverDebounce: number = 50;
  private lastMouseMove: number = 0;
  private lastHoverUpdate: number = 0;
  private wheelTimeout: NodeJS.Timeout | null = null;
  private eventQueue: MouseEvent[] = [];
  private maxQueueSize: number = 100;
  
  optimizeMouseMove(event: MouseEvent): boolean {
    const now = Date.now();
    
    // Throttle mouse move events
    if (now - this.lastMouseMove < this.mouseMoveThrottle) {
      return false; // Skip this event
    }
    
    this.lastMouseMove = now;
    return true; // Process this event
  }
  
  optimizeHover(event: MouseEvent): boolean {
    const now = Date.now();
    
    // Debounce hover events
    if (now - this.lastHoverUpdate < this.hoverDebounce) {
      return false;
    }
    
    this.lastHoverUpdate = now;
    return true;
  }
  
  optimizeWheel(event: MouseEvent, callback: () => void) {
    if (this.wheelTimeout) {
      clearTimeout(this.wheelTimeout);
    }
    
    this.wheelTimeout = setTimeout(() => {
      callback();
      this.wheelTimeout = null;
    }, this.wheelDebounce);
  }
  
  queueEvent(event: MouseEvent) {
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.eventQueue.shift(); // Remove oldest event
    }
    
    this.eventQueue.push(event);
  }
  
  processEventQueue(): MouseEvent[] {
    const events = [...this.eventQueue];
    this.eventQueue.length = 0;
    return events;
  }
  
  // Memory-efficient coordinate caching
  private coordinateCache: Map<string, UIElement> = new Map();
  
  getCachedElementBounds(id: string): UIElement | null {
    return this.coordinateCache.get(id) || null;
  }
  
  cacheElementBounds(id: string, element: UIElement) {
    if (this.coordinateCache.size > 50) { // Limit cache size
      const firstKey = this.coordinateCache.keys().next().value;
      this.coordinateCache.delete(firstKey);
    }
    
    this.coordinateCache.set(id, element);
  }
}
```

**Memory-Efficient Selection Storage**
```typescript
class SelectionBuffer {
  private buffer: Map<string, CompressedSelection> = new Map();
  private maxBufferSize: number = 10;
  
  interface CompressedSelection {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    messageIndices: number[];
    timestamp: number;
  }
  
  cacheSelection(id: string, selection: TextSelection) {
    if (this.buffer.size >= this.maxBufferSize) {
      this.evictOldestSelection();
    }
    
    const compressed: CompressedSelection = {
      startRow: selection.start.row,
      startCol: selection.start.column,
      endRow: selection.end.row,
      endCol: selection.end.column,
      messageIndices: [selection.messageSpan.startMessage, selection.messageSpan.endMessage],
      timestamp: Date.now()
    };
    
    this.buffer.set(id, compressed);
  }
  
  getSelection(id: string): CompressedSelection | null {
    return this.buffer.get(id) || null;
  }
  
  private evictOldestSelection() {
    let oldestId = '';
    let oldestTime = Date.now();
    
    for (const [id, selection] of this.buffer.entries()) {
      if (selection.timestamp < oldestTime) {
        oldestTime = selection.timestamp;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.buffer.delete(oldestId);
    }
  }
  
  cleanup() {
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
    
    for (const [id, selection] of this.buffer.entries()) {
      if (selection.timestamp < cutoff) {
        this.buffer.delete(id);
      }
    }
  }
}
```

## External Dependencies

### Current Dependencies Assessment

Based on the existing `package.json` analysis, Plato already includes all necessary dependencies:

- **ink**: v6.2.3 - React-based terminal UI framework with comprehensive mouse support capabilities
- **react**: v19.1.1 - Component architecture foundation for mouse event handling
- **picocolors**: v1.0.0 - Terminal color support for visual feedback and selection highlighting
- **@types/react**: v19.1.12 - TypeScript definitions for enhanced component development

### Ink Framework Mouse Capabilities

**Built-in Mouse Support Analysis**
Ink v6.2.3 provides extensive mouse event handling through:
- Native ANSI mouse protocol parsing and coordinate translation
- React component integration with mouse event props
- Cross-platform terminal compatibility matrix
- Coordinate mapping between terminal space and React component hierarchy

**No Additional Dependencies Required**

The enhancement will be implemented using:
1. **Native Node.js Terminal APIs**: Already utilized in current implementation (lines 115-119)
2. **React/Ink Event System**: Component-level mouse event handling through existing hooks
3. **ANSI Escape Sequences**: Extended mouse protocol support building on current foundation

### Platform-Specific Terminal Integration

**Windows/WSL Compatibility**
- Current WSL detection logic already implemented (`isRawModeSupported` check)
- Windows Terminal provides full SGR mouse protocol support
- WSL environments use UTF-8 mouse mode fallback (existing pattern)

**macOS Terminal Integration**
- iTerm2 and Terminal.app provide complete ANSI mouse protocol support  
- Native clipboard integration through existing terminal OSC sequences
- Full coordinate precision up to terminal size limits

**Linux Terminal Ecosystem**
- GNOME Terminal, Konsole, xterm provide standard mouse protocol compatibility
- X11 clipboard integration via terminal escape sequences
- Consistent behavior across major distributions

**Cross-Platform Implementation Strategy**
All mouse functionality achieved through:
- Standard ANSI escape sequences (extending current implementation at lines 115-119)
- React/Ink component event system integration  
- Native Node.js terminal API capabilities (already utilized)
- Platform detection using existing environment variable patterns

### Optional Future Enhancements

**Advanced Clipboard Operations**
If enhanced clipboard features beyond standard terminal copy/paste are needed:
- `clipboardy` package: Cross-platform clipboard access (1.3.0, ~45KB installed)
- Only required for advanced clipboard operations beyond terminal-native support
- Not needed for core mouse selection and copy functionality

**Terminal Capability Detection**
For advanced terminal feature probing:
- Custom implementation preferred using existing environment variable analysis
- `term-features` type libraries could be considered but add unnecessary complexity
- Current environment detection patterns (TERM_PROGRAM, WSL detection) sufficient

### Implementation Dependencies Summary

**Zero Additional Dependencies Required**

The existing technology stack provides complete coverage:
- Mouse event capture and processing via Ink's built-in ANSI mouse parsing
- Cross-platform terminal compatibility through existing detection patterns  
- React component integration using current Ink architecture
- Performance-optimized event handling with existing Node.js APIs
- Visual feedback rendering using current picocolors terminal styling

The mouse support enhancement will be implemented as a pure extension of the existing codebase without introducing new external dependencies.

## Approach

### Development Strategy

**Phase 1: Foundation Enhancement (Week 1)**
- Extend existing mouse protocol implementation in `keyboard-handler.tsx` (lines 115-119)
- Implement comprehensive MouseEvent parsing for all ANSI protocols (SGR, UTF-8, urxvt)
- Create MouseProvider context for state management across the React component tree
- Establish coordinate mapping system for terminal-to-component translation
- Integrate with existing KeyboardState interface (line 22) for unified state management

**Phase 2: Component Integration (Week 1-2)**
- Develop `useMouse()` hook for Ink component mouse event handling
- Create InteractiveBox and InteractiveText enhanced components with hover states
- Implement click detection for existing UI elements (slash command suggestions, confirmation dialogs)
- Add visual feedback system with click animations and hover highlighting
- Integrate with existing status line and mode indicators (lines 1064-1069)

**Phase 3: Text Selection Engine (Week 2)**
- Build character-level text selection with drag operation support
- Implement multi-line and cross-message selection capabilities spanning conversation history
- Create SelectionRenderer for terminal-based highlighting using ANSI color codes
- Integrate system clipboard operations across all supported platforms
- Add selection persistence and buffer management for copy operations

**Phase 4: Navigation and Performance (Week 2-3)**
- Implement ScrollController with configurable sensitivity and smooth animations
- Add viewport management for conversation history navigation with scroll position persistence
- Create performance optimizations with event throttling, debouncing, and memory management
- Implement comprehensive cross-platform testing and validation
- Add configuration options for scroll sensitivity and visual feedback preferences

### Integration with Existing Architecture

**Minimal Disruption Approach**
- Build directly on current `mouseMode` state management (KeyboardState line 22, default true line 58)
- Extend existing ANSI mouse protocol activation (lines 115-119 in useEffect)
- Preserve all current keyboard input handling and fallback mechanisms
- Maintain complete compatibility with WSL and non-raw-mode environments

**Preserve Existing Functionality**
- All mouse enhancements operate as extensions of current `mouseMode` toggle
- Keyboard-driven workflow remains fully functional and unchanged
- Graceful degradation in environments with limited or no mouse support
- Preserve existing `/mouse` command (lines 526-558) with enhanced capabilities
- Maintain compatibility with `/paste` command (lines 531-533, 962-990) functionality

**Architecture Consistency**
- Follow existing patterns for state management and React hooks usage
- Integrate with current session persistence and state recovery mechanisms
- Maintain consistency with existing slash command architecture
- Preserve current error handling and platform detection patterns

### Testing and Validation Strategy

**Cross-Platform Testing Matrix**
- **Windows**: Windows Terminal, PowerShell, Command Prompt, Windows Subsystem for Linux (WSL 1/2)
- **macOS**: iTerm2, Terminal.app, third-party terminals (Hyper, Alacritty)
- **Linux**: GNOME Terminal, Konsole, xterm, tmux/screen nested sessions
- **Container Environments**: Docker, development containers, CI/CD environments

**Performance Validation Targets**
- Mouse event processing latency < 16ms for 60fps responsiveness
- Memory usage increase < 10MB for all mouse enhancement features  
- Scroll animation consistency at 60fps with smooth easing transitions
- Text selection accuracy with pixel-perfect coordinate mapping validation
- CPU usage < 5% during active mouse interaction sessions

**User Experience Testing Protocol**
- Click precision validation for all interactive elements with sub-pixel accuracy
- Text selection accuracy across different content types (code blocks, formatted text, conversation history)
- Scroll behavior consistency and smoothness across different content lengths
- Visual feedback timing, clarity, and consistency validation
- Cross-platform clipboard integration testing for copy/paste operations
- Accessibility testing to ensure mouse enhancements don't interfere with keyboard navigation

**Regression Testing**
- Ensure existing keyboard-driven workflows remain completely unaffected
- Validate WSL and limited-environment compatibility with graceful fallback
- Confirm session persistence and state recovery functionality
- Test integration with existing slash commands and confirmation dialogs
- Verify performance characteristics remain within acceptable bounds