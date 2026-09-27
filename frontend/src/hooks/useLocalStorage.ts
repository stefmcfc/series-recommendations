import { useEffect, useState } from 'react'

// FRONTEND-098-AC-01/02: generic, JSON-serializing localStorage read/write --
// generalizes SeriesList.tsx's original bespoke viewMode persistence pattern
// into one shared hook. Reads once on mount, falling back to `defaultValue`
// on a missing key, a JSON.parse failure, or an `isValid` rejection; writes
// on every change; both directions silently swallow any read/write failure
// (private browsing, quota, storage disabled) rather than throwing.
//
// Bugfix (found scoping frontend_spec_136's KeywordDetailModal, which reads/
// writes the same `keywordFavourites` key as its parent KeywordsView while
// both are mounted together): two live instances of this hook for the same
// key previously couldn't see each other's writes -- each held its own React
// state, read from storage only once on mount, and the native `storage`
// event only fires in *other* browser tabs, never the one that wrote. So
// toggling a favourite inside the modal never updated the star already
// rendered in the table behind it, without a full remount. The returned
// setter now also broadcasts a same-tab CustomEvent naming the key; every
// mounted instance for that key re-reads storage and updates its own state
// in response, so multiple live consumers of one key stay in sync without a
// new shared hook/context.
const SYNC_EVENT = 'app:local-storage-sync'

interface SyncEventDetail {
  key: string
}

function readStoredValue<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    const parsed: unknown = JSON.parse(stored)
    return isValid(parsed) ? parsed : defaultValue
  } catch {
    return defaultValue
  }
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() =>
    readStoredValue(key, defaultValue, isValid),
  )

  useEffect(() => {
    const handleSync = (event: Event) => {
      const { key: changedKey } = (event as CustomEvent<SyncEventDetail>).detail
      if (changedKey !== key) return
      setValue(readStoredValue(key, defaultValue, isValid))
    }
    window.addEventListener(SYNC_EVENT, handleSync)
    return () => window.removeEventListener(SYNC_EVENT, handleSync)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is stable per call site by convention (mirrors the original write effect's own assumption below); defaultValue/isValid are likewise expected stable per call site.
  }, [key])

  const setAndPersist = (next: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Silently ignore -- persistence is a nice-to-have, not a requirement.
    }
    setValue(next)
    // Dispatched synchronously, after the write above -- so every other
    // mounted instance's handleSync (including this one's own, a harmless
    // no-op re-read of the value it just set) reads the storage write that
    // already happened, never a stale one.
    window.dispatchEvent(
      new CustomEvent<SyncEventDetail>(SYNC_EVENT, { detail: { key } }),
    )
  }

  return [value, setAndPersist]
}
