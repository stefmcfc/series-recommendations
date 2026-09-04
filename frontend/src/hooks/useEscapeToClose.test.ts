import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useEscapeToClose } from './useEscapeToClose'

describe('FRONTEND-083-AC-01: calls onEscape when Escape is pressed', () => {
  it('invokes onEscape for an Escape keydown', () => {
    const onEscape = vi.fn()
    const { result } = renderHook(() => useEscapeToClose(onEscape))

    result.current({ key: 'Escape' } as React.KeyboardEvent<HTMLDivElement>)

    expect(onEscape).toHaveBeenCalledOnce()
  })
})

describe('FRONTEND-083-AC-02: ignores every other key', () => {
  it('does not invoke onEscape for a non-Escape keydown', () => {
    const onEscape = vi.fn()
    const { result } = renderHook(() => useEscapeToClose(onEscape))

    result.current({ key: 'Enter' } as React.KeyboardEvent<HTMLDivElement>)

    expect(onEscape).not.toHaveBeenCalled()
  })
})
