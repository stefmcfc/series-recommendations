# Frontend Spec 001: Types & API Service Layer

**Status**: ✅ Implemented — see `frontend/src/types/series.ts`, `frontend/src/types/api.ts`, `frontend/src/services/seriesApi.ts`. Tests: `frontend/src/services/__tests__/seriesApi.test.ts`.
**Priority**: P0 (foundational layer)
**Depends on**: Backend Specs 001, 002, 003, 004
**Frontend Stage**: 1 of N

---

## Overview

The foundational TypeScript types and the axios-based API service layer. All other frontend components depend on these files. No UI here — pure contracts and communication.

**Deliverables** (all built): `src/types/series.ts`, `src/types/api.ts`, `src/services/seriesApi.ts`, `src/services/__tests__/seriesApi.test.ts`.

---

## Glossary

| Term | Definition |
|------|-----------|
| `SeriesDto` | The shape of a series object returned from the backend |
| `SearchCriteria` | All optional filter params accepted by `GET /api/v1/series/search` |
| `ApiError` | Structured error thrown by the service layer |
| `ApiResponse<T>` | Wrapper around `{ data: T, count?: number }` matching backend response shape |
| `SeriesStatus` | Enum: `WATCHING`, `COMPLETED`, `DROPPED`, `BACKLOG` |
| Centralized wrapper | The single `request<T>()` helper in `seriesApi.ts` that handles errors consistently |

---

## Requirements

### Requirement 1: Series TypeScript Types
`series.ts` exports `SeriesStatus` enum, `Series` interface (matches backend `SeriesDto` exactly — `id`, `title`, `year`, `genres`, `totalSeasons`, `totalEpisodes`, `currentSeason`, `currentEpisode`, `status`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `personalRating`, `personalNotes`, `dateAdded`, `dateCompleted`), `CreateSeriesRequest` (title required, rest optional), `UpdateSeriesRequest` (fully partial), `SearchCriteria` (all optional filter fields). Nullable backend fields are typed `T | null`, not `T | undefined`.

### Requirement 2: API Response and Error Types
`api.ts` exports `ApiResponse<T>` (`{ data: T, count?: number }`), `ApiError` class (`message`, `status`, `details?`, discriminant `isApiError: true`), `LoadingState` union, `AsyncState<T>`.

### Requirement 3: Centralized API Request Wrapper
A private `request<T>()` helper wraps every axios call: unwraps `response.data` on success; on a 4xx/5xx response throws `ApiError` populated from the backend error body; on a network error (no response) throws `ApiError(0, 'Network error. Please check your connection.')`; logs requests/errors to console only when `import.meta.env.DEV`.

### Requirement 4: CRUD Service Methods
`seriesApi` object (not a class) exports `getAll()`, `getById(id)`, `create(data)`, `update(id, data)`, `delete(id)` — each typed against `Series`/`CreateSeriesRequest`/`UpdateSeriesRequest`, unwrapping the `{ data, count }` envelope on list endpoints so callers get `Series[]` directly.

### Requirement 5: Search Service Method
`seriesApi.search(criteria)` serializes `SearchCriteria` to query params (`buildSearchParams`), omitting null/undefined fields, and maps `criteria.genres[]` to repeated `?genre=` params to match the backend contract.

### Requirement 6: Export Service Method
`seriesApi.export(format, filters?)` calls `GET /api/v1/series/export` with `responseType: 'blob'`, returns `Promise<Blob>`, and does **not** trigger a download itself — that's the calling component's job (relevant once export UI is built).

### Requirement 7: Base URL Configuration
Reads `import.meta.env.VITE_API_BASE`, falls back to `http://localhost:8080/api/v1`, configured once on the axios instance.

---

## Cross-References

| This spec | Backend contract |
|-----------|-----------------|
| `Series` interface | Backend `SeriesDto` (Spec 001 entity) |
| `seriesApi.getAll()` | `GET /api/v1/series` → `{ data: Series[], count: number }` (Spec 002) |
| `seriesApi.getById()` | `GET /api/v1/series/{id}` → `Series` or 404 (Spec 002) |
| `seriesApi.create()` | `POST /api/v1/series` → `Series` or 400 (Spec 002) |
| `seriesApi.update()` | `PATCH /api/v1/series/{id}` → `Series` or 400/404 (Spec 002) |
| `seriesApi.delete()` | `DELETE /api/v1/series/{id}` → 204 or 404 (Spec 002) |
| `seriesApi.search()` | `GET /api/v1/series/search` → `{ data: Series[], count: number }` (Spec 003) |
| `seriesApi.export()` | `GET /api/v1/series/export` → file blob (Spec 004) |
| `SearchCriteria` | `SeriesSearchCriteria` DTO (Spec 003) |

---

## Acceptance Criteria Summary

- [x] `SeriesStatus` enum exported with 4 values
- [x] `Series` interface matches backend DTO; optional fields typed as `T | null`
- [x] `CreateSeriesRequest` has `title` required, all others optional
- [x] `UpdateSeriesRequest` is fully partial
- [x] `SearchCriteria` has all optional filter fields
- [x] `ApiResponse<T>`, `ApiError`, `LoadingState`, `AsyncState<T>` exported from `api.ts`
- [x] `ApiError` carries `status`, `message`, `details`; has `isApiError: true` discriminant
- [x] Axios instance created once with `baseURL` from env var (fallback to localhost:8080)
- [x] List endpoints unwrap `data` field before returning
- [x] 4xx/5xx errors throw `ApiError` with correct `status` and `message`
- [x] Network errors throw `ApiError` with `status: 0`
- [x] Dev-only logging in the request wrapper; silent in production
- [x] `search()` omits null/undefined fields from params, maps `genres[]` to repeated `genre` param
- [x] `export()` sets `responseType: 'blob'`, returns `Promise<Blob>`, does not trigger a download
- [x] Full test suite in `src/services/__tests__/seriesApi.test.ts` passes (`npm test`)

## Testing

See `frontend/src/services/__tests__/seriesApi.test.ts` for the full suite (mirrors requirement IDs SH-001 through SN-009 from the original draft: getAll/getById/create/update/delete/search/export happy paths, 4xx/5xx/network error handling, and no-logging-in-production). Run with:

```bash
cd frontend && npm test
```
