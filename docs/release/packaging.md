# Packaging & Releases

## Requirements
- Node.js 20+; ship as npm package with postinstall checks.
- External deps: `git`, `rg` available in PATH.

## Bundling
- Bundle with `@vercel/ncc` or `esbuild` for fast startup.
- Optional: prebuilt binaries via `pkg` for platforms that need it.

## CI Pipeline
- Lint/test → build → package tgz → smoke E2E on Linux/macOS/Windows.
- Attach `RELEASE_NOTES.md` and update `/release-notes` feed.

## Versioning
- Semver; breaking changes require migration notes.
