import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { SeriesDetailActionsPanel } from './SeriesDetailActionsPanel'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'
import styles from './SeriesDetail.module.css'

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'abc-123',
    title: 'The Office',
    year: 2005,
    lastAirYear: null,
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
    personalNotes: 'Rewatch of the year',
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

const baseProps = {
  confirmingDelete: false,
  deleteError: null,
  deleting: false,
  onConfirmDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onEditClick: vi.fn(),
  onDeleteClick: vi.fn(),
  refreshing: false,
  onRefreshClick: vi.fn(),
  series: makeSeries(),
  onRewatchToggle: vi.fn(),
  acknowledging: false,
  onDismissNewContentClick: vi.fn(),
  onRecommendationsClick: vi.fn(),
  recommendationsDisabled: false,
}

describe('FRONTEND-104-AC-02: actionsInfo precedes actionsRow', () => {
  // NOTE: the spec's own Red sketch for this AC queries the row via
  // `getByTestId('actions-row')`, but Requirement 3 (AC-03) separately
  // applies `data-testid="sticky-actions-bar"` to that same div -- a single
  // element can't carry two different data-testid values. Design Decisions
  // describes `sticky-actions-bar` as the canonical, shared identifier for
  // this element across both render branches, so this test uses that one
  // (rather than adding a second, redundant testid) to resolve the
  // sketch/AC-03 conflict.
  it('renders actionsInfo before actionsRow when last-refreshed info is present', () => {
    render(
      <SeriesDetailActionsPanel
        {...baseProps}
        series={makeSeries({ lastRefreshedAt: '2026-09-01T00:00:00Z' })}
      />,
    )
    const info = screen.getByTestId('actions-info')
    const row = screen.getByTestId('sticky-actions-bar')
    expect(
      info.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('FRONTEND-104-AC-03: actionsRow carries the sticky class (normal state)', () => {
  // NOTE: the spec's own Red sketch asserts `toHaveClass('actionsRow')`
  // (an unhashed literal), but this codebase's CSS Modules setup hashes
  // class names at build/test time (e.g. `_actionsRow_1ae6ed`) -- matching
  // every other class-list assertion added under frontend_spec_103. Asserted
  // against the imported `styles`/`styles` module's actual (hashed) class
  // value instead.
  it('applies actionsSticky to actionsRow when not confirming delete', () => {
    render(<SeriesDetailActionsPanel {...baseProps} confirmingDelete={false} />)
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass(
      styles.actionsRow,
    )
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass(
      styles.actionsSticky,
    )
  })
})

describe('FRONTEND-104-AC-04: outer actions wrapper carries the sticky class (delete-confirmation state)', () => {
  it('applies actionsSticky to the outer wrapper when confirming delete', () => {
    render(<SeriesDetailActionsPanel {...baseProps} confirmingDelete={true} />)
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass(styles.actions)
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass(
      styles.actionsSticky,
    )
  })
})

describe('FRONTEND-104-AC-05: actionsInfo is never sticky', () => {
  it('does not apply actionsSticky to actionsInfo', () => {
    render(
      <SeriesDetailActionsPanel
        {...baseProps}
        series={makeSeries({ lastRefreshedAt: '2026-09-01T00:00:00Z' })}
      />,
    )
    expect(screen.getByTestId('actions-info')).not.toHaveClass(
      styles.actionsSticky,
    )
  })
})
