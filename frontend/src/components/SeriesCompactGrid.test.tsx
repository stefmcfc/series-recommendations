import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { SeriesCompactGrid } from './SeriesCompactGrid'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'
import surface from '../styles/surfaces.module.css'

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: null,
    lastAirYear: null,
    genres: null,
    tags: null,
    totalSeasons: null,
    totalEpisodes: null,
    currentSeason: null,
    currentEpisode: null,
    status: SeriesStatus.BACKLOG,
    imdbRating: null,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: null,
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

describe('FRONTEND-105-AC-05: compact-grid cards compose the shared surface primitive', () => {
  it('applies surface.card to each card', () => {
    render(
      <SeriesCompactGrid
        series={[makeSeries({ title: 'Chernobyl' })]}
        posterErrorIds={new Set()}
        onPosterError={vi.fn()}
        onCardClick={vi.fn()}
      />,
    )
    expect(
      screen.getByText('Chernobyl').closest('button')?.className,
    ).toContain(surface.card)
  })
})
