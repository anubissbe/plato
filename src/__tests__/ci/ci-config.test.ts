/**
 * CI Configuration Validation Tests
 * 
 * Tests to ensure CI/CD configuration files are valid and properly configured
 * for the GitHub Actions workflow, coverage reporting, and quality gates.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface GitHubActionsWorkflow {
  name?: string;
  on: string | string[] | Record<string, any>;
  jobs: Record<string, JobDefinition>;
  env?: Record<string, string>;
}

interface JobDefinition {
  name?: string;
  'runs-on': string | string[];
  strategy?: {
    matrix?: Record<string, any[]>;
    'fail-fast'?: boolean;
    'max-parallel'?: number;
  };
  steps: Array<{
    name?: string;
    uses?: string;
    run?: string;
    with?: Record<string, any>;
    env?: Record<string, string>;
    if?: string;
  }>;
  timeout?: number;
  'continue-on-error'?: boolean;
}

describe('CI Configuration Validation', () => {
  // Module-scoped variables for sharing between test suites
  let workflowContent: GitHubActionsWorkflow | null = null;
  let packageJson: any = null;
  let readmeContent: string = '';
  let readmeExists: boolean = false;
  let workflowExists: boolean = false;

  beforeAll(async () => {
    // Load workflow file
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'test.yml');
    try {
      await fs.access(workflowPath);
      workflowExists = true;
      const fileContent = await fs.readFile(workflowPath, 'utf-8');
      workflowContent = yaml.load(fileContent) as GitHubActionsWorkflow;
    } catch {
      workflowExists = false;
      workflowContent = null;
    }

    // Load package.json
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      packageJson = JSON.parse(content);
    } catch {
      packageJson = null;
    }

    // Load README
    try {
      const readmePath = path.join(process.cwd(), 'README.md');
      readmeContent = await fs.readFile(readmePath, 'utf-8');
      readmeExists = true;
    } catch {
      readmeExists = false;
    }
  });

  describe('GitHub Actions Workflow', () => {
    test('should have GitHub Actions workflow file', () => {
      expect(workflowExists).toBe(true);
    });

    test('should trigger on pull requests', () => {
      if (!workflowContent) {
        expect(workflowContent).not.toBeNull();
        return;
      }

      const triggers = workflowContent.on;
      const hasPRTrigger = 
        triggers === 'pull_request' ||
        (Array.isArray(triggers) && triggers.includes('pull_request')) ||
        (typeof triggers === 'object' && 'pull_request' in triggers);

      expect(hasPRTrigger).toBe(true);
    });

    test('should have test job configured', () => {
      if (!workflowContent) return;

      expect(workflowContent.jobs).toHaveProperty('test');
      const testJob = workflowContent.jobs.test;
      expect(testJob).toBeDefined();
    });

    test('should use matrix strategy for Node.js versions', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      expect(testJob.strategy).toBeDefined();
      expect(testJob.strategy?.matrix).toBeDefined();
      expect(testJob.strategy?.matrix?.node).toBeDefined();
      
      // Should test Node 18, 20, 22
      const nodeVersions = testJob.strategy?.matrix?.node;
      expect(nodeVersions).toContain(18);
      expect(nodeVersions).toContain(20);
      expect(nodeVersions).toContain(22);
    });

    test('should use matrix strategy for operating systems', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      expect(testJob.strategy?.matrix?.os).toBeDefined();
      
      // Should test on Ubuntu, macOS, Windows
      const osSystems = testJob.strategy?.matrix?.os;
      expect(osSystems).toContain('ubuntu-latest');
      expect(osSystems).toContain('macos-latest');
      expect(osSystems).toContain('windows-latest');
    });

    test('should have proper job steps', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      const steps = testJob.steps;
      
      // Essential steps
      const hasCheckout = steps.some(step => step.uses?.includes('actions/checkout'));
      const hasNodeSetup = steps.some(step => step.uses?.includes('actions/setup-node'));
      const hasInstall = steps.some(step => step.run?.includes('npm ci'));
      const hasTest = steps.some(step => 
        step.run?.includes('npm test') || 
        step.run?.includes('npm run test')
      );
      
      expect(hasCheckout).toBe(true);
      expect(hasNodeSetup).toBe(true);
      expect(hasInstall).toBe(true);
      expect(hasTest).toBe(true);
    });

    test('should run tests with coverage', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      const hasTestWithCoverage = testJob.steps.some(step => 
        step.run?.includes('npm run test:ci') ||
        (step.run?.includes('npm test') && step.run?.includes('--coverage'))
      );
      
      expect(hasTestWithCoverage).toBe(true);
    });

    test('should include linting step', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      const hasLint = testJob.steps.some(step => step.run?.includes('npm run lint'));
      
      expect(hasLint).toBe(true);
    });

    test('should include type checking step', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      const hasTypecheck = testJob.steps.some(step => 
        step.run?.includes('npm run typecheck') || 
        step.run?.includes('tsc')
      );
      
      expect(hasTypecheck).toBe(true);
    });

    test('should have coverage reporting step', () => {
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      const hasCoverageUpload = testJob.steps.some(step => 
        step.uses?.includes('codecov/codecov-action') ||
        step.uses?.includes('coverallsapp/github-action')
      );
      
      expect(hasCoverageUpload).toBe(true);
    });
  });

  describe('Package.json CI Scripts', () => {
    test('should have test:ci script', () => {
      if (!packageJson) {
        expect(packageJson).not.toBeNull();
        return;
      }
      expect(packageJson.scripts).toHaveProperty('test:ci');
    });

    test('should have test:coverage script', () => {
      if (!packageJson) return;
      expect(packageJson.scripts).toHaveProperty('test:coverage');
    });

    test('test:ci script should use appropriate flags', () => {
      if (!packageJson) return;
      const testCiScript = packageJson.scripts['test:ci'];
      expect(testCiScript).toContain('--ci');
      expect(testCiScript).toContain('--coverage');
      expect(testCiScript).toContain('--maxWorkers');
    });
  });

  describe('Coverage Configuration', () => {
    test('should have coverage thresholds configured', () => {
      // Check if jest.config.cjs has coverage thresholds
      const jestConfig = require(path.join(process.cwd(), 'jest.config.cjs'));
      
      expect(jestConfig.coverageThreshold).toBeDefined();
      expect(jestConfig.coverageThreshold.global).toBeDefined();
      
      const thresholds = jestConfig.coverageThreshold.global;
      expect(thresholds.branches).toBeGreaterThanOrEqual(80);
      expect(thresholds.functions).toBeGreaterThanOrEqual(80);
      expect(thresholds.lines).toBeGreaterThanOrEqual(80);
      expect(thresholds.statements).toBeGreaterThanOrEqual(80);
    });

    test('should have coverage reporters configured', () => {
      const jestConfig = require(path.join(process.cwd(), 'jest.config.cjs'));
      
      expect(jestConfig.coverageReporters).toBeDefined();
      expect(jestConfig.coverageReporters).toContain('text');
      expect(jestConfig.coverageReporters).toContain('lcov');
      expect(jestConfig.coverageReporters).toContain('html');
    });

    test('should collect coverage from correct files', () => {
      const jestConfig = require(path.join(process.cwd(), 'jest.config.cjs'));
      
      expect(jestConfig.collectCoverageFrom).toBeDefined();
      expect(jestConfig.collectCoverageFrom).toContain('src/**/*.{ts,tsx}');
      expect(jestConfig.collectCoverageFrom).toContain('!src/**/*.test.ts');
      expect(jestConfig.collectCoverageFrom).toContain('!src/**/__tests__/**');
    });
  });

  describe('CI Performance Requirements', () => {
    test('should have reasonable timeout configured', () => {
      // Test that CI workflow has a reasonable timeout
      if (!workflowContent) return;

      const testJob = workflowContent.jobs.test;
      const timeout = testJob.timeout || 60; // Default to 60 minutes
      
      expect(timeout).toBeLessThanOrEqual(60); // Should timeout within 60 minutes
      expect(timeout).toBeGreaterThanOrEqual(5); // But allow at least 5 minutes
    });

    test('should use parallel test execution', () => {
      if (!packageJson) return;
      const testCiScript = packageJson.scripts['test:ci'];
      expect(testCiScript).toContain('--maxWorkers');
      
      // Extract maxWorkers value
      const match = testCiScript.match(/--maxWorkers[=\s]+(\d+)/);
      if (match) {
        const workers = parseInt(match[1], 10);
        expect(workers).toBeGreaterThanOrEqual(2);
        expect(workers).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('README Coverage Badges', () => {
    test('should have README file', () => {
      expect(readmeExists).toBe(true);
    });

    test('should include coverage badge', () => {
      if (!readmeExists) return;
      // Check for coverage badge patterns (Codecov or Coveralls)
      const hasCodecovBadge = readmeContent.includes('codecov.io/gh/');
      const hasCoverallsBadge = readmeContent.includes('coveralls.io/repos/');
      const hasCoverageBadge = readmeContent.includes('![Coverage]') || 
                               readmeContent.includes('![coverage]');
      
      expect(hasCodecovBadge || hasCoverallsBadge || hasCoverageBadge).toBe(true);
    });

    test('should include build status badge', () => {
      if (!readmeExists) return;
      const hasBuildBadge = readmeContent.includes('github.com/') && 
                           (readmeContent.includes('/workflows/') || 
                            readmeContent.includes('/actions/'));
      
      expect(hasBuildBadge).toBe(true);
    });
  });

  describe('Required Files Existence', () => {
    test('should have .github/workflows directory', async () => {
      const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
      await expect(fs.access(workflowsDir)).resolves.not.toThrow();
    });

    test('should have coverage output directory configured', () => {
      const jestConfig = require(path.join(process.cwd(), 'jest.config.cjs'));
      expect(jestConfig.coverageDirectory).toBeDefined();
      expect(jestConfig.coverageDirectory).toBe('coverage');
    });

    test('should have .gitignore entry for coverage', async () => {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      
      expect(gitignoreContent).toContain('coverage/');
    });
  });
});
