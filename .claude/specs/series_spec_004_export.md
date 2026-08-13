# Spec 004: Series Export (JSON & CSV)

**Status**: ✅ Implemented — see `backend/src/main/java/com/example/seriestracker/service/SeriesExportService.java`, `dto/SeriesExportResponse.java`, and the `/export` endpoint in `controller/SeriesController.java`. Tests: `backend/src/test/groovy/com/example/seriestracker/service/SeriesExportServiceSpec.groovy`. (Note: the README roadmap previously marked this "Planned" — it was already built; corrected during the Claude Code migration.)
**Priority**: P1 (MVP feature)
**Depends on**: Spec 002
**Backend Task**

## Overview
Export all series data in JSON or CSV format, with the same filters as Spec 003 optionally applied first.

## Requirements

### Export Endpoint

```
GET /api/v1/series/export

Query Parameters:
  - format: String (required; "json" or "csv")
  - all Spec 003 search params (optional; applied as a filter before export)

Headers:
  Content-Type: application/json | text/csv
  Content-Disposition: attachment; filename="series-export-{yyyyMMdd_HHmmss}.{ext}"
```

### JSON Export
Body: `{ "exportDate": ..., "series": [...], "count": N }` (via `SeriesExportResponse`).

### CSV Export
Headers row + one row per series. Rules:
- `null` values are empty cells (no quotes, no literal "null")
- String values with commas are quoted (e.g., genres)
- Dates in ISO8601
- UTF-8 encoding

### Implementation

`SeriesExportService`:
```java
public String exportAsJson(List<SeriesDto> series, LocalDateTime exportDate);
public String exportAsCsv(List<SeriesDto> series);
```

`SeriesController#export` builds a `SeriesSearchCriteria` from the query params, calls `searchService.search(...)`, then delegates to `exportService` and sets `Content-Disposition`. Returns 400 for an invalid `format`.

### Acceptance Criteria

- [x] Export all series as JSON with all fields
- [x] Export all series as CSV with headers
- [x] JSON export is valid, parseable JSON
- [x] CSV export has headers and correct number of columns
- [x] CSV escaping works (commas in genres don't break CSV)
- [x] Export filename includes timestamp
- [x] Content-Disposition header triggers browser download
- [x] Export with filters applied (e.g., only COMPLETED) works
- [x] No series to export returns empty array/rows (not 404)
- [x] Invalid format param returns 400
- [x] Null values handled correctly in both formats
- [x] Dates exported in ISO8601 format

### Future Enhancements
- `fields` param to select which columns to export
- Import (reverse operation)
- Other formats (Excel, XML)

## Testing

`SeriesExportServiceSpec.groovy` covers: JSON structure validity (`exportDate`/`series`/`count`), all-fields presence, CSV structure + headers, CSV comma-escaping in genres, and null handling in both formats — all at the service layer.

**Gap**: no controller-level (`MockMvc`) test for the `/export` HTTP endpoint — `SeriesControllerSpec.groovy` doesn't cover the `Content-Disposition` header, the invalid-`format` 400 response, or filter-before-export wiring at the HTTP layer. Worth adding.

Run with:

```bash
gradlew.bat test --tests "com.example.seriestracker.service.SeriesExportServiceSpec"
```
