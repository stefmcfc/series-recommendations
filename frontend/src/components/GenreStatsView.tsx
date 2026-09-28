import { useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { NameStatsTable } from './NameStatsTable'
import { GenreDetailModal } from './GenreDetailModal'
import {
  DEFAULT_GENRE_FAVOURITES,
  isGenreFavourites,
} from './RecommendationControls'
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
  // FRONTEND-137-AC-03: mirrors KeywordsView's identical keywordFavourites
  // read -- its own genreFavourites localStorage key.
  const [genreFavourites] = useLocalStorage(
    'genreFavourites',
    DEFAULT_GENRE_FAVOURITES,
    isGenreFavourites,
  )
  // FRONTEND-137-AC-04: mirrors KeywordsView's identical detailKeyword state,
  // opening GenreDetailModal instead -- no recommendations-modal equivalent
  // here, since genres don't have one.
  const [detailGenre, setDetailGenre] = useState<string | null>(null)

  return (
    <>
      <NameStatsTable
        testId="genre-stats-view"
        heading="Genres"
        idPrefix="genres"
        nameColumnLabel="Genre"
        loadingLabel="Loading genre stats..."
        errorLabel="Failed to load genre stats. Please try again."
        fetchStats={seriesApi.getGenreStats}
        filters={filters}
        favouriteNames={genreFavourites}
        onOpenDetail={setDetailGenre}
      />
      {detailGenre !== null && (
        <GenreDetailModal
          genre={detailGenre}
          onClose={() => setDetailGenre(null)}
        />
      )}
    </>
  )
}
