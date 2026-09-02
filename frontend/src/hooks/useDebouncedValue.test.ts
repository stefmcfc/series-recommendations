import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('FRONTEND-073-AC-01: useDebouncedValue debounces', () => {
  it('only updates after the delay elapses with no further changes', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 350),
      { initialProps: { value: 'a' } },
    )
    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('ab')
    vi.useRealTimers()
  })
})
