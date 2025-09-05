// Note: These are internal functions from orchestrator.ts
// We need to test them by importing the module and accessing internal functions
// For now, we'll create unit tests that would test the parsing logic

describe('orchestrator parsers', () => {
  // Mock the parsing functions to test their logic
  
  describe('parseToolCall', () => {
    // Test the tool call parsing logic
    function parseToolCall(text: string, strict = true): null | { server: string; name: string; input: any } {
      // Recreate the parsing logic for testing
      const fences = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
      for (const m of fences) {
        try {
          const obj = JSON.parse(m[1]);
          const tc = obj.tool_call || obj["tool_call"];
          if (tc && typeof tc === 'object') {
            const server = tc.server;
            const name = tc.name;
            const input = tc.input ?? {};
            if (server && name) return { server, name, input };
          }
          if (!strict) {
            const server = obj.server || obj.mcp_server || obj.provider;
            const name = obj.name || obj.tool || obj.tool_name;
            const input = obj.input || obj.arguments || obj.params || {};
            if (server && name) return { server, name, input };
          }
        } catch {}
      }
      return null;
    }

    it('should parse valid tool call in JSON fenced block', () => {
      const text = `
Here's a tool call:
\`\`\`json
{"tool_call": {"server": "test-server", "name": "test-tool", "input": {"param": "value"}}}
\`\`\`
      `;

      const result = parseToolCall(text);

      expect(result).toEqual({
        server: 'test-server',
        name: 'test-tool',
        input: { param: 'value' }
      });
    });

    it('should parse tool call without explicit input', () => {
      const text = `
\`\`\`json
{"tool_call": {"server": "test-server", "name": "test-tool"}}
\`\`\`
      `;

      const result = parseToolCall(text);

      expect(result).toEqual({
        server: 'test-server',
        name: 'test-tool',
        input: {}
      });
    });

    it('should return null for invalid JSON', () => {
      const text = `
\`\`\`json
{"tool_call": invalid json}
\`\`\`
      `;

      const result = parseToolCall(text);

      expect(result).toBeNull();
    });

    it('should return null when no tool_call found in strict mode', () => {
      const text = `
\`\`\`json
{"server": "test-server", "name": "test-tool", "input": {"param": "value"}}
\`\`\`
      `;

      const result = parseToolCall(text, true);

      expect(result).toBeNull();
    });

    it('should parse alternative formats in non-strict mode', () => {
      const text = `
\`\`\`json
{"server": "test-server", "name": "test-tool", "input": {"param": "value"}}
\`\`\`
      `;

      const result = parseToolCall(text, false);

      expect(result).toEqual({
        server: 'test-server',
        name: 'test-tool',
        input: { param: 'value' }
      });
    });

    it('should handle alternative server and name keys in non-strict mode', () => {
      const text = `
\`\`\`json
{"mcp_server": "test-server", "tool": "test-tool", "params": {"param": "value"}}
\`\`\`
      `;

      const result = parseToolCall(text, false);

      expect(result).toEqual({
        server: 'test-server',
        name: 'test-tool',
        input: { param: 'value' }
      });
    });

    it('should return null when server or name is missing', () => {
      const text = `
\`\`\`json
{"tool_call": {"server": "test-server"}}
\`\`\`
      `;

      const result = parseToolCall(text);

      expect(result).toBeNull();
    });

    it('should handle multiple JSON blocks and return first valid', () => {
      const text = `
First block:
\`\`\`json
{"invalid": "json"}
\`\`\`

Second block:
\`\`\`json
{"tool_call": {"server": "test-server", "name": "test-tool"}}
\`\`\`
      `;

      const result = parseToolCall(text);

      expect(result).toEqual({
        server: 'test-server',
        name: 'test-tool',
        input: {}
      });
    });
  });

  describe('parseDiffDetails', () => {
    // Test diff parsing logic
    function parseDiffDetails(patch: string): { file: string; addedLines: number; newFile: boolean; preview: string[] }[] {
      const results: { file: string; addedLines: number; newFile: boolean; preview: string[] }[] = [];
      const fileHeaders = patch.match(/^diff --git a\/.+ b\/.+$/gm) || patch.match(/^--- .+$/gm) || [];
      
      for (const header of fileHeaders) {
        const fileMatch = header.match(/^--- a\/(.+)$|^--- (.+)$/) || header.match(/^diff --git a\/(.+) b\/(.+)$/);
        if (!fileMatch) continue;
        
        const file = fileMatch[1] || fileMatch[2];
        if (!file) continue;
        
        // Count added lines (lines starting with +)
        const addedLines = (patch.match(/^\+[^+]/gm) || []).length;
        
        // Check if it's a new file
        const newFile = patch.includes('new file mode') || patch.includes('--- /dev/null');
        
        // Extract preview lines (first few lines of changes)
        const previewMatch = patch.match(/@@.*?@@\n((?:.*\n){0,5})/);
        const preview = previewMatch ? previewMatch[1].trim().split('\n') : [];
        
        results.push({ file, addedLines, newFile, preview });
        break; // For simplicity, just handle the first file
      }
      
      return results;
    }

    it('should parse basic diff with file changes', () => {
      const patch = `--- a/src/test.js
+++ b/src/test.js
@@ -1,3 +1,4 @@
 const test = true;
+const newVar = false;
 console.log(test);
 module.exports = test;`;

      const result = parseDiffDetails(patch);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('src/test.js');
      expect(result[0].addedLines).toBeGreaterThan(0);
      expect(result[0].newFile).toBe(false);
    });

    it('should detect new files', () => {
      const patch = `--- /dev/null
+++ b/src/newfile.js
@@ -0,0 +1,5 @@
+const newFile = true;
+console.log('This is new');
+module.exports = newFile;`;

      const result = parseDiffDetails(patch);

      expect(result).toHaveLength(1);
      expect(result[0].newFile).toBe(true);
    });

    it('should handle git diff format', () => {
      const patch = `diff --git a/src/test.js b/src/test.js
index abc123..def456 100644
--- a/src/test.js
+++ b/src/test.js
@@ -1,2 +1,3 @@
 const test = true;
+const added = 'new line';
 console.log(test);`;

      const result = parseDiffDetails(patch);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('src/test.js');
    });

    it('should return empty array for invalid patch', () => {
      const patch = 'This is not a valid diff';

      const result = parseDiffDetails(patch);

      expect(result).toEqual([]);
    });
  });

  describe('parseAllToolCalls', () => {
    function parseAllToolCalls(text: string, strict = true): { server: string; name: string; input: any }[] {
      const calls: { server: string; name: string; input: any }[] = [];
      const fences = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
      
      for (const m of fences) {
        try {
          const obj = JSON.parse(m[1]);
          const tc = obj.tool_call || obj["tool_call"];
          if (tc && typeof tc === 'object') {
            const server = tc.server;
            const name = tc.name;
            const input = tc.input ?? {};
            if (server && name) calls.push({ server, name, input });
          }
        } catch {}
      }
      
      return calls;
    }

    it('should parse multiple tool calls', () => {
      const text = `
First call:
\`\`\`json
{"tool_call": {"server": "server1", "name": "tool1", "input": {"param1": "value1"}}}
\`\`\`

Second call:
\`\`\`json
{"tool_call": {"server": "server2", "name": "tool2", "input": {"param2": "value2"}}}
\`\`\`
      `;

      const result = parseAllToolCalls(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        server: 'server1',
        name: 'tool1',
        input: { param1: 'value1' }
      });
      expect(result[1]).toEqual({
        server: 'server2',
        name: 'tool2',
        input: { param2: 'value2' }
      });
    });

    it('should skip invalid tool calls', () => {
      const text = `
Valid call:
\`\`\`json
{"tool_call": {"server": "server1", "name": "tool1"}}
\`\`\`

Invalid call:
\`\`\`json
{"invalid": "format"}
\`\`\`

Another valid call:
\`\`\`json
{"tool_call": {"server": "server2", "name": "tool2"}}
\`\`\`
      `;

      const result = parseAllToolCalls(text);

      expect(result).toHaveLength(2);
      expect(result[0].server).toBe('server1');
      expect(result[1].server).toBe('server2');
    });

    it('should return empty array when no tool calls found', () => {
      const text = `
Some regular text without tool calls.
\`\`\`json
{"not": "a tool call"}
\`\`\`
      `;

      const result = parseAllToolCalls(text);

      expect(result).toEqual([]);
    });
  });
});