import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SourceRankingPreview } from './SourceRankingPreview'
import styles from './SourceRankingPreview.module.css'
import type { Series } from '../types/series'

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: '1',
    title: 'Ozark',
    year: 2017,
    lastAirYear: null,
    genres: 'Crime, Drama',
    tags: null,
    totalSeasons: 4,
    totalEpisodes: 44,
    currentSeason: null,
    currentEpisode: null,
    status: 'COMPLETED',
    imdbRating: null,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: null,
    personalNotes: null,
    posterUrl: null,
    imdbId: 'tt5071412',
    dateAdded: '2024-01-01T00:00:00Z',
    dateCompleted: null,
    lastRefreshedAt: null,
    newContentDetectedAt: null,
    originCountry: null,
    productionStatus: null,
    originalLanguage: null,
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

describe('FRONTEND-135-AC-13: renders rank and title in prop order', () => {
  it('numbers rows 1, 2, 3 in the order series are given', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ title: 'B' }), makeSeries({ title: 'A' })]}
        strategy="personalRatingThenDate"
      />,
    )
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[0]).toHaveTextContent('1')
    expect(rows[0]).toHaveTextContent('B')
    expect(rows[1]).toHaveTextContent('2')
    expect(rows[1]).toHaveTextContent('A')
  })
})

describe('FRONTEND-135-AC-14: personal rating shown on every row', () => {
  it('shows the rating value or a placeholder for null', () => {
    render(
      <SourceRankingPreview
        series={[
          makeSeries({ personalRating: 8 }),
          makeSeries({ personalRating: null }),
        ]}
        strategy="customBlendThenPersonalRating"
      />,
    )
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[0]).toHaveTextContent(/8/)
    expect(rows[1]).toHaveTextContent(/no rating/i)
  })
})

describe('FRONTEND-135-AC-15: blend value shown only for blend strategies', () => {
  it('shows blend value for a blend strategy', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ imdbRating: 8, tmdbRating: 6 })]}
        strategy="personalRatingThenCustomBlend"
        blendSources={['imdb', 'tmdb']}
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).toHaveTextContent(
      /blend.*7/i,
    )
  })

  it('omits blend value for personalRatingThenDate', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries()]}
        strategy="personalRatingThenDate"
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).not.toHaveTextContent(
      /blend/i,
    )
  })
})

describe('FRONTEND-135-AC-16: dateCompleted shown only for personalRatingThenDate', () => {
  it('shows dateCompleted for the default strategy, formatted like the rest of the app', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ dateCompleted: '2024-05-01' })]}
        strategy="personalRatingThenDate"
      />,
    )
    const expected = new Date('2024-05-01').toLocaleDateString()
    expect(screen.getByTestId('source-ranking-row')).toHaveTextContent(expected)
  })

  it('omits dateCompleted for a blend strategy', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ dateCompleted: '2024-05-01' })]}
        strategy="customBlendThenPersonalRating"
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).not.toHaveTextContent(
      /2024-05-01/,
    )
  })
})

describe('FRONTEND-135-AC-17: cutoff divider and muted styling beyond position 20', () => {
  it('shows the cutoff message and mutes rows 21+', () => {
    const series = Array.from({ length: 22 }, (_, i) =>
      makeSeries({ id: `s${i}`, title: `S${i}` }),
    )
    render(
      <SourceRankingPreview
        series={series}
        strategy="personalRatingThenDate"
      />,
    )

    expect(
      screen.getByText(/won't be queried \(limit: 20\)/i),
    ).toBeInTheDocument()
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[19]).not.toHaveClass(styles.mutedRow)
    expect(rows[20]).toHaveClass(styles.mutedRow)
    expect(rows[21]).toHaveClass(styles.mutedRow)
  })
})

describe('FRONTEND-135-AC-18: no cutoff UI when at or under the limit', () => {
  it('renders no divider and no muted rows for exactly 20 series', () => {
    const series = Array.from({ length: 20 }, (_, i) =>
      makeSeries({ id: `s${i}` }),
    )
    render(
      <SourceRankingPreview
        series={series}
        strategy="personalRatingThenDate"
      />,
    )

    expect(screen.queryByText(/won't be queried/i)).not.toBeInTheDocument()
    expect(
      screen
        .getAllByTestId('source-ranking-row')
        .every((row) => !row.className.includes('mutedRow')),
    ).toBe(true)
  })
})

describe('FRONTEND-135-AC-19: empty-pool hint', () => {
  it('shows a hint and renders no rows when series is empty', () => {
    render(
      <SourceRankingPreview series={[]} strategy="personalRatingThenDate" />,
    )
    expect(screen.getByText(/no series to preview/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId('source-ranking-row')).toHaveLength(0)
  })
})
