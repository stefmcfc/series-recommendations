import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('FRONTEND-098-AC-01/02: useLocalStorage read/write/degrade', () => {
  it('returns the default when nothing is stored', () => {
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    expect(result.current[0]).toBe('default')
  })

  it('reads a previously stored, JSON-serialized value', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'))
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    expect(result.current[0]).toBe('stored')
  })

  it('writes JSON-serialized on every change', () => {
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    act(() => result.current[1]('changed'))
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('changed'))
  })

  it('falls back to the default on a read failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    expect(result.current[0]).toBe('default')
  })

  it('falls back to the default when the stored value fails isValid', () => {
    localStorage.setItem('test-key', JSON.stringify(42))
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    expect(result.current[0]).toBe('default')
  })

  it('falls back to the default when the stored value is malformed JSON', () => {
    localStorage.setItem('test-key', '{not valid json')
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    expect(result.current[0]).toBe('default')
  })

  it('does not throw when a write fails', () => {
    const { result } = renderHook(() =>
      useLocalStorage(
        'test-key',
        'default',
        (v): v is string => typeof v === 'string',
      ),
    )
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => act(() => result.current[1]('changed'))).not.toThrow()
  })
})
