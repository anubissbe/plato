export interface AriaLabels {
  role: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
}

export interface LiveRegion {
  ariaLive: 'polite' | 'assertive' | 'off';
  ariaAtomic: boolean;
  ariaRelevant?: string;
}

export interface HighContrastTheme {
  foreground: string;
  background: string;
  accent: string;
  error: string;
  [key: string]: string;
}

export interface FocusRingStyle {
  color: string;
  width: string;
  style: string;
}

export interface Transition {
  type: string;
  duration: number;
}

export class AccessibilityManager {
  private ariaStates: Map<string, Map<string, any>> = new Map();
  private highContrastEnabled: boolean = false;
  private highContrastTheme: HighContrastTheme;
  private focusRingStyle: FocusRingStyle;
  private focusVisibleOnly: boolean = false;
  private reducedMotion: boolean = false;

  constructor() {
    this.highContrastTheme = {
      foreground: '#ffffff',
      background: '#000000',
      accent: '#ffff00',
      error: '#ff0000',
    };
    
    this.focusRingStyle = {
      color: '#0066cc',
      width: '2px',
      style: 'solid',
    };

    // Check system preferences
    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = prefersReducedMotion.matches;
    }
  }

  getAriaLabels(componentType: string): AriaLabels {
    const labels: Record<string, AriaLabels> = {
      button: {
        role: 'button',
        ariaLabel: 'Button',
      },
      input: {
        role: 'textbox',
        ariaLabel: 'Input field',
      },
      checkbox: {
        role: 'checkbox',
        ariaLabel: 'Checkbox',
      },
      menu: {
        role: 'menu',
        ariaLabel: 'Menu',
      },
    };

    return labels[componentType] || { role: componentType };
  }

  createLiveRegion(priority: 'polite' | 'assertive'): LiveRegion {
    return {
      ariaLive: priority,
      ariaAtomic: true,
      ariaRelevant: 'additions text',
    };
  }

  setAriaDescription(element: string, description: string): { ariaDescribedBy: string; description: string } {
    const id = `${element}-description-${Date.now()}`;
    return {
      ariaDescribedBy: id,
      description,
    };
  }

  setAriaState(element: string, state: string, value: any): void {
    if (!this.ariaStates.has(element)) {
      this.ariaStates.set(element, new Map());
    }
    this.ariaStates.get(element)!.set(state, value);
  }

  getAriaState(element: string, state: string): any {
    return this.ariaStates.get(element)?.get(state);
  }

  enableHighContrast(): void {
    this.highContrastEnabled = true;
  }

  disableHighContrast(): void {
    this.highContrastEnabled = false;
  }

  isHighContrastEnabled(): boolean {
    return this.highContrastEnabled;
  }

  setHighContrastTheme(theme: HighContrastTheme): void {
    this.highContrastTheme = theme;
  }

  getHighContrastColors(): HighContrastTheme {
    return this.highContrastTheme;
  }

  calculateContrast(color1: string, color2: string): number {
    // Simplified contrast calculation
    const getLuminance = (color: string): number => {
      const rgb = parseInt(color.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  getFocusIndicatorStyle(): any {
    const style: any = {
      outline: `${this.focusRingStyle.width} ${this.focusRingStyle.style} ${this.focusRingStyle.color}`,
      outlineOffset: '2px',
    };

    if (this.focusVisibleOnly) {
      style.focusVisible = true;
    }

    return style;
  }

  setFocusRingStyle(style: FocusRingStyle): void {
    this.focusRingStyle = style;
  }

  setFocusVisibleOnly(enabled: boolean): void {
    this.focusVisibleOnly = enabled;
  }

  isFocusVisibleOnly(): boolean {
    return this.focusVisibleOnly;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  isReducedMotionEnabled(): boolean {
    return this.reducedMotion;
  }

  getAnimationDuration(animationType: string): number {
    if (this.reducedMotion) {
      return 0;
    }

    const durations: Record<string, number> = {
      fade: 200,
      slide: 300,
      scale: 250,
      rotate: 400,
    };

    return durations[animationType] || 200;
  }

  getTransition(transitionType: string): Transition {
    if (this.reducedMotion) {
      return {
        type: 'instant',
        duration: 0,
      };
    }

    const transitions: Record<string, Transition> = {
      slide: { type: 'slide', duration: 300 },
      fade: { type: 'fade', duration: 200 },
      scale: { type: 'scale', duration: 250 },
    };

    return transitions[transitionType] || { type: 'instant', duration: 0 };
  }
}

export class ScreenReaderSupport {
  private announcementQueue: Array<{
    message: string;
    priority: 'polite' | 'assertive';
    timestamp: number;
  }> = [];
  private formErrors: Map<string, string> = new Map();
  private semanticStructure = {
    headings: {
      h1: [] as string[],
      h2: [] as string[],
      h3: [] as string[],
    },
  };

  announce(
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
    options?: { timeout?: number }
  ): { message: string; priority: string } {
    const announcement = {
      message,
      priority,
      timestamp: Date.now(),
    };

    this.announcementQueue.push(announcement);
    
    // Sort by priority (assertive first)
    this.announcementQueue.sort((a, b) => {
      if (a.priority === 'assertive' && b.priority === 'polite') return -1;
      if (a.priority === 'polite' && b.priority === 'assertive') return 1;
      return a.timestamp - b.timestamp;
    });

    if (options?.timeout) {
      setTimeout(() => {
        const index = this.announcementQueue.findIndex(a => a === announcement);
        if (index !== -1) {
          this.announcementQueue.splice(index, 1);
        }
      }, options.timeout);
    }

    return { message, priority };
  }

  getAnnouncementQueue(): typeof this.announcementQueue {
    return this.announcementQueue;
  }

  getSemanticStructure(): typeof this.semanticStructure {
    // Initialize with example structure
    this.semanticStructure.headings.h1 = ['Main Application'];
    return this.semanticStructure;
  }

  getLandmarks(): Array<{ role: string; label?: string }> {
    return [
      { role: 'main', label: 'Main content' },
      { role: 'navigation', label: 'Primary navigation' },
      { role: 'complementary', label: 'Sidebar' },
    ];
  }

  getSkipLinks(): Array<{ text: string; target: string }> {
    return [
      { text: 'Skip to main content', target: '#main' },
      { text: 'Skip to navigation', target: '#nav' },
    ];
  }

  associateLabel(inputId: string, labelText: string): { htmlFor: string; labelText: string } {
    return {
      htmlFor: inputId,
      labelText,
    };
  }

  announceFormError(fieldId: string, errorMessage: string): void {
    this.formErrors.set(fieldId, errorMessage);
    this.announce(`Error on ${fieldId}: ${errorMessage}`, 'assertive');
  }

  getFormErrors(): Record<string, string> {
    return Object.fromEntries(this.formErrors);
  }

  markFieldRequired(fieldId: string): { ariaRequired: boolean; ariaInvalid: boolean } {
    return {
      ariaRequired: true,
      ariaInvalid: false,
    };
  }
}

export class KeyboardNavigation {
  private tabIndices: Map<string, number> = new Map();
  private rovingItems: string[] = [];
  private activeRovingItem: string = '';
  private tabTrap: { id: string; elements: string[]; active: boolean } | null = null;
  private currentListItem: string = '';
  private currentCell = { row: 0, col: 0 };
  private gridSize = { rows: 0, cols: 0 };
  private shortcuts: Map<string, () => void> = new Map();
  private shortcutsEnabled: boolean = true;
  private listItems: string[] = [];
  private wrapNavigation: boolean = false;

  setTabIndex(elementId: string, index: number): void {
    this.tabIndices.set(elementId, index);
  }

  getTabIndex(elementId: string): number {
    return this.tabIndices.get(elementId) ?? -1;
  }

  getTabOrder(): string[] {
    return Array.from(this.tabIndices.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
  }

  enableRovingTabIndex(items: string[]): void {
    this.rovingItems = items;
    items.forEach(item => this.setTabIndex(item, -1));
    if (items.length > 0) {
      this.setActiveRovingItem(items[0]);
    }
  }

  setActiveRovingItem(itemId: string): void {
    this.rovingItems.forEach(item => this.setTabIndex(item, -1));
    this.setTabIndex(itemId, 0);
    this.activeRovingItem = itemId;
  }

  createTabTrap(trapId: string, elements: string[]): void {
    this.tabTrap = {
      id: trapId,
      elements,
      active: false,
    };
  }

  activateTabTrap(trapId: string): void {
    if (this.tabTrap && this.tabTrap.id === trapId) {
      this.tabTrap.active = true;
    }
  }

  isTabTrapActive(): boolean {
    return this.tabTrap?.active ?? false;
  }

  getTrappedElements(): string[] {
    return this.tabTrap?.elements ?? [];
  }

  setupListNavigation(listId: string, items: string[], options?: { wrap?: boolean }): void {
    this.listItems = items;
    this.wrapNavigation = options?.wrap ?? false;
    if (items.length > 0) {
      this.currentListItem = items[0];
    }
  }

  setupGridNavigation(gridId: string, rows: number, cols: number): void {
    this.gridSize = { rows, cols };
    this.currentCell = { row: 0, col: 0 };
  }

  handleArrowKey(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (this.listItems.length > 0) {
      const currentIndex = this.listItems.indexOf(this.currentListItem);
      let newIndex = currentIndex;

      if (direction === 'down') {
        newIndex = currentIndex + 1;
        if (newIndex >= this.listItems.length) {
          newIndex = this.wrapNavigation ? 0 : this.listItems.length - 1;
        }
      } else if (direction === 'up') {
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = this.wrapNavigation ? this.listItems.length - 1 : 0;
        }
      }

      this.currentListItem = this.listItems[newIndex];
    } else if (this.gridSize.rows > 0 && this.gridSize.cols > 0) {
      if (direction === 'right') {
        this.currentCell.col = Math.min(this.currentCell.col + 1, this.gridSize.cols - 1);
      } else if (direction === 'left') {
        this.currentCell.col = Math.max(this.currentCell.col - 1, 0);
      } else if (direction === 'down') {
        this.currentCell.row = Math.min(this.currentCell.row + 1, this.gridSize.rows - 1);
      } else if (direction === 'up') {
        this.currentCell.row = Math.max(this.currentCell.row - 1, 0);
      }
    }
  }

  getCurrentListItem(): string {
    return this.currentListItem;
  }

  setCurrentListItem(item: string): void {
    this.currentListItem = item;
  }

  getCurrentCell(): { row: number; col: number } {
    return this.currentCell;
  }

  registerShortcut(key: string, handler: () => void): void {
    this.shortcuts.set(key, handler);
  }

  handleKeyPress(key: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }): void {
    if (!this.shortcutsEnabled) return;

    let shortcutKey = key;
    if (modifiers?.ctrlKey) shortcutKey = `Ctrl+${shortcutKey.toUpperCase()}`;
    if (modifiers?.altKey) shortcutKey = `Alt+${shortcutKey}`;
    if (modifiers?.shiftKey) shortcutKey = `Shift+${shortcutKey}`;

    const handler = this.shortcuts.get(shortcutKey) || this.shortcuts.get(key);
    if (handler) {
      handler();
    }
  }

  disableShortcuts(): void {
    this.shortcutsEnabled = false;
  }

  enableShortcuts(): void {
    this.shortcutsEnabled = true;
  }
}

export class FocusManager {
  private currentFocus: string = '';
  private focusHistory: string[] = [];
  private focusGroups: Map<string, string[]> = new Map();
  private focusGuards: Map<string, { elements: string[]; active: boolean }> = new Map();
  private groupCycling: Map<string, boolean> = new Map();

  setFocus(elementId: string): void {
    if (this.currentFocus) {
      this.focusHistory.push(this.currentFocus);
    }
    this.currentFocus = elementId;
  }

  getCurrentFocus(): string {
    return this.currentFocus;
  }

  getFocusHistory(): string[] {
    return this.focusHistory;
  }

  restorePreviousFocus(): void {
    if (this.focusHistory.length > 0) {
      this.currentFocus = this.focusHistory.pop()!;
    }
  }

  createFocusGroup(groupId: string, elements: string[]): void {
    this.focusGroups.set(groupId, elements);
  }

  getFocusGroup(groupId: string): string[] | undefined {
    return this.focusGroups.get(groupId);
  }

  focusGroup(groupId: string): void {
    const group = this.focusGroups.get(groupId);
    if (group && group.length > 0) {
      this.setFocus(group[0]);
    }
  }

  setGroupCycling(groupId: string, enabled: boolean): void {
    this.groupCycling.set(groupId, enabled);
  }

  focusNext(groupId: string): void {
    const group = this.focusGroups.get(groupId);
    if (!group) return;

    const currentIndex = group.indexOf(this.currentFocus);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex + 1;
    if (nextIndex >= group.length) {
      nextIndex = this.groupCycling.get(groupId) ? 0 : group.length - 1;
    }

    this.setFocus(group[nextIndex]);
  }

  createFocusGuard(guardId: string, elements: string[]): void {
    this.focusGuards.set(guardId, {
      elements,
      active: false,
    });
  }

  activateFocusGuard(guardId: string): void {
    const guard = this.focusGuards.get(guardId);
    if (guard) {
      guard.active = true;
    }
  }

  deactivateFocusGuard(guardId: string): void {
    const guard = this.focusGuards.get(guardId);
    if (guard) {
      guard.active = false;
    }
  }

  canFocusElement(elementId: string): boolean {
    // Check if any active guards prevent focusing
    for (const guard of this.focusGuards.values()) {
      if (guard.active && !guard.elements.includes(elementId)) {
        return false;
      }
    }
    return true;
  }
}