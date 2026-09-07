import { seriesApi } from '../services/seriesApi'
import { formatCountryName } from '../utils/countryName'
import { NameStatsTable } from './NameStatsTable'
import type { NameStat, NameStatsOptions } from './NameStatsTable'
import type { CountryStat } from '../types/series'
import type { NameStatsFiltersState } from '../hooks/useNameStatsFilters'

// FRONTEND-089-AC-04: NameStatsTable has no hook for transforming a row's
// `name` for display, and per this session's "no premature abstraction"
// pattern it's not worth adding one for a need only this single consumer
// has -- so the raw-code-to-display-name resolution happens here, at the
// fetch boundary, before the data ever reaches NameStatsTable. This
// preserves the backend's ordering (no client-side re-sort of the already
// server-sorted rows) while ensuring only display names are ever rendered
// or used as row keys.
//
// `formatCountryName` is typed `(code: string | null) => string | null`;
// `stat.name` here is always a non-null string, so the `?? stat.name`
// fallback exists purely to satisfy TypeScript's return type -- it will not
// actually be hit for a non-null input.
function mapToDisplayNames(stats: CountryStat[]): NameStat[] {
  return stats.map((stat) => ({
    ...stat,
    name: formatCountryName(stat.name) ?? stat.name,
  }))
}

function fetchCountryStats(options: NameStatsOptions): Promise<NameStat[]> {
  return seriesApi.getCountryStats(options).then(mapToDisplayNames)
}

interface CountryStatsViewProps {
  readonly filters: NameStatsFiltersState
}

// FRONTEND-089: thin wrapper over the shared NameStatsTable (see
// KeywordsView/GenreStatsView), differing only in the labels/testId/fetch
// method -- plus the display-name mapping above, the one genuine difference
// this view has from its two siblings.
//
// FRONTEND-096-AC-14: `filters` is forwarded unchanged from AnalysisView's
// single shared useNameStatsFilters() instance -- this is the only change
// this component makes for that spec.
export function CountryStatsView({ filters }: CountryStatsViewProps) {
  return (
    <NameStatsTable
      testId="country-stats-view"
      heading="Country of Origin"
      idPrefix="country"
      nameColumnLabel="Country"
      loadingLabel="Loading country stats..."
      errorLabel="Failed to load country stats. Please try again."
      fetchStats={fetchCountryStats}
      filters={filters}
    />
  )
}
