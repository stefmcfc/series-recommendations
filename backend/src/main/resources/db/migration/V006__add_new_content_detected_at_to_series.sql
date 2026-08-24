-- series_spec_018_series_refresh.md (SERIES-018-AC-23): flags that a refresh found
-- totalSeasons/totalEpisodes had increased since the prior refresh -- non-null means "new
-- content detected, not yet acknowledged". Nullable, cleared only by an explicit
-- POST /series/{id}/acknowledge-new-content (never auto-cleared by a subsequent refresh that
-- doesn't find further new content). Same nullable-LocalDateTime pattern as
-- last_refreshed_at/date_completed.
ALTER TABLE series ADD COLUMN new_content_detected_at TIMESTAMP;
