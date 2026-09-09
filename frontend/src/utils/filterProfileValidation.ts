// FRONTEND-108-AC-03: client-side mirror of series_spec_056's
// @Size(max=255)/@Pattern(regexp="^[^\r\n\t]*$") bound on FilterProfile.name
// -- exists so a user gets instant feedback instead of waiting on a
// round-trip, and so the UI never lets through something the backend will
// reject anyway (this spec's Design Decisions: data hygiene, not a security
// allowlist -- SQL injection is structurally impossible for this table).
// One shared function backs both SaveFilterProfileModal and the Settings
// rename control.

export const FILTER_PROFILE_NAME_MAX_LENGTH = 255

export interface FilterProfileNameValidationResult {
  valid: boolean
  error: string | null
}

const CONTROL_CHAR_PATTERN = /[\r\n\t]/

export function validateFilterProfileName(
  name: string,
  existingNames: readonly string[],
  currentName?: string,
): FilterProfileNameValidationResult {
  const trimmed = name.trim()

  if (trimmed === '') {
    return { valid: false, error: 'Enter a name for this profile.' }
  }

  if (trimmed.length > FILTER_PROFILE_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Name must be ${FILTER_PROFILE_NAME_MAX_LENGTH} characters or fewer.`,
    }
  }

  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain line breaks or tabs.' }
  }

  const isDuplicate = existingNames.some(
    (existing) => existing === trimmed && existing !== currentName,
  )
  if (isDuplicate) {
    return {
      valid: false,
      error: `A profile named '${trimmed}' already exists for this area`,
    }
  }

  return { valid: true, error: null }
}
