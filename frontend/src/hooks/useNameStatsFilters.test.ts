import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useNameStatsFilters } from './useNameStatsFilters'

// FRONTEND-096-AC-09: this hook lifts filter/sort/panel-open state (plus
// buildFetchOptions) out of NameStatsTable.tsx unchanged in behavior -- see
// that component's own historical comments for how this logic originated
// (frontend_spec_086, frontend_spec_095). Moving it here is what lets
// AnalysisView share one instance across all three /analysis sub-tabs.

describe('FRONTEND-096-AC-09: useNameStatsFilters owns filter/sort/panel state', () => {
  it('starts with blank filterInputs/appliedFilters, undefined sort, filters closed', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    expect(result.current.filterInputs.minSeriesCount).toBe('')
    expect(result.current.appliedFilters.minSeriesCount).toBe('')
    expect(result.current.sortBy).toBeUndefined()
    expect(result.current.filtersOpen).toBe(false)
  })

  it('starts with an empty options object and zero activeFilterCount', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    expect(result.current.options).toEqual({})
    expect(result.current.activeFilterCount).toBe(0)
  })

  it('handleApplyFilters commits filterInputs into appliedFilters and bumps applyVersion', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() =>
      result.current.handleFilterInputChange('minSeriesCount')({
        target: { value: '5' },
      } as React.ChangeEvent<HTMLInputElement>),
    )
    const versionBefore = result.current.applyVersion
    act(() => result.current.handleApplyFilters())
    expect(result.current.appliedFilters.minSeriesCount).toBe('5')
    expect(result.current.applyVersion).toBeGreaterThan(versionBefore)
  })

  it('reflects applied filters in the computed options and activeFilterCount', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() =>
      result.current.handleFilterInputChange('minSeriesCount')({
        target: { value: '5' },
      } as React.ChangeEvent<HTMLInputElement>),
    )
    act(() => result.current.handleApplyFilters())

    expect(result.current.options).toEqual({ minSeriesCount: 5 })
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('handleSortChange sets sortBy on first click, toggles direction on repeat', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() => result.current.handleSortChange('seriesCount'))
    expect(result.current.sortBy).toBe('seriesCount')
    expect(result.current.sortDirection).toBeUndefined()
    expect(result.current.sortIndicator('seriesCount')).toBe(' ▼')

    act(() => result.current.handleSortChange('seriesCount'))
    expect(result.current.sortDirection).toBe('asc')
    expect(result.current.sortIndicator('seriesCount')).toBe(' ▲')
  })

  it('handleToggleFiltersOpen flips filtersOpen', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() => result.current.handleToggleFiltersOpen())
    expect(result.current.filtersOpen).toBe(true)
    act(() => result.current.handleToggleFiltersOpen())
    expect(result.current.filtersOpen).toBe(false)
  })
})

describe('FRONTEND-096-AC-06: activeFilterCount counts appliedFilters, not live keystrokes', () => {
  it('does not count an unapplied filterInputs change', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() =>
      result.current.handleFilterInputChange('minSeriesCount')({
        target: { value: '5' },
      } as React.ChangeEvent<HTMLInputElement>),
    )
    expect(result.current.activeFilterCount).toBe(0)
  })

  it('counts a non-default statusScope once applied', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() =>
      result.current.handleStatusScopeChange({
        target: { value: 'completed' },
      } as React.ChangeEvent<HTMLSelectElement>),
    )
    act(() => result.current.handleApplyFilters())
    expect(result.current.activeFilterCount).toBe(1)
    expect(result.current.options).toEqual({ onlyCompleted: true })
  })
})

describe('FRONTEND-096-AC-07/08: Reset Filters clears without a separate Apply, leaves sort untouched', () => {
  it('clears filterInputs and appliedFilters immediately, preserves sortBy', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() => result.current.handleSortChange('seriesCount'))
    act(() =>
      result.current.handleFilterInputChange('minSeriesCount')({
        target: { value: '5' },
      } as React.ChangeEvent<HTMLInputElement>),
    )
    act(() => result.current.handleApplyFilters())

    const versionBefore = result.current.applyVersion
    act(() => result.current.handleResetFilters())

    expect(result.current.filterInputs.minSeriesCount).toBe('')
    expect(result.current.appliedFilters.minSeriesCount).toBe('')
    expect(result.current.sortBy).toBe('seriesCount')
    expect(result.current.options).toEqual({ sortBy: 'seriesCount' })
    expect(result.current.applyVersion).toBeGreaterThan(versionBefore)
  })
})
