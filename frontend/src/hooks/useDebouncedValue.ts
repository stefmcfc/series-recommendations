import { useEffect, useState } from 'react'

// FRONTEND-073-AC-01: returns `value` only after it has stayed unchanged for
// `delayMs` -- the previous debounced value is returned in the meantime.
// Every change to `value` (or `delayMs`) resets the pending timer.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}
