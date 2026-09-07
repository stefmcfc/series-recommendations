import { seriesApi } from '../services/seriesApi'
import { NameStatsTable } from './NameStatsTable'
import type { NameStatsFiltersState } from '../hooks/useNameStatsFilters'

interface KeywordsViewProps {
  readonly filters: NameStatsFiltersState
}

// FRONTEND-086/FRONTEND-088: thin wrapper over the shared NameStatsTable
// (extracted from this component and its structural sibling
// GenreStatsView, which had duplicated the entire state/effect/JSX tree
// near-verbatim) -- only the labels/testId/fetch method differ.
//
// FRONTEND-096-AC-14: `filters` is forwarded unchanged from AnalysisView's
// single shared useNameStatsFilters() instance -- this is the only change
// this component makes for that spec.
export function KeywordsView({ filters }: KeywordsViewProps) {
  return (
    <NameStatsTable
      testId="keywords-view"
      heading="Keywords"
      idPrefix="keywords"
      nameColumnLabel="Keyword"
      loadingLabel="Loading keyword stats..."
      errorLabel="Failed to load keyword stats. Please try again."
      fetchStats={seriesApi.getKeywordStats}
      filters={filters}
    />
  )
}
