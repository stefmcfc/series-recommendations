-- series_spec_008_series_lifecycle_data.md: Requirements 1 (SERIES-008-AC-01) and 4
-- (SERIES-008-AC-18) -- two persistent per-series boolean flags. Both NOT NULL DEFAULT FALSE,
-- since neither has a meaningful "unknown" state: a series that has never been touched is
-- simply "not excluded"/"not flagged".
--
-- Note: this spec's third new column, production_status (SERIES-008-AC-07), was already added
-- by V003 as a minimal prerequisite pulled forward for series_spec_018_series_refresh.md before
-- this spec itself shipped -- see ProductionStatus's own javadoc -- so it is not repeated here.
ALTER TABLE series ADD COLUMN exclude_from_recommendations BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE series ADD COLUMN flagged_for_rewatch BOOLEAN NOT NULL DEFAULT FALSE;
