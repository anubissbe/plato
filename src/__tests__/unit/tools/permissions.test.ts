import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { 
  loadPermissions, 
  checkPermission, 
  savePermissions, 
  getProjectPermissions,
  setDefault,
  addPermissionRule,
  removePermissionRule,
  type Permissions,
  type Rule,
  type PermissionQuery
} from '../../../tools/permissions';

jest.mock('fs/promises');
jest.mock('yaml');
jest.mock('../../../config');

describe('permissions', () => {
  const mockCwd = '/project';
  const projectConfigPath = path.join(mockCwd, '.plato', 'config.yaml');
  const globalConfigPath = path.join(process.env.HOME || '/home/user', '.config', 'plato', 'config.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    delete process.env.PLATO_SKIP_PERMISSIONS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadPermissions', () => {
    it('should load and merge permissions from global and project configs', async () => {
      const globalConfig = { permissions: { defaults: { fs_patch: 'confirm' } } };
      const projectConfig = { 
        permissions: { 
          defaults: { mcp_tool: 'allow' },
          rules: [{ match: { tool: 'fs_patch' }, action: 'deny' }]
        } 
      };

      (fs.readFile as jest.Mock).mockImplementation((filePath) => {
        if (filePath === globalConfigPath) {
          return Promise.resolve(YAML.stringify(globalConfig));
        } else if (filePath === projectConfigPath) {
          return Promise.resolve(YAML.stringify(projectConfig));
        }
        return Promise.reject(new Error('File not found'));
      });

      (YAML.parse as jest.Mock).mockImplementation((text) => {
        if (text === YAML.stringify(globalConfig)) return globalConfig;
        if (text === YAML.stringify(projectConfig)) return projectConfig;
        return {};
      });

      const permissions = await loadPermissions();

      expect(permissions.defaults?.fs_patch).toBe('confirm');
      expect(permissions.defaults?.mcp_tool).toBe('allow');
      expect(permissions.rules).toHaveLength(1);
      expect(permissions.rules?.[0].action).toBe('deny');
    });

    it('should handle missing config files gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      const permissions = await loadPermissions();

      expect(permissions).toEqual({});
    });

    it('should handle invalid YAML gracefully', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid: yaml: content');
      (YAML.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const permissions = await loadPermissions();

      expect(permissions).toEqual({});
    });
  });

  describe('checkPermission', () => {
    beforeEach(() => {
      // Mock loadConfig for dangerous mode checks
      jest.doMock('../../../config.js', () => ({
        loadConfig: jest.fn().mockResolvedValue({ privacy: {} })
      }));
    });

    it('should return allow for skip permissions environment variable', async () => {
      process.env.PLATO_SKIP_PERMISSIONS = 'true';

      const result = await checkPermission({ tool: 'fs_patch' });

      expect(result).toBe('allow');
    });

    it('should return allow for dangerous mode in config', async () => {
      const { loadConfig } = await import('../../../config.js');
      (loadConfig as jest.Mock).mockResolvedValue({
        privacy: { skip_all_prompts: true }
      });

      const result = await checkPermission({ tool: 'fs_patch' });

      expect(result).toBe('allow');
    });

    it('should check rules in order and return first match', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({
        permissions: {
          rules: [
            { match: { tool: 'fs_patch', path: '/project/**' }, action: 'deny' },
            { match: { tool: 'fs_patch' }, action: 'allow' }
          ]
        }
      }));

      (YAML.parse as jest.Mock).mockImplementation((text) => YAML.parse(text));

      const result = await checkPermission({ 
        tool: 'fs_patch', 
        path: '/project/src/file.ts' 
      });

      expect(result).toBe('deny');
    });

    it('should use defaults when no rules match', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({
        permissions: {
          defaults: { fs_patch: 'confirm' }
        }
      }));

      (YAML.parse as jest.Mock).mockImplementation((text) => YAML.parse(text));

      const result = await checkPermission({ tool: 'fs_patch' });

      expect(result).toBe('confirm');
    });

    it('should default to allow when no rules or defaults match', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      const result = await checkPermission({ tool: 'unknown_tool' });

      expect(result).toBe('allow');
    });

    it('should match glob patterns correctly', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({
        permissions: {
          rules: [
            { match: { path: '/project/src/**/*.ts' }, action: 'confirm' }
          ]
        }
      }));

      (YAML.parse as jest.Mock).mockImplementation((text) => YAML.parse(text));

      const result1 = await checkPermission({ 
        tool: 'fs_patch', 
        path: '/project/src/components/Button.ts' 
      });
      const result2 = await checkPermission({ 
        tool: 'fs_patch', 
        path: '/project/src/index.js' 
      });

      expect(result1).toBe('confirm');
      expect(result2).toBe('allow');
    });

    it('should match command patterns with regex', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({
        permissions: {
          rules: [
            { match: { command: 'rm.*-rf' }, action: 'deny' }
          ]
        }
      }));

      (YAML.parse as jest.Mock).mockImplementation((text) => YAML.parse(text));

      const result = await checkPermission({ 
        tool: 'exec', 
        command: 'rm -rf /tmp/test' 
      });

      expect(result).toBe('deny');
    });
  });

  describe('savePermissions', () => {
    it('should save permissions to project config', async () => {
      const existingConfig = { someOtherConfig: 'value' };
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify(existingConfig));
      (YAML.parse as jest.Mock).mockReturnValue(existingConfig);
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const newPermissions: Permissions = {
        defaults: { fs_patch: 'allow' }
      };

      await savePermissions(newPermissions);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(projectConfigPath), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        projectConfigPath,
        expect.stringContaining('"permissions":'),
        'utf8'
      );
    });

    it('should handle missing project config file', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const newPermissions: Permissions = {
        defaults: { fs_patch: 'allow' }
      };

      await savePermissions(newPermissions);

      expect(fs.writeFile).toHaveBeenCalledWith(
        projectConfigPath,
        expect.stringContaining('"permissions":'),
        'utf8'
      );
    });
  });

  describe('getProjectPermissions', () => {
    it('should return project permissions', async () => {
      const config = { 
        permissions: { defaults: { fs_patch: 'deny' } },
        otherConfig: 'value'
      };
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify(config));
      (YAML.parse as jest.Mock).mockReturnValue(config);

      const permissions = await getProjectPermissions();

      expect(permissions.defaults?.fs_patch).toBe('deny');
    });

    it('should return empty permissions when file does not exist', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      const permissions = await getProjectPermissions();

      expect(permissions).toEqual({});
    });
  });

  describe('setDefault', () => {
    it('should set default permission for a tool', async () => {
      const existingPermissions = { rules: [{ match: { tool: 'other' }, action: 'deny' }] };
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({ permissions: existingPermissions }));
      (YAML.parse as jest.Mock).mockReturnValue({ permissions: existingPermissions });
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await setDefault('fs_patch', 'confirm');

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.permissions.defaults.fs_patch).toBe('confirm');
    });
  });

  describe('addPermissionRule', () => {
    it('should add a new rule to existing permissions', async () => {
      const existingPermissions = { 
        defaults: { fs_patch: 'confirm' },
        rules: [{ match: { tool: 'other' }, action: 'allow' }] 
      };
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({ permissions: existingPermissions }));
      (YAML.parse as jest.Mock).mockReturnValue({ permissions: existingPermissions });
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const newRule: Rule = { match: { tool: 'fs_patch', path: '/sensitive/**' }, action: 'deny' };
      await addPermissionRule(newRule);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.permissions.rules).toHaveLength(2);
      expect(writtenConfig.permissions.rules[1]).toEqual(newRule);
    });
  });

  describe('removePermissionRule', () => {
    it('should remove rule at specified index', async () => {
      const existingPermissions = { 
        rules: [
          { match: { tool: 'first' }, action: 'allow' },
          { match: { tool: 'second' }, action: 'deny' },
          { match: { tool: 'third' }, action: 'confirm' }
        ]
      };
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({ permissions: existingPermissions }));
      (YAML.parse as jest.Mock).mockReturnValue({ permissions: existingPermissions });
      (YAML.stringify as jest.Mock).mockImplementation((obj) => JSON.stringify(obj));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await removePermissionRule(1);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.permissions.rules).toHaveLength(2);
      expect(writtenConfig.permissions.rules[0].match.tool).toBe('first');
      expect(writtenConfig.permissions.rules[1].match.tool).toBe('third');
    });

    it('should handle invalid indices gracefully', async () => {
      const existingPermissions = { 
        rules: [{ match: { tool: 'only' }, action: 'allow' }]
      };
      (fs.readFile as jest.Mock).mockResolvedValue(YAML.stringify({ permissions: existingPermissions }));
      (YAML.parse as jest.Mock).mockReturnValue({ permissions: existingPermissions });

      await removePermissionRule(-1);
      await removePermissionRule(5);

      // Should not call writeFile
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});