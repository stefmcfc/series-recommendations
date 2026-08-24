-- series_spec_023_recommendation_metadata_and_overview.md (SERIES-023-AC-14): a series' TMDB
-- description, parsed from GET /tv/{id}'s overview field -- nullable (a manually-added series,
-- or one whose TMDB lookup never resolved a detail, has no overview), no format validation,
-- same posture as origin_country/imdb_id.
ALTER TABLE series ADD COLUMN overview TEXT;
