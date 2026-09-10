-- series_spec_061_series_original_language.md (SERIES-061-AC-08): the raw ISO 639-1 code TMDB
-- reports as a series' original_language field (e.g. "en", "ko", "ja"). Nullable, same pattern
-- as the existing `origin_country` column (V004) -- manually-added series that never went
-- through a TMDB lookup won't have one.
ALTER TABLE series ADD COLUMN original_language VARCHAR(2);
