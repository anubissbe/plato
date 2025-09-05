import { loginCopilot, logoutCopilot, providerFetch } from '../../../providers/copilot';
import { loadConfig } from '../../../config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

jest.mock('../../../config');
jest.mock('fs/promises');

// Mock fetch globally
global.fetch = jest.fn();

describe('copilot provider', () => {
  const mockHomeDir = '/home/test';
  const credsFile = path.join(mockHomeDir, '.config', 'plato', 'credentials.json');
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loginCopilot', () => {
    it('should perform OAuth device flow authentication', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        provider: { copilot: { client_id: 'test-client-id' } }
      });

      // Mock device code response
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            device_code: 'test-device-code',
            user_code: 'TEST-CODE',
            verification_uri: 'https://github.com/login/device',
            interval: 1
          })
        })
      );

      // Mock access token response (successful after one pending)
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === 'https://github.com/login/oauth/access_token') {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ error: 'authorization_pending' })
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-refresh-token' })
            });
          }
        }
        // Mock Copilot token response
        if (url === 'https://api.github.com/copilot_internal/v2/token') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              token: 'test-access-token',
              expires_at: Math.floor(Date.now() / 1000) + 3600
            })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock file operations
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await loginCopilot();

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Open https://github.com/login/device and enter code: TEST-CODE')
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Authenticated with GitHub')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        credsFile,
        expect.stringContaining('test-access-token'),
        'utf8'
      );
    });

    it('should handle device code request failure', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        provider: { copilot: {} }
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(loginCopilot()).rejects.toThrow('device code failed: 401');
    });

    it('should handle device flow errors', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        provider: { copilot: {} }
      });

      // Mock device code response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          device_code: 'test-device-code',
          user_code: 'TEST-CODE',
          verification_uri: 'https://github.com/login/device'
        })
      });

      // Mock access token response with error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 'access_denied' })
      });

      await expect(loginCopilot()).rejects.toThrow('device flow error: access_denied');
    });
  });

  describe('logoutCopilot', () => {
    it('should delete credentials and print logout message', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await logoutCopilot();

      expect(fs.unlink).toHaveBeenCalledWith(credsFile);
      expect(process.stdout.write).toHaveBeenCalledWith('Logged out.\n');
    });

    it('should handle missing credentials file gracefully', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.unlink as jest.Mock).mockRejectedValue(error);

      await logoutCopilot();

      expect(process.stdout.write).toHaveBeenCalledWith('Logged out.\n');
    });
  });

  describe('providerFetch', () => {
    beforeEach(() => {
      // Mock credential loading
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
        type: 'oauth',
        refresh: 'test-refresh-token',
        access: 'test-access-token',
        expires: Date.now() + 3600000
      }));
    });

    it('should add required headers to requests', async () => {
      (loadConfig as jest.Mock).mockResolvedValue({
        provider: { copilot: { headers: { 'Custom-Header': 'custom-value' } } }
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await providerFetch('https://api.example.com/test', {
        method: 'POST',
        headers: { 'X-Initiator': 'test' }
      });

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-access-token',
          'User-Agent': 'GitHubCopilotChat/0.26.7',
          'Editor-Version': 'vscode/1.99.3',
          'Editor-Plugin-Version': 'copilot-chat/0.26.7',
          'Copilot-Integration-Id': 'vscode-chat',
          'Openai-Intent': 'conversation-edits',
          'X-Initiator': 'test',
          'Custom-Header': 'custom-value'
        })
      });
    });

    it('should refresh expired access token', async () => {
      // Mock expired credentials
      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        type: 'oauth',
        refresh: 'test-refresh-token',
        access: 'old-access-token',
        expires: Date.now() - 1000 // Expired
      }));

      (loadConfig as jest.Mock).mockResolvedValue({
        provider: { copilot: {} }
      });

      // Mock token refresh
      let tokenRefreshed = false;
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === 'https://api.github.com/copilot_internal/v2/token') {
          tokenRefreshed = true;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              token: 'new-access-token',
              expires_at: Math.floor(Date.now() / 1000) + 3600
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await providerFetch('https://api.example.com/test');

      expect(tokenRefreshed).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        credsFile,
        expect.stringContaining('new-access-token'),
        'utf8'
      );
    });

    it('should throw error when not logged in', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await expect(providerFetch('https://api.example.com/test')).rejects.toThrow('Not logged in. Run `plato login`.');
    });

    it('should handle token refresh failure', async () => {
      // Mock expired credentials
      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        type: 'oauth',
        refresh: 'test-refresh-token',
        access: 'old-access-token',
        expires: Date.now() - 1000 // Expired
      }));

      (loadConfig as jest.Mock).mockResolvedValue({
        provider: { copilot: {} }
      });

      // Mock token refresh failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      await expect(providerFetch('https://api.example.com/test')).rejects.toThrow('copilot token failed: 401');
    });
  });
});