import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { RecommendationQuery, Series, SortOptions } from '../types/series'
import type { PickerOption } from './KeywordPicker'
import { formatCountryNames } from '../utils/countryName'
import { formatSeriesYear } from '../utils/formatSeriesYear'
import { UseMySeriesPanel } from './UseMySeriesPanel'
import { CustomSearchPanel } from './CustomSearchPanel'
import { TrendingPanel } from './TrendingPanel'
import { HighestRatedPanel } from './HighestRatedPanel'
import { RecommendationFiltersBox } from './RecommendationFiltersBox'
import styles from './RecommendationControls.module.css'

// FRONTEND-047: Country reuses KeywordPicker's own pinned-option support
// (US/GB one click away) with its searchable "rest" coming from the static
// COUNTRY_OPTIONS list -- deliberately not derived from the user's own
// tracked series (Discover modes don't touch tracked data, see this spec's
// Design Decisions).
// TOOLING-008: exported so UseMySeriesPanel/CustomSearchPanel/
// RecommendationFiltersBox (which render the Country picker) can reuse the
// same pinned codes without duplicating this judgment call.
// eslint-disable-next-line react-refresh/only-export-components -- this file intentionally exports shared module-level data/helpers alongside the RecommendationControls component per tooling_spec_008's Design Decisions (helpers stay module-level here rather than moving into the new panel files); Fast Refresh state loss on an edit here is an acceptable, deliberate tradeoff.
export const COUNTRY_PINNED_OPTIONS = ['US', 'GB']

// FRONTEND-047-AC-08/09/12 (revised 2026-08-28): Language keeps a hardcoded,
// locally-scoped option list (not extracted to utils/ -- exactly one
// consumer today, see this spec's Design Decisions) resolved to
// human-readable names via Intl.DisplayNames, mirroring
// utils/countryName.ts's formatCountryName pattern but for language codes
// specifically. Language now renders through KeywordPicker itself (the same
// chip-with-"x" UX Country already uses) instead of a bespoke picker --
// single-select is enforced by a thin adapter where it's used below, not
// here. Unlike Country's pinned codes (deliberately excluded from `options`
// so they display as bare codes), Language's pinned codes ARE included in
// `options` so resolvePinnedOptions resolves them to full names.
let languageDisplayNames: Intl.DisplayNames | null = null
function getLanguageDisplayNames(): Intl.DisplayNames | null {
  if (languageDisplayNames !== null) return languageDisplayNames
  try {
    languageDisplayNames = new Intl.DisplayNames(['en'], { type: 'language' })
    return languageDisplayNames
  } catch {
    return null
  }
}
function formatLanguageName(code: string): string {
  try {
    return getLanguageDisplayNames()?.of(code) ?? code
  } catch {
    return code
  }
}

// FRONTEND-047-AC-08: pinned quick-select codes -- English, Spanish, French,
// German, Japanese, Korean, a judgment call on "most commonly wanted TV
// languages" (see this spec's Design Decisions).
// TOOLING-008: exported for the same reason as COUNTRY_PINNED_OPTIONS above.
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export const LANGUAGE_PINNED_CODES = ['en', 'es', 'fr', 'de', 'ja', 'ko']
const LANGUAGE_OPTION_CODES = [
  ...LANGUAGE_PINNED_CODES,
  'it',
  'zh',
  'pt',
  'hi',
  'sv',
  'da',
  'no',
  'nl',
]
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export const LANGUAGE_OPTIONS: PickerOption[] = LANGUAGE_OPTION_CODES.map(
  (code) => ({
    id: code,
    label: formatLanguageName(code),
  }),
)

// FRONTEND-042: two-tier source selector -- 'mode' picks the top-level tab
// ("Use My Series" merges the former "Automatic"/"Specific Series" -- see
// frontend_spec_042's Design Decisions for why those were always the same
// thing), 'discoverMode' (below) picks which of the three Discover sub-tabs
// is active, relevant only while mode === 'discover'.
export type SourceMode = 'useMySeries' | 'discover'
export type DiscoverMode = 'customSearch' | 'trending' | 'topRated'
export type SortByOption = 'score' | 'recommendationCount'
type TrendingWindow = 'day' | 'week'
// FRONTEND-035: picker-scoped filter/sort state for "Specific Series" mode --
// deliberately not part of ControlsState/RecommendationQuery, mirroring how
// filtersOpen/allSeries/genreOptions are already separate useState calls for
// the same reason (UI-local display concerns, never sent to the backend).
// TOOLING-008: this state itself now lives inside UseMySeriesPanel, but the
// types stay here alongside the specificSeries* pool/sort/filter helper
// functions they describe (this spec's Design Decisions: shared/pure
// helpers stay module-level in this file), exported for that panel to use.
export type SpecificSeriesStatusFilter =
  'any' | 'completedOnly' | 'completedOrWatching'
export type SpecificSeriesSortBy = NonNullable<SortOptions['sortBy']>
export type SpecificSeriesSortDirection = NonNullable<
  SortOptions['sortDirection']
>
// FRONTEND-033-AC-01: real, TMDB-backed sort options for topRated/genre mode
// -- replaces the previous "Best Match"/"Vote Average" no-op pair for those
// two modes only. See frontend_spec_033_discover_native_sort_controls.md.
export type DiscoverSortByOption =
  | 'vote_average.desc'
  | 'popularity.desc'
  | 'first_air_date.desc'
  | 'vote_count.desc'

// SERIES-031-AC-12 / FRONTEND-055-AC-05: mirrors the backend's own
// RecommendationCriteriaValidator bound exactly (1900 to current year + 1) --
// these min/max attributes are a UX nicety (constrains the number input's
// spin arrows, gives the browser a validation hint), not the actual
// enforcement; the backend rejects an out-of-range value regardless of what
// the frontend allows through. Relocated to a shared util so SearchFilter.tsx
// can use the identical bounds without duplicating the constants.

interface RecommendationControlsProps {
  readonly onQueryChange: (query: RecommendationQuery | undefined) => void
  // FRONTEND-040-AC-06/07/08: broadcasts whether a recommendations request is
  // currently in flight (mirrored down from App.tsx's recommendationsLoading,
  // itself fed by RecommendationsList's onLoadingChange) so this panel can
  // lock itself while one is running. Optional/defaulted to false so every
  // pre-existing call site that doesn't pass it keeps working unchanged.
  readonly loading?: boolean
}

// TOOLING-008: exported -- every new sibling panel component receives the
// full ControlsState + updateState rather than individual field props, the
// same shape this file's own internal helpers already consumed before this
// spec (this spec's Design Decisions).
export interface ControlsState {
  mode: SourceMode
  discoverMode: DiscoverMode
  selectedSeriesIds: string[]
  genresSelected: string[]
  keywordsSelected: string[]
  trendingWindow: TrendingWindow
  minTmdbRating: string
  minVoteCount: string
  minVoteCountTouched: boolean
  yearMin: string
  yearMax: string
  excludeGenresSelected: string[]
  excludeKeywordsText: string
  language: string
  // FRONTEND-047-AC-04/05/06: mirrors genresSelected/keywordsSelected's
  // existing shape -- multi-select, OR-matched countries of origin.
  countriesSelected: string[]
  sortBy: SortByOption
  discoverSortBy: DiscoverSortByOption
}

// FRONTEND-033-AC-03: each mode's default matches its current implicit
// behavior exactly, so a user who never touches the control sees no
// behavior change from before this spec. FRONTEND-042: keys rekeyed from the
// old flat 'genre' mode name to the new 'customSearch' Discover sub-mode
// name -- same two defaults, same behavior, cosmetic rename only.
const DISCOVER_SORT_BY_DEFAULTS: Record<
  'topRated' | 'customSearch',
  DiscoverSortByOption
> = {
  topRated: 'vote_average.desc',
  customSearch: 'popularity.desc',
}

// FRONTEND-035-AC-14: field list/labels mirror SeriesList.tsx's own
// SORT_BY_OPTIONS -- only the field set and labels are reused here, the sort
// itself stays entirely client-side (buildSpecificSeriesCandidatePool below),
// unlike SeriesList's which is a request parameter.
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export const SPECIFIC_SERIES_SORT_BY_OPTIONS: {
  value: SpecificSeriesSortBy
  label: string
}[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'personalRating', label: 'Personal Rating' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'imdbRating', label: 'IMDb Rating' },
  { value: 'tmdbRating', label: 'TMDB Rating' },
]

// TOOLING-008/FRONTEND-068: exported so buildQuery's field-population
// behavior (excludeGenresSelected -> query.excludeGenres, no comma-parsing)
// is directly testable, mirroring COUNTRY_PINNED_OPTIONS/
// buildSpecificSeriesCandidatePool's existing module-level-export rationale.
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export const initialState: ControlsState = {
  mode: 'useMySeries',
  discoverMode: 'customSearch',
  selectedSeriesIds: [],
  genresSelected: [],
  keywordsSelected: [],
  trendingWindow: 'week',
  minTmdbRating: '',
  minVoteCount: '',
  minVoteCountTouched: false,
  yearMin: '',
  yearMax: '',
  excludeGenresSelected: [],
  excludeKeywordsText: '',
  language: '',
  countriesSelected: [],
  sortBy: 'score',
  discoverSortBy: DISCOVER_SORT_BY_DEFAULTS.topRated,
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

// FRONTEND-042: shared by both tab tiers' change handlers (top-level
// useMySeries/discover, and the nested Discover sub-tabs) -- computes the
// minVoteCount auto-fill (FRONTEND-030-AC-07/08/09) and discoverSortBy reset
// (FRONTEND-033-AC-05) side effects that used to live in one flat
// handleModeChange, now keyed off the two-tier mode/discoverMode pair
// instead of the old five-value SourceMode. Mutates `patch` in place, mirrors
// the applySourceModeQuery/applyRatingAndRangeFilters mutate-a-draft-query
// convention already used elsewhere in this file.
function applyModeChangeSideEffects(
  prevState: ControlsState,
  nextMode: SourceMode,
  nextDiscoverMode: DiscoverMode,
  patch: Partial<ControlsState>,
): void {
  const enteringTopRated =
    nextMode === 'discover' && nextDiscoverMode === 'topRated'
  const leavingTopRated =
    prevState.mode === 'discover' && prevState.discoverMode === 'topRated'

  if (!prevState.minVoteCountTouched) {
    if (enteringTopRated) {
      patch.minVoteCount = '200'
    } else if (leavingTopRated) {
      patch.minVoteCount = ''
    }
  }

  // FRONTEND-033-AC-05: entering topRated/customSearch resets the sort
  // selection to that sub-mode's own default -- never leaks a discoverSortBy
  // value chosen under one into the other, or into an unrelated mode's
  // request (buildQuery only ever reads it for topRated/customSearch).
  if (
    nextMode === 'discover' &&
    (nextDiscoverMode === 'topRated' || nextDiscoverMode === 'customSearch')
  ) {
    patch.discoverSortBy = DISCOVER_SORT_BY_DEFAULTS[nextDiscoverMode]
  }
}

// TOOLING-008-AC-06: applySourceModeQuery itself was flagged by SonarQube
// (typescript:S3776, complexity 17/15) -- split into one small function per
// state.mode/state.discoverMode branch (mirroring
// applyRatingAndRangeFilters/applyExcludeAndMiscFilters's existing
// "extract one function per concern" pattern one level further), called in
// sequence below. No change to RecommendationQuery output for any mode: each
// branch mutates a disjoint set of query fields, so call order is
// unobservable, but is kept matching the original function's branch order
// for readability.
function applyUseMySeriesModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.mode !== 'useMySeries') return

  // SERIES-033/FRONTEND-049: sent unconditionally so the backend never has
  // to infer "Use My Series" by elimination -- an empty Custom Search
  // request is now a legitimate, distinct request (series_spec_033), so
  // this tab must identify itself explicitly on every request, whether or
  // not a narrowing series selection has been made.
  query.sourceMode = 'useMySeries'
  if (state.selectedSeriesIds.length > 0) {
    query.seriesIds = state.selectedSeriesIds
  }
}

function applyCustomSearchModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.mode !== 'discover' || state.discoverMode !== 'customSearch') {
    return
  }
  if (state.genresSelected.length > 0) query.genres = state.genresSelected
  if (state.keywordsSelected.length > 0) {
    query.keywords = state.keywordsSelected
  }
}

function applyTrendingModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.mode !== 'discover' || state.discoverMode !== 'trending') return

  query.sourceMode = 'trending'
  query.trendingWindow = state.trendingWindow
}

function applyTopRatedModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.mode !== 'discover' || state.discoverMode !== 'topRated') return

  query.sourceMode = 'topRated'
}

// FRONTEND-033-AC-04: only sent when it differs from the current mode's own
// default -- mirrors SeriesList.tsx's buildSortParam wire-minimization
// convention (series_spec_009) so a client at the default behaves
// identically to a pre-FRONTEND-033 client. Kept as its own function (rather
// than folded into applyTopRatedModeQuery/applyCustomSearchModeQuery) since
// it's a cross-cutting concern over both of those modes, not one mode's own
// branch.
function applyDiscoverSortByModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (
    state.mode !== 'discover' ||
    (state.discoverMode !== 'topRated' && state.discoverMode !== 'customSearch')
  ) {
    return
  }
  if (state.discoverSortBy !== DISCOVER_SORT_BY_DEFAULTS[state.discoverMode]) {
    query.discoverSortBy = state.discoverSortBy
  }
}

// FRONTEND-042: rekeyed for the two-tier state -- the wire values this
// produces (query.seriesIds/genres/keywords/sourceMode/discoverSortBy) are
// byte-identical to before this spec, only the UI-state conditions guarding
// them changed.
function applySourceModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  applyUseMySeriesModeQuery(state, query)
  applyCustomSearchModeQuery(state, query)
  applyTrendingModeQuery(state, query)
  applyTopRatedModeQuery(state, query)
  applyDiscoverSortByModeQuery(state, query)
}

function applyRatingAndRangeFilters(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.minTmdbRating.trim() !== '')
    query.minTmdbRating = Number(state.minTmdbRating)
  if (state.minVoteCount.trim() !== '')
    query.minVoteCount = Number(state.minVoteCount)
  if (state.yearMin.trim() !== '') query.yearMin = Number(state.yearMin)
  if (state.yearMax.trim() !== '') query.yearMax = Number(state.yearMax)
}

function applyExcludeAndMiscFilters(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.excludeGenresSelected.length > 0) {
    query.excludeGenres = state.excludeGenresSelected
  }

  const excludeKeywords = parseCommaList(state.excludeKeywordsText)
  if (excludeKeywords.length > 0) query.excludeKeywords = excludeKeywords

  if (state.language.trim() !== '') query.language = state.language.trim()

  // FRONTEND-047-AC-06: sent regardless of which panel the Country picker
  // was rendered in -- both locations write to the same countriesSelected
  // state slot.
  if (state.countriesSelected.length > 0)
    query.countries = state.countriesSelected
}

// Cosmetic pass (2026-08-27, no spec): title | (year) | country - status,
// pipe before country instead of an em dash, hyphen instead of brackets
// before status. `seriesPickerLabel` stays the plain-text source of truth
// for search matching/dedup/the picker's flattened accessible name;
// `seriesPickerDisplay` is the same content with bold title / italic status
// for visual rendering only (KeywordPicker's PickerOption.display).
// TOOLING-008: exported -- UseMySeriesPanel is the only remaining consumer,
// but this stays here alongside buildSpecificSeriesCandidatePool per this
// spec's Design Decisions (shared pure helpers stay module-level here).
// FRONTEND-035-AC-17: the trailing status segment is only meaningful when
// the pool can contain a mix of statuses -- once specificSeriesStatusFilter
// narrows it to one value (or two, for "Completed or Watching"), every
// suggestion would repeat the same text, so it's omitted in that case.
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export function seriesPickerLabel(
  series: Series,
  statusFilter: SpecificSeriesStatusFilter,
): string {
  const formattedYear = formatSeriesYear(series)
  const yearPart = formattedYear !== '' ? ` (${formattedYear})` : ''
  const countryPart =
    series.originCountry != null
      ? ` | ${formatCountryNames(series.originCountry)}`
      : ''
  const statusPart = statusFilter === 'any' ? ` - ${series.status}` : ''
  return `${series.title}${yearPart}${countryPart}${statusPart}`
}

// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export function seriesPickerDisplay(
  series: Series,
  statusFilter: SpecificSeriesStatusFilter,
): ReactNode {
  const formattedYear = formatSeriesYear(series)
  const yearPart = formattedYear !== '' ? ` (${formattedYear})` : ''
  const countryPart =
    series.originCountry != null
      ? ` | ${formatCountryNames(series.originCountry)}`
      : ''
  return (
    <>
      <strong>{series.title}</strong>
      {yearPart}
      {countryPart}
      {statusFilter === 'any' && (
        <>
          {' - '}
          <em>{series.status}</em>
        </>
      )}
    </>
  )
}

// FRONTEND-035-AC-11: a series matches when at least one selected genre
// appears in its comma-separated genres field, case-insensitively, each
// segment trimmed. No genres selected means every series passes.
function filterSpecificSeriesByGenre(
  series: Series[],
  genreFilter: string[],
): Series[] {
  if (genreFilter.length === 0) return series
  const lowerFilter = new Set(genreFilter.map((genre) => genre.toLowerCase()))
  return series.filter((s) => {
    const seriesGenres =
      s.genres?.split(',').map((genre) => genre.trim().toLowerCase()) ?? []
    return seriesGenres.some((genre) => lowerFilter.has(genre))
  })
}

// FRONTEND-069-AC-01/02/03: negated mirror of filterSpecificSeriesByGenre
// above -- same exact-token-match shape (lowercased, comma-split, trimmed),
// deliberately not the backend's substring match (this spec's Design
// Decisions), since it's extending an already-established client-side
// function rather than introducing a new one from scratch. A genre-less
// series (`s.genres` null/empty) yields an empty seriesGenres array, whose
// `.some(...)` is always false, so it's never excluded (AC-02) -- no
// special-case branch needed beyond the existing optional-chaining pattern.
function filterSpecificSeriesByExcludeGenre(
  series: Series[],
  excludeGenreFilter: string[],
): Series[] {
  if (excludeGenreFilter.length === 0) return series
  const lowerFilter = new Set(
    excludeGenreFilter.map((genre) => genre.toLowerCase()),
  )
  return series.filter((s) => {
    const seriesGenres =
      s.genres?.split(',').map((genre) => genre.trim().toLowerCase()) ?? []
    return !seriesGenres.some((genre) => lowerFilter.has(genre))
  })
}

// FRONTEND-035-AC-12: three fixed options -- Any Status (default, everything
// passes), Completed Only, Completed or Watching.
function filterSpecificSeriesByStatus(
  series: Series[],
  statusFilter: SpecificSeriesStatusFilter,
): Series[] {
  if (statusFilter === 'completedOnly') {
    return series.filter((s) => s.status === 'COMPLETED')
  }
  if (statusFilter === 'completedOrWatching') {
    return series.filter(
      (s) => s.status === 'COMPLETED' || s.status === 'WATCHING',
    )
  }
  return series
}

// FRONTEND-081-AC-04: same exact-token, case-insensitive match shape as
// filterSpecificSeriesByGenre above (this spec's Design Decisions), applied
// to Series.keywords instead of the comma-separated genres string. No
// keywords selected means every series passes.
function filterSpecificSeriesByKeywords(
  series: Series[],
  keywordsFilter: string[],
): Series[] {
  if (keywordsFilter.length === 0) return series
  const lowerFilter = new Set(
    keywordsFilter.map((keyword) => keyword.toLowerCase()),
  )
  return series.filter((s) =>
    s.keywords.some((keyword) => lowerFilter.has(keyword.toLowerCase())),
  )
}

// FRONTEND-081-AC-05: a null personalRating never passes an active
// threshold -- matches SeriesSearchService's matchesPersonalRating
// null-handling convention (this spec's Design Decisions). No threshold set
// (null) means every series passes.
function filterSpecificSeriesByMinPersonalRating(
  series: Series[],
  minPersonalRating: number | null,
): Series[] {
  if (minPersonalRating == null) return series
  return series.filter(
    (s) => s.personalRating != null && s.personalRating >= minPersonalRating,
  )
}

// FRONTEND-081-AC-06: same null-exclusion-when-active convention as
// filterSpecificSeriesByMinPersonalRating above, applied to imdbRating.
// minImdbRating is a raw text-input string; a blank/whitespace-only value is
// treated as "not set" (matches SearchFilter.tsx's own FormState -> criteria
// conversion).
function filterSpecificSeriesByMinImdbRating(
  series: Series[],
  minImdbRating: string,
): Series[] {
  const trimmed = minImdbRating.trim()
  if (trimmed === '') return series
  const threshold = Number(trimmed)
  return series.filter((s) => s.imdbRating != null && s.imdbRating >= threshold)
}

// FRONTEND-081-AC-07: same shape as filterSpecificSeriesByMinImdbRating
// above, applied to tmdbRating. Distinct from RecommendationFiltersBox's own
// unrelated "Min TMDB Rating" (post-TMDB) field -- see this spec's
// Design Decisions on the "(My Series)" label suffix.
function filterSpecificSeriesByMinTmdbRating(
  series: Series[],
  minTmdbRating: string,
): Series[] {
  const trimmed = minTmdbRating.trim()
  if (trimmed === '') return series
  const threshold = Number(trimmed)
  return series.filter((s) => s.tmdbRating != null && s.tmdbRating >= threshold)
}

// FRONTEND-081-AC-08: a null year never passes an active range (either bound
// set) -- same null-exclusion-when-active convention as the rating filters
// above. Either bound may be set independently; an unset bound imposes no
// constraint on that side of the range.
//
// FRONTEND-082-AC-01/02/03: mirrors the backend's interval-overlap semantics
// (SeriesSearchService.matchesYearRange) exactly. A series spans
// [year, lastAirYear ?? year]; yearMax still only ever checks the series'
// start year (year), while yearMin checks the series' effective end year
// (lastAirYear if set, else year) so a still-running/long-running show whose
// start predates the range but whose airing span reaches into it still
// matches.
function filterSpecificSeriesByYearRange(
  series: Series[],
  yearMin: string,
  yearMax: string,
): Series[] {
  const trimmedMin = yearMin.trim()
  const trimmedMax = yearMax.trim()
  if (trimmedMin === '' && trimmedMax === '') return series
  const min = trimmedMin === '' ? null : Number(trimmedMin)
  const max = trimmedMax === '' ? null : Number(trimmedMax)
  return series.filter((s) => {
    if (s.year == null) return false
    if (min != null && (s.lastAirYear ?? s.year) < min) return false
    if (max != null && s.year > max) return false
    return true
  })
}

function getSpecificSeriesSortValue(
  series: Series,
  sortBy: SpecificSeriesSortBy,
): string | number | null {
  switch (sortBy) {
    case 'dateAdded':
      return series.dateAdded
    case 'personalRating':
      return series.personalRating
    case 'title':
      return series.title
    case 'year':
      return series.year
    case 'imdbRating':
      return series.imdbRating
    case 'tmdbRating':
      return series.tmdbRating
    default:
      return null
  }
}

// FRONTEND-035-AC-16: null values for the selected sort field always sort
// last, regardless of ascending/descending -- matches
// series_spec_009_rating_sort.md's backend null-last convention, kept here
// for consistency even though this sort runs entirely client-side.
function compareSpecificSeries(
  a: Series,
  b: Series,
  sortBy: SpecificSeriesSortBy,
  direction: SpecificSeriesSortDirection,
): number {
  const aValue = getSpecificSeriesSortValue(a, sortBy)
  const bValue = getSpecificSeriesSortValue(b, sortBy)

  if (aValue == null && bValue == null) return 0
  if (aValue == null) return 1
  if (bValue == null) return -1

  const comparison =
    typeof aValue === 'string' && typeof bValue === 'string'
      ? aValue.localeCompare(bValue)
      : (aValue as number) - (bValue as number)

  return direction === 'asc' ? comparison : -comparison
}

// FRONTEND-081: bundles buildSpecificSeriesCandidatePool's filter criteria
// into a single options object (this spec's Design Decisions) -- 13
// positional parameters (the original 7 plus the six new fields below) would
// be unreadable/error-prone at the one call site that builds this. sortBy/
// sortDirection are included here (not split out) since they're still just
// one more field this same options object threads through unchanged.
export interface SpecificSeriesFilters {
  genreFilter: string[]
  excludeGenreFilter: string[]
  statusFilter: SpecificSeriesStatusFilter
  sortBy: SpecificSeriesSortBy
  sortDirection: SpecificSeriesSortDirection
  // FRONTEND-081-AC-04 through AC-08: the five new Section 1 fields
  // (frontend_spec_081), local-only state in UseMySeriesPanel, never part of
  // ControlsState/RecommendationQuery -- same scope call as the five fields
  // above (this spec's Design Decisions).
  keywordsFilter: string[]
  minPersonalRating: number | null
  minImdbRating: string
  minTmdbRating: string
  yearMin: string
  yearMax: string
}

// FRONTEND-035-AC-13: fixed pipeline order -- genre filter, then status
// filter, then client-side sort -- shared by both the inline picker and the
// browse-all modal, so what's offered (subject to KeywordPicker's own cap or
// typed-text search) is always computed identically. FRONTEND-081 extends
// this chain with five more independent narrowing steps (keywords, min
// personal/IMDb/TMDB rating, year range) -- order among these doesn't affect
// the result since each is just another `.filter()` step.
//
// FRONTEND-050-AC-01/AC-02: a series with excludeFromRecommendations === true
// is dropped before genre/status filtering runs, so neither the inline
// picker nor the browse-all modal (both consume this function's output) ever
// offers it as a selectable option -- the flag means what it says everywhere
// in the UI, not just automatically at recommendation time.
//
// FRONTEND-035-AC-07 / FRONTEND-050-AC-03 / FRONTEND-081-AC-09: any
// already-selected series the filter chain narrows away -- or that has since
// been marked excluded -- is unioned back in *after* sorting, purely so
// KeywordPicker's chip-label lookup (which resolves a selected id against
// whatever `options` it was last given -- see KeywordPicker.tsx) can still
// find a correct label instead of falling back to rendering the raw id. This
// is deliberately sourced from the unfiltered `allSeries`, not `selectable`,
// and never affects what's offered as a *suggestion*: KeywordPicker already
// excludes anything in `selected` from its suggestion list. This step
// operates generically on whatever the filter chain excluded, so it already
// covers the five new FRONTEND-081 predicates with no change of its own.
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export function buildSpecificSeriesCandidatePool(
  allSeries: Series[],
  filters: SpecificSeriesFilters,
  selectedSeriesIds: string[],
): Series[] {
  const selectable = allSeries.filter((s) => !s.excludeFromRecommendations)
  const filtered = filterSpecificSeriesByYearRange(
    filterSpecificSeriesByMinTmdbRating(
      filterSpecificSeriesByMinImdbRating(
        filterSpecificSeriesByMinPersonalRating(
          filterSpecificSeriesByKeywords(
            filterSpecificSeriesByStatus(
              filterSpecificSeriesByExcludeGenre(
                filterSpecificSeriesByGenre(selectable, filters.genreFilter),
                filters.excludeGenreFilter,
              ),
              filters.statusFilter,
            ),
            filters.keywordsFilter,
          ),
          filters.minPersonalRating,
        ),
        filters.minImdbRating,
      ),
      filters.minTmdbRating,
    ),
    filters.yearMin,
    filters.yearMax,
  )
  const sorted = [...filtered].sort((a, b) =>
    compareSpecificSeries(a, b, filters.sortBy, filters.sortDirection),
  )

  const sortedIds = new Set(sorted.map((s) => s.id))
  const missingSelected = allSeries.filter(
    (s) => selectedSeriesIds.includes(s.id) && !sortedIds.has(s.id),
  )

  return [...sorted, ...missingSelected]
}

// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on COUNTRY_PINNED_OPTIONS above for rationale.
export function buildQuery(state: ControlsState): RecommendationQuery {
  const query: RecommendationQuery = {}
  applySourceModeQuery(state, query)
  applyRatingAndRangeFilters(state, query)
  applyExcludeAndMiscFilters(state, query)
  if (state.sortBy === 'recommendationCount') query.sortBy = state.sortBy
  return query
}

export function RecommendationControls({
  onQueryChange,
  loading = false,
}: RecommendationControlsProps) {
  const [state, setState] = useState<ControlsState>(initialState)
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])

  useEffect(() => {
    seriesApi
      .getAll()
      .then(setAllSeries)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    seriesApi
      .getGenreOptions()
      .then(setGenreOptions)
      .catch(() => undefined)
  }, [])

  // FRONTEND-032-AC-07/AC-08: offers tracked keywords as type-ahead
  // suggestions alongside free text. Unlike SearchFilter's stricter
  // fetch-failure handling (keywords are that field's only input method),
  // this field stays fully usable via free text on its own, so a failed
  // fetch degrades silently here -- no error banner, options just stay [].
  useEffect(() => {
    seriesApi
      .getKeywordStats()
      .then((stats) => setKeywordOptions(stats.map((stat) => stat.name)))
      .catch(() => undefined)
  }, [])

  // FRONTEND-040-AC-01: state-only update, no longer a choke point that
  // fires a backend request on every change -- every call site except
  // handleModeChange now funnels through this. Sending is deferred until
  // handleApplyFilters (the new "Apply Filters" button) runs.
  const updateState = (patch: Partial<ControlsState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }

  // FRONTEND-062-AC-02/AC-04 (reverses FRONTEND-040-AC-02): switching the
  // top-level tab now updates pending state only, like every other control
  // -- no onQueryChange(buildQuery(next)) call. It still calls
  // onQueryChange(undefined) to clear any previously-fetched query/results
  // rather than leaving a different mode's stale results displayed under
  // the newly-selected tab's controls (see this spec's Design Decisions).
  // FRONTEND-042 splits this into two call sites (top-level tab, Discover
  // sub-tab) since the selector is now a two-tier tab widget instead of one
  // flat radio group; FRONTEND-042-AC-15 requires each to no-op on a
  // re-click of the already-active tab, since tab <button>s don't get that
  // behavior for free the way native radio inputs do.
  const handleTopLevelModeChange = (mode: SourceMode) => {
    if (mode === state.mode) return

    // Entering Discover always lands on its default sub-tab (Custom
    // Search); leaving it (or staying on Use My Series) doesn't touch
    // discoverMode -- it's simply irrelevant while mode !== 'discover'.
    const nextDiscoverMode: DiscoverMode =
      mode === 'discover' ? 'customSearch' : state.discoverMode

    const patch: Partial<ControlsState> = {
      mode,
      discoverMode: nextDiscoverMode,
      selectedSeriesIds: [],
      genresSelected: [],
      keywordsSelected: [],
    }
    applyModeChangeSideEffects(state, mode, nextDiscoverMode, patch)

    const next = { ...state, ...patch }
    setState(next)
    onQueryChange(undefined)
  }

  // FRONTEND-062-AC-03/AC-04 (reverses FRONTEND-040-AC-02): same treatment
  // as handleTopLevelModeChange above -- pending state only, plus
  // onQueryChange(undefined) to clear a previous mode's stale results.
  const handleDiscoverSubModeChange = (discoverMode: DiscoverMode) => {
    if (state.mode === 'discover' && discoverMode === state.discoverMode) return

    const patch: Partial<ControlsState> = {
      mode: 'discover',
      discoverMode,
      selectedSeriesIds: [],
      genresSelected: [],
      keywordsSelected: [],
    }
    applyModeChangeSideEffects(state, 'discover', discoverMode, patch)

    const next = { ...state, ...patch }
    setState(next)
    onQueryChange(undefined)
  }

  // FRONTEND-040-AC-03: sends whatever the current pending (possibly not-
  // yet-applied) state is at the moment of the click.
  const handleApplyFilters = () => {
    onQueryChange(buildQuery(state))
  }

  // FRONTEND-046: Custom Search is the one Discover sub-mode where Min TMDB
  // Rating/Year Min/Year Max render inside the mode's own panel instead of
  // the shared Filters disclosure box -- see applyRatingAndRangeFilters
  // above, unchanged by this spec: these three fields are sent identically
  // regardless of which JSX block renders their <input>.
  const isCustomSearch =
    state.mode === 'discover' && state.discoverMode === 'customSearch'

  // FRONTEND-042: Sort By is hidden only under Discover > Popular Right Now,
  // unchanged behavior from the old flat 'trending' mode, rekeyed.
  const hideSortBy =
    state.mode === 'discover' && state.discoverMode === 'trending'

  return (
    <div className={styles.container}>
      {/* FRONTEND-042: real two-tier WAI-ARIA Tabs pattern (role="tablist"/
          "tab"/"tabpanel", aria-selected/aria-controls) replaces the old
          flat radio <fieldset> -- this switches which panel of the page is
          shown, which is what Tabs is for, not a radio-group form field.
          Deliberately not <NavLink>s (that's frontend_spec_041's separate,
          actually-navigates-somewhere top-level app nav). */}
      <div className={styles.sourceSelector}>
        <div
          role="tablist"
          aria-label="Recommendation Source"
          className={styles.tablist}
        >
          <button
            type="button"
            role="tab"
            id="source-tab-use-my-series"
            aria-selected={state.mode === 'useMySeries'}
            aria-controls="source-panel-use-my-series"
            className={`${styles.tab} ${
              state.mode === 'useMySeries' ? styles.tabActive : ''
            }`}
            disabled={loading}
            onClick={() => handleTopLevelModeChange('useMySeries')}
          >
            Use My Series
          </button>
          <button
            type="button"
            role="tab"
            id="source-tab-discover"
            aria-selected={state.mode === 'discover'}
            aria-controls="source-panel-discover"
            className={`${styles.tab} ${
              state.mode === 'discover' ? styles.tabActive : ''
            }`}
            disabled={loading}
            onClick={() => handleTopLevelModeChange('discover')}
          >
            Discover
          </button>
        </div>

        {state.mode === 'useMySeries' && (
          <UseMySeriesPanel
            state={state}
            updateState={updateState}
            allSeries={allSeries}
            genreOptions={genreOptions}
            keywordOptions={keywordOptions}
          />
        )}

        {state.mode === 'discover' && (
          <div
            role="tabpanel"
            id="source-panel-discover"
            aria-labelledby="source-tab-discover"
            className={styles.tabPanel}
          >
            <div
              role="tablist"
              aria-label="Discover mode"
              className={styles.tablistNested}
            >
              <button
                type="button"
                role="tab"
                id="discover-tab-custom-search"
                aria-selected={state.discoverMode === 'customSearch'}
                aria-controls="discover-panel-custom-search"
                className={`${styles.tab} ${
                  state.discoverMode === 'customSearch' ? styles.tabActive : ''
                }`}
                disabled={loading}
                onClick={() => handleDiscoverSubModeChange('customSearch')}
              >
                Custom Search
              </button>
              <button
                type="button"
                role="tab"
                id="discover-tab-trending"
                aria-selected={state.discoverMode === 'trending'}
                aria-controls="discover-panel-trending"
                className={`${styles.tab} ${
                  state.discoverMode === 'trending' ? styles.tabActive : ''
                }`}
                disabled={loading}
                onClick={() => handleDiscoverSubModeChange('trending')}
              >
                Popular Right Now
              </button>
              <button
                type="button"
                role="tab"
                id="discover-tab-top-rated"
                aria-selected={state.discoverMode === 'topRated'}
                aria-controls="discover-panel-top-rated"
                className={`${styles.tab} ${
                  state.discoverMode === 'topRated' ? styles.tabActive : ''
                }`}
                disabled={loading}
                onClick={() => handleDiscoverSubModeChange('topRated')}
              >
                Highest Rated
              </button>
            </div>

            {state.discoverMode === 'trending' && (
              <TrendingPanel state={state} updateState={updateState} />
            )}

            {state.discoverMode === 'customSearch' && (
              <CustomSearchPanel
                state={state}
                updateState={updateState}
                genreOptions={genreOptions}
                keywordOptions={keywordOptions}
              />
            )}
          </div>
        )}
      </div>

      {/* FRONTEND-081-AC-10: Post TMDB filtering (RecommendationFiltersBox)
          now renders before Sort filtered recs (HighestRatedPanel), reversing
          their previous order -- both already render unconditionally in this
          same shared position for every mode, so the reorder is global, not
          mode-specific (this spec's Design Decisions). */}
      <RecommendationFiltersBox
        state={state}
        updateState={updateState}
        isCustomSearch={isCustomSearch}
        genreOptions={genreOptions}
      />

      {!hideSortBy && (
        <HighestRatedPanel state={state} updateState={updateState} />
      )}

      {/* FRONTEND-040-AC-03: the single explicit "Get Recommendations"
          action -- every other control above now only updates local
          (pending) state; nothing reaches the backend until this is
          clicked. Placed after the Filters disclosure section, mirroring
          AddSeriesForm/EditSeriesForm's submit-button-at-the-end
          convention. FRONTEND-065-AC-02: relabeled from "Apply Filters". */}
      <button
        type="button"
        className={styles.applyButton}
        onClick={handleApplyFilters}
        disabled={loading}
      >
        Get Recommendations
      </button>

      {/* FRONTEND-040-AC-07/08: a second, independent loading indicator
          from RecommendationsList's own "Loading recommendations..." state
          -- this one locks the controls panel itself while any request
          (mode-triggered or Apply-triggered) is in flight. Reuses the same
          spinner SVG/<output> markup RecommendationsList's loading state
          already renders (RecommendationsList.tsx), not a new design. */}
      {loading && (
        <output className={styles.processingOverlay} aria-label="Loading">
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
          <span>Processing recommendations…</span>
        </output>
      )}
    </div>
  )
}
