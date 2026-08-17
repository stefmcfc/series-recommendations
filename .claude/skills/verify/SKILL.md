---
name: verify
description: Build/launch/drive recipe for verifying changes to the TV Series Tracker end-to-end — backend via curl/API, frontend via browser. Frontend browser-driving currently covers `SeriesList` only, which isn't wired into `App.tsx` yet; extend this section as more components land.
---

# Verifying this app end-to-end

## Launch (backend)

- `cd backend && gradlew.bat bootRun` starts the Spring Boot server on **:8080**.
- **Gotcha — run from `backend/`.** The SQLite file path (`jdbc:sqlite:./data/series.db`) is relative to the working directory. Running Gradle from anywhere else creates/looks for the DB in the wrong place (or fails to find `backend/data/`, which must exist first — see RUNBOOK.md troubleshooting).
- Flyway runs migrations automatically on startup — no separate migrate step.
- Ready when `curl http://localhost:8080/api/v1/series` returns `{ "data": [], "count": 0 }` (or existing data, not empty on a reused DB).
- **Gotcha — port 8080 already in use.** `netstat -ano | findstr :8080` then `taskkill /PID <pid> /F`. Common if a previous `bootRun` was backgrounded and not cleanly stopped.
- Only `gradlew.bat` is checked in (Windows) — there's no Unix wrapper, so this only runs as-is on Windows.

## Launch (frontend)

- `cd frontend && npm run dev` starts Vite on **:5173**, proxying `/api` to `:8080` (`vite.config.ts`).
- `SeriesList` exists (`frontend/src/components/SeriesList.tsx`) but **isn't wired into `App.tsx` yet** — `App.tsx` is still the unmodified Vite scaffold. To see or drive it in a browser, temporarily mount it (see "Drive (frontend)" below); don't leave that wiring in when you're done.
- `@axe-core/react` runs automatically in dev mode (`main.tsx`, gated on `import.meta.env.DEV`) and logs accessibility violations to the browser console. It re-scans on every DOM mutation, not just first render — check the console after driving each state, not only on load.

## Drive (backend, via curl)

Smoke-test the full CRUD + search + export surface after a backend change:

```bash
# Create
curl -X POST http://localhost:8080/api/v1/series \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"The Office\", \"year\": 2005, \"genres\": \"Comedy\", \"totalSeasons\": 9}"

# Read all / one
curl http://localhost:8080/api/v1/series
curl http://localhost:8080/api/v1/series/{id}

# Update progress
curl -X PATCH http://localhost:8080/api/v1/series/{id} \
  -H "Content-Type: application/json" \
  -d "{\"currentSeason\": 3, \"currentEpisode\": 7}"

# Search / filter
curl "http://localhost:8080/api/v1/series/search?title=office&status=WATCHING"

# Export
curl "http://localhost:8080/api/v1/series/export?format=json"
curl "http://localhost:8080/api/v1/series/export?format=csv"

# Delete
curl -X DELETE http://localhost:8080/api/v1/series/{id}
```

## Drive (frontend, via browser)

Nothing is wired into `App.tsx` yet, so verifying a component means temporarily mounting it, driving it, then reverting the mount before committing:

1. Add a temporary import + render to `App.tsx` (e.g. `import { SeriesList } from './components/SeriesList'` and `<SeriesList />` near the top of the returned JSX).
2. `cd frontend && npm run dev`, then open `http://localhost:5173` (the `claude-in-chrome` skill's tools work well for this — navigate, screenshot, and `read_console_messages` with a pattern like `axe|violat|error`).
3. Drive through the states that matter for a data-fetching component:
   - **Loading** — visible immediately on mount, before the fetch resolves.
   - **Error** — works without the backend running at all (the fetch fails naturally); confirms error copy, retry button, `role="alert"`.
   - **Empty** — backend running (`gradlew.bat bootRun` from `backend/`) with no rows in the DB.
   - **Populated** — `POST` a series first (see the curl recipe above), then reload.
4. Check the console for axe violations after each state change, and `zoom`/screenshot anything visually suspicious.
5. **Revert the temporary `App.tsx` mount** before committing — `git diff frontend/src/App.tsx` should be empty.

**Gotcha — dark theme.** This app's CSS uses `prefers-color-scheme` (`frontend/src/index.css`'s `--text`/`--text-h`/`--bg`/`--border`/`--accent`/`--social-bg` custom properties). A component styled with hardcoded light-theme colors will pass every Vitest assertion (jsdom doesn't render CSS) and still fail an axe contrast check the moment it's actually rendered in a browser in dark mode. Use the shared custom properties, not hardcoded hex values, and always do at least one real browser pass — Vitest alone isn't sufficient sign-off for a new component's styling.

**Gotcha — stale `node_modules` after switching branches.** If tests suddenly fail with `Cannot find module '@testing-library/dom'` (or similar) right after a `git checkout`/rebase, it means `node_modules` reflects a different branch's `package.json` than the one you're now on. Run `npm ci` (or `npm install`) again — git doesn't touch `node_modules` on checkout.

## Worth probing

- Validation: missing/blank `title`, out-of-range ratings (`imdbRating > 10`, `metacriticRating > 100`), `currentSeason > totalSeasons`, `dateCompleted` set while `status != COMPLETED` — each should return 400 with a field-level message via `GlobalExceptionHandler`, never a raw stack trace.
- 404 on a non-existent series `id` (must be a valid UUID shape — check what happens with a malformed one too).
- `/search` with no matching criteria (empty result, not an error) and with an unknown `status` value.
- `/export?format=xml` or another unsupported format — confirm this fails cleanly rather than silently defaulting.
- Response bodies never leak internals (SQL, stack traces, file paths) — matches the "no stack traces in API error responses" expectation already met by `GlobalExceptionHandler`.

## Resetting between runs

```bash
del backend\data\series.db
```

Then restart `bootRun` — Flyway recreates the schema from scratch. Useful when testing migration changes or when leftover data from a previous manual test is in the way.
