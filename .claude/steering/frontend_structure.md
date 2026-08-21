# Frontend Project Structure

## Directory Layout (current + target)

Lines marked **(built)** exist today; everything else is the target layout to grow into as specs are implemented (see `.claude/specs/frontend_spec_002.md` onward).

All six components below follow the same triplet pattern — `ComponentName.tsx` + `ComponentName.test.tsx` + `ComponentName.module.css`, all colocated in `src/components/` — so only the `.tsx` file is listed per component below.

```
frontend/
├── src/
│   ├── components/                 # Reusable React components (all built)
│   │   ├── SeriesList.tsx          # frontend_spec_002.md + frontend_spec_004.md (Edit/Delete) + frontend_spec_006.md (criteria prop) + frontend_spec_008.md (a11y fix); wired into App.tsx
│   │   ├── AddSeriesForm.tsx       # frontend_spec_003_add_series_form.md; create-series modal
│   │   ├── EditSeriesForm.tsx      # frontend_spec_004.md; edit-series modal
│   │   ├── SeriesDetail.tsx        # frontend_spec_005_series_detail.md; full-record view + own Edit/Delete
│   │   ├── SearchFilter.tsx        # frontend_spec_006_search_filter.md
│   │   ├── ExportControls.tsx      # frontend_spec_007_export_trigger.md
│   │   └── RecommendationsList.tsx # frontend_spec_010_recommendations.md; wired into App.tsx via a nav toggle alongside SeriesList
│   │
│   ├── pages/                   # Page-level components, if routing is added (not yet created — see frontend_spec_005.md's design decisions on why no router exists yet)
│   │
│   ├── services/                # (built)
│   │   └── seriesApi.ts         # All backend API calls
│   │
│   ├── types/                   # (built)
│   │   ├── series.ts            # Series, SeriesStatus, CreateSeriesRequest, UpdateSeriesRequest, SearchCriteria
│   │   └── api.ts               # ApiResponse, ApiError, LoadingState, AsyncState
│   │
│   ├── hooks/                   # Custom React hooks (not yet created)
│   │
│   ├── styles/                  # Global styles (not yet created — `index.css` currently lives at src/ root)
│   │
│   ├── utils/                   # (built)
│   │   └── relativeTime.ts      # frontend_spec_023_series_refresh.md; formatRelativeTime()
│   │
│   ├── App.tsx                  # (built) Orchestrator: swaps SeriesList/SeriesDetail on the selected series, renders SearchFilter/ExportControls above the list, owns AddSeriesForm/EditSeriesForm modal state and the refresh-via-remount key(s)
│   ├── index.css                # (built)
│   ├── main.tsx                 # (built) Entry point
│   └── test-setup.ts            # (built) Vitest + jest-dom setup
│
├── public/                      # (built) favicon.svg, icons.svg
│
├── vite.config.ts               # (built)
├── vitest.config.ts             # (built)
├── tsconfig.json                # (built)
├── package.json                 # (built)
├── package-lock.json            # (built)
├── .env.local                   # Local environment (git-ignored, not present by default)
└── .gitignore                   # (built)
```

## File Naming Rules

| Category | Pattern | Example |
|----------|---------|---------|
| React Components | `PascalCase.tsx` | `SeriesList.tsx` |
| Component Tests | `PascalCase.test.tsx` | `SeriesList.test.tsx` |
| Services/Utils | `camelCase.ts` | `seriesApi.ts` |
| Type Definitions | `camelCase.ts` | `series.ts` |
| Hooks | `use[Name].ts` | `useSeries.ts` |

## Component Organization

### Presentational Components
Live in `src/components/`. Receive data via props, handle UI only.

### Container Components
Live in `src/pages/` or top-level `src/`. Manage state and data fetching. `SeriesList` (Frontend Spec 002) is a container component — see its spec for the exact contract.

## Services & API Layer

All backend communication goes through `src/services/seriesApi.ts` (already built, Frontend Spec 001). It exports a `seriesApi` object with `getAll`, `getById`, `create`, `update`, `delete`, `search`, `export` — all typed against `src/types/series.ts`, and a centralized error wrapper that throws `ApiError` (`src/types/api.ts`) for 4xx/5xx/network failures. New components should call these methods, never raw `axios`/`fetch`.

## Type Definitions

Centralized in `src/types/` — see `series.ts` for `Series`, `SeriesStatus`, `CreateSeriesRequest`, `UpdateSeriesRequest`, `SearchCriteria`, and `api.ts` for `ApiResponse<T>`, `ApiError`, `LoadingState`, `AsyncState<T>`.

## Environment Configuration

```
# frontend/.env.local
VITE_API_BASE=http://localhost:8080/api/v1
```

`seriesApi.ts` reads `import.meta.env.VITE_API_BASE` and falls back to `http://localhost:8080/api/v1` if unset. The Vite dev server also proxies `/api` to `localhost:8080` (`vite.config.ts`) as an alternative to setting this var.

## Testing Setup

- Run: `npm test` (single run) or `npm run test:watch`
- Files: `*.test.tsx` or `*.test.ts`, colocated with source (e.g. `src/services/__tests__/seriesApi.test.ts`)
- Vitest + React Testing Library + jsdom (`test-setup.ts` wires up `@testing-library/jest-dom` matchers)
- Scope: component behavior and user interactions, not implementation details; API calls are mocked via `vi.mock('../services/seriesApi')`

## Build & Deployment

- Build: `npm run build` → `frontend/dist/`
- Preview: `npm run preview`
- Deploy: not yet decided — no deployment config exists in this repo

## Key Principles

1. **Type Everything**: TypeScript for all code, no `any` without justification
2. **Separation of Concerns**: Components for UI, `services/` for API, `types/` for contracts
3. **Test Behavior**: Test what users see and do, not implementation
4. **Keep It Simple**: MVP features only; no over-engineering
5. **Reusable Components**: Build small, composable pieces
6. **Error Handling**: Clear error messages to users (via `ApiError`, not raw stack traces)
7. **Performance**: Lazy load, optimize re-renders, tree-shake unused code — not a concern yet at this scale
