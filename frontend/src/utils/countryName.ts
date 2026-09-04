let regionNames: Intl.DisplayNames | null = null

function getRegionNames(): Intl.DisplayNames | null {
  if (regionNames !== null) return regionNames
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    return regionNames
  } catch {
    return null
  }
}

/**
 * Resolves a raw ISO 3166-1 alpha-2 country code (e.g. "GB") to its
 * human-readable display name (e.g. "United Kingdom") via the native
 * Intl.DisplayNames API. Falls back to the raw code, unchanged, if
 * resolution throws or returns undefined -- an unrecognized code degrades
 * to showing the raw value, never to a blank or crashed render.
 */
export function formatCountryName(code: string | null): string | null {
  if (code === null) return null

  try {
    const displayNames = getRegionNames()
    const resolved = displayNames?.of(code)
    // "Unknown Region" is CLDR's special-cased name for the reserved "ZZ"
    // code -- treat it the same as an unresolved code and fall back to the
    // raw value rather than showing a name that isn't actually informative.
    if (resolved == null || resolved === 'Unknown Region') return code
    return resolved
  } catch {
    return code
  }
}

/**
 * Resolves a possibly comma-separated multi-country raw value (e.g. "GB,US"
 * for a co-production, matching the backend's bare-comma, no-space storage
 * delimiter) to a human-readable, comma-space-joined display string (e.g.
 * "United Kingdom, United States"). Each code is resolved individually via
 * formatCountryName, so an unresolvable code within a multi-code value falls
 * back to its raw code in place rather than failing the whole value, and a
 * single-code input produces an identical result to calling
 * formatCountryName directly.
 */
export function formatCountryNames(raw: string | null): string | null {
  if (raw === null) return null

  return raw.split(',').map(formatCountryName).join(', ')
}
