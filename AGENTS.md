# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Application code grouped by domain (e.g., `src/core/`, `src/api/`).
- `tests/`: Mirrors `src/` layout; name tests to match targets.
- `scripts/`: Developer utilities (setup, lint, format, release).
- `assets/` or `public/`: Static files (images, schemas, samples).
- `docs/`: Architecture notes, ADRs, and runbooks.

Example: `src/<module>/` with `index` (entry), `models`, `services`, and `__init__`/`utils` as appropriate.

## Build, Test, and Development Commands
Prefer Makefile tasks when available; otherwise use the language’s native tools.
- Build: `make build` or language-specific build (e.g., `npm run build`).
- Dev run: `make dev` (hot reload) or `python -m <pkg>` / `npm run dev`.
- Install deps: `make setup` or `python -m venv .venv && pip install -r requirements.txt` / `npm ci`.
- Tests: `make test` or `pytest -q` / `npm test`.
- Lint/format: `make lint fmt` or `ruff . && black .` / `eslint . && prettier -w .`.

## Coding Style & Naming Conventions
- Indentation: 4 spaces (Python), 2 spaces (JS/TS). Keep lines ≤ 100 chars.
- Names: `snake_case` for Python modules/functions; `camelCase` for variables; `PascalCase` for classes; kebab-case for file names where idiomatic.
- Structure: small, cohesive modules; avoid cyclic deps; prefer dependency injection over globals.
- Tooling: use linters/formatters (e.g., Ruff + Black, ESLint + Prettier). Configure via `pyproject.toml` or project configs.

## Testing Guidelines
- Frameworks: pytest for Python, Vitest/Jest for JS/TS.
- Naming: mirror source path; use `_test.py` or `.test.ts`/`.test.js` suffixes.
- Coverage: target ≥ 80% on changed code. Run with `pytest --cov=src` or `vitest run --coverage`.
- Practices: unit tests near edges; integration tests for modules; use fixtures in `tests/fixtures/`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`). Imperative, concise subject; add context in body.
- PRs: clear description, linked issues (`Closes #123`), screenshots or logs for behavior changes, and test notes. Keep PRs focused and small.

## Security & Configuration
- Secrets: never commit `.env`; provide `.env.example` and document required vars. Rotate keys on exposure.
- Dependencies: pin versions; run `pip-audit` / `npm audit` in CI. Validate all external inputs.
