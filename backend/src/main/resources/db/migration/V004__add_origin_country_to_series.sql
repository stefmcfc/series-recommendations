-- series_spec_021_origin_country.md (SERIES-021-AC-11): the raw ISO 3166-1 alpha-2 code TMDB
-- reports as a series' first origin_country entry (e.g. "GB", "US"). Nullable, same pattern as
-- the existing `production_status` column (V003) -- manually-added series that never went
-- through a TMDB lookup won't have one.
ALTER TABLE series ADD COLUMN origin_country VARCHAR(2);
