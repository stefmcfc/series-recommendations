import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

export interface SubmitDeleteCallbacks {
  readonly onStart: () => void
  readonly onSuccess: () => void
  readonly onError: (message: string) => void
}

// TOOLING-006-AC-04: shared control flow for "submit a confirmed delete and
// report success/failure" -- extracted from the near-identical bodies
// previously duplicated in SeriesDetail.tsx and SeriesList.tsx's
// handleConfirmDelete.
export function submitDelete(
  id: string,
  callbacks: SubmitDeleteCallbacks,
): void {
  const { onStart, onSuccess, onError } = callbacks

  onStart()

  seriesApi
    .delete(id)
    .then(() => {
      onSuccess()
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError) {
        onError(err.message)
      } else {
        onError('An unexpected error occurred. Please try again.')
      }
    })
}
