/**
 * Layout Persistence
 * Handles saving and loading layout configurations
 */

import fs from 'fs/promises';
import path from 'path';
import type { LayoutConfig } from './layout-manager.js';

const LAYOUT_CONFIG_PATH = '.plato/layout.json';

export class LayoutPersistence {
  private configPath: string;
  
  constructor(basePath: string = process.cwd()) {
    this.configPath = path.join(basePath, LAYOUT_CONFIG_PATH);
  }
  
  /**
   * Save layout configuration to disk
   */
  async save(config: LayoutConfig): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      
      const json = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configPath, json, 'utf8');
    } catch (error) {
      console.error('Failed to save layout configuration:', error);
    }
  }
  
  /**
   * Load layout configuration from disk
   */
  async load(): Promise<LayoutConfig | null> {
    try {
      const json = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(json) as LayoutConfig;
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  }
  
  /**
   * Delete saved layout configuration
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
  
  /**
   * Check if layout configuration exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }
}