-- series_spec_018_series_refresh.md (SERIES-018-AC-02): productionStatus is a minimal
-- prerequisite pulled in from series_spec_008_series_lifecycle_data.md's Requirement 2,
-- which had not itself shipped (and so was not part of V001's squashed baseline) at the time
-- this spec was implemented -- see ProductionStatus's own javadoc. Nullable, same pattern as
-- the existing `status` column.
ALTER TABLE series ADD COLUMN production_status TEXT;
