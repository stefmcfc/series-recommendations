let languageNames: Intl.DisplayNames | null = null

function getLanguageNames(): Intl.DisplayNames | null {
  if (languageNames !== null) return languageNames
  try {
    languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
    return languageNames
  } catch {
    return null
  }
}

/**
 * Resolves a raw ISO 639-1 language code (e.g. "en") to its human-readable
 * display name (e.g. "English") via the native Intl.DisplayNames API. Falls
 * back to the raw code, unchanged, if resolution throws or returns
 * undefined -- an unrecognized code degrades to showing the raw value,
 * never to a blank or crashed render. Mirrors utils/countryName.ts's
 * formatCountryName shape exactly (frontend_spec_117).
 */
export function formatLanguageName(code: string | null): string | null {
  if (code === null) return null

  try {
    const displayNames = getLanguageNames()
    const resolved = displayNames?.of(code)
    if (resolved == null) return code
    return resolved
  } catch {
    return code
  }
}
