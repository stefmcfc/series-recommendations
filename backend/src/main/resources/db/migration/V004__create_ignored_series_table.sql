-- SERIES-006-AC-30: a dismissed recommendation is recorded here so it never resurfaces.
-- Deliberately a separate table, not a new SeriesStatus value -- an ignored title was never
-- watched and was never added, so it has none of `series`'s progress/rating fields.
CREATE TABLE IF NOT EXISTS ignored_series (
    id TEXT PRIMARY KEY NOT NULL,
    imdb_id VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    reason TEXT,
    ignored_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ignored_series_imdb_id ON ignored_series(imdb_id);
