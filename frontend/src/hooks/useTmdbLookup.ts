import { useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { LookupTmdbCandidate, SeriesLookupResult } from '../types/series'

// FRONTEND-045-AC-01: extracted from AddSeriesForm's original inline lookup
// state/handlers so a second form (EditSeriesForm) can reuse the identical
// TMDB search -> single-match auto-resolve / multi-match candidate-picker
// flow without duplicating it. `onResolved` is the only thing that varies
// between callers -- AddSeriesForm applies the result immediately,
// EditSeriesForm gates it behind an overwrite-confirm dialog first.
export function useTmdbLookup(
  title: string,
  onResolved: (result: SeriesLookupResult) => void,
) {
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [tmdbCandidates, setTmdbCandidates] = useState<LookupTmdbCandidate[]>(
    [],
  )
  const [resolvingTmdbCandidate, setResolvingTmdbCandidate] = useState(false)

  const handleLookup = async () => {
    const trimmedTitle = title.trim()
    if (trimmedTitle === '' || lookingUp) return

    setLookupError(null)
    setTmdbCandidates([])
    setLookingUp(true)

    try {
      const results = await seriesApi.searchTmdb(trimmedTitle)

      if (results.length === 0) {
        setLookupError('No matches found for that title.')
        return
      }

      if (results.length === 1) {
        const [candidate] = results
        const result = await seriesApi.resolveTmdbCandidate(candidate.tmdbId)
        onResolved(result)
        return
      }

      setTmdbCandidates(results)
    } catch (err) {
      if (err instanceof ApiError) {
        setLookupError(err.message)
      } else {
        setLookupError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLookingUp(false)
    }
  }

  const handleSelectTmdbCandidate = async (candidate: LookupTmdbCandidate) => {
    if (resolvingTmdbCandidate) return

    setLookupError(null)
    setResolvingTmdbCandidate(true)

    try {
      const result = await seriesApi.resolveTmdbCandidate(candidate.tmdbId)
      onResolved(result)
      setTmdbCandidates([])
    } catch (err) {
      if (err instanceof ApiError) {
        setLookupError(err.message)
      } else {
        setLookupError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setResolvingTmdbCandidate(false)
    }
  }

  const handleCancelTmdbCandidates = () => {
    setTmdbCandidates([])
  }

  return {
    lookingUp,
    lookupError,
    tmdbCandidates,
    resolvingTmdbCandidate,
    handleLookup,
    handleSelectTmdbCandidate,
    handleCancelTmdbCandidates,
  }
}
