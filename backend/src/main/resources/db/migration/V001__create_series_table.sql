-- series_spec_017_tmdb_primary_lookup.md (SERIES-017-AC-16): squashed baseline -- creates the
-- series table directly in its final shape, absorbing every column every subsequent migration
-- (poster_url, imdb_id/idx_series_imdb_id, tags/idx_series_tags) and this spec/spec_018 added
-- (tmdb_rating, tmdb_vote_count, last_refreshed_at), and never creating metacritic_rating or
-- alternate_title at all -- nothing has shipped to production, so patching those two
-- columns' create-then-drop round-trips forward across V001-V006 would be pure waste.
CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    genres TEXT,
    total_seasons INTEGER,
    total_episodes INTEGER,
    current_season INTEGER,
    current_episode INTEGER,
    status TEXT DEFAULT 'BACKLOG',
    -- NUMERIC not DECIMAL: sqlite-jdbc reports "DECIMAL(3,1)" back as JDBC type FLOAT,
    -- which fails Hibernate's schema validation for a BigDecimal field (expects NUMERIC).
    -- SQLite gives both the same type affinity, so this doesn't change stored values.
    -- Applies equally to tmdb_rating below, for the same reason.
    imdb_rating NUMERIC(3,1),
    rotten_tomatoes_rating INTEGER,
    personal_rating INTEGER,
    personal_notes TEXT,
    poster_url VARCHAR(1000),
    -- SERIES-014-AC-01/02: nullable, comma-separated, user-supplied labels for organizing a
    -- collection (no fixed vocabulary, unlike genres).
    tags TEXT,
    -- SERIES-006-AC-01: nullable -- manually-added series that never went through a lookup
    -- won't have one. Indexed since it's queried for existence checks by RecommendationService.
    imdb_id VARCHAR(20),
    -- series_spec_017: TMDB's own community rating/vote count, populated at create time from
    -- TmdbClient.details() -- a third, independent rating source alongside imdb_rating/
    -- rotten_tomatoes_rating.
    tmdb_rating NUMERIC(3,1),
    tmdb_vote_count INTEGER,
    -- series_spec_018_series_refresh.md (not yet implemented): when this series' TMDB/IMDb/RT
    -- ratings were last refreshed from upstream. Column added now, per that spec's explicit
    -- instruction, so it doesn't need its own later migration once nothing else has shipped
    -- for it either -- no other spec_018 behavior is implemented by this migration.
    last_refreshed_at TIMESTAMP,
    date_added TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_completed TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_series_status ON series(status);
CREATE INDEX IF NOT EXISTS idx_series_date_added ON series(date_added);
CREATE INDEX IF NOT EXISTS idx_series_genres ON series(genres);
CREATE INDEX IF NOT EXISTS idx_series_imdb_id ON series(imdb_id);
CREATE INDEX IF NOT EXISTS idx_series_tags ON series(tags);
