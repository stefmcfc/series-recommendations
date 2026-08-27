import { vi, describe, it, expect, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { toggleRewatchFlag } from './rewatchToggle'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'abc-123',
    title: 'The Office',
    year: 2005,
    genres: 'Comedy',
    tags: null,
    totalSeasons: 9,
    totalEpisodes: 201,
    currentSeason: 4,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.9,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: 5,
    personalNotes: null,
    posterUrl: null,
    imdbId: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    lastRefreshedAt: null,
    newContentDetectedAt: null,
    originCountry: null,
    productionStatus: null,
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('TOOLING-006-AC-01: toggleRewatchFlag', () => {
  it('applies the optimistic update immediately, reverts and reports on failure', async () => {
    const clearError = vi.fn()
    const applyOptimistic = vi.fn()
    const revert = vi.fn()
    const setError = vi.fn()
    vi.spyOn(seriesApi, 'update').mockRejectedValue(
      new ApiError(500, 'failed to update'),
    )

    toggleRewatchFlag('abc', true, {
      clearError,
      applyOptimistic,
      revert,
      setError,
    })

    expect(clearError).toHaveBeenCalled()
    expect(applyOptimistic).toHaveBeenCalled()
    await waitFor(() => expect(revert).toHaveBeenCalled())
    expect(setError).toHaveBeenCalledWith('failed to update')
  })

  it('reports the generic fallback message when the rejection is not an ApiError', async () => {
    const setError = vi.fn()
    vi.spyOn(seriesApi, 'update').mockRejectedValue(new Error('boom'))

    toggleRewatchFlag('abc', true, {
      clearError: vi.fn(),
      applyOptimistic: vi.fn(),
      revert: vi.fn(),
      setError,
    })

    await waitFor(() =>
      expect(setError).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again.',
      ),
    )
  })

  it('calls seriesApi.update with the given id and nextValue', () => {
    vi.spyOn(seriesApi, 'update').mockResolvedValue(makeSeries())

    toggleRewatchFlag('abc', true, {
      clearError: vi.fn(),
      applyOptimistic: vi.fn(),
      revert: vi.fn(),
      setError: vi.fn(),
    })

    expect(seriesApi.update).toHaveBeenCalledWith('abc', {
      flaggedForRewatch: true,
    })
  })

  it('does not call revert/setError on success', async () => {
    const revert = vi.fn()
    const setError = vi.fn()
    vi.spyOn(seriesApi, 'update').mockResolvedValue(makeSeries())

    toggleRewatchFlag('abc', true, {
      clearError: vi.fn(),
      applyOptimistic: vi.fn(),
      revert,
      setError,
    })

    await waitFor(() => expect(seriesApi.update).toHaveBeenCalled())
    expect(revert).not.toHaveBeenCalled()
    expect(setError).not.toHaveBeenCalled()
  })
})
