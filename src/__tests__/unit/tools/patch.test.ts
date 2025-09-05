// Mock dependencies at the top level before any imports
jest.mock('execa', () => ({
  execa: jest.fn()
}));

jest.mock('fs/promises');

// Mock simple-git to handle dynamic import
jest.mock('simple-git', () => jest.fn(() => ({
  checkIsRepo: jest.fn().mockResolvedValue(true)
})));

import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { dryRunApply, apply, revert, revertLast } from '../../../tools/patch';

const mockExeca = execa as jest.MockedFunction<typeof execa>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('patch', () => {
  const mockCwd = '/project';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    
    // Setup default fs mocks
    mockFs.stat = jest.fn().mockRejectedValue(new Error('ENOENT'));
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFs.writeFile = jest.fn().mockResolvedValue(undefined);
    mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify([]));
    mockFs.rm = jest.fn().mockResolvedValue(undefined);
    
    // Setup default execa mock
    mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any);
  });

  describe('dryRunApply', () => {
    it('should return ok=true when patch can be applied', async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`;

      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

      const result = await dryRunApply(diff);

      expect(result).toEqual({ ok: true, conflicts: [] });
      expect(mockExeca).toHaveBeenCalledWith('git', ['apply', '--check', expect.any(String)]);
    });

    it('should return ok=false with conflicts when patch cannot be applied', async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`;

      const error = new Error('Git apply failed') as any;
      error.stderr = 'error: patch failed: file.txt:1\nerror: file.txt: patch does not apply';
      mockExeca.mockRejectedValueOnce(error);

      const result = await dryRunApply(diff);

      expect(result.ok).toBe(false);
      expect(result.conflicts).toContain('error: patch failed: file.txt:1');
      expect(result.conflicts).toContain('error: file.txt: patch does not apply');
    });

    it('should sanitize diff by removing Begin/End Patch markers', async () => {
      const diff = `*** Begin Patch
--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line
*** End Patch`;

      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

      await dryRunApply(diff);

      // Check that the diff was written without the markers
      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        typeof call[1] === 'string' && call[1].includes('--- a/file.txt')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![1]).not.toContain('*** Begin Patch');
      expect(writeCall![1]).not.toContain('*** End Patch');
    });
  });

  describe('apply', () => {
    it('should apply patch and save to journal', async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`;

      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

      await apply(diff);

      // Check git apply call with --whitespace=nowarn flag
      expect(mockExeca).toHaveBeenCalledWith('git', ['apply', '--whitespace=nowarn', expect.any(String)]);
      
      // Verify there were 2 calls (temp file + journal)
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
      
      // Check that journal was written with apply action
      const hasJournalWrite = mockFs.writeFile.mock.calls.some(call => 
        String(call[1]).includes('action') && String(call[1]).includes('apply')
      );
      expect(hasJournalWrite).toBe(true);
    });

    it('should throw error when patch cannot be applied', async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`;

      const error = new Error('Git apply failed') as any;
      error.stderr = 'error: patch failed';
      mockExeca.mockRejectedValueOnce(error);

      await expect(apply(diff)).rejects.toThrow();
    });
  });

  describe('revert', () => {
    it('should revert patch using git apply -R', async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`;

      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

      await revert(diff);

      expect(mockExeca).toHaveBeenCalledWith('git', ['apply', '-R', expect.any(String)]);
      
      // Verify there were 2 calls (temp file + journal)
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
      
      // Check that journal was written with revert action
      const hasJournalWrite = mockFs.writeFile.mock.calls.some(call => 
        String(call[1]).includes('action') && String(call[1]).includes('revert')
      );
      expect(hasJournalWrite).toBe(true);
    });
  });

  describe('revertLast', () => {
    it('should revert last patch from journal', async () => {
      const journal = [
        {
          action: 'apply',
          diff: `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`,
          at: 1234567890
        }
      ];

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(journal));
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

      const result = await revertLast();

      expect(result).toBe(true);
      expect(mockExeca).toHaveBeenCalledWith('git', ['apply', '-R', expect.any(String)]);
    });

    it('should return false when no patches to revert', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify([]));

      const result = await revertLast();

      expect(result).toBe(false);
    });

    it('should return false when journal file does not exist', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await revertLast();

      expect(result).toBe(false);
    });

    it('should skip revert entries and only revert apply entries', async () => {
      const journal = [
        {
          action: 'revert',
          diff: `--- a/file.txt`,
          at: 1234567880
        },
        {
          action: 'apply',
          diff: `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old line
+new line`,
          at: 1234567890
        }
      ];

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(journal));
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

      const result = await revertLast();

      expect(result).toBe(true);
      expect(mockExeca).toHaveBeenCalledWith('git', ['apply', '-R', expect.any(String)]);
    });
  });
});
