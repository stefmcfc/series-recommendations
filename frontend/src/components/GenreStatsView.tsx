import { seriesApi } from '../services/seriesApi'
import { NameStatsTable } from './NameStatsTable'

// FRONTEND-088: thin wrapper over the shared NameStatsTable (extracted from
// this component and its structural sibling KeywordsView, which had
// duplicated the entire state/effect/JSX tree near-verbatim) -- only the
// labels/testId/fetch method differ.
export function GenreStatsView() {
  return (
    <NameStatsTable
      testId="genre-stats-view"
      heading="Genres"
      idPrefix="genres"
      nameColumnLabel="Genre"
      loadingLabel="Loading genre stats..."
      errorLabel="Failed to load genre stats. Please try again."
      fetchStats={seriesApi.getGenreStats}
    />
  )
}
