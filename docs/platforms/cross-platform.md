# Cross-Platform Support

## OS Matrix
- macOS 13+, Ubuntu 22.04+, Windows 11.

## PTY
- macOS/Linux: `node-pty` with default shell.
- Windows: ConPTY; fall back to PowerShell if needed.

## Paths & EOL
- Normalize path separators in UI; preserve file EOL.

## Clipboard/Export
- macOS: `pbcopy`; Linux: `xclip`/`xsel`; Windows: `clip`.

## Colors
- Respect `NO_COLOR` and `FORCE_COLOR`.
