import { describe, it, expect } from 'vitest'
import {
  resolveSourceRankingPool,
  computeCustomRatingBlend,
  rankSourceSeries,
} from './sourceRanking'
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

describe('FRONTEND-135-AC-01: explicit selection pool', () => {
  it('returns exactly the selected series regardless of status', () => {
    const backlog = makeSeries({ id: '1', status: 'BACKLOG' })
    const completed = makeSeries({ id: '2', status: 'COMPLETED' })
    const untouched = makeSeries({ id: '3', status: 'COMPLETED' })
    const pool = resolveSourceRankingPool(
      [backlog, completed, untouched],
      ['1', '2'],
    )
    expect(pool.map((s) => s.id)).toEqual(['1', '2'])
  })
})

describe('FRONTEND-135-AC-02: automatic pool', () => {
  it('includes only COMPLETED series with a non-blank imdbId', () => {
    const eligible = makeSeries({ id: '1', status: 'COMPLETED', imdbId: 'tt1' })
    const wrongStatus = makeSeries({
      id: '2',
      status: 'WATCHING',
      imdbId: 'tt2',
    })
    const noImdbId = makeSeries({ id: '3', status: 'COMPLETED', imdbId: null })
    const blankImdbId = makeSeries({
      id: '4',
      status: 'COMPLETED',
      imdbId: '   ',
    })
    const pool = resolveSourceRankingPool(
      [eligible, wrongStatus, noImdbId, blankImdbId],
      [],
    )
    expect(pool.map((s) => s.id)).toEqual(['1'])
  })
})

describe('FRONTEND-135-AC-03: excludeFromRecommendations filtering', () => {
  it('drops an excluded series from an explicit selection', () => {
    const excluded = makeSeries({ id: '1', excludeFromRecommendations: true })
    const included = makeSeries({ id: '2', excludeFromRecommendations: false })
    expect(
      resolveSourceRankingPool([excluded, included], ['1', '2']).map(
        (s) => s.id,
      ),
    ).toEqual(['2'])
  })

  it('drops an excluded series from the automatic pool', () => {
    const excluded = makeSeries({
      id: '1',
      status: 'COMPLETED',
      imdbId: 'tt1',
      excludeFromRecommendations: true,
    })
    expect(resolveSourceRankingPool([excluded], [])).toEqual([])
  })
})

describe('FRONTEND-135-AC-04: blend averages exactly the requested, present sources', () => {
  it('averages imdb and tmdb only when both are requested and present', () => {
    const series = makeSeries({
      imdbRating: 8,
      tmdbRating: 6,
      rottenTomatoesRating: 100,
    })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBe(7)
  })

  it('ignores a requested source with no value on this series', () => {
    const series = makeSeries({ imdbRating: 8, tmdbRating: null })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBe(8)
  })
})

describe('FRONTEND-135-AC-05: Rotten Tomatoes normalization', () => {
  it('divides tomatometer/popcornmeter by 10 before blending', () => {
    const series = makeSeries({
      rottenTomatoesRating: 90,
      rottenTomatoesPopcornmeter: 70,
    })
    expect(
      computeCustomRatingBlend(series, ['tomatometer', 'popcornmeter']),
    ).toBe(8)
  })
})

describe('FRONTEND-135-AC-06: null when no requested source has a value', () => {
  it('returns null, not NaN or 0', () => {
    const series = makeSeries({ imdbRating: null, tmdbRating: null })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBeNull()
  })
})

describe('FRONTEND-135-AC-07: rounds to one decimal place', () => {
  it('averages 8 and 7.3 to 7.7, not 7.65 or 7.6500000001', () => {
    const series = makeSeries({ imdbRating: 8, tmdbRating: 7.3 })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBe(7.7)
  })
})

describe('FRONTEND-135-AC-08: personalRatingThenDate ordering', () => {
  it('sorts by personal rating descending, ties broken by more recent dateCompleted', () => {
    const a = makeSeries({
      id: 'a',
      personalRating: 9,
      dateCompleted: '2024-01-01',
    })
    const b = makeSeries({
      id: 'b',
      personalRating: 9,
      dateCompleted: '2024-06-01',
    })
    const c = makeSeries({
      id: 'c',
      personalRating: 7,
      dateCompleted: '2025-01-01',
    })
    const ranked = rankSourceSeries([a, b, c], 'personalRatingThenDate', [
      'imdb',
      'tmdb',
    ])
    expect(ranked.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts a null personalRating last', () => {
    const rated = makeSeries({ id: 'rated', personalRating: 1 })
    const unrated = makeSeries({ id: 'unrated', personalRating: null })
    const ranked = rankSourceSeries(
      [unrated, rated],
      'personalRatingThenDate',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['rated', 'unrated'])
  })

  it('sorts a null dateCompleted last among equal personal ratings', () => {
    const dated = makeSeries({
      id: 'dated',
      personalRating: 5,
      dateCompleted: '2024-01-01',
    })
    const undated = makeSeries({
      id: 'undated',
      personalRating: 5,
      dateCompleted: null,
    })
    const ranked = rankSourceSeries(
      [undated, dated],
      'personalRatingThenDate',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['dated', 'undated'])
  })
})

describe('FRONTEND-135-AC-09: personalRatingThenCustomBlend ordering', () => {
  it('breaks a personal-rating tie by blend value, higher blend first', () => {
    const higherBlend = makeSeries({
      id: 'hi',
      personalRating: 6,
      imdbRating: 9,
      tmdbRating: 9,
    })
    const lowerBlend = makeSeries({
      id: 'lo',
      personalRating: 6,
      imdbRating: 4,
      tmdbRating: 4,
    })
    const ranked = rankSourceSeries(
      [lowerBlend, higherBlend],
      'personalRatingThenCustomBlend',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['hi', 'lo'])
  })

  it('sorts a null blend value (no requested source present) last among an equal personal rating', () => {
    const withBlend = makeSeries({
      id: 'with',
      personalRating: 5,
      imdbRating: 7,
    })
    const withoutBlend = makeSeries({
      id: 'without',
      personalRating: 5,
      imdbRating: null,
      tmdbRating: null,
    })
    const ranked = rankSourceSeries(
      [withoutBlend, withBlend],
      'personalRatingThenCustomBlend',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['with', 'without'])
  })
})

describe('FRONTEND-135-AC-10: customBlendThenPersonalRating ordering', () => {
  it('ranks by blend value first, ahead of a higher personal rating', () => {
    const higherPersonal = makeSeries({
      id: 'hp',
      personalRating: 10,
      imdbRating: 2,
      tmdbRating: 2,
    })
    const higherBlend = makeSeries({
      id: 'hb',
      personalRating: 1,
      imdbRating: 9,
      tmdbRating: 9,
    })
    const ranked = rankSourceSeries(
      [higherPersonal, higherBlend],
      'customBlendThenPersonalRating',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['hb', 'hp'])
  })
})

describe('FRONTEND-135-AC-11: empty blendSources falls back to imdb+tmdb', () => {
  it('blends imdb and tmdb when blendSources is []', () => {
    const series = makeSeries({
      imdbRating: 8,
      tmdbRating: 6,
      rottenTomatoesRating: 100,
    })
    const ranked = rankSourceSeries(
      [series],
      'customBlendThenPersonalRating',
      [],
    )
    expect(computeCustomRatingBlend(ranked[0], [])).toBe(7)
  })
})

describe('FRONTEND-135-AC-12: does not mutate the input array', () => {
  it('leaves the original array order untouched', () => {
    const low = makeSeries({ id: 'low', personalRating: 1 })
    const high = makeSeries({ id: 'high', personalRating: 9 })
    const pool = [low, high]
    const ranked = rankSourceSeries(pool, 'personalRatingThenDate', [
      'imdb',
      'tmdb',
    ])
    expect(pool.map((s) => s.id)).toEqual(['low', 'high'])
    expect(ranked).not.toBe(pool)
  })
})
