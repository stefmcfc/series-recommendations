---
name: verify
description: Build/launch/drive recipe for verifying changes to the TV Series Tracker end-to-end — backend via curl/API, frontend via browser. `SeriesList` and `AddSeriesForm` are both wired into `App.tsx` (Frontend Specs 002/003); extend this section as more components land.
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
- `SeriesList` and `AddSeriesForm` are both wired into `App.tsx` (Frontend Specs 002/003) — no temporary mounting needed, `npm run dev` + open the browser is enough.
- `@axe-core/react` runs automatically in dev mode (`main.tsx`, gated on `import.meta.env.DEV`) and logs accessibility violations to the browser console. It re-scans on every DOM mutation, not just first render — check the console after driving each state, not only on load.
- **Gotcha — CORS blocks the browser (but not curl or Vitest) if you hit the backend directly.** The backend has no CORS config, and `seriesApi.ts`'s default `VITE_API_BASE` is the absolute URL `http://localhost:8080/api/v1`, so a browser on `http://localhost:5173` calling it directly is a blocked cross-origin request (shows up as "Failed to load series. Please try again." even though the backend is healthy). Work around it for a browser pass by creating a git-ignored `frontend/.env.local` with `VITE_API_BASE=/api/v1`, which routes calls through Vite's own dev-server proxy (server-side, not subject to browser CORS) — see RUNBOOK.md's Troubleshooting section for detail. Delete `.env.local` again afterwards; don't leave it in place.

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

`SeriesList` and `AddSeriesForm` are both already wired into `App.tsx` — no temporary mounting needed for either.

1. Apply the CORS workaround above (`frontend/.env.local` with `VITE_API_BASE=/api/v1`) if driving against a real backend.
2. `cd frontend && npm run dev`, then open `http://localhost:5173` (the `claude-in-chrome` skill's tools work well for this — navigate, screenshot, and `read_console_messages` with a pattern like `axe|violat|error`; if that tool isn't available in a given session, a small ad-hoc `puppeteer-core` script pointed at the local Chrome/Edge install and this app's dev-server URL is a viable fallback for scripted click/type/screenshot flows).
3. Drive through the states that matter:
   - **Loading** — visible immediately on `SeriesList` mount, before the fetch resolves.
   - **Error** — works without the backend running at all (the fetch fails naturally); confirms error copy, retry button, `role="alert"`.
   - **Empty** — backend running (`gradlew.bat bootRun` from `backend/`) with no rows in the DB; also the state to open `AddSeriesForm` from ("Add your first series" button).
   - **Populated** — `POST` a series first (see the curl recipe above), then reload; or drive `AddSeriesForm` end-to-end (open → fill → submit) and confirm the list refreshes with the new row via `SeriesList`'s remount-on-`key`-change.
   - **`AddSeriesForm` validation** — submit blank (title-required error), then an out-of-range field (e.g. `personalRating` > 5) alongside a valid title, and confirm inline errors render without calling the API.
4. Check the console for axe violations after each state change, and `zoom`/screenshot anything visually suspicious. Check both light and dark `prefers-color-scheme` (see the dark-theme gotcha below) — `page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])` if scripting this with `puppeteer-core`.
5. Clean up afterwards: delete `frontend/.env.local` if you created it, and delete any test series you created via the UI (`curl -X DELETE .../series/{id}` or `del backend\data\series.db` to reset entirely).

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
