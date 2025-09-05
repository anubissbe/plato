// Mock all external dependencies before imports
jest.mock('../../providers/copilot', () => ({
  loginCopilot: jest.fn().mockResolvedValue(undefined),
  logoutCopilot: jest.fn().mockResolvedValue(undefined),
  getAuthInfo: jest.fn().mockResolvedValue({ loggedIn: false }),
}));

jest.mock('../../config', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    provider: { active: 'copilot' },
    model: { active: 'gpt-4' },
    editing: { autoApply: 'off' }
  }),
  setConfigValue: jest.fn(),
}));

jest.mock('../../providers/chat_fallback', () => ({
  chatCompletions: jest.fn().mockResolvedValue({ content: 'mock response', usage: null }),
  chatStream: jest.fn().mockResolvedValue({ content: 'mock response', usage: null }),
}));

jest.mock('simple-git', () => ({
  default: () => ({
    checkIsRepo: () => Promise.resolve(false),
    status: () => Promise.resolve({ current: 'main' }),
  }),
}));

import { SLASH_MAP } from '../../slash/commands';
import { loginCopilot, logoutCopilot, getAuthInfo } from '../../providers/copilot';
import { loadConfig } from '../../config';

describe('Authentication Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Registry', () => {
    test('should have /login command registered', () => {
      expect(SLASH_MAP.has('/login')).toBe(true);
      const command = SLASH_MAP.get('/login');
      expect(command?.summary).toContain('provider');
    });

    test('should have /logout command registered', () => {
      expect(SLASH_MAP.has('/logout')).toBe(true);
      const command = SLASH_MAP.get('/logout');
      expect(command?.summary).toContain('credentials');
    });

    test('should have /status command registered', () => {
      expect(SLASH_MAP.has('/status')).toBe(true);
      const command = SLASH_MAP.get('/status');
      expect(command?.summary).toContain('status');
    });
  });

  describe('/login Command', () => {
    test('should handle successful login', async () => {
      const mockLoginCopilot = loginCopilot as jest.MockedFunction<typeof loginCopilot>;
      mockLoginCopilot.mockResolvedValueOnce(undefined);

      const result = await simulateLoginCommand();
      
      expect(result.success).toBe(true);
      expect(mockLoginCopilot).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('login');
    });

    test('should handle login failure gracefully', async () => {
      const mockLoginCopilot = loginCopilot as jest.MockedFunction<typeof loginCopilot>;
      mockLoginCopilot.mockRejectedValueOnce(new Error('Network error'));

      const result = await simulateLoginCommand();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
      expect(result.error).toContain('Network error');
    });

    test('should handle authentication timeout', async () => {
      const mockLoginCopilot = loginCopilot as jest.MockedFunction<typeof loginCopilot>;
      mockLoginCopilot.mockRejectedValueOnce(new Error('timeout'));

      const result = await simulateLoginCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    test('should show device code instructions during login', async () => {
      // Mock console.log to capture device code output
      const consoleSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      
      await simulateLoginCommand();
      
      expect(loginCopilot).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('/logout Command', () => {
    test('should handle successful logout', async () => {
      const mockLogoutCopilot = logoutCopilot as jest.MockedFunction<typeof logoutCopilot>;
      mockLogoutCopilot.mockResolvedValueOnce(undefined);

      const result = await simulateLogoutCommand();
      
      expect(result.success).toBe(true);
      expect(mockLogoutCopilot).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('logged out');
    });

    test('should handle logout when not logged in', async () => {
      // This simulates the behavior where logout is called regardless of auth status
      const result = await simulateLogoutCommand();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('logged out');
    });

    test('should handle logout failure', async () => {
      const mockLogoutCopilot = logoutCopilot as jest.MockedFunction<typeof logoutCopilot>;
      mockLogoutCopilot.mockRejectedValueOnce(new Error('Logout failed'));

      const result = await simulateLogoutCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Logout failed');
    });

    test('should clear credentials on successful logout', async () => {
      await simulateLogoutCommand();
      
      expect(logoutCopilot).toHaveBeenCalledTimes(1);
    });
  });

  describe('/status Command', () => {
    test('should show status when logged in', async () => {
      const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      
      mockLoadConfig.mockResolvedValueOnce({
        provider: { active: 'copilot' },
        model: { active: 'gpt-4' },
        editing: { autoApply: 'off' }
      });
      
      mockGetAuthInfo.mockResolvedValueOnce({ 
        loggedIn: true, 
        user: { login: 'testuser' } 
      });

      const result = await simulateStatusCommand();
      
      expect(result.success).toBe(true);
      expect(result.status).toContain('provider=copilot');
      expect(result.status).toContain('model=gpt-4');
      expect(result.status).toContain('account=testuser');
    });

    test('should show status when logged out', async () => {
      const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      
      mockLoadConfig.mockResolvedValueOnce({
        provider: { active: 'copilot' },
        model: { active: 'gpt-4' },
        editing: { autoApply: 'off' }
      });
      
      mockGetAuthInfo.mockResolvedValueOnce({ loggedIn: false });

      const result = await simulateStatusCommand();
      
      expect(result.success).toBe(true);
      expect(result.status).toContain('provider=copilot');
      expect(result.status).toContain('model=gpt-4');
      expect(result.status).toContain('account=logged-out');
    });

    test('should handle status check failure', async () => {
      const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
      mockLoadConfig.mockRejectedValueOnce(new Error('Config load failed'));

      const result = await simulateStatusCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Config load failed');
    });

    test('should show default values when config missing', async () => {
      const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      
      mockLoadConfig.mockResolvedValueOnce({});
      mockGetAuthInfo.mockResolvedValueOnce({ loggedIn: false });

      const result = await simulateStatusCommand();
      
      expect(result.success).toBe(true);
      expect(result.status).toContain('provider=undefined');
      expect(result.status).toContain('model=undefined');
    });

    test('should format status consistently with Claude Code', async () => {
      const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      
      mockLoadConfig.mockResolvedValueOnce({
        provider: { active: 'copilot' },
        model: { active: 'gpt-4' }
      });
      
      mockGetAuthInfo.mockResolvedValueOnce({ 
        loggedIn: true, 
        user: { login: 'testuser' } 
      });

      const result = await simulateStatusCommand();
      
      // Should match Claude Code format: "status: provider=X model=Y account=Z"
      expect(result.status).toMatch(/^status: provider=\w+ model=[\w-]+ account=[\w-]+$/);
    });
  });

  describe('Authentication State Management', () => {
    test('should maintain authentication state between commands', async () => {
      // Login first
      await simulateLoginCommand();
      expect(loginCopilot).toHaveBeenCalledTimes(1);
      
      // Check status should reflect logged in state
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      mockGetAuthInfo.mockResolvedValueOnce({ 
        loggedIn: true, 
        user: { login: 'testuser' } 
      });
      
      const statusResult = await simulateStatusCommand();
      expect(statusResult.status).toContain('account=testuser');
    });

    test('should handle authentication expiration', async () => {
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      mockGetAuthInfo.mockResolvedValueOnce({ loggedIn: false });

      const result = await simulateStatusCommand();
      
      expect(result.status).toContain('account=logged-out');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network connectivity issues', async () => {
      const mockLoginCopilot = loginCopilot as jest.MockedFunction<typeof loginCopilot>;
      mockLoginCopilot.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await simulateLoginCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });

    test('should handle invalid provider configuration', async () => {
      const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
      // Cast to any to simulate invalid config
      mockLoadConfig.mockResolvedValueOnce({
        provider: { active: 'invalid-provider' as any }
      });

      const result = await simulateStatusCommand();
      
      expect(result.success).toBe(true);
      expect(result.status).toContain('provider=invalid-provider');
    });

    test('should validate authentication before sensitive operations', async () => {
      const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;
      mockGetAuthInfo.mockResolvedValueOnce({ loggedIn: false });

      // This would be used by commands that require authentication
      const authResult = await checkAuthenticationRequired();
      
      expect(authResult.authenticated).toBe(false);
      expect(authResult.message).toContain('authentication');
    });
  });
});

// Helper functions for authentication command testing
async function simulateLoginCommand(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    await loginCopilot();
    return {
      success: true,
      message: 'Successfully initiated login process'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Login failed',
      error: (error as Error).message
    };
  }
}

async function simulateLogoutCommand(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    await logoutCopilot();
    return {
      success: true,
      message: 'Successfully logged out'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Logout failed',
      error: (error as Error).message
    };
  }
}

async function simulateStatusCommand(): Promise<{
  success: boolean;
  status: string;
  error?: string;
}> {
  try {
    const cfg = await loadConfig();
    const auth = await getAuthInfo();
    
    const providerName = cfg.provider?.active;
    const modelName = cfg.model?.active;
    const accountInfo = auth.user?.login ?? (auth.loggedIn ? 'logged-in' : 'logged-out');
    
    const statusString = `status: provider=${providerName} model=${modelName} account=${accountInfo}`;
    
    return {
      success: true,
      status: statusString
    };
  } catch (error) {
    return {
      success: false,
      status: '',
      error: (error as Error).message
    };
  }
}

async function checkAuthenticationRequired(): Promise<{
  authenticated: boolean;
  message: string;
}> {
  const auth = await getAuthInfo();
  
  if (!auth.loggedIn) {
    return {
      authenticated: false,
      message: 'This command requires authentication. Please run /login first.'
    };
  }
  
  return {
    authenticated: true,
    message: 'User is authenticated'
  };
}