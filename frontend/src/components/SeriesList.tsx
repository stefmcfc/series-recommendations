import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { SeriesStatus } from '../types/series'
import type { Series, SearchCriteria, SortOptions } from '../types/series'
import { formatCountryNames } from '../utils/countryName'
import { formatSeriesYear } from '../utils/formatSeriesYear'
import { toggleRewatchFlag } from '../utils/rewatchToggle'
import { submitDelete } from '../utils/deleteSeries'
import { StarRating } from './StarRating'
import { SeriesCompactGrid } from './SeriesCompactGrid'
import { SeriesPosterGrid } from './SeriesPosterGrid'
import styles from './SeriesList.module.css'

interface SeriesListProps {
  readonly onSeriesClick?: (id: string) => void
  readonly onAddClick?: () => void
  readonly onEditClick?: (series: Series) => void
  readonly criteria?: SearchCriteria
  // FRONTEND-071-AC-01/02/03: the funnel button's open/closed and
  // active-filter state are lifted to MySeriesView (App.tsx) -- optional
  // here (defaulting to "closed, inactive, no-op") so every pre-existing
  // <SeriesList /> render in this file's other tests keeps working
  // unchanged.
  readonly isFiltersOpen?: boolean
  readonly onOpenFilters?: () => void
  readonly hasActiveFilters?: boolean
  // FRONTEND-073-AC-03/04: the live Title search box is a controlled input --
  // SeriesList doesn't own the raw title value itself, MySeriesView (App.tsx)
  // does, the same way it already owns isFiltersOpen/hasActiveFilters.
  // Optional (defaulting to an inert, uncontrolled-looking empty box) so
  // every pre-existing <SeriesList /> render in this file's other tests
  // keeps working unchanged.
  readonly titleSearch?: string
  readonly onTitleSearchChange?: (value: string) => void
}

// FRONTEND-013-AC-12: sort field options, in display order. Extended by
// Requirement 5 (FRONTEND-013-AC-14/15) with title/year/imdbRating/tmdbRating
// alongside the original dateAdded/personalRating pair.
type SortByOption = NonNullable<SortOptions['sortBy']>
type SortDirection = NonNullable<SortOptions['sortDirection']>

const SORT_BY_OPTIONS: { value: SortByOption; label: string }[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'personalRating', label: 'Personal Rating' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'imdbRating', label: 'IMDb Rating' },
  { value: 'tmdbRating', label: 'TMDB Rating' },
]

// Matches the backend's own default (series_spec_009_rating_sort.md,
// SERIES-009-AC-06) -- when the control is at its default, no sort argument
// is passed through to getAll()/search() at all (see buildSortParam below).
const DEFAULT_SORT_BY: SortByOption = 'dateAdded'
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc'

function buildSortParam(
  sortBy: SortByOption,
  sortDirection: SortDirection,
): SortOptions | undefined {
  if (sortBy === DEFAULT_SORT_BY && sortDirection === DEFAULT_SORT_DIRECTION) {
    return undefined
  }
  return { sortBy, sortDirection }
}

// FRONTEND-039-AC-01: the rating column shows whichever rating the list is
// currently sorted by, when that's a rating field -- otherwise it falls back
// to IMDb rating (the pre-existing default display).
function activeRating(
  series: Series,
  sortBy: SortByOption,
): { value: number | null; source: 'IMDb' | 'TMDB' } {
  return sortBy === 'tmdbRating'
    ? { value: series.tmdbRating, source: 'TMDB' }
    : { value: series.imdbRating, source: 'IMDb' }
}

// FRONTEND-054-AC-01/03: three opt-in rendering modes over the same fetched
// `series` array -- purely a display toggle, no new fetch/filter/sort logic.
type ViewMode = 'expanded' | 'compact' | 'poster'

const VIEW_MODE_STORAGE_KEY = 'seriesListViewMode'
const DEFAULT_VIEW_MODE: ViewMode = 'expanded'
const VIEW_MODES: readonly ViewMode[] = ['expanded', 'compact', 'poster']

function isViewMode(value: string | null): value is ViewMode {
  return value != null && (VIEW_MODES as readonly string[]).includes(value)
}

// FRONTEND-054-AC-03: read once on mount, degrading silently to the default
// on a read failure (private browsing, quota, storage disabled) or an
// unrecognized stored value -- this app's first localStorage-persisted UI
// preference.
function readStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    return isViewMode(stored) ? stored : DEFAULT_VIEW_MODE
  } catch {
    return DEFAULT_VIEW_MODE
  }
}

function hasActiveCriteria(criteria?: SearchCriteria): boolean {
  if (!criteria) return false
  return Object.values(criteria).some((value) => {
    if (value == null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value !== ''
    if (typeof value === 'boolean') return value
    return true
  })
}

export function SeriesList({
  onSeriesClick,
  onAddClick,
  onEditClick,
  criteria,
  isFiltersOpen = false,
  onOpenFilters,
  hasActiveFilters = false,
  titleSearch = '',
  onTitleSearchChange,
}: SeriesListProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [posterErrorIds, setPosterErrorIds] = useState<Set<string>>(new Set())
  // FRONTEND-012-AC-12/14: per-row rewatch toggle errors, keyed by series id
  // -- mirrors RecommendationsList's per-card scoped-error pattern
  // (FRONTEND-010-AC-17) since more than one row's toggle can be in flight.
  const [rewatchErrors, setRewatchErrors] = useState<Record<string, string>>({})
  // FRONTEND-013-AC-12: sort state lives here, local to the list -- see the
  // spec's Design Decisions for why this isn't lifted into App.tsx/SearchFilter.
  const [sortBy, setSortBy] = useState<SortByOption>(DEFAULT_SORT_BY)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  )
  // FRONTEND-054-AC-01/02/03: view mode is local, purely-rendering state --
  // switching it never triggers a new seriesApi call.
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredViewMode())

  const criteriaActive = hasActiveCriteria(criteria)

  // FRONTEND-054-AC-03: written on every change; a write failure (private
  // browsing, quota, storage disabled) degrades silently.
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
    } catch {
      // Silently ignore -- persistence is a nice-to-have, not a requirement.
    }
  }, [viewMode])

  useEffect(() => {
    let cancelled = false

    // FRONTEND-013-AC-13/16: whichever of getAll()/search() is active per
    // criteriaActive gets the current sortBy/sortDirection.
    const sortParam = buildSortParam(sortBy, sortDirection)
    const fetchSeries = criteriaActive
      ? seriesApi.search(criteria as SearchCriteria, sortParam)
      : seriesApi.getAll(sortParam)

    fetchSeries
      .then((data) => {
        if (cancelled) return
        setSeries(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load series. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- criteriaActive is derived from criteria; including both is redundant and would cause criteria's object identity to trigger duplicate re-fetches.
  }, [refreshIndex, criteria, sortBy, sortDirection])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshIndex((index) => index + 1)
  }, [])

  const handleRowClick = (id: string) => {
    if (confirmingDeleteId === id) return
    onSeriesClick?.(id)
  }

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    id: string,
  ) => {
    if (event.key === 'Escape' && confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      setDeleteError(null)
    }
  }

  const handleEditClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    s: Series,
  ) => {
    event.stopPropagation()
    onEditClick?.(s)
  }

  const handleDeleteClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    event.stopPropagation()
    setDeleteError(null)
    setConfirmingDeleteId(id)
  }

  const handleTitleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onTitleSearchChange?.(event.target.value)
  }

  const handleTitleSearchClear = () => {
    onTitleSearchChange?.('')
  }

  const handleSortByChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortBy = event.target.value as SortByOption
    setSortBy(newSortBy)
    setSortDirection(newSortBy === 'title' ? 'asc' : 'desc')
  }

  const handleSortDirectionToggle = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
  }

  const handlePosterError = (id: string) => {
    setPosterErrorIds((prev) => new Set(prev).add(id))
  }

  const handleRewatchToggle = (id: string, previousValue: boolean) => {
    const nextValue = !previousValue

    toggleRewatchFlag(id, nextValue, {
      clearError: () =>
        setRewatchErrors((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        }),
      applyOptimistic: () =>
        setSeries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, flaggedForRewatch: nextValue } : s,
          ),
        ),
      revert: () =>
        setSeries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, flaggedForRewatch: previousValue } : s,
          ),
        ),
      setError: (message) =>
        setRewatchErrors((prev) => ({ ...prev, [id]: message })),
    })
  }

  const handleCancelDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setConfirmingDeleteId(null)
    setDeleteError(null)
  }

  const handleConfirmDelete = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    event.stopPropagation()

    submitDelete(id, {
      onStart: () => {
        setDeleteError(null)
        setDeleting(true)
      },
      onSuccess: () => {
        setDeleting(false)
        setConfirmingDeleteId(null)
        setSeries((prev) => prev.filter((item) => item.id !== id))
      },
      onError: (message) => {
        setDeleting(false)
        setDeleteError(message)
      },
    })
  }

  return (
    <div className={styles.container} data-testid="series-list">
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h2 className={styles.heading}>My Series</h2>
          <div className={styles.titleSearchWrap}>
            <input
              id="live-title-search"
              data-testid="live-title-search"
              className={styles.titleSearchInput}
              type="text"
              aria-label="Search by title"
              placeholder="Search by title..."
              value={titleSearch}
              onChange={handleTitleSearchChange}
            />
            {titleSearch !== '' && (
              <button
                type="button"
                className={styles.titleSearchClear}
                aria-label="Clear title search"
                onClick={handleTitleSearchClear}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className={styles.headerToolbar}>
          <div className={styles.sortControl}>
            <label htmlFor="series-sort-by" className={styles.sortLabel}>
              Sort by
            </label>
            <select
              id="series-sort-by"
              className={styles.sortSelect}
              aria-label="Sort by"
              value={sortBy}
              onChange={handleSortByChange}
            >
              {SORT_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.sortDirectionButton}
              aria-label={
                sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'
              }
              data-tooltip={
                sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'
              }
              onClick={handleSortDirectionToggle}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <div className={styles.viewModeToggle}>
            <button
              type="button"
              className={styles.viewModeButton}
              data-testid="view-mode-expanded-btn"
              aria-label="Expanded view"
              data-tooltip="Expanded view"
              aria-pressed={viewMode === 'expanded'}
              onClick={() => setViewMode('expanded')}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.viewModeButton}
              data-testid="view-mode-compact-btn"
              aria-label="Compact view"
              data-tooltip="Compact view"
              aria-pressed={viewMode === 'compact'}
              onClick={() => setViewMode('compact')}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.viewModeButton}
              data-testid="view-mode-poster-btn"
              aria-label="Poster-only view"
              data-tooltip="Poster-only view"
              aria-pressed={viewMode === 'poster'}
              onClick={() => setViewMode('poster')}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="9.5" r="1.5" />
                <path d="M21 15l-5-5-9 9" />
              </svg>
            </button>
          </div>
          <div className={styles.filtersTrigger}>
            <button
              type="button"
              className={styles.filtersButton}
              data-testid="open-filters-btn"
              aria-label={hasActiveFilters ? 'Filters (active)' : 'Filters'}
              data-tooltip={hasActiveFilters ? 'Filters (active)' : 'Filters'}
              aria-expanded={isFiltersOpen}
              onClick={() => onOpenFilters?.()}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="3 4 21 4 14 13 14 20 10 22 10 13 3 4" />
              </svg>
              {hasActiveFilters && (
                <span
                  className={styles.filtersActiveDot}
                  data-testid="filters-active-dot"
                />
              )}
            </button>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.addButton}
              data-testid="add-series-btn"
              aria-label="Add new series"
              onClick={() => onAddClick?.()}
            >
              Add Series
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <output className={styles.loading} aria-label="Loading">
          <svg
            className={styles.spinner}
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span>Loading series...</span>
        </output>
      )}

      {!loading && error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && series.length === 0 && (
        <div className={styles.empty}>
          <p>
            {criteriaActive
              ? 'No series match your filters.'
              : 'No series yet.'}
          </p>
          {!criteriaActive && (
            <button
              type="button"
              className={styles.addButton}
              data-testid="add-series-btn"
              aria-label="Add new series"
              onClick={() => onAddClick?.()}
            >
              Add your first series
            </button>
          )}
        </div>
      )}

      {!loading && !error && series.length > 0 && viewMode === 'expanded' && (
        <ul className={styles.list}>
          {series.map((s) => {
            const yearLabel = formatSeriesYear(s)
            return (
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-cancels-delete-confirmation (frontend_spec_008.md FRONTEND-008-AC-06) relies on the keydown bubbling up from whichever Confirm/Cancel button currently has focus; the <li> itself is intentionally non-interactive (no role/tabIndex — see frontend_spec_008.md) and isn't a keyboard-interaction target on its own.
              <li
                key={s.id}
                className={styles.row}
                data-testid="series-row"
                onKeyDown={(e) => handleRowKeyDown(e, s.id)}
              >
                <div className={styles.rowPrimary}>
                  <div
                    className={styles.thumbnail}
                    data-testid="series-thumbnail"
                  >
                    {s.posterUrl !== null && !posterErrorIds.has(s.id) && (
                      <img
                        src={s.posterUrl}
                        alt=""
                        className={styles.thumbnailImage}
                        onError={() => handlePosterError(s.id)}
                      />
                    )}
                  </div>
                  <div className={styles.titleGroup}>
                    <button
                      type="button"
                      className={styles.title}
                      onClick={() => handleRowClick(s.id)}
                    >
                      {yearLabel === '' ? s.title : `${s.title} (${yearLabel})`}
                    </button>
                    {s.originCountry != null && (
                      <span className={styles.country}>
                        {' | '}
                        {formatCountryNames(s.originCountry)}
                      </span>
                    )}
                  </div>
                  <span className={styles.rating}>
                    {activeRating(s, sortBy).value ?? '—'}
                    <span className={styles.ratingSource}>
                      {' '}
                      {activeRating(s, sortBy).source}
                    </span>
                  </span>
                  <StarRating value={s.personalRating} />

                  {confirmingDeleteId === s.id ? (
                    <div className={styles.rowActions}>
                      {deleteError && (
                        <span className={styles.deleteError} role="alert">
                          {deleteError}
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.confirmDeleteButton}
                        data-testid="confirm-delete-btn"
                        disabled={deleting}
                        onClick={(e) => handleConfirmDelete(e, s.id)}
                      >
                        {deleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelDeleteButton}
                        data-testid="cancel-delete-btn"
                        disabled={deleting}
                        onClick={handleCancelDelete}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.editButton}
                        data-testid="edit-series-btn"
                        aria-label={`Edit ${s.title}`}
                        onClick={(e) => handleEditClick(e, s)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        data-testid="delete-series-btn"
                        aria-label={`Delete ${s.title}`}
                        onClick={(e) => handleDeleteClick(e, s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.rowSecondary}>
                  <div className={styles.rowSecondaryLeft}>
                    {s.genres != null && s.genres.trim() !== '' && (
                      <span className={styles.genres}>{s.genres}</span>
                    )}
                    {criteria?.status == null && (
                      <span className={styles.status}>{s.status}</span>
                    )}
                    {s.newContentDetectedAt != null && (
                      <span
                        className={styles.newContentBadge}
                        data-testid="new-content-badge"
                      >
                        New content
                      </span>
                    )}
                    {s.excludeFromRecommendations && (
                      <span
                        className={styles.excludedBadge}
                        data-testid="excluded-from-recommendations-badge"
                      >
                        Excluded from recommendations
                      </span>
                    )}
                  </div>

                  <div className={styles.rowSecondaryRight}>
                    {s.status === SeriesStatus.COMPLETED && (
                      <button
                        type="button"
                        className={`${styles.rewatchToggle} ${
                          s.flaggedForRewatch ? styles.rewatchToggleActive : ''
                        }`}
                        aria-label={
                          s.flaggedForRewatch
                            ? 'Flagged for rewatch'
                            : 'Flag for rewatch'
                        }
                        aria-pressed={s.flaggedForRewatch}
                        onClick={() =>
                          handleRewatchToggle(s.id, s.flaggedForRewatch)
                        }
                      >
                        {s.flaggedForRewatch ? 'Flagged' : 'Rewatch'}
                      </button>
                    )}
                    {rewatchErrors[s.id] && (
                      <span className={styles.rewatchError} role="alert">
                        {rewatchErrors[s.id]}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* FRONTEND-054-AC-04/05/06: same `series` state as the expanded view
          above -- switching viewMode never changes which series are shown. */}
      {!loading && !error && series.length > 0 && viewMode === 'compact' && (
        <SeriesCompactGrid
          series={series}
          posterErrorIds={posterErrorIds}
          onPosterError={handlePosterError}
          onCardClick={handleRowClick}
        />
      )}

      {!loading && !error && series.length > 0 && viewMode === 'poster' && (
        <SeriesPosterGrid
          series={series}
          posterErrorIds={posterErrorIds}
          onPosterError={handlePosterError}
          onCardClick={handleRowClick}
        />
      )}
    </div>
  )
}
