const SAFE_IMAGE_URL_PROTOCOLS = new Set(['http:', 'https:'])

// Returns a re-parsed, http(s)-only URL string safe to assign to an <img
// src>, or null if the input is unparseable or uses a scheme a browser
// could treat as executable rather than a plain image fetch (javascript:,
// data:, vbscript:, ...). Returns URL.href -- a value reconstructed from
// the parsed URL object, not the raw input string -- rather than a boolean
// gate, since CodeQL's js/xss-through-dom taint tracking follows the
// original tainted variable straight through a boolean predicate; only a
// genuinely re-derived value clears it.
export function sanitizeImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return SAFE_IMAGE_URL_PROTOCOLS.has(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}
