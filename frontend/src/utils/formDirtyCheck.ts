// FRONTEND-043: flat key-by-key comparison against a snapshot captured at
// mount, used to gate Cancel/Escape behind a confirm dialog only when the
// form actually has unsaved changes. Both AddSeriesForm's and
// EditSeriesForm's FormState shapes are flat (strings/booleans/one enum), so
// a shallow !== comparison is sufficient -- no deep-equality library needed.
// Constrained on `object` rather than `Record<string, unknown>` -- both
// FormState interfaces have no index signature, which `tsc -b` (unlike
// vitest's looser transform) refuses to treat as assignable to Record.
export function isFormDirty<T extends object>(current: T, initial: T): boolean {
  return (Object.keys(initial) as Array<keyof T>).some(
    (key) => current[key] !== initial[key],
  )
}
