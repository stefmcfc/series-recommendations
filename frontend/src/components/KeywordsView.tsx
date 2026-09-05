import { seriesApi } from '../services/seriesApi'
import { NameStatsTable } from './NameStatsTable'

// FRONTEND-086/FRONTEND-088: thin wrapper over the shared NameStatsTable
// (extracted from this component and its structural sibling
// GenreStatsView, which had duplicated the entire state/effect/JSX tree
// near-verbatim) -- only the labels/testId/fetch method differ.
export function KeywordsView() {
  return (
    <NameStatsTable
      testId="keywords-view"
      heading="Keywords"
      idPrefix="keywords"
      nameColumnLabel="Keyword"
      loadingLabel="Loading keyword stats..."
      errorLabel="Failed to load keyword stats. Please try again."
      fetchStats={seriesApi.getKeywordStats}
    />
  )
}
