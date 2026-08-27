import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

export interface ToggleRewatchFlagCallbacks {
  readonly clearError: () => void
  readonly applyOptimistic: () => void
  readonly revert: () => void
  readonly setError: (message: string) => void
}

// TOOLING-006-AC-01: shared control flow for "optimistically flip the
// rewatch flag, revert and report an error on failure" -- extracted from the
// near-identical bodies previously duplicated in SeriesDetail.tsx and
// SeriesList.tsx's handleRewatchToggle.
export function toggleRewatchFlag(
  id: string,
  nextValue: boolean,
  callbacks: ToggleRewatchFlagCallbacks,
): void {
  const { clearError, applyOptimistic, revert, setError } = callbacks

  clearError()
  applyOptimistic()

  seriesApi
    .update(id, { flaggedForRewatch: nextValue })
    .catch((err: unknown) => {
      revert()
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    })
}
