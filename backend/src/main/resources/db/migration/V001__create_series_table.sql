CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    genres TEXT,
    total_seasons INTEGER,
    total_episodes INTEGER,
    current_season INTEGER,
    current_episode INTEGER,
    status TEXT DEFAULT 'BACKLOG',
    imdb_rating DECIMAL(3,1),
    metacritic_rating INTEGER,
    rotten_tomatoes_rating INTEGER,
    personal_rating INTEGER,
    personal_notes TEXT,
    date_added TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_completed TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_series_status ON series(status);
CREATE INDEX IF NOT EXISTS idx_series_date_added ON series(date_added);
CREATE INDEX IF NOT EXISTS idx_series_genres ON series(genres);