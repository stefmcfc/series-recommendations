-- series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md (SERIES-027-AC-01): Rotten
-- Tomatoes' audience (Popcornmeter) score, distinct from the existing rotten_tomatoes_rating
-- column, which stores the critics' Tomatometer score (sourced from OMDb). Nullable -- there is
-- no external data source for this field; it is entered manually by the user only, and is never
-- written by SeriesRefreshService (see the spec's Design Decisions).
ALTER TABLE series ADD COLUMN rotten_tomatoes_popcornmeter INTEGER;
