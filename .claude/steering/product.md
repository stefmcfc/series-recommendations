# TV Series Tracker

## What it does
A personal app for logging TV series you're watching, tracking your progress through them, and storing ratings/reviews from multiple sources (IMDb, Metacritic, Rotten Tomatoes).

## Who it's for
Personal use—you. Track your viewing habits in one place without relying on external platforms.

## Key features
- Add new series with metadata (title, year, genre, episode count)
- Log current viewing progress (season and episode)
- Store ratings from IMDb, Metacritic, Rotten Tomatoes
- Add personal notes and reviews
- Search and filter by genre, rating range, completion status
- Export series data as JSON or CSV

## Goals
- Build a tool you'll actually use and maintain
- Keep data portable (can export anytime)
- Fast search/filter performance for 50+ series
- Simple, intuitive UI that doesn't require documentation

## Non-goals
- Social features (sharing, following users, comments)
- Streaming service integration or watchlist syncing
- Episode-by-episode tracking (season/episode level is enough)
- Real-time data fetching from external APIs
- Mobile app (web-first)

## Known constraints
- Local-first initially (no cloud sync, no multi-device)
- Data lives in a single SQLite database file locally
