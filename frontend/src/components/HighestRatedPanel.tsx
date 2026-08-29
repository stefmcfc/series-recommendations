import type {
  ControlsState,
  DiscoverSortByOption,
  SortByOption,
} from './RecommendationControls'
import styles from './RecommendationControls.module.css'

interface HighestRatedPanelProps {
  readonly state: ControlsState
  readonly updateState: (patch: Partial<ControlsState>) => void
}

// TOOLING-008-AC-04: the shared "Sort By" fieldset, extracted from
// RecommendationControls.tsx -- named for the sub-mode (Highest Rated) this
// spec's Requirement 4 groups it with, though it renders under every mode
// except Popular Right Now (RecommendationControls gates it behind
// `!hideSortBy`, unchanged from before this spec): the four TMDB-native
// options under Highest Rated/Custom Search (FRONTEND-033), or the
// Best Match/Most Recommended pair under Use My Series.
export function HighestRatedPanel({
  state,
  updateState,
}: HighestRatedPanelProps) {
  // FRONTEND-033-AC-01: topRated/customSearch get four real, TMDB-native
  // options in place of the legacy Best Match/Vote Average(-relabeled) pair.
  const showDiscoverSortByOptions =
    state.mode === 'discover' &&
    (state.discoverMode === 'topRated' || state.discoverMode === 'customSearch')

  const handleSortByChange = (sortBy: SortByOption) => {
    updateState({ sortBy })
  }

  const handleDiscoverSortByChange = (discoverSortBy: DiscoverSortByOption) => {
    updateState({ discoverSortBy })
  }

  return (
    <fieldset className={styles.sortByFieldset}>
      <legend>Sort By</legend>

      {showDiscoverSortByOptions ? (
        <>
          <div className={styles.modeOption}>
            <input
              id="sort-by-vote-average"
              type="radio"
              name="sort-by"
              checked={state.discoverSortBy === 'vote_average.desc'}
              onChange={() => handleDiscoverSortByChange('vote_average.desc')}
            />
            <label htmlFor="sort-by-vote-average">Vote Average</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="sort-by-most-popular"
              type="radio"
              name="sort-by"
              checked={state.discoverSortBy === 'popularity.desc'}
              onChange={() => handleDiscoverSortByChange('popularity.desc')}
            />
            <label htmlFor="sort-by-most-popular">Most Popular</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="sort-by-newest"
              type="radio"
              name="sort-by"
              checked={state.discoverSortBy === 'first_air_date.desc'}
              onChange={() => handleDiscoverSortByChange('first_air_date.desc')}
            />
            <label htmlFor="sort-by-newest">Newest</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="sort-by-most-voted"
              type="radio"
              name="sort-by"
              checked={state.discoverSortBy === 'vote_count.desc'}
              onChange={() => handleDiscoverSortByChange('vote_count.desc')}
            />
            <label htmlFor="sort-by-most-voted">Most Voted</label>
          </div>
        </>
      ) : (
        <>
          <div className={styles.modeOption}>
            <input
              id="sort-by-score"
              type="radio"
              name="sort-by"
              checked={state.sortBy === 'score'}
              onChange={() => handleSortByChange('score')}
            />
            <label htmlFor="sort-by-score">Best Match</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="sort-by-recommendation-count"
              type="radio"
              name="sort-by"
              checked={state.sortBy === 'recommendationCount'}
              onChange={() => handleSortByChange('recommendationCount')}
            />
            <label htmlFor="sort-by-recommendation-count">
              Most Recommended
            </label>
          </div>
        </>
      )}
    </fieldset>
  )
}
