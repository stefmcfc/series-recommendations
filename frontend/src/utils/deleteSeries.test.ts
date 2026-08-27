import { vi, describe, it, expect, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { submitDelete } from './deleteSeries'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('TOOLING-006-AC-04: submitDelete', () => {
  it('calls onStart, then onSuccess when the delete resolves', async () => {
    const onStart = vi.fn()
    const onSuccess = vi.fn()
    vi.spyOn(seriesApi, 'delete').mockResolvedValue(undefined)

    submitDelete('abc', { onStart, onSuccess, onError: vi.fn() })

    expect(onStart).toHaveBeenCalled()
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('calls onError with the ApiError message when the delete rejects', async () => {
    const onError = vi.fn()
    vi.spyOn(seriesApi, 'delete').mockRejectedValue(
      new ApiError(409, 'cannot delete'),
    )

    submitDelete('abc', { onStart: vi.fn(), onSuccess: vi.fn(), onError })

    await waitFor(() => expect(onError).toHaveBeenCalledWith('cannot delete'))
  })

  it('reports the generic fallback message when the rejection is not an ApiError', async () => {
    const onError = vi.fn()
    vi.spyOn(seriesApi, 'delete').mockRejectedValue(new Error('boom'))

    submitDelete('abc', { onStart: vi.fn(), onSuccess: vi.fn(), onError })

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again.',
      ),
    )
  })

  it('calls seriesApi.delete with the given id', () => {
    vi.spyOn(seriesApi, 'delete').mockResolvedValue(undefined)

    submitDelete('abc', {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    })

    expect(seriesApi.delete).toHaveBeenCalledWith('abc')
  })

  it('does not call onError on success', async () => {
    const onError = vi.fn()
    vi.spyOn(seriesApi, 'delete').mockResolvedValue(undefined)

    submitDelete('abc', { onStart: vi.fn(), onSuccess: vi.fn(), onError })

    await waitFor(() => expect(seriesApi.delete).toHaveBeenCalled())
    expect(onError).not.toHaveBeenCalled()
  })
})
