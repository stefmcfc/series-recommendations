import { useMemo, useState } from 'react'
import type {
  NameStatsOptions,
  NameStatsSortBy,
  NameStatsSortDirection,
} from '../components/NameStatsTable'
import type { AnalysisFilterCriteria } from '../types/filterProfile'

// FRONTEND-096-AC-09: filter/sort/panel-open state, plus the
// buildFetchOptions helper, lifted out of NameStatsTable.tsx unchanged in
// behavior -- see that component's own historical comments for how this
// logic originated (frontend_spec_086's Apply-Filters pattern,
// frontend_spec_095's status-scope addition). NameStatsTable keeps only its
// own stats/loading/error state and fetch effect, now driven by this hook's
// return value via a `filters` prop. Owning this in a hook (rather than
// leaving it local to NameStatsTable) is what lets AnalysisView instantiate
// it exactly once and share it across all three /analysis sub-tabs, so
// switching tabs no longer discards it (frontend_spec_096's Design
// Decisions).

// FRONTEND-095-AC-04: the status-scope select's two option values -- 'all'
// is the default and maps to onlyCompleted being omitted entirely (never
// sent as false); 'completed' maps to onlyCompleted: true.
type StatusScope = 'all' | 'completed'

export interface FilterInputs {
  minSeriesCount: string
  minAveragePersonalRating: string
  minAverageBlendedRating: string
  statusScope: StatusScope
}

const emptyFilterInputs: FilterInputs = {
  minSeriesCount: '',
  minAveragePersonalRating: '',
  minAverageBlendedRating: '',
  statusScope: 'all',
}

// FRONTEND-086-AC-09/10/SERIES-047-AC-07: each sortable field's established
// default direction when sortDirection is omitted -- used here purely to
// compute the toggle's starting point and the direction indicator, not sent
// to the backend unless the user has actually toggled (see buildFetchOptions
// below, which only includes sortDirection once it's explicitly set).
const DEFAULT_SORT_DIRECTION: Record<NameStatsSortBy, NameStatsSortDirection> =
  {
    seriesCount: 'desc',
    averagePersonalRating: 'desc',
    averageBlendedRating: 'desc',
    name: 'asc',
  }

// FRONTEND-086-AC-06: a blank filter field is omitted entirely (not sent as
// 0) -- leaving all three blank reduces this to {}.
function buildFetchOptions(
  sortBy: NameStatsSortBy | undefined,
  sortDirection: NameStatsSortDirection | undefined,
  appliedFilters: FilterInputs,
): NameStatsOptions {
  const options: NameStatsOptions = {}
  if (sortBy !== undefined) options.sortBy = sortBy
  if (sortDirection !== undefined) options.sortDirection = sortDirection
  if (appliedFilters.minSeriesCount.trim() !== '')
    options.minSeriesCount = Number(appliedFilters.minSeriesCount)
  if (appliedFilters.minAveragePersonalRating.trim() !== '')
    options.minAveragePersonalRating = Number(
      appliedFilters.minAveragePersonalRating,
    )
  if (appliedFilters.minAverageBlendedRating.trim() !== '')
    options.minAverageBlendedRating = Number(
      appliedFilters.minAverageBlendedRating,
    )
  // FRONTEND-095-AC-05/06: only included when explicitly 'completed' --
  // 'all' (the default, and reverting back to it) omits onlyCompleted
  // entirely rather than sending it as false.
  if (appliedFilters.statusScope === 'completed') options.onlyCompleted = true
  return options
}

// FRONTEND-096-AC-06: counts only appliedFilters -- what's actually driving
// the table right now -- not the uncommitted filterInputs the user may still
// be typing (this spec's Design Decisions).
function countActiveFilters(appliedFilters: FilterInputs): number {
  const nonBlankCount = [
    appliedFilters.minSeriesCount,
    appliedFilters.minAveragePersonalRating,
    appliedFilters.minAverageBlendedRating,
  ].filter((value) => value.trim() !== '').length
  return nonBlankCount + (appliedFilters.statusScope !== 'all' ? 1 : 0)
}

export interface NameStatsFiltersState {
  filterInputs: FilterInputs
  appliedFilters: FilterInputs
  sortBy: NameStatsSortBy | undefined
  sortDirection: NameStatsSortDirection | undefined
  applyVersion: number
  filtersOpen: boolean
  options: NameStatsOptions
  activeFilterCount: number
  handleFilterInputChange: (
    field: keyof Omit<FilterInputs, 'statusScope'>,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void
  handleStatusScopeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  handleSortChange: (column: NameStatsSortBy) => void
  handleApplyFilters: () => void
  handleResetFilters: () => void
  handleToggleFiltersOpen: () => void
  sortIndicator: (column: NameStatsSortBy) => string
  // FRONTEND-112-AC-08: applies a saved Analysis profile immediately (no
  // separate Apply click), matching frontend_spec_107's "select-and-apply
  // immediately" Design Decision.
  applyFilterProfile: (criteria: AnalysisFilterCriteria) => void
  // FRONTEND-112-AC-08: distinct from handleResetFilters -- this also resets
  // sortBy/sortDirection to undefined, since this area's saved criteria
  // include sort (this spec's Design Decisions: handleResetFilters
  // deliberately leaves sort untouched, "filters" and "sort" are separate
  // concerns there).
  clearFilterProfile: () => void
}

export function useNameStatsFilters(): NameStatsFiltersState {
  const [sortBy, setSortBy] = useState<NameStatsSortBy | undefined>(undefined)
  const [sortDirection, setSortDirection] = useState<
    NameStatsSortDirection | undefined
  >(undefined)

  // FRONTEND-086-AC-05: uncommitted field values the user is currently
  // typing -- distinct from appliedFilters below, which only changes when
  // Apply Filters is clicked (explicit-submit convention, matching
  // SearchFilter).
  const [filterInputs, setFilterInputs] =
    useState<FilterInputs>(emptyFilterInputs)
  const [appliedFilters, setAppliedFilters] =
    useState<FilterInputs>(emptyFilterInputs)
  // FRONTEND-086-AC-05: Apply Filters must always re-fetch, even when the
  // filter values are unchanged from what's already applied (e.g. re-typing
  // the same value, or clicking Apply again with nothing changed) -- an
  // identical appliedFilters object reference wouldn't otherwise trigger
  // NameStatsTable's fetch effect, so a click bumps this counter
  // unconditionally. Reset Filters (below) bumps it too, for the same reason
  // -- see FRONTEND-096-AC-07.
  const [applyVersion, setApplyVersion] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const options = useMemo(
    () => buildFetchOptions(sortBy, sortDirection, appliedFilters),
    [sortBy, sortDirection, appliedFilters],
  )
  const activeFilterCount = useMemo(
    () => countActiveFilters(appliedFilters),
    [appliedFilters],
  )

  const handleSortChange = (column: NameStatsSortBy) => {
    if (sortBy === column) {
      const currentDirection = sortDirection ?? DEFAULT_SORT_DIRECTION[column]
      setSortDirection(currentDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection(undefined)
    }
  }

  const handleFilterInputChange =
    (field: keyof Omit<FilterInputs, 'statusScope'>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilterInputs((prev) => ({ ...prev, [field]: event.target.value }))
    }

  // FRONTEND-095-AC-04: separate from handleFilterInputChange above since the
  // status scope control is a <select> (StatusScope union), not a free-text
  // numeric <input> (string).
  const handleStatusScopeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const statusScope = event.target.value as StatusScope
    setFilterInputs((prev) => ({ ...prev, statusScope }))
  }

  const handleApplyFilters = () => {
    setAppliedFilters(filterInputs)
    setApplyVersion((v) => v + 1)
  }

  // FRONTEND-096-AC-07/08: clears both filterInputs and appliedFilters and
  // immediately bumps applyVersion so NameStatsTable's fetch effect re-runs
  // right away -- no separate Apply click required, matching SearchFilter's
  // own "Clear Filters" precedent rather than leaving stale results on
  // screen (this spec's Design Decisions). sortBy/sortDirection are
  // deliberately left untouched -- "filters" and "sort" are separate
  // concerns in this component already.
  const handleResetFilters = () => {
    setFilterInputs(emptyFilterInputs)
    setAppliedFilters(emptyFilterInputs)
    setApplyVersion((v) => v + 1)
  }

  const handleToggleFiltersOpen = () => {
    setFiltersOpen((open) => !open)
  }

  // FRONTEND-112-AC-08: sets filterInputs/appliedFilters and sortBy/
  // sortDirection from the profile's criteria and bumps applyVersion --
  // adapted from handleApplyFilters, not a copy (also sets sort, which that
  // function never touches).
  const applyFilterProfile = (criteria: AnalysisFilterCriteria) => {
    // A saved profile's criteria may be a partial object (e.g. a profile
    // saved before a field existed, or omitted at save time) even though
    // TCriteria's type says otherwise -- defaulting each field via
    // emptyFilterInputs keeps this a safe full replace either way, matching
    // how every other area's saved criteria is treated as partial at the
    // description layer (describeFilterCriteria.ts's own `Partial<...>`
    // narrowing).
    const nextFilterInputs: FilterInputs = {
      minSeriesCount:
        criteria.minSeriesCount ?? emptyFilterInputs.minSeriesCount,
      minAveragePersonalRating:
        criteria.minAveragePersonalRating ??
        emptyFilterInputs.minAveragePersonalRating,
      minAverageBlendedRating:
        criteria.minAverageBlendedRating ??
        emptyFilterInputs.minAverageBlendedRating,
      statusScope: criteria.statusScope ?? emptyFilterInputs.statusScope,
    }
    setFilterInputs(nextFilterInputs)
    setAppliedFilters(nextFilterInputs)
    setSortBy(criteria.sortBy)
    setSortDirection(criteria.sortDirection)
    setApplyVersion((v) => v + 1)
  }

  // FRONTEND-112-AC-08: adapted from handleResetFilters -- additionally
  // resets sortBy/sortDirection to undefined, since this spec's saved
  // criteria include sort (deliberately different from handleResetFilters,
  // see this spec's Design Decisions).
  const clearFilterProfile = () => {
    setFilterInputs(emptyFilterInputs)
    setAppliedFilters(emptyFilterInputs)
    setSortBy(undefined)
    setSortDirection(undefined)
    setApplyVersion((v) => v + 1)
  }

  const sortIndicator = (column: NameStatsSortBy): string => {
    if (sortBy !== column) return ''
    const direction = sortDirection ?? DEFAULT_SORT_DIRECTION[column]
    return direction === 'asc' ? ' ▲' : ' ▼'
  }

  return {
    filterInputs,
    appliedFilters,
    sortBy,
    sortDirection,
    applyVersion,
    filtersOpen,
    options,
    activeFilterCount,
    handleFilterInputChange,
    handleStatusScopeChange,
    handleSortChange,
    handleApplyFilters,
    handleResetFilters,
    handleToggleFiltersOpen,
    sortIndicator,
    applyFilterProfile,
    clearFilterProfile,
  }
}
