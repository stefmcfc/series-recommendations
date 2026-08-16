---
name: verify
description: Build/launch/drive recipe for verifying changes to the TV Series Tracker end-to-end. Currently backend-only (curl/API level) — the frontend section gets filled in once SeriesList and later components exist to actually drive in a browser.
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
- Nothing under `src/components/` exists yet (see `CLAUDE.md` "Current status") — there's no UI to drive with a browser yet. Once `SeriesList` (or later components) land, this section should gain a "Drive" subsection following the `run` skill's pattern (launch → browser-drive → inspect), plus any gotchas discovered while doing it (e.g. React-controlled-input quirks, download interception, timing issues) — don't assume the current backend-only shape of this skill is final.

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
