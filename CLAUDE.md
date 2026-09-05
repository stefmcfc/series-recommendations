# TV Series Tracker

A personal app for logging TV series you're watching, tracking viewing progress, and storing ratings from multiple sources (IMDb, Metacritic, Rotten Tomatoes). See [README.md](./README.md) for the product overview, [API.md](./API.md) for the API reference, [ROADMAP.md](./ROADMAP.md) for feature delivery status, and [RUNBOOK.md](./RUNBOOK.md) for local dev setup.

## Hard rules

These are hard rules, not suggestions — follow them even if training data or habit suggests otherwise.

- **Java 25 (LTS) only.** Never bump the Gradle toolchain to a non-LTS Java version in this repo — experiment with newer/preview versions in a dedicated project instead (e.g. `java-features`).
- **All frontend backend calls go through `frontend/src/services/seriesApi.ts`.** No raw `axios`/`fetch` calls in components, ever.
- **Backend business logic lives in `service/`.** Controllers stay thin and delegate; repositories stay plain `JpaRepository` extensions with no custom queries (filtering is done in the service layer — see `series_spec_003_search.md` for the rationale and the threshold at which that should change).
- **Types are centralized** in `frontend/src/types/` (backend: the `dto/` package). Don't redeclare or duplicate a shape inline in a component or controller.
- **Spec first.** Write or update the relevant `.claude/specs/` EARS spec before implementing a new requirement — see `.claude/steering/ears_format.md` and the `ears-spec` skill. Exception: a one-off, no-behavior-change quality/maintenance pass (e.g. resolving a batch of SonarQube/lint findings) doesn't need a spec — there's no new requirement to write acceptance criteria against. If a "cleanup" turns out to need a real behavior change (e.g. converting `role="dialog"` to a native `<dialog>` with proper focus-trap lifecycle), that specific piece reverts to needing a spec.
- **Never commit secrets.** No `.env`, API keys, or credentials — see `.claude/steering/tech.md`.
- **Only `gradlew.bat` (Windows) is checked in** for the Gradle wrapper. Don't add a Unix `gradlew` script unless asked — it risks wrapper-jar/version drift with no one to keep it in sync.

## Current status

- **Backend**: fully implemented. Entity/schema, CRUD endpoints, search & filter, and JSON/CSV export are all built and covered by Spock specs. See `.claude/specs/series_spec_*.md`. CORS (`CorsConfig`) exposes `Content-Disposition` in addition to the allow-list/methods/headers already configured, so the frontend's export download can read the server-computed filename cross-origin (`.claude/specs/tooling_spec_001_code_quality_security.md`, AC-17).
- **Frontend**: full CRUD + browse UI is implemented — `SeriesList` (list, with per-row Edit/Delete and inline delete confirmation), `AddSeriesForm`/`EditSeriesForm` (modals), `SeriesDetail` (full-record view reached by clicking a row, with its own Edit/Delete), `SearchFilter` (title/genre/status/rating-range/started-not-finished filtering), and `ExportControls` (JSON/CSV download, respecting active filters). `App.tsx` orchestrates all of it: it swaps between `SeriesList` and `SeriesDetail` based on the selected series (no router), renders `SearchFilter`/`ExportControls` above the list, and owns the two modals' open/closed state plus the `key`-bump refresh pattern used after add/edit success. See `.claude/specs/frontend_spec_*.md` (001–008) for the full history, including two corrections made along the way: `seriesApi.getById`/`create`/`update` now correctly unwrap the backend's response envelope (frontend_spec_005), and `SeriesList`'s rows no longer nest interactive controls inside a `role="button"` wrapper (frontend_spec_008, an accessibility fix). See `ROADMAP.md` for current feature delivery status — as of 2026-08-27, `frontend_spec_034`/`frontend_spec_035` (both frontend-only) are specced but not yet built; everything else is done.

## Tech stack (actual installed versions)

| Layer | Technology |
|-------|-----------|
| Backend | Java 25 toolchain, Spring Boot 4.1.0 |
| Frontend | TypeScript ~6.0, React 19.2, Vite 8.2 |
| Database | SQLite (local dev); PostgreSQL planned for production, no code changes needed (Spring Data JPA) |
| ORM | Spring Data JPA + Hibernate (community SQLite dialect) |
| Migrations | Flyway |
| Build (backend) | Gradle (wrapper included, Windows `gradlew.bat` only) |
| Build (frontend) | Vite 8, npm |
| Tests (backend) | Spock 2.4 (Groovy 5) |
| Tests (frontend) | Vitest 4, React Testing Library |

Full detail lives in `.claude/steering/tech.md`.

## Deep-dive references

Read these when working in the relevant area — don't duplicate their content here:

- `.claude/steering/product.md` — what the app does, who it's for, goals/non-goals
- `.claude/steering/tech.md` — full tech stack detail and rationale
- `.claude/steering/structure.md` — backend package layout, naming conventions, where tests live
- `.claude/steering/frontend_structure.md` — frontend directory layout and target component structure
- `.claude/steering/frontend_conventions.md` — frontend coding conventions (typing, API layer, styling, testing)
- `.claude/steering/ears_format.md` — the EARS requirement format all specs use
- `.claude/specs/` — feature specs (backend 001–004, frontend 001–008), each with acceptance criteria and TDD test cases
- `ROADMAP.md` — every feature delivered or specced, one row per feature pairing its backend/frontend specs, with status. Check this before asking "what's left to build?" instead of re-reading all specs.
- `API.md` — full API endpoint reference (query params, behavior notes).
- `.claude/SPEC_CANDIDATES.md` — ideas confirmed worth a real spec eventually, not yet written. Move an entry into `ROADMAP.md`'s "Specced, coming soon" table when it's actually spec'd, don't leave it duplicated.
- `.claude/ideas/future_ideas.md` — genuinely speculative/deferred ideas, one level earlier than a spec candidate.

## Working conventions

- Specs are written in EARS format (`.claude/steering/ears_format.md`) with acceptance criteria and red/green TDD test cases. When adding a feature, write or update a spec in `.claude/specs/` first.
- **The idea pipeline**: `.claude/ideas/future_ideas.md` (raw, unconfirmed) → `.claude/SPEC_CANDIDATES.md` (confirmed worth a spec, not yet written) → a real spec exists, tracked in `ROADMAP.md`'s "Specced, coming soon" table → implemented, row moves to "Delivered" → `CHANGELOG.md` (shipped version entry). An idea moves out of one file and into the next as it progresses — never leave the same idea duplicated across two of these at once. Before adding to or editing any of the tracking files, re-check what it references against the current codebase — referenced classes/components can move (e.g. during a refactor) without the tracking file being updated, which was found to have actually happened when `future_ideas.md` was audited on 2026-08-26: one item had already shipped without being marked delivered, two others referenced a class that had since been split into a different one. (`.claude/OUTSTANDING_SPECS.md`, which used to sit between "spec exists" and "implemented" in this pipeline, was retired 2026-08-27 — its role now lives in `ROADMAP.md`.)
- **Keep `ROADMAP.md` current.** Writing a new spec adds a row under "Specced, coming soon"; completing a spec (every AC checked) moves that row into "Delivered". Do this as part of the same change that created/altered/completed the spec, not as a separate pass.
- Backend: business logic in `service/`, controllers stay thin, repositories are plain `JpaRepository` extensions. Tests are Spock specs colocated under `src/test/groovy/`, one `*Spec.groovy` per class under test.
- Frontend: all backend calls go through `frontend/src/services/seriesApi.ts` — no raw `axios`/`fetch` calls in components. Types live in `frontend/src/types/`. Components are typed function components; tests are colocated `*.test.tsx`/`*.test.ts` files run with Vitest.
- Use the `backend-dev` and `frontend-dev` subagents (`.claude/agents/`) for implementation work in their respective areas, and the `ears-spec` skill when drafting a new spec.

## Commit style

**Conventional Commits** for every commit message: `<type>(<scope>): <description>` — types `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `chore`; scope is the area touched where one applies (e.g. `feat(search): add genre filter`, `docs(specs): add verification markers`).

## Versioning & changelog

The app is versioned as one unit with [Semantic Versioning](https://semver.org/): `backend/build.gradle.kts` (`version`) and `frontend/package.json` (`"version"`) are kept in sync, and every notable change is recorded in [CHANGELOG.md](./CHANGELOG.md) ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format).

- Add an entry under `## [Unreleased]` in `CHANGELOG.md` as part of the same PR that ships a user-facing feature or fix — not retroactively.
- **Keep entries small and granular.** One bullet per discrete, independently-describable change — not one large paragraph rolling up several design decisions, endpoints, or live-review revision passes into a single entry. If a PR touches multiple distinct things (e.g. a new endpoint *and* a UI component *and* a bug fix found along the way), give each its own bullet rather than one dense run-on paragraph. Entries had grown into multi-sentence paragraphs by 2026-08-24/25; split further work back down.
- When cutting a release (merging to `main`), move `[Unreleased]` into a dated `## [x.y.z] - YYYY-MM-DD` section and bump both version fields together: **major** for breaking API/data changes, **minor** for new features, **patch** for fixes/chores with no behavior change users would notice.

## Git workflow

- **One backend spec + its corresponding frontend spec in flight at a time.** Don't start a new spec's branch — especially not a branch chained off another not-yet-merged branch — while an earlier spec pair is still open. Finish (merged to `main`) or get explicit direction to pause the current pair before starting the next one. Reason: on 2026-08-24/25, two parallel feature chains (watch-providers, 4 branches; Rotten Tomatoes, 2 branches) plus a docs branch were all open at once. Squash-merging a parent branch deletes it, which auto-closes any child PR still targeting it — so nearly every merge in that batch required re-opening a fresh PR, re-merging `main` into the branch, and hand-resolving conflicts (almost always CHANGELOG.md/roadmap-table lines — the roadmap table lived in README.md at the time, now in ROADMAP.md — occasionally real code like a shared-component refactor). A single-pair-at-a-time flow has no sibling/child branches to orphan, so this doesn't happen.
- **Branch naming**: `feature/<slug>` for new work, `fix/<slug>` for bug fixes (e.g. `feature/series-list`, `fix/export-null-rating`).
- **Commit before starting the next spec.** Before beginning implementation on a new spec, run `git status` — if it shows uncommitted changes from a previously *completed* spec (tests green, Definition of Done met), commit and push that work first rather than starting the next one on top of it. This is what actually keeps commits atomic; splitting an already-tangled multi-feature working tree after the fact is expensive and sometimes impossible without risky manual patch surgery (this happened for real on 2026-08-24 — several unrelated features sat uncommitted together for two days before being pushed, and `SeriesController.java`/`types/series.ts`/`SeriesList.tsx`/`SeriesDetail.tsx` couldn't be cleanly separated between them; see PR #49's commit history and body for how that was untangled). Uncommitted changes that are mid-spec (not yet done) are fine to leave as-is while you keep working.
- **Push and PR are pre-authorized** once a unit of work is done and its tests pass — push the branch and open the PR (`gh pr create`) without asking each time.
- **Merging to `main` always needs a check-in first** — never merge without the user's explicit go-ahead in that instance, even if the PR is green.
- **Before that check-in, release hygiene must already be done, not deferred to "after merge."** Green CI/tests are necessary but not sufficient. This is **two separate checks, not one** — treating the first as satisfying the second is exactly how this has failed before:
  1. **Did this PR add a `CHANGELOG.md` entry under `[Unreleased]` for its own change?** (Plus `README.md`/`API.md`/`ROADMAP.md`/`RUNBOOK.md` if it touches features, endpoints, config, or how the project is run/verified — see the Definition of Done checklist.)
  2. **Separately, immediately before running `gh pr merge`: is `[Unreleased]` on `main` (i.e. including this PR's about-to-land entry) now non-empty?** If yes, *this merge* must also cut it into a dated `## [x.y.z] - YYYY-MM-DD` section and bump both version files — right now, as part of getting this merge ready, not as a follow-up once it's noticed. Passing check 1 on every PR does **not** imply check 2 has been done — check 2 must be re-verified at every single merge, even the third one in a row in the same session where the first one already got it right.

  Reason: on 2026-08-25, 16 merged PRs in a row landed on `main` with their CHANGELOG content left sitting in `[Unreleased]` and the version never bumped past `2.1.0` — including PR #87, merged without this being caught — because "tests are green" was being treated as the whole bar. Recovering from that required a dedicated archaeology pass (`git show` per commit) to reconstruct dated, correctly-versioned CHANGELOG sections after the fact. **It happened again on 2026-09-01, at smaller scale**: PR #144 correctly cut `3.8.0`, but PRs #145/#146/#147 each added a correct per-PR `[Unreleased]` entry (check 1, done every time) without re-cutting the release at merge time (check 2, skipped three times running) — three merges' worth of shipped work sat undated on `main` until it was noticed and swept up in one fix. CI now enforces check 2 mechanically (see `.github/workflows/ci.yml`'s `changelog-cut` job) specifically because narrative instructions alone didn't survive a fast run of consecutive merge approvals within one session.
  - **Perform this cut as a commit on the feature branch itself, before merging — never as a separate follow-up `chore(release)` branch/PR.** A standalone release-cut PR/push (e.g. commit `385859e`) touches only `CHANGELOG.md` + the two version fields, but still runs the full backend/frontend/CodeQL suite twice more (its own PR check, then its own merge-to-`main` push) for a diff with no code in it. `ci.yml`/`codeql.yml` detect and skip that specific shape as a backstop (see `.claude/steering/ci_cd_pipeline.md`), but the backstop exists for when this slips — it's not a reason to make a habit of the separate branch.
- **Merge strategy**: squash and delete the branch (`gh pr merge --squash --delete-branch`) once approved.

## Definition of Done

A unit of work isn't done until:

- Tests pass (`gradlew.bat test` for backend changes, `npm test` + `npm run lint` for frontend changes)
- The relevant `.claude/specs/` file's acceptance criteria are checked off (or the spec is created first, if this is new work)
- `ROADMAP.md` is updated: a new spec gets a row under "Specced, coming soon"; a completed spec's row moves to "Delivered"
- `API.md` is updated if an endpoint was created, amended, or deleted
- `README.md` is updated if features, scripts, or configuration changed (endpoint-level detail belongs in `API.md`, feature status in `ROADMAP.md` — see above)
- `RUNBOOK.md` is updated if how the project is run, verified, or troubleshot changed — including when an *existing* config property (e.g. an API key) starts gating more or different endpoints than its current description covers, not just when a brand-new property is added. (A real gap hit in practice: `app.tmdb.api-key`'s description named only `/recommendations` after `/lookup/search-tmdb`/`/lookup/resolve-tmdb` started depending on it too — nothing auto-detects this, so it has to be checked deliberately.)

## When unsure

If a request is ambiguous or a steering doc is silent on it, make a reasonable call, note the assumption briefly, and keep moving. Stop and check in first only when the decision is security-relevant (e.g. touches secrets, auth, exposed data) or crosses into merging to `main`.

## Commands

```bash
# Backend (from backend/)
gradlew.bat bootRun        # start dev server on :8080
gradlew.bat test           # run Spock specs

# Frontend (from frontend/)
npm install
npm run dev                # dev server on :5173, proxies /api to :8080
npm test                   # Vitest, single run
```
