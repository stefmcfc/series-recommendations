import { useEffect, useState } from 'react'

// FRONTEND-098-AC-01/02: generic, JSON-serializing localStorage read/write --
// generalizes SeriesList.tsx's original bespoke viewMode persistence pattern
// into one shared hook. Reads once on mount, falling back to `defaultValue`
// on a missing key, a JSON.parse failure, or an `isValid` rejection; writes
// on every change; both directions silently swallow any read/write failure
// (private browsing, quota, storage disabled) rather than throwing.
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored === null) return defaultValue
      const parsed: unknown = JSON.parse(stored)
      return isValid(parsed) ? parsed : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Silently ignore -- persistence is a nice-to-have, not a requirement.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is stable per call site by convention (mirrors SeriesList.tsx's original VIEW_MODE_STORAGE_KEY usage); only `value` changes are meant to trigger a write.
  }, [value])

  return [value, setValue]
}
