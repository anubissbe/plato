// Mock for execa module to avoid ESM issues in Jest
export const execa = jest.fn().mockImplementation((command: string, args: string[] = [], options: any = {}) => {
  return Promise.resolve({
    stdout: '',
    stderr: '',
    exitCode: 0,
    failed: false,
    command: `${command} ${args.join(' ')}`,
    escapedCommand: `${command} ${args.join(' ')}`,
    killed: false,
    signal: undefined,
    timedOut: false,
  });
});

export const execaSync = jest.fn().mockImplementation((command: string, args: string[] = [], options: any = {}) => {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    failed: false,
    command: `${command} ${args.join(' ')}`,
    escapedCommand: `${command} ${args.join(' ')}`,
    killed: false,
    signal: undefined,
    timedOut: false,
  };
});

export const execaCommand = jest.fn().mockImplementation((command: string, options: any = {}) => {
  return Promise.resolve({
    stdout: '',
    stderr: '',
    exitCode: 0,
    failed: false,
    command,
    escapedCommand: command,
    killed: false,
    signal: undefined,
    timedOut: false,
  });
});

export const execaCommandSync = jest.fn().mockImplementation((command: string, options: any = {}) => {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    failed: false,
    command,
    escapedCommand: command,
    killed: false,
    signal: undefined,
    timedOut: false,
  };
});

export default execa;