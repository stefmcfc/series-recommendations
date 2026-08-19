# Spec 001: Series Entity & Database Schema

**Status**: ✅ Implemented — see `backend/src/main/java/uk/co/stefirby/seriestracker/model/SeriesEntity.java`, `SeriesStatus.java`, `ValidSeries.java`/`SeriesValidator.java`, and `backend/src/main/resources/db/migration/V001__create_series_table.sql`. Tests: `backend/src/test/groovy/uk/co/stefirby/seriestracker/model/SeriesEntitySpec.groovy`.
**Priority**: P0 (foundation for everything else)
**Backend Task**

## Overview
Define the Series entity and create the initial database schema. This is the foundation for all CRUD operations.

## Requirements

### Data Model
A Series record contains:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key, auto-generated |
| `title` | String (255) | Yes | Series name |
| `year` | Integer | No | Release year (e.g., 2020) |
| `genres` | String (500) | No | Comma-separated (e.g., "Drama,Thriller") |
| `totalSeasons` | Integer | No | Number of seasons |
| `totalEpisodes` | Integer | No | Total episode count across all seasons |
| `currentSeason` | Integer | No | Which season user is on (1-indexed) |
| `currentEpisode` | Integer | No | Which episode within that season |
| `status` | Enum | No | One of: `WATCHING`, `COMPLETED`, `DROPPED`, `BACKLOG` (default: `BACKLOG`) |
| `imdbRating` | BigDecimal | No | 0.0–10.0 |
| `metacriticRating` | Integer | No | 0–100 |
| `rottenTomatoesRating` | Integer | No | 0–100 |
| `personalRating` | Integer | No | 1–5 stars |
| `personalNotes` | Text | No | User's review/notes (up to 5000 chars) |
| `dateAdded` | LocalDateTime | Yes | Timestamp when added to tracker |
| `dateCompleted` | LocalDateTime | No | When user finished watching (null if not completed) |

### Validation Rules

- `title`: Not blank, min 1 char, max 255
- `year`: If provided, must be > 0 and <= current year
- `totalSeasons` / `totalEpisodes`: If provided, must be > 0
- `currentSeason`: Must be <= `totalSeasons` (if both provided)
- `currentEpisode`: Must be > 0 (if provided)
- `imdbRating`: If provided, must be between 0.0 and 10.0 (inclusive)
- `metacriticRating`: If provided, must be between 0 and 100 (inclusive)
- `rottenTomatoesRating`: If provided, must be between 0 and 100 (inclusive)
- `personalRating`: If provided, must be between 1 and 5 (inclusive)
- `dateCompleted`: Must be null if `status` != `COMPLETED`, must be >= `dateAdded`
- `status`: Defaults to `BACKLOG` on creation

### Implementation Details

#### JPA Entity
- Class: `SeriesEntity.java` in `backend/src/main/java/uk/co/stefirby/seriestracker/model/`
- Table name: `series` (lowercase, singular per convention)
- Use `@Entity`, `@Table`, `@Column` annotations
- Use `UUID` for `id` with `@GeneratedValue(strategy = GenerationType.UUID)`
- Use `@Enumerated(EnumType.STRING)` for `status`
- Use `@CreationTimestamp` for `dateAdded`
- Mark fields with `@NotNull`, `@NotBlank`, `@Min`, `@Max` as appropriate for validation
- Cross-field rule (`currentSeason <= totalSeasons`) enforced via the custom `@ValidSeries` constraint + `SeriesValidator`

#### DTO for API
- Class: `SeriesDto.java` in `backend/src/main/java/uk/co/stefirby/seriestracker/dto/`
- Mirrors entity fields, used for API requests/responses

#### Database Migration
- File: `backend/src/main/resources/db/migration/V001__create_series_table.sql`
- Creates `series` table with all columns above
- SQLite dialect (`hibernate-community-dialects`)

### Acceptance Criteria

- [x] `SeriesEntity` compiles and runs with Spring Boot
- [x] All validation annotations are in place
- [x] Database migration runs without errors on fresh SQLite
- [x] Entity can be instantiated with minimal data (title only)
- [x] Entity can be instantiated with all optional fields
- [x] Trying to save invalid data (e.g., `imdbRating > 10`) raises validation error
- [x] `dateAdded` is auto-set on creation

### Out of Scope
- REST endpoints (Spec 002)
- Querying/filtering (Spec 003)
- Update/delete logic (Spec 002)

## Testing

Full Spock spec suite (`SeriesEntitySpec.groovy`) covers: minimal/full construction, blank/null title rejection, rating range validation (IMDb, Metacritic, Rotten Tomatoes, personal), year bounds, `totalSeasons`/`totalEpisodes`/`currentEpisode` positivity, `currentSeason <= totalSeasons`, null-optional-field acceptance, and the `BACKLOG` default. Run with:

```bash
gradlew.bat test --tests "uk.co.stefirby.seriestracker.model.SeriesEntitySpec"
```
