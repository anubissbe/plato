/**
 * End-to-End Workflow Integration Tests
 * 
 * Tests complete user workflows from login through file editing and session management,
 * validating the full Plato experience and Claude Code parity.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { orchestrator } from '../../runtime/orchestrator';
import { IntegrationTestFramework, ClaudeCodeParityValidator } from './framework.test';
import { loginCopilot, logoutCopilot, getAuthInfo } from '../../providers/copilot';
import { loadConfig, saveConfig } from '../../config';
import type { ChatMessage } from '../../core/types';
import type { Config } from '../../config';

// Mock external dependencies
jest.mock('../../providers/copilot');
const mockLoginCopilot = loginCopilot as jest.MockedFunction<typeof loginCopilot>;
const mockLogoutCopilot = logoutCopilot as jest.MockedFunction<typeof logoutCopilot>;
const mockGetAuthInfo = getAuthInfo as jest.MockedFunction<typeof getAuthInfo>;

describe('End-to-End Workflow Tests', () => {
  let framework: IntegrationTestFramework;
  // Using imported orchestrator module

  beforeEach(async () => {
    framework = new IntegrationTestFramework();
    await framework.setup();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await framework.teardown();
  });

  describe('Complete Login → Edit → Save Workflow', () => {
    test('should complete full user workflow with Claude Code parity', async () => {
      // === PHASE 1: Authentication ===
      
      // Mock successful login
      mockLoginCopilot.mockResolvedValue({
        success: true,
        message: 'Successfully logged in to GitHub Copilot'
      });
      
      mockGetAuthInfo.mockResolvedValue({
        isLoggedIn: true,
        user: 'testuser@example.com',
        scopes: ['copilot']
      });

      // Step 1: Login
      const loginResult = await simulateLoginCommand();
      expect(loginResult.success).toBe(true);
      expect(loginResult.output).toContain('Successfully logged in');
      
      // Validate Claude Code parity for login output
      const loginValidation = ClaudeCodeParityValidator.validateCommandOutput('/login', loginResult.output);
      expect(loginValidation.isValid).toBe(true);

      // === PHASE 2: Status Verification ===
      
      // Step 2: Check status
      const statusResult = await simulateStatusCommand();
      expect(statusResult.success).toBe(true);
      expect(statusResult.output).toMatch(/status: provider=copilot model=\w+/);
      
      // Validate Claude Code parity for status output
      const statusValidation = ClaudeCodeParityValidator.validateCommandOutput('/status', statusResult.output);
      expect(statusValidation.isValid).toBe(true);

      // === PHASE 3: File Creation and Editing ===
      
      // Step 3: Create a file via conversation
      const createFileMessage: ChatMessage = {
        role: 'user',
        content: 'Create a file called hello.js with a simple hello world function'
      };
      
      orchestrator.addMessage(createFileMessage);
      
      // Mock assistant response with file creation
      const assistantResponse = `I'll create a hello.js file for you.

*** Begin Patch ***
--- /dev/null
+++ b/hello.js
@@ -0,0 +1,3 @@
+function hello() {
+    console.log("Hello, World!");
+}
*** End Patch ***

Created hello.js with a simple hello world function.`;

      orchestrator.addMessage({ 
        role: 'assistant', 
        content: assistantResponse 
      });

      // Process patch (mock patch application)
      const patchResult = await simulatePatchApplication('hello.js', `function hello() {
    console.log("Hello, World!");
}`);

      expect(patchResult.success).toBe(true);
      expect(patchResult.filesChanged).toContain('hello.js');

      // Verify file was created
      const fileContent = await framework.readTestFile('hello.js');
      expect(fileContent).toContain('Hello, World!');
      expect(fileContent).toContain('function hello()');

      // === PHASE 4: File Modification ===
      
      // Step 4: Modify the file
      const modifyMessage: ChatMessage = {
        role: 'user',
        content: 'Add a parameter to the hello function so it can greet a specific person'
      };

      orchestrator.addMessage(modifyMessage);

      const modifyResponse = `I'll update the hello function to accept a parameter.

*** Begin Patch ***
--- a/hello.js
+++ b/hello.js
@@ -1,3 +1,3 @@
-function hello() {
-    console.log("Hello, World!");
+function hello(name = "World") {
+    console.log(\`Hello, \${name}!\`);
 }
*** End Patch ***

Updated the hello function to accept a name parameter.`;

      orchestrator.addMessage({ 
        role: 'assistant', 
        content: modifyResponse 
      });

      // Process modification patch
      const modifyPatchResult = await simulatePatchApplication('hello.js', `function hello(name = "World") {
    console.log(\`Hello, \${name}!\`);
}`);

      expect(modifyPatchResult.success).toBe(true);

      // Verify modification
      const modifiedContent = await framework.readTestFile('hello.js');
      expect(modifiedContent).toContain('name = "World"');
      expect(modifiedContent).toContain('${name}');

      // === PHASE 5: Session Persistence ===
      
      // Step 5: Save session
      await orchestrator.saveSession();

      // Verify session contains all workflow data
      const sessionData = JSON.parse(await framework.readTestFile('.plato/session.json'));
      expect(sessionData.messages.length).toBeGreaterThanOrEqual(4); // User + assistant messages
      
      const createMessage = sessionData.messages.find((m: any) => 
        m.content.includes('Create a file called hello.js')
      );
      expect(createMessage).toBeDefined();

      // === PHASE 6: Workflow Validation ===
      
      // Verify token metrics were tracked
      const metrics = orchestrator.getTokenMetrics();
      expect(metrics.inputTokens).toBeGreaterThan(0);
      expect(metrics.outputTokens).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBe(metrics.inputTokens + metrics.outputTokens);

      // Verify git repository state
      expect(await framework.fileExists('.git')).toBe(true);
      expect(await framework.fileExists('hello.js')).toBe(true);

      console.log('✅ Complete login → edit → save workflow completed successfully');
    });

    test('should handle workflow interruption and recovery', async () => {
      // === SETUP: Start workflow ===
      mockLoginCopilot.mockResolvedValue({
        success: true,
        message: 'Successfully logged in to GitHub Copilot'
      });

      await simulateLoginCommand();
      
      // Start file creation
      orchestrator.addMessage({
        role: 'user',
        content: 'Create a config file with some settings'
      });

      // Save intermediate state
      await orchestrator.saveSession();

      // === SIMULATE: Interruption ===
      // Create new orchestrator (simulates restart/interruption)
      const recoveredOrchestrator = new Orchestrator();
      await recoveredOrchestrator.restoreSession();

      // === VERIFY: Recovery ===
      const recoveredMessages = recoveredOrchestrator.getMessages();
      expect(recoveredMessages.length).toBeGreaterThan(0);
      
      const configMessage = recoveredMessages.find(m => 
        m.content.includes('Create a config file')
      );
      expect(configMessage).toBeDefined();

      // Continue workflow after recovery
      const continueResponse = `I'll continue creating your config file.

*** Begin Patch ***
--- /dev/null
+++ b/config.json
@@ -0,0 +1,5 @@
+{
+  "version": "1.0.0",
+  "debug": false,
+  "port": 3000
+}
*** End Patch ***`;

      recoveredOrchestrator.addMessage({
        role: 'assistant',
        content: continueResponse
      });

      // Verify recovery completion
      await recoveredOrchestrator.saveSession();
      expect(await framework.fileExists('config.json')).toBe(false); // Patch not actually applied in test
    });
  });

  describe('Multi-File Editing Workflow', () => {
    test('should handle multiple file operations in sequence', async () => {
      // Login first
      mockLoginCopilot.mockResolvedValue({ success: true, message: 'Logged in' });
      await simulateLoginCommand();

      // === File 1: Package.json ===
      const packageMessage: ChatMessage = {
        role: 'user',
        content: 'Create a package.json for a new Node.js project called "test-project"'
      };

      orchestrator.addMessage(packageMessage);

      const packageResponse = `I'll create a package.json for your test-project.

*** Begin Patch ***
--- /dev/null
+++ b/package.json
@@ -0,0 +1,12 @@
+{
+  "name": "test-project",
+  "version": "1.0.0",
+  "description": "A test project",
+  "main": "index.js",
+  "scripts": {
+    "start": "node index.js",
+    "test": "echo \\"Error: no test specified\\" && exit 1"
+  },
+  "author": "",
+  "license": "ISC"
+}
*** End Patch ***`;

      orchestrator.addMessage({ role: 'assistant', content: packageResponse });
      await simulatePatchApplication('package.json', '{"name": "test-project"}');

      // === File 2: Index.js ===
      const indexMessage: ChatMessage = {
        role: 'user',
        content: 'Now create the main index.js file with a simple server'
      };

      orchestrator.addMessage(indexMessage);

      const indexResponse = `I'll create the index.js file with a simple server.

*** Begin Patch ***
--- /dev/null
+++ b/index.js
@@ -0,0 +1,8 @@
+const http = require('http');
+
+const server = http.createServer((req, res) => {
+    res.writeHead(200, { 'Content-Type': 'text/plain' });
+    res.end('Hello from test-project!');
+});
+
+server.listen(3000, () => console.log('Server running on port 3000'));
*** End Patch ***`;

      orchestrator.addMessage({ role: 'assistant', content: indexResponse });
      await simulatePatchApplication('index.js', 'const http = require("http");');

      // === File 3: README.md ===
      const readmeMessage: ChatMessage = {
        role: 'user',
        content: 'Add a README.md with setup instructions'
      };

      orchestrator.addMessage(readmeMessage);

      const readmeResponse = `I'll create a README.md with setup instructions.

*** Begin Patch ***
--- /dev/null
+++ b/README.md
@@ -0,0 +1,15 @@
+# test-project
+
+A simple Node.js test project.
+
+## Setup
+
+1. Install dependencies:
+   \`\`\`
+   npm install
+   \`\`\`
+
+2. Start the server:
+   \`\`\`
+   npm start
+   \`\`\`
*** End Patch ***`;

      orchestrator.addMessage({ role: 'assistant', content: readmeResponse });
      await simulatePatchApplication('README.md', '# test-project');

      // === VERIFICATION ===
      // Save complete session
      await orchestrator.saveSession();

      // Verify all files are tracked in conversation
      const messages = orchestrator.getMessages();
      const packageMsg = messages.find(m => m.content.includes('package.json'));
      const indexMsg = messages.find(m => m.content.includes('index.js'));
      const readmeMsg = messages.find(m => m.content.includes('README.md'));

      expect(packageMsg).toBeDefined();
      expect(indexMsg).toBeDefined();
      expect(readmeMsg).toBeDefined();

      // Verify conversation flow makes sense
      expect(messages.length).toBeGreaterThanOrEqual(6); // 3 user + 3 assistant messages

      console.log('✅ Multi-file editing workflow completed successfully');
    });
  });

  describe('Error Handling in Workflows', () => {
    test('should handle authentication failure gracefully', async () => {
      // Mock login failure
      mockLoginCopilot.mockResolvedValue({
        success: false,
        error: 'Authentication failed: Invalid credentials'
      });

      const loginResult = await simulateLoginCommand();
      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('Authentication failed');

      // Verify error format matches Claude Code
      const errorValidation = ClaudeCodeParityValidator.validateErrorFormat(
        `❌ Error: ${loginResult.error}`
      );
      expect(errorValidation).toBe(true);

      // Verify status shows not logged in
      mockGetAuthInfo.mockResolvedValue({
        isLoggedIn: false,
        user: null,
        scopes: []
      });

      const statusResult = await simulateStatusCommand();
      expect(statusResult.output).toContain('not logged in');
    });

    test('should handle file operation failures', async () => {
      // Login successfully first
      mockLoginCopilot.mockResolvedValue({ success: true, message: 'Logged in' });
      await simulateLoginCommand();

      // Try to create file in protected location
      const protectedFileMessage: ChatMessage = {
        role: 'user',
        content: 'Create a file at /etc/protected-file.txt'
      };

      orchestrator.addMessage(protectedFileMessage);

      // Mock patch application failure
      const patchResult = await simulatePatchApplication('/etc/protected-file.txt', 'content', true);
      expect(patchResult.success).toBe(false);
      expect(patchResult.error).toBeDefined();

      // Verify error is properly communicated
      const errorMessage = `❌ Error: Permission denied: ${patchResult.error}`;
      const errorValidation = ClaudeCodeParityValidator.validateErrorFormat(errorMessage);
      expect(errorValidation).toBe(true);
    });

    test('should handle network interruptions during streaming', async () => {
      // Setup successful login
      mockLoginCopilot.mockResolvedValue({ success: true, message: 'Logged in' });
      await simulateLoginCommand();

      // Start streaming request
      const message: ChatMessage = {
        role: 'user',
        content: 'Create a large file with lots of content'
      };

      orchestrator.addMessage(message);

      // Mock streaming with interruption
      const mockStream = jest.spyOn(orchestrator, 'streamChat')
        .mockImplementation(async function* () {
          yield { type: 'content', content: 'Starting to create file...' };
          yield { type: 'content', content: 'Adding content...' };
          // Simulate network interruption
          throw new Error('Network error: Connection lost');
        });

      // Attempt streaming
      try {
        const chunks: string[] = [];
        for await (const chunk of orchestrator.streamChat([message])) {
          if (chunk.type === 'content') {
            chunks.push(chunk.content);
          }
        }
        fail('Expected network error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network error');
      }

      // Verify partial response was captured
      expect(mockStream).toHaveBeenCalled();
    });
  });

  describe('Workflow Performance and Optimization', () => {
    test('should complete workflow within performance budgets', async () => {
      const startTime = Date.now();

      // Login
      mockLoginCopilot.mockResolvedValue({ success: true, message: 'Logged in' });
      await simulateLoginCommand();

      // Create file
      orchestrator.addMessage({
        role: 'user',
        content: 'Create a simple test file'
      });

      // Process response
      orchestrator.addMessage({
        role: 'assistant',
        content: 'Created test file successfully'
      });

      // Save session
      await orchestrator.saveSession();

      const totalTime = Date.now() - startTime;

      // Workflow should complete quickly (< 5 seconds for simple operations)
      expect(totalTime).toBeLessThan(5000);

      // Verify resource usage is reasonable
      const metrics = orchestrator.getTokenMetrics();
      expect(metrics.totalTokens).toBeLessThan(1000); // Reasonable token usage
    });

    test('should handle large workflow efficiently', async () => {
      const startTime = Date.now();

      // Login
      mockLoginCopilot.mockResolvedValue({ success: true, message: 'Logged in' });
      await simulateLoginCommand();

      // Create multiple files efficiently
      const fileCount = 10;
      for (let i = 0; i < fileCount; i++) {
        orchestrator.addMessage({
          role: 'user',
          content: `Create file-${i}.js with content`
        });

        orchestrator.addMessage({
          role: 'assistant',
          content: `Created file-${i}.js successfully`
        });
      }

      await orchestrator.saveSession();

      const totalTime = Date.now() - startTime;

      // Should handle multiple operations efficiently
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds for 10 files

      const messages = orchestrator.getMessages();
      expect(messages.length).toBe(fileCount * 2 + 2); // User+assistant pairs + login messages
    });
  });
});

// Helper functions for E2E testing

async function simulateLoginCommand(): Promise<{
  success: boolean;
  output: string;
  error?: string;
}> {
  try {
    const result = await loginCopilot();
    if (result.success) {
      return {
        success: true,
        output: result.message || 'Successfully logged in to GitHub Copilot'
      };
    } else {
      return {
        success: false,
        output: '',
        error: result.error || 'Login failed'
      };
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown login error'
    };
  }
}

async function simulateStatusCommand(): Promise<{
  success: boolean;
  output: string;
  error?: string;
}> {
  try {
    const config = await loadConfig();
    const auth = await getAuthInfo();
    
    const providerStatus = config.provider?.active || 'none';
    const modelStatus = config.model?.active || 'none';
    const accountInfo = auth.isLoggedIn ? auth.user : 'not logged in';

    const statusString = `status: provider=${providerStatus} model=${modelStatus} account=${accountInfo}`;
    
    return {
      success: true,
      output: statusString
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Status check failed'
    };
  }
}

async function simulatePatchApplication(
  filename: string,
  content: string,
  shouldFail = false
): Promise<{
  success: boolean;
  filesChanged: string[];
  error?: string;
}> {
  if (shouldFail) {
    return {
      success: false,
      filesChanged: [],
      error: `Failed to write to ${filename}`
    };
  }

  // Mock successful patch application
  return {
    success: true,
    filesChanged: [filename]
  };
}