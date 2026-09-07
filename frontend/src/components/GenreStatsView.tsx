import { seriesApi } from '../services/seriesApi'
import { NameStatsTable } from './NameStatsTable'
import type { NameStatsFiltersState } from '../hooks/useNameStatsFilters'

interface GenreStatsViewProps {
  readonly filters: NameStatsFiltersState
}

// FRONTEND-088: thin wrapper over the shared NameStatsTable (extracted from
// this component and its structural sibling KeywordsView, which had
// duplicated the entire state/effect/JSX tree near-verbatim) -- only the
// labels/testId/fetch method differ.
//
// FRONTEND-096-AC-14: `filters` is forwarded unchanged from AnalysisView's
// single shared useNameStatsFilters() instance -- this is the only change
// this component makes for that spec.
export function GenreStatsView({ filters }: GenreStatsViewProps) {
  return (
    <NameStatsTable
      testId="genre-stats-view"
      heading="Genres"
      idPrefix="genres"
      nameColumnLabel="Genre"
      loadingLabel="Loading genre stats..."
      errorLabel="Failed to load genre stats. Please try again."
      fetchStats={seriesApi.getGenreStats}
      filters={filters}
    />
  )
}
