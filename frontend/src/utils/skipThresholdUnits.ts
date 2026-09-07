// FRONTEND-101: unit-conversion helpers for the Refresh All skip-threshold
// override. Deliberately no Hours/Minutes unit -- a single-series refresh
// already bypasses the skip threshold entirely (series_spec_018), so a
// sub-day threshold has no real use case.
export type SkipThresholdUnit = 'days' | 'weeks' | 'months'

// Flat, calendar-unaware approximations (1 month = 30 days) -- this is a
// skip *threshold*, not a scheduling deadline, so "roughly a month" is what
// picking that unit means. Matches this app's existing pragmatic-
// approximation posture elsewhere (e.g. RecommendationPoolCache's TTL).
const MINUTES_PER_DAY = 1440
const MINUTES_PER_WEEK = 10080
const MINUTES_PER_MONTH = 43200

const UNIT_MINUTES: Record<SkipThresholdUnit, number> = {
  days: MINUTES_PER_DAY,
  weeks: MINUTES_PER_WEEK,
  months: MINUTES_PER_MONTH,
}

// FRONTEND-101-AC-02: convert a value + unit picked in the override control
// to total minutes before calling seriesApi.refreshAll.
export function toMinutes(value: number, unit: SkipThresholdUnit): number {
  return value * UNIT_MINUTES[unit]
}

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

// FRONTEND-101-AC-04: format skipThresholdMinutesUsed back to the largest
// whole unit that divides it evenly (months, then weeks, then days),
// falling back to plain minutes when none divide evenly -- never loses
// precision, just prefers the readable form when one exists.
export function formatThreshold(minutes: number): string {
  if (minutes % MINUTES_PER_MONTH === 0) {
    return pluralize(minutes / MINUTES_PER_MONTH, 'month')
  }
  if (minutes % MINUTES_PER_WEEK === 0) {
    return pluralize(minutes / MINUTES_PER_WEEK, 'week')
  }
  if (minutes % MINUTES_PER_DAY === 0) {
    return pluralize(minutes / MINUTES_PER_DAY, 'day')
  }
  return `${minutes} min`
}
