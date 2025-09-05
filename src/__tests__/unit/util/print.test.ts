import { print } from '../../../util/print';

describe('print', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('should write string with newline to stdout', () => {
    print('Hello, World!');
    expect(stdoutSpy).toHaveBeenCalledWith('Hello, World!\n');
  });

  it('should handle empty strings', () => {
    print('');
    expect(stdoutSpy).toHaveBeenCalledWith('\n');
  });

  it('should handle strings with special characters', () => {
    print('Line 1\nLine 2\tTabbed');
    expect(stdoutSpy).toHaveBeenCalledWith('Line 1\nLine 2\tTabbed\n');
  });

  it('should handle unicode characters', () => {
    print('Hello 世界 🌍');
    expect(stdoutSpy).toHaveBeenCalledWith('Hello 世界 🌍\n');
  });

  it('should handle multiple calls', () => {
    print('First');
    print('Second');
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'First\n');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, 'Second\n');
  });
});