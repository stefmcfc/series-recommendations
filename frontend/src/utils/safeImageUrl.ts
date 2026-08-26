const SAFE_IMAGE_URL_PROTOCOLS = new Set(['http:', 'https:'])

// Gates rendering a user-typed URL as an <img src> to http(s) only -- blocks
// javascript:/data:/vbscript: and any other scheme a browser might treat as
// executable rather than a plain image fetch. Resolves CodeQL's
// js/xss-through-dom finding on the poster preview in SeriesFormFields.
export function isSafeImageUrl(url: string): boolean {
  try {
    return SAFE_IMAGE_URL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}
