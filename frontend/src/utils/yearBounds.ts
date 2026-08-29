// SERIES-031-AC-12 / FRONTEND-055-AC-05: mirrors the backend's own
// RecommendationCriteriaValidator bound exactly (1900 to current year + 1).
// These are a UX nicety (constrains a number input's spin arrows, gives the
// browser a validation hint) -- the backend rejects an out-of-range value
// regardless of what the frontend allows through. Shared by
// RecommendationControls.tsx and SearchFilter.tsx so the two components'
// year-field bounds can't drift apart.
export const MIN_VALID_YEAR = 1900
export const MAX_VALID_YEAR = new Date().getFullYear() + 1
