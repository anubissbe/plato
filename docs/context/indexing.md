# Indexing, Watchers, Context Budget

## Index & Ignore
- Roots: current repo plus `/add-dir` entries.
- Ignore: `.gitignore`, `.platoignore`, binary detection, size caps.
- Build file table: path, size, lang, checksum, last seen; store in cache.

## Watchers
- FS watch per root: debounced updates to file table.
- Large changes trigger background reindex.

## Selection & Budget
- `/context` shows selected artifacts and token estimate by item.
- Auto-sampler: choose representative code slices with headers and locations.
- Keep within `model.context_window` minus system/overhead.
