/**
 * Initial test to verify Jest setup
 * This test ensures our testing infrastructure is working correctly
 */

describe('Jest Setup Verification', () => {
  it('should run a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with TypeScript types', () => {
    const message: string = 'Jest is configured';
    expect(message).toContain('Jest');
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve('async works');
    await expect(promise).resolves.toBe('async works');
  });
});