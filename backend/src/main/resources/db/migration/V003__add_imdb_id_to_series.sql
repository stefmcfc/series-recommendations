-- SERIES-006-AC-01: nullable imdbId so recommendations (Requirement 6) can reliably
-- cross-reference "is this TMDB result something the user already has?" via a stable
-- external ID. Nullable because manually-added series that never used the OMDb lookup
-- won't have one -- they simply can't be matched against.
ALTER TABLE series ADD COLUMN imdb_id VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_series_imdb_id ON series(imdb_id);
