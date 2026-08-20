-- SERIES-013-AC-01: nullable alternateTitle so a series known under two different
-- names (e.g. OMDb's "MI-5" vs. the TMDB-searched "Spooks") can preserve both.
-- No index -- nothing in this spec's scope filters or looks up by alternateTitle.
ALTER TABLE series ADD COLUMN alternate_title VARCHAR(255);
