# Frontend Conventions

## File Structure & Naming

- **Components**: `PascalCase.tsx` (e.g., `SeriesList.tsx`, `SearchFilter.tsx`)
- **Utilities/Services**: `camelCase.ts` (e.g., `seriesApi.ts`, `formatDate.ts`)
- **Types**: `camelCase.ts` (e.g., `series.ts`, `api.ts`) exporting `PascalCase` interfaces/types
- **Tests**: `ComponentName.test.tsx` or `fileName.test.ts` (colocated with source)

## TypeScript Type Conventions

- Types live in `src/types/series.ts` and `src/types/api.ts`
- Use `interface` for object shapes, `type`/`enum` for unions or fixed value sets
- All API responses are typed; no `any` without justification
- Optional fields that can be `null` from the backend are typed `T | null`, not `T | undefined` — see `Series` in `src/types/series.ts` for the pattern

## API Communication

- All backend calls go through `src/services/seriesApi.ts` — never call `axios`/`fetch` directly from a component
- Base URL comes from `import.meta.env.VITE_API_BASE`, falling back to `http://localhost:8080/api/v1` (Vite env convention — **not** `process.env`, that's a Create React App pattern that doesn't apply here)
- All API responses are typed with TypeScript interfaces
- Errors are centralized: the service layer's `request<T>()` wrapper catches axios errors and throws a typed `ApiError` (`src/types/api.ts`) with `status`, `message`, and optional `details`

Example (matches the actual implementation in `seriesApi.ts`):
```typescript
import axios from 'axios';
import type { Series } from '../types/series';
import { ApiError } from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api/v1';
const client = axios.create({ baseURL: API_BASE });

export const seriesApi = {
  getAll: (): Promise<Series[]> =>
    request<{ data: Series[]; count: number }>(() => client.get('/series')).then(r => r.data),
  // ...
};
```

## Component Patterns

### Presentational Components
- Receive data via props
- Handle only UI logic (show/hide, clicks, forms)
- No direct API calls

### Container Components
- Manage state (`useState`, `useReducer`, or Context)
- Fetch data via `useEffect`
- Coordinate between presentational components
- Example: `SeriesList` (Frontend Spec 002) — fetches its own data via `seriesApi.getAll()`, owns loading/error/empty state

### Hooks (Custom)
- Extract reusable logic into hooks
- Prefix with `use` (e.g., `useSeries.ts`, `useSearch.ts`)
- Keep one responsibility per hook
- None exist yet — extract when a second component needs the same fetch/state logic, not before

## State Management

- React hooks (`useState`, `useContext`) for local state
- `useEffect` for side effects (data fetching)
- Context API for global state if needed later — not Redux
- Avoid prop drilling; lift state up or use Context

## Styling

**Not yet decided for this codebase.** The original Kiro steering assumed Tailwind CSS, but `tailwindcss` is **not** currently in `package.json` — only plain CSS (`App.css`, `index.css`) exists. Before building the first real UI component, either:
- add Tailwind (`npm install -D tailwindcss` + config), or
- continue with plain CSS / CSS Modules

and update this section once decided. Don't assume Tailwind classes are available until the dependency is actually installed.

## Testing Strategy (Vitest + React Testing Library)

- Test user interactions, not implementation details
- Use `render()` and `screen` to query elements
- Mock the service layer with `vi.mock('../services/seriesApi')`, not axios directly, in component tests (see `.claude/specs/frontend_spec_002.md` for the pattern)
- One test file per component, colocated

Example:
```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SeriesList } from './SeriesList';
import { seriesApi } from '../services/seriesApi';

vi.mock('../services/seriesApi');
const mockGetAll = vi.mocked(seriesApi.getAll);

describe('SeriesList', () => {
  it('should render a list of series', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'The Office', /* ... */ } as any]);
    render(<SeriesList />);
    expect(await screen.findByText('The Office')).toBeInTheDocument();
  });
});
```

## Environment Variables

- Create `.env.local` in `frontend/` (git-ignored)
- Use `VITE_` prefix for Vite to expose variables
- Example: `VITE_API_BASE=http://localhost:8080/api/v1`
- Access via `import.meta.env.VITE_API_BASE`

## Code Style

- Use arrow functions for callbacks
- Destructure props and imports
- Keep components under ~200 lines (split if larger)
- Use meaningful variable names; avoid abbreviations
- No comments unless the WHY is non-obvious

## Error Handling

- Display user-friendly error messages, driven by `ApiError.message`
- Never expose raw backend stack traces or `ApiError.details` internals directly to the user beyond what's needed
- Log errors to console only in dev (`import.meta.env.DEV`) — `seriesApi.ts` already does this in its request wrapper

## Accessibility (a11y)

- Use semantic HTML: `<button>`, `<label>`, `<form>`, etc.
- Include `aria-label` on icon-only buttons
- Ensure form inputs have associated `<label>` elements
- Loading indicators need `role="status"`; error containers need `role="alert"` (see Frontend Spec 002 acceptance criteria for the concrete pattern)

## Performance

- Lazy load routes (`React.lazy` + `Suspense`) once routing exists
- Memoize components if props don't change (`React.memo`)
- Use `useCallback` sparingly (only if dependencies are stable)
- Not a real concern yet at this app's scale (~50 series) — don't over-optimize prematurely
