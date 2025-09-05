import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { loadConfig, saveConfig, setConfigValue, ensureConfigLoaded } from '../../config';
import type { Config } from '../../config';

jest.mock('fs/promises');
jest.mock('yaml');

describe('config', () => {
  const mockHomeDir = '/home/test';
  const globalConfigPath = path.join(mockHomeDir, '.config', 'plato', 'config.yaml');
  const projectConfigPath = path.join(process.cwd(), '.plato', 'config.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    
    // Reset module state between tests
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('should load and merge global and project configs', async () => {
      const globalConfig = { model: { active: 'gpt-3.5-turbo' } };
      const projectConfig = { editing: { autoApply: 'off' as const } };

      (fs.readFile as jest.Mock).mockImplementation((path) => {
        if (path === globalConfigPath) {
          return Promise.resolve(YAML.stringify(globalConfig));
        } else if (path === projectConfigPath) {
          return Promise.resolve(YAML.stringify(projectConfig));
        }
        return Promise.reject(new Error('File not found'));
      });

      (YAML.parse as jest.Mock).mockImplementation((text) => {
        if (text === YAML.stringify(globalConfig)) return globalConfig;
        if (text === YAML.stringify(projectConfig)) return projectConfig;
        return {};
      });

      const { loadConfig } = await import('../../config');
      const config = await loadConfig();

      expect(config.model?.active).toBe('gpt-3.5-turbo');
      expect(config.editing?.autoApply).toBe('off');
      expect(config.provider?.copilot?.base_url).toBe('https://api.githubcopilot.com');
    });

    it('should use defaults when configs are missing', async () => {
      const fileNotFoundError = new Error('File not found') as NodeJS.ErrnoException;
      fileNotFoundError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(fileNotFoundError);

      const { loadConfig } = await import('../../config');
      const config = await loadConfig();

      expect(config.provider?.active).toBe('copilot');
      expect(config.provider?.copilot?.base_url).toBe('https://api.githubcopilot.com');
      expect(config.provider?.copilot?.chat_path).toBe('/v1/chat/completions');
      expect(config.model?.active).toBe('gpt-4o');
      expect(config.editing?.autoApply).toBe('on');
      expect(config.context?.roots).toEqual([process.cwd()]);
      expect(config.toolCallPreset?.enabled).toBe(true);
      expect(config.toolCallPreset?.strictOnly).toBe(true);
    });

    it('should handle read errors other than ENOENT', async () => {
      const readError = new Error('Permission denied');
      (fs.readFile as jest.Mock).mockRejectedValue(readError);

      const { loadConfig } = await import('../../config');
      await expect(loadConfig()).rejects.toThrow('Permission denied');
    });

    it('should cache config after first load', async () => {
      const fileNotFoundError = new Error('File not found') as NodeJS.ErrnoException;
      fileNotFoundError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(fileNotFoundError);

      const { loadConfig } = await import('../../config');
      const config1 = await loadConfig();
      const config2 = await loadConfig();

      expect(config1).toBe(config2); // Same reference
      expect(fs.readFile).toHaveBeenCalledTimes(2); // Only called once per file
    });
  });

  describe('setConfigValue', () => {
    beforeEach(async () => {
      const fileNotFoundError = new Error('File not found') as NodeJS.ErrnoException;
      fileNotFoundError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(fileNotFoundError);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
    });

    it('should handle boolean type coercion', async () => {
      const { setConfigValue } = await import('../../config');
      
      await setConfigValue('autoApply', 'true');
      expect(fs.writeFile).toHaveBeenCalledWith(
        globalConfigPath,
        expect.stringContaining('"autoApply":true'),
        'utf8'
      );
    });

    it('should handle number type coercion', async () => {
      const { setConfigValue } = await import('../../config');
      
      await setConfigValue('port', '8080');
      expect(fs.writeFile).toHaveBeenCalledWith(
        globalConfigPath,
        expect.stringContaining('"port":8080'),
        'utf8'
      );
    });

    it('should throw error for invalid number values', async () => {
      const { setConfigValue } = await import('../../config');
      
      await expect(setConfigValue('port', 'invalid')).rejects.toThrow('Invalid value for port: expected number');
    });

    it('should handle JSON type coercion', async () => {
      const { setConfigValue } = await import('../../config');
      
      await setConfigValue('toolCallPreset', '{"enabled":false}');
      expect(fs.writeFile).toHaveBeenCalledWith(
        globalConfigPath,
        expect.stringContaining('"toolCallPreset":{"enabled":false}'),
        'utf8'
      );
    });

    it('should throw error for invalid JSON values', async () => {
      const { setConfigValue } = await import('../../config');
      
      await expect(setConfigValue('toolCallPreset', 'invalid json')).rejects.toThrow('Invalid value for toolCallPreset: expected valid JSON');
    });

    it('should handle nested key paths', async () => {
      const { setConfigValue } = await import('../../config');
      
      await setConfigValue('model.active', 'claude-3');
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.model.active).toBe('claude-3');
    });

    it('should create nested objects if they do not exist', async () => {
      const { setConfigValue } = await import('../../config');
      
      await setConfigValue('deeply.nested.key', 'value');
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.deeply.nested.key).toBe('value');
    });

    it('should clear cache after saving', async () => {
      const { setConfigValue, loadConfig } = await import('../../config');
      
      // Load config first to populate cache
      await loadConfig();
      
      // Set a value
      await setConfigValue('model.active', 'new-model');
      
      // Load config again - should re-read files
      jest.clearAllMocks();
      await loadConfig();
      
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe('saveConfig', () => {
    beforeEach(() => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
    });

    it('should create config directory and save config', async () => {
      const { saveConfig } = await import('../../config');
      const config: Config = {
        model: { active: 'gpt-4' },
        editing: { autoApply: 'on' }
      };

      await saveConfig(config);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockHomeDir, '.config', 'plato'),
        { recursive: true }
      );
      expect(YAML.stringify).toHaveBeenCalledWith(config);
      expect(fs.writeFile).toHaveBeenCalledWith(
        globalConfigPath,
        JSON.stringify(config),
        'utf8'
      );
    });

    it('should clear cache after saving', async () => {
      const fileNotFoundError = new Error('File not found') as NodeJS.ErrnoException;
      fileNotFoundError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(fileNotFoundError);

      const { saveConfig, loadConfig } = await import('../../config');
      
      // Load config first to populate cache
      const config1 = await loadConfig();
      
      // Save config
      await saveConfig(config1);
      
      // Load config again - should re-read files
      jest.clearAllMocks();
      await loadConfig();
      
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe('ensureConfigLoaded', () => {
    it('should load config if not cached', async () => {
      const fileNotFoundError = new Error('File not found') as NodeJS.ErrnoException;
      fileNotFoundError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(fileNotFoundError);

      const { ensureConfigLoaded } = await import('../../config');
      
      await ensureConfigLoaded();
      
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should not reload config if already cached', async () => {
      const fileNotFoundError = new Error('File not found') as NodeJS.ErrnoException;
      fileNotFoundError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(fileNotFoundError);

      const { ensureConfigLoaded, loadConfig } = await import('../../config');
      
      // Load config first
      await loadConfig();
      jest.clearAllMocks();
      
      // Ensure loaded - should not reload
      await ensureConfigLoaded();
      
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });
});