-- series_spec_039_last_air_year.md (SERIES-039-AC-02): the year component of TMDB's
-- last_air_date for a series' most recently aired episode -- for an ended show, its true end
-- year; for a still-running show, the year of the most recent episode aired so far. Nullable,
-- same pattern as production_status/origin_country (V003/V004): a manually-added series, or one
-- whose TMDB lookup/refresh never resolved a detail, has no value.
ALTER TABLE series ADD COLUMN last_air_year INTEGER;
