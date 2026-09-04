// FRONTEND-043: flat key-by-key comparison against a snapshot captured at
// mount, used to gate Cancel/Escape behind a confirm dialog only when the
// form actually has unsaved changes. Both AddSeriesForm's and
// EditSeriesForm's FormState shapes are flat (strings/booleans/one enum), so
// a shallow !== comparison is sufficient -- no deep-equality library needed.
export function isFormDirty<T extends Record<string, unknown>>(
  current: T,
  initial: T,
): boolean {
  return (Object.keys(initial) as Array<keyof T>).some(
    (key) => current[key] !== initial[key],
  )
}
