// TOOLING-005-AC-01: shared validators for the field set AddSeriesForm and
// EditSeriesForm both render via SeriesFormFields. Each function's parameter
// types are the minimal shape it reads/writes, not either form's full
// FormState, so both forms' differently-shaped FormState/FieldErrors types
// satisfy them structurally with no shared FormState type needed.

import { MIN_VALID_YEAR, MAX_VALID_YEAR } from './yearBounds'

// FRONTEND-061-AC-01: reuses the same MIN_VALID_YEAR/MAX_VALID_YEAR bound as
// SearchFilter/RecommendationControls (and the backend's own validator)
// rather than a second, independently-maintained range.
export function validateYear(
  form: { year: string },
  errors: { year?: string },
): void {
  if (form.year.trim() === '') return
  const year = Number(form.year)
  if (Number.isNaN(year) || year < MIN_VALID_YEAR || year > MAX_VALID_YEAR) {
    errors.year = `Year must be between ${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}`
  }
}

export function validateTotalSeasons(
  form: { totalSeasons: string },
  errors: { totalSeasons?: string },
): void {
  if (form.totalSeasons.trim() === '') return
  const totalSeasons = Number(form.totalSeasons)
  if (!Number.isInteger(totalSeasons) || totalSeasons < 1) {
    errors.totalSeasons = 'Total seasons must be a whole number of at least 1'
  }
}

export function validateTotalEpisodes(
  form: { totalEpisodes: string },
  errors: { totalEpisodes?: string },
): void {
  if (form.totalEpisodes.trim() === '') return
  const totalEpisodes = Number(form.totalEpisodes)
  if (!Number.isInteger(totalEpisodes) || totalEpisodes < 1) {
    errors.totalEpisodes = 'Total episodes must be a whole number of at least 1'
  }
}

export function validateImdbRating(
  form: { imdbRating: string },
  errors: { imdbRating?: string },
): void {
  if (form.imdbRating.trim() === '') return
  const imdbRating = Number(form.imdbRating)
  if (Number.isNaN(imdbRating) || imdbRating < 0 || imdbRating > 10) {
    errors.imdbRating = 'IMDb rating must be between 0 and 10'
  }
}

export function validateRottenTomatoesRating(
  form: { rottenTomatoesRating: string },
  errors: { rottenTomatoesRating?: string },
): void {
  if (form.rottenTomatoesRating.trim() === '') return
  const rottenTomatoesRating = Number(form.rottenTomatoesRating)
  if (
    !Number.isInteger(rottenTomatoesRating) ||
    rottenTomatoesRating < 0 ||
    rottenTomatoesRating > 100
  ) {
    errors.rottenTomatoesRating =
      'Rotten Tomatoes rating must be a whole number between 0 and 100'
  }
}

export function validateRottenTomatoesPopcornmeter(
  form: { rottenTomatoesPopcornmeter: string },
  errors: { rottenTomatoesPopcornmeter?: string },
): void {
  if (form.rottenTomatoesPopcornmeter.trim() === '') return
  const rottenTomatoesPopcornmeter = Number(form.rottenTomatoesPopcornmeter)
  if (
    !Number.isInteger(rottenTomatoesPopcornmeter) ||
    rottenTomatoesPopcornmeter < 0 ||
    rottenTomatoesPopcornmeter > 100
  ) {
    errors.rottenTomatoesPopcornmeter =
      'Rotten Tomatoes rating must be a whole number between 0 and 100'
  }
}
