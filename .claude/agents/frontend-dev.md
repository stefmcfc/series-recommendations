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

## Static-analysis / Sonar cleanup patterns

Learned resolving a full SonarQube pass (2026-08-25, see `chore/sonar-findings-cleanup`) — reuse these rather than re-deriving them:

- **`waitFor(() => screen.getByX(...))` → `screen.findByX(...)` (`typescript:S9020`) has a real second-order risk**: when the `waitFor`+`getBy` was the test's *only* assertion (especially the `expect(screen.getByX(...)).toBeInTheDocument()` shape), dropping straight to a bare `await screen.findByX(...)` removes the test's only `expect()` call and can trip `typescript:S2699` ("add at least one assertion") — a rule that doesn't recognize a bare `find*` throw as satisfying it. After a bulk conversion, re-scan every touched file for `it(...)` blocks with zero `expect()` calls and wrap the terminal `find*` in `expect(await screen.findByX(...)).toBeInTheDocument()` for those specifically.
- **Same ARIA-role rule, very different fix risk depending on the target element.** `role="status"` → `<output>` is a safe, transparent swap (implicit role, no lifecycle) — but `role="dialog"` → `<dialog>` is *not* a tag swap: it needs `showModal()`/`close()` lifecycle management (focus trap, native `::backdrop`, `cancel` event), and jsdom's `<dialog>` support has known gaps. Don't treat every instance of one Sonar rule as uniform risk — check what the target element actually requires before converting.
- **Mark-props-readonly (`typescript:S6759`) is only safe to blind-apply to the component's own `*Props` interface** — don't touch sibling interfaces in the same file (`FormState`, `ControlsState`, etc.) that represent genuinely mutable local state.
- **CSS contrast findings (`css:S7924`) on a "text + translucent background of the same base hue" pattern** are often a static-analysis artifact — a linter without paint/compositing context can't resolve the true rendered backdrop, so it may be comparing the literal (pre-alpha) RGB values, which are identical. Fix with a genuinely distinct **opaque** tint (verified by direct WCAG contrast calculation, not just eyeballing) rather than relying on alpha blending a checker can't see through.
- **NOSONAR / suppression placement**: the report's line/column often anchors to the *opening tag or statement's own indentation*, not the specific attribute/token that triggered the rule — e.g. a `role="dialog"` finding several lines into a multi-line JSX tag actually anchors to the `<div` line itself. Placing `// NOSONAR` on the attribute line looks right but won't clear the finding; verify against the report's exact line/col (or re-run the tool) rather than assuming. JSX opening-tag attribute lists do tolerate a trailing `// comment` (same lexer trivia rules as any argument list) — no need to fall back to a `{/* */}` block for this.
- **Windows CRLF safety in scripted codemods**: this repo (`core.autocrlf=true`) uses CRLF line endings. A Node script that does `text.split('\n')`, edits specific lines, and rejoins with `'\n'` silently strips the `\r` on every line it touches while leaving it on untouched lines — producing a mixed-line-ending file that shows as noisy edits on every changed line. Either avoid split/join entirely (surgical string replace) or explicitly normalize (`.replace(/\r\n/g,'\n')` before editing, `.replace(/\n/g,'\r\n')` before writing) and re-check with `file <path>` afterward.

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
