import { describe, it, expect } from 'vitest'
import { isFormDirty } from './formDirtyCheck'

describe('isFormDirty', () => {
  it('returns false when every key matches', () => {
    const initial = { title: 'Show', count: 1, active: true }
    const current = { title: 'Show', count: 1, active: true }
    expect(isFormDirty(current, initial)).toBe(false)
  })

  it('returns true when any key differs', () => {
    const initial = { title: 'Show', count: 1, active: true }
    const current = { title: 'Show (Edited)', count: 1, active: true }
    expect(isFormDirty(current, initial)).toBe(true)
  })

  it('detects a difference in a non-string field', () => {
    const initial = { title: 'Show', count: 1, active: true }
    const current = { title: 'Show', count: 1, active: false }
    expect(isFormDirty(current, initial)).toBe(true)
  })
})
