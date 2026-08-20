-- SERIES-014-AC-01/02: nullable, comma-separated tags a user assigns to organize their
-- own collection (no fixed vocabulary, unlike genres). Indexed now, mirroring
-- idx_series_genres, since this spec's Overview explicitly intends tags to become
-- filterable in a later round.
ALTER TABLE series ADD COLUMN tags TEXT;

CREATE INDEX IF NOT EXISTS idx_series_tags ON series(tags);
