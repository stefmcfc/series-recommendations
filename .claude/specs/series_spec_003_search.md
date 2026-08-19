# Spec 003: Series Search & Filtering

**Status**: ✅ Implemented — see `backend/src/main/java/uk/co/stefirby/seriestracker/service/SeriesSearchService.java`, `dto/SeriesSearchCriteria.java`, and the `/search` endpoint in `controller/SeriesController.java`. Tests: `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/SeriesSearchServiceSpec.groovy`. (Note: the README roadmap previously marked this "Planned" — it was already built; corrected during the Claude Code migration.)
**Priority**: P1 (MVP feature)
**Depends on**: Spec 002
**Backend Task**

## Overview
Search and filter series by title, genre, status, and rating ranges. Support substring matching and combine multiple filters.

## Requirements

### Search & Filter Endpoint

```
GET /api/v1/series/search

Query Parameters (all optional):
  - title: String (substring match, case-insensitive)
  - genre: String, repeatable (comma-separated genres to match; any genre matches — OR logic)
  - status: String (WATCHING | COMPLETED | DROPPED | BACKLOG)
  - minPersonalRating / maxPersonalRating: Integer (1–5)
  - minImdbRating / maxImdbRating: BigDecimal (0.0–10.0)
  - startedNotFinished: Boolean (true = WATCHING or DROPPED with progress)

200 OK → { "data": [...], "count": N }
```

### Filtering Logic

- **Title**: case-insensitive substring match
- **Genre**: series' comma-separated `genres` field; repeated `?genre=` params OR together; case-insensitive substring match per genre
- **Status**: exact enum match, one value
- **Personal/IMDb rating**: both bounds optional and inclusive; series with a null rating are excluded from a range filter that's actually applied, otherwise ignored (not filtered)
- **startedNotFinished**: `true` → `status` is `WATCHING` or `DROPPED` AND `currentSeason` is not null

### Service Layer

`SeriesSearchService.search(SeriesSearchCriteria criteria): List<SeriesDto>` — sorted by `dateAdded DESC`. Implemented as in-memory stream filtering over `repository.findAll()` (Option A from the original spec — fine at this app's scale; move to DB-level `@Query` filtering only if it becomes a real bottleneck).

`SeriesSearchCriteria` DTO: `title`, `genres` (List\<String\>), `status`, `minPersonalRating`, `maxPersonalRating`, `minImdbRating`, `maxImdbRating`, `startedNotFinished`.

### Acceptance Criteria

- [x] Search by title (case-insensitive substring) works
- [x] Search by genre (single and multiple, OR logic) works
- [x] Search by status (exact match) works
- [x] Search by personal rating range works
- [x] Search by IMDb rating range works
- [x] "Started not finished" filter works
- [x] Multiple filters combined return correct intersection
- [x] No matches returns empty list (not 404)
- [x] Results sorted by dateAdded DESC
- [x] Missing params don't break the query (all optional)

### Out of Scope
- Pagination (future)
- Advanced sorting options (future)
- Full-text search (future)

## Testing

`SeriesSearchServiceSpec.groovy` covers: title substring (case variations), single/multiple genre OR logic, status exact match, personal/IMDb rating ranges, "started not finished", combined filters, empty results, null-rating handling in range queries, and default sort order — all at the service layer.

**Gap**: there is no controller-level (`MockMvc`) test for the `/search` HTTP endpoint itself — `SeriesControllerSpec.groovy` doesn't cover it. Worth adding if the query-param → `SeriesSearchCriteria` wiring in the controller ever needs to change.

Run with:

```bash
gradlew.bat test --tests "uk.co.stefirby.seriestracker.service.SeriesSearchServiceSpec"
```
