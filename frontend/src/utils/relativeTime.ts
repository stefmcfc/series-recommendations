const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`
}

/**
 * Formats an ISO timestamp as a human-readable relative time ("just now",
 * "5 minutes ago", "3 hours ago", "7 days ago") at second/minute/hour/day
 * granularity, measured against the current time.
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()

  if (diffMs < MINUTE) return 'just now'
  if (diffMs < HOUR) return pluralize(Math.floor(diffMs / MINUTE), 'minute')
  if (diffMs < DAY) return pluralize(Math.floor(diffMs / HOUR), 'hour')
  return pluralize(Math.floor(diffMs / DAY), 'day')
}
