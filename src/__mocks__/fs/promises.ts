// Mock for fs/promises module
const fs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn(),
  rename: jest.fn(),
  copyFile: jest.fn(),
  appendFile: jest.fn(),
  realpath: jest.fn(),
};

export default fs;
export const {
  readFile,
  writeFile,
  mkdir,
  access,
  readdir,
  stat,
  unlink,
  rmdir,
  rename,
  copyFile,
  appendFile,
  realpath,
} = fs;