// TOOLING-005-AC-01: shared validators for the field set AddSeriesForm and
// EditSeriesForm both render via SeriesFormFields. Each function's parameter
// types are the minimal shape it reads/writes, not either form's full
// FormState, so both forms' differently-shaped FormState/FieldErrors types
// satisfy them structurally with no shared FormState type needed.

export function validateYear(
  form: { year: string },
  errors: { year?: string },
): void {
  if (form.year.trim() === '') return
  const year = Number(form.year)
  if (Number.isNaN(year) || year < 1 || year > 2026) {
    errors.year = 'Year must be between 1 and 2026'
  }
}

export function validateTotalSeasons(
  form: { totalSeasons: string },
  errors: { totalSeasons?: string },
): void {
  if (form.totalSeasons.trim() === '') return
  const totalSeasons = Number(form.totalSeasons)
  if (Number.isNaN(totalSeasons) || totalSeasons < 1) {
    errors.totalSeasons = 'Total seasons must be at least 1'
  }
}

export function validateTotalEpisodes(
  form: { totalEpisodes: string },
  errors: { totalEpisodes?: string },
): void {
  if (form.totalEpisodes.trim() === '') return
  const totalEpisodes = Number(form.totalEpisodes)
  if (Number.isNaN(totalEpisodes) || totalEpisodes < 1) {
    errors.totalEpisodes = 'Total episodes must be at least 1'
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
    Number.isNaN(rottenTomatoesRating) ||
    rottenTomatoesRating < 0 ||
    rottenTomatoesRating > 100
  ) {
    errors.rottenTomatoesRating =
      'Rotten Tomatoes rating must be between 0 and 100'
  }
}

export function validateRottenTomatoesPopcornmeter(
  form: { rottenTomatoesPopcornmeter: string },
  errors: { rottenTomatoesPopcornmeter?: string },
): void {
  if (form.rottenTomatoesPopcornmeter.trim() === '') return
  const rottenTomatoesPopcornmeter = Number(form.rottenTomatoesPopcornmeter)
  if (
    Number.isNaN(rottenTomatoesPopcornmeter) ||
    rottenTomatoesPopcornmeter < 0 ||
    rottenTomatoesPopcornmeter > 100
  ) {
    errors.rottenTomatoesPopcornmeter =
      'Rotten Tomatoes rating must be between 0 and 100'
  }
}

export function validatePersonalRating(
  form: { personalRating: string },
  errors: { personalRating?: string },
): void {
  if (form.personalRating.trim() === '') return
  const personalRating = Number(form.personalRating)
  if (
    Number.isNaN(personalRating) ||
    personalRating < 1 ||
    personalRating > 5
  ) {
    errors.personalRating = 'Personal rating must be between 1 and 5'
  }
}
