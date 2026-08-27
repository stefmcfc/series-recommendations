// FRONTEND-032-AC-06: resolves the shared "how many suggestions to show when
// a KeywordPicker's input is empty" tunable from a Vite env var, defaulting
// to 10 when unset or non-numeric. Kept as a standalone pure function
// (rather than reading import.meta.env inline at each call site) so it's
// directly unit-testable, mirroring seriesApi.ts's API_BASE resolution
// pattern but as a function since this one needs validation, not just a
// nullish-coalesce fallback.
export function resolveKeywordSuggestionsLimit(
  raw: string | undefined,
): number {
  const parsed = raw !== undefined ? Number(raw) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

export const KEYWORD_SUGGESTIONS_LIMIT = resolveKeywordSuggestionsLimit(
  import.meta.env.VITE_KEYWORD_SUGGESTIONS_LIMIT as string | undefined,
)

// FRONTEND-035-AC-08: same pattern as resolveKeywordSuggestionsLimit above,
// but for the "Specific Series" picker's default (empty-input) suggestion
// cap -- a separate tunable since the two pickers' pools/use-cases differ,
// defaulting to 15 rather than 10.
export function resolveSpecificSeriesPickerLimit(
  raw: string | undefined,
): number {
  const parsed = raw !== undefined ? Number(raw) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15
}

export const SPECIFIC_SERIES_PICKER_LIMIT = resolveSpecificSeriesPickerLimit(
  import.meta.env.VITE_SPECIFIC_SERIES_PICKER_LIMIT as string | undefined,
)
