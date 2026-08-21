-- series_spec_019_keyword_tracking.md (SERIES-019-AC-01): normalized TMDB keyword storage --
-- a `keyword` table (one row per distinct TMDB keyword id, shared across every series that
-- carries it) plus a `series_keyword` join table, rather than a delimited string column like
-- `genres`/`tags`, so aggregate seriesCount/averagePersonalRating stats (KeywordStatsService)
-- don't require parsing every row on every request. Same UUID-as-TEXT PK convention as
-- `series`/`ignored_series`.
CREATE TABLE IF NOT EXISTS keyword (
    id TEXT PRIMARY KEY NOT NULL,
    tmdb_keyword_id INTEGER NOT NULL,
    name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_tmdb_keyword_id ON keyword(tmdb_keyword_id);

CREATE TABLE IF NOT EXISTS series_keyword (
    series_id TEXT NOT NULL REFERENCES series(id),
    keyword_id TEXT NOT NULL REFERENCES keyword(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_keyword_series_id_keyword_id ON series_keyword(series_id, keyword_id);
