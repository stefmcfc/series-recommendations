-- series_spec_055_filter_profiles.md: named, saved filter/criteria snapshots for one of three
-- unrelated frontend contexts (MY_SERIES/USE_MY_SERIES/RECOMMENDATION_FILTERS). One generic
-- table, not three typed ones -- the backend never filters, sorts, or joins on individual
-- criteria fields, so `criteria` is stored as an opaque JSON blob (TEXT column).
CREATE TABLE IF NOT EXISTS filter_profile (
    id TEXT PRIMARY KEY NOT NULL,
    area VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    criteria TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uniqueness is scoped to (area, name), not name alone -- the same profile name can exist once
-- per area without conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_filter_profile_area_name ON filter_profile(area, name);
