import type { PickerOption } from '../components/KeywordPicker'
import { formatCountryName } from './countryName'

// FRONTEND-047-AC-07: a static, hardcoded list of common TV-production
// countries -- deliberately not sourced from the user's own tracked series'
// origin countries (unlike genres/keywords' vocabulary endpoints), since
// Discover modes deliberately don't touch tracked data at all (see
// frontend_spec_047's Design Decisions). Deliberately excludes US/GB --
// those are supplied to KeywordPicker via `pinnedOptions` instead
// (RecommendationControls.tsx), displaying as their bare codes ("US"/"GB",
// a quick one-click shortcut) rather than resolving to a full name here;
// this list is only ever the *searchable rest* beyond the pinned two.
const COMMON_TV_PRODUCTION_COUNTRY_CODES = [
  'CA',
  'AU',
  'NZ',
  'IE',
  'FR',
  'DE',
  'ES',
  'IT',
  'SE',
  'DK',
  'NO',
  'NL',
  'JP',
  'KR',
  'CN',
  'IN',
  'BR',
  'MX',
]

export const COUNTRY_OPTIONS: PickerOption[] =
  COMMON_TV_PRODUCTION_COUNTRY_CODES.map((code) => ({
    id: code,
    label: formatCountryName(code) ?? code,
  }))
