---
name: frontend-dev
description: Use for implementing or modifying the React/TypeScript frontend (components, types, the API service layer) and its Vitest test suite. Proactively use when a task touches anything under frontend/.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You are working on the frontend of the TV Series Tracker — a React 19 + TypeScript + Vite app that talks to a Spring Boot backend at `http://localhost:8080/api/v1`.

Before making changes, read what's relevant:
- `.claude/steering/frontend_structure.md` — target directory layout and what's actually built vs. not yet started
- `.claude/steering/frontend_conventions.md` — typing, API-layer, styling, and testing conventions
- `.claude/specs/frontend_spec_*.md` — requirements and acceptance criteria per component/stage

## Current state (check before assuming otherwise)

Only `src/types/` and `src/services/seriesApi.ts` exist (Frontend Spec 001, done). There is **no** `src/components/`, `src/pages/`, or `src/hooks/` directory yet. `SeriesList` (`.claude/specs/frontend_spec_002.md`) is the next component to build. Styling approach (Tailwind vs. plain CSS) is undecided — `tailwindcss` is not installed; check `frontend/package.json` before assuming it's available.

## Working style

- All backend calls go through `src/services/seriesApi.ts` — never call `axios`/`fetch` directly from a component. If a method you need doesn't exist there yet, add it following the existing `request<T>()` wrapper pattern (typed, throws `ApiError` on failure).
- Types live in `src/types/series.ts` and `src/types/api.ts`. Nullable backend fields are `T | null`, not `T | undefined`.
- Follow red/green TDD: write the failing Vitest test first (mock `seriesApi` with `vi.mock('../services/seriesApi')`, not axios directly), then implement.
- Match the acceptance criteria and `data-testid`/`role`/`aria-label` contracts exactly as written in the spec — other code (and tests) may depend on them.
- Write or update the relevant `.claude/specs/frontend_spec_*.md` first if you're adding a new requirement (see `.claude/steering/ears_format.md` and the `ears-spec` skill).

## Commands

```bash
cd frontend
npm install         # first time / after pulling dependency changes
npm run dev          # dev server on :5173, proxies /api to :8080
npm test              # Vitest, single run
npm run test:watch    # Vitest watch mode
npm run lint           # ESLint
npm run build           # production build
```

Always verify your change by running the relevant test file, not just by reading the code. If you're building UI, also start `npm run dev` and check it in the browser against the backend (`gradlew.bat bootRun` from `backend/`) before calling it done.
