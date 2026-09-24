import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useFilterProfileSelector } from './useFilterProfileSelector'
import { seriesApi } from '../services/seriesApi'

vi.mock('../services/seriesApi')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-129-AC-01: useFilterProfileSelector shares one fetch/selection state', () => {
  it('fetches profiles once for the given area and exposes them', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    const { result } = renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: {},
        onApply: vi.fn(),
      }),
    )
    await waitFor(() => expect(result.current.profiles).toHaveLength(1))
    expect(seriesApi.listFilterProfiles).toHaveBeenCalledTimes(1)
    expect(seriesApi.listFilterProfiles).toHaveBeenCalledWith('MY_SERIES')
  })

  it('does not fetch while disabled', () => {
    const listSpy = vi.spyOn(seriesApi, 'listFilterProfiles')
    renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: {},
        onApply: vi.fn(),
        disabled: true,
      }),
    )
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('selecting a profile applies it immediately and marks it selected', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: { genres: ['Comedy'] },
        createdAt: '',
        updatedAt: '',
      },
    ])
    const onApply = vi.fn()
    const { result } = renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: {},
        onApply,
      }),
    )
    await waitFor(() => expect(result.current.profiles).toHaveLength(1))

    act(() => {
      result.current.handleSelect(result.current.profiles[0])
    })

    expect(onApply).toHaveBeenCalledWith({ genres: ['Comedy'] })
    expect(result.current.selectedId).toBe('1')
    expect(result.current.selectedProfile?.id).toBe('1')
  })

  it('reclicking the already-applied profile clears via onClear and deselects', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: { genres: ['Comedy'] },
        createdAt: '',
        updatedAt: '',
      },
    ])
    const onApply = vi.fn()
    const onClear = vi.fn()
    const { result } = renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: {},
        onApply,
        onClear,
      }),
    )
    await waitFor(() => expect(result.current.profiles).toHaveLength(1))

    act(() => {
      result.current.handleSelect(result.current.profiles[0])
    })
    act(() => {
      result.current.handleSelect(result.current.profiles[0])
    })

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(result.current.selectedId).toBeNull()
    expect(result.current.selectedProfile).toBeNull()
  })

  it('refuses an invalid saved profile and surfaces actionError without applying', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'RECOMMENDATION_FILTERS',
        name: 'Broken',
        criteria: { minTmdbRating: '-99' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    const onApply = vi.fn()
    const { result } = renderHook(() =>
      useFilterProfileSelector({
        area: 'RECOMMENDATION_FILTERS',
        currentCriteria: {},
        onApply,
      }),
    )
    await waitFor(() => expect(result.current.profiles).toHaveLength(1))

    act(() => {
      result.current.handleSelect(result.current.profiles[0])
    })

    expect(onApply).not.toHaveBeenCalled()
    expect(result.current.actionError).toMatch(
      /"Broken" has an invalid saved value and can't be applied/i,
    )
  })

  it('hasActiveCriteria reflects whether currentCriteria has any describable entries', () => {
    const { result, rerender } = renderHook(
      ({ currentCriteria }) =>
        useFilterProfileSelector({
          area: 'MY_SERIES',
          currentCriteria,
          onApply: vi.fn(),
        }),
      { initialProps: { currentCriteria: {} } },
    )
    expect(result.current.hasActiveCriteria).toBe(false)

    rerender({ currentCriteria: { genres: ['Comedy'] } })
    expect(result.current.hasActiveCriteria).toBe(true)
  })

  it('handleSaveFromModal creates a profile, appends it, and closes the save modal', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    vi.spyOn(seriesApi, 'createFilterProfile').mockResolvedValue({
      id: '2',
      area: 'MY_SERIES',
      name: 'New',
      criteria: { genres: ['Comedy'] },
      createdAt: '',
      updatedAt: '',
    })
    const { result } = renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: { genres: ['Comedy'] },
        onApply: vi.fn(),
      }),
    )
    await waitFor(() => expect(result.current.profiles).toHaveLength(0))

    act(() => result.current.setSaveModalOpen(true))
    await act(async () => {
      await result.current.handleSaveFromModal('New')
    })

    expect(seriesApi.createFilterProfile).toHaveBeenCalledWith(
      'MY_SERIES',
      'New',
      { genres: ['Comedy'] },
    )
    expect(result.current.profiles).toHaveLength(1)
    expect(result.current.saveModalOpen).toBe(false)
  })

  describe('FRONTEND-129-AC-07: handleUpdateConfirm sends name + criteria', () => {
    it('replaces the profile in profiles and closes the update modal on success', async () => {
      vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
        {
          id: '1',
          area: 'MY_SERIES',
          name: 'Weeknight',
          criteria: {},
          createdAt: '',
          updatedAt: '',
        },
      ])
      vi.spyOn(seriesApi, 'updateFilterProfile').mockResolvedValue({
        id: '1',
        area: 'MY_SERIES',
        name: 'Weekend',
        criteria: { genres: ['Drama'] },
        createdAt: '',
        updatedAt: '',
      })
      const { result } = renderHook(() =>
        useFilterProfileSelector({
          area: 'MY_SERIES',
          currentCriteria: { genres: ['Drama'] },
          onApply: vi.fn(),
        }),
      )
      await waitFor(() => expect(result.current.profiles).toHaveLength(1))
      act(() => result.current.handleSelect(result.current.profiles[0]))
      act(() => result.current.setUpdateModalOpen(true))

      await act(async () => {
        await result.current.handleUpdateConfirm('Weekend')
      })

      expect(seriesApi.updateFilterProfile).toHaveBeenCalledWith('1', {
        name: 'Weekend',
        criteria: { genres: ['Drama'] },
      })
      expect(result.current.profiles[0].name).toBe('Weekend')
      expect(result.current.updateModalOpen).toBe(false)
    })

    it('propagates a rejection and leaves the update modal state for the caller to handle', async () => {
      vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
        {
          id: '1',
          area: 'MY_SERIES',
          name: 'Weeknight',
          criteria: {},
          createdAt: '',
          updatedAt: '',
        },
      ])
      vi.spyOn(seriesApi, 'updateFilterProfile').mockRejectedValue(
        new Error('network'),
      )
      const { result } = renderHook(() =>
        useFilterProfileSelector({
          area: 'MY_SERIES',
          currentCriteria: {},
          onApply: vi.fn(),
        }),
      )
      await waitFor(() => expect(result.current.profiles).toHaveLength(1))
      act(() => result.current.handleSelect(result.current.profiles[0]))
      act(() => result.current.setUpdateModalOpen(true))

      await expect(
        act(async () => {
          await result.current.handleUpdateConfirm('Weeknight')
        }),
      ).rejects.toThrow('network')

      expect(result.current.updateModalOpen).toBe(true)
    })
  })
})
