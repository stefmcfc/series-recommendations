# Spec 002: Series CRUD & REST Endpoints

**Status**: ✅ Implemented — see `backend/src/main/java/com/example/seriestracker/controller/SeriesController.java`, `service/SeriesService.java`, `repository/SeriesRepository.java`, `exception/{EntityNotFoundException,GlobalExceptionHandler}.java`. Tests: `backend/src/test/groovy/com/example/seriestracker/{service/SeriesServiceSpec,controller/SeriesControllerSpec}.groovy`.
**Priority**: P0 (core API)
**Depends on**: Spec 001
**Backend Task**

## Overview
REST endpoints for creating, reading, updating, and deleting Series, plus the service layer handling business logic and validation.

## Requirements

### REST Endpoints

#### 1. Create Series
```
POST /api/v1/series
Body: SeriesDto (title required, everything else optional)
201 Created → { "data": { ...series... } }
```

#### 2. Get All Series
```
GET /api/v1/series
200 OK → { "data": [...], "count": N }
```

#### 3. Get Series by ID
```
GET /api/v1/series/{id}
200 OK → { "data": { ...series... } }
404 Not Found → { "error": "Series not found", "id": "{id}" }
```

#### 4. Update Series (partial)
```
PATCH /api/v1/series/{id}
Body: partial SeriesDto
200 OK → { "data": { ...updated series... } }
404 / 400 on not-found / validation failure
```

**Validation rules**:
- If `currentSeason`/`currentEpisode` updated, validate against `totalSeasons`/`totalEpisodes`
- If `status` changed to `COMPLETED`, set `dateCompleted` to now (if not already set)
- If `status` changed away from `COMPLETED`, clear `dateCompleted`
- All Spec 001 validation rules apply

#### 5. Delete Series
```
DELETE /api/v1/series/{id}
204 No Content
404 Not Found if id doesn't exist
```

### Service Layer

`SeriesService` (`backend/src/main/java/com/example/seriestracker/service/SeriesService.java`):
```java
public SeriesDto create(SeriesDto dto);
public SeriesDto getById(UUID id);       // throws EntityNotFoundException if not found
public List<SeriesDto> getAll();
public SeriesDto update(UUID id, SeriesDto dto);  // partial update
public void delete(UUID id);             // throws EntityNotFoundException if not found
```

`SeriesRepository extends JpaRepository<SeriesEntity, UUID>` — no custom queries needed for CRUD.

`SeriesController` (`@RestController`, `@RequestMapping("/api/v1/series")`) delegates to the service and returns the appropriate status codes.

### Error Handling

- `GlobalExceptionHandler` (`@ControllerAdvice`): `EntityNotFoundException` → 404, `MethodArgumentNotValidException` → 400 with details, generic `Exception` → 500
- `EntityNotFoundException(String message) extends RuntimeException`

### Response Wrapper

`ApiResponse<T>` — `{ data: T, error?: String, count?: long }`. Used for all responses.

### Acceptance Criteria

- [x] POST creates a series with title only; other fields are null/default
- [x] POST with invalid `imdbRating` (e.g., 15) returns 400
- [x] GET /series returns empty list if no series exist
- [x] GET /series/{id} returns the series if it exists
- [x] GET /series/{id} returns 404 if id doesn't exist
- [x] PATCH updates only the provided fields
- [x] PATCH with invalid `currentSeason` (e.g., > totalSeasons) returns 400
- [x] PATCH setting status to COMPLETED auto-sets dateCompleted
- [x] DELETE removes the series
- [x] DELETE on non-existent id returns 404
- [x] All endpoints return appropriate HTTP status codes
- [x] Error responses include descriptive messages

### Out of Scope
- Search/filtering by genre, status, etc. (Spec 003)
- Pagination (future)
- Export (Spec 004)

### Notes
- Controllers stay thin; business logic lives in the service
- `@Transactional` on service methods that modify data

## Testing

`SeriesServiceSpec.groovy` and `SeriesControllerSpec.groovy` cover: minimal/full creation, invalid-rating rejection, get all (empty/non-empty), get by id (found/404), update (progress fields, invalid `currentSeason`, COMPLETED auto-sets/clears `dateCompleted`), delete (success/404), and the equivalent HTTP-level assertions via `MockMvc`. Run with:

```bash
gradlew.bat test --tests "com.example.seriestracker.service.SeriesServiceSpec"
gradlew.bat test --tests "com.example.seriestracker.controller.SeriesControllerSpec"
```
