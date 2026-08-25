import { useEffect, useRef, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series, UpdateSeriesRequest } from '../types/series'
import styles from './EditSeriesForm.module.css'

interface EditSeriesFormProps {
  series: Series
  onCancel: () => void
  onSuccess: (series: Series) => void
}

interface FormState {
  title: string
  year: string
  genres: string
  tags: string
  totalSeasons: string
  totalEpisodes: string
  currentSeason: string
  currentEpisode: string
  status: SeriesStatus
  imdbRating: string
  rottenTomatoesRating: string
  rottenTomatoesPopcornmeter: string
  personalRating: string
  personalNotes: string
  posterUrl: string
  excludeFromRecommendations: boolean
}

type FieldErrors = Partial<Record<keyof FormState, string>>

function numberToFormValue(value: number | null): string {
  return value == null ? '' : String(value)
}

function toFormState(series: Series): FormState {
  return {
    title: series.title,
    year: numberToFormValue(series.year),
    genres: series.genres ?? '',
    tags: series.tags ?? '',
    totalSeasons: numberToFormValue(series.totalSeasons),
    totalEpisodes: numberToFormValue(series.totalEpisodes),
    currentSeason: numberToFormValue(series.currentSeason),
    currentEpisode: numberToFormValue(series.currentEpisode),
    status: series.status,
    imdbRating: numberToFormValue(series.imdbRating),
    rottenTomatoesRating: numberToFormValue(series.rottenTomatoesRating),
    rottenTomatoesPopcornmeter: numberToFormValue(
      series.rottenTomatoesPopcornmeter,
    ),
    personalRating: numberToFormValue(series.personalRating),
    personalNotes: series.personalNotes ?? '',
    posterUrl: series.posterUrl ?? '',
    excludeFromRecommendations: series.excludeFromRecommendations,
  }
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  if (form.title.trim() === '') {
    errors.title = 'Title is required'
  }

  if (form.year.trim() !== '') {
    const year = Number(form.year)
    if (Number.isNaN(year) || year < 1 || year > 2026) {
      errors.year = 'Year must be between 1 and 2026'
    }
  }

  if (form.totalSeasons.trim() !== '') {
    const totalSeasons = Number(form.totalSeasons)
    if (Number.isNaN(totalSeasons) || totalSeasons < 1) {
      errors.totalSeasons = 'Total seasons must be at least 1'
    }
  }

  if (form.totalEpisodes.trim() !== '') {
    const totalEpisodes = Number(form.totalEpisodes)
    if (Number.isNaN(totalEpisodes) || totalEpisodes < 1) {
      errors.totalEpisodes = 'Total episodes must be at least 1'
    }
  }

  if (form.currentSeason.trim() !== '') {
    const currentSeason = Number(form.currentSeason)
    if (Number.isNaN(currentSeason) || currentSeason < 1) {
      errors.currentSeason = 'Current season must be at least 1'
    } else if (
      form.totalSeasons.trim() !== '' &&
      currentSeason > Number(form.totalSeasons)
    ) {
      errors.currentSeason = 'Current season cannot exceed total seasons'
    }
  }

  if (form.currentEpisode.trim() !== '') {
    const currentEpisode = Number(form.currentEpisode)
    if (Number.isNaN(currentEpisode) || currentEpisode < 1) {
      errors.currentEpisode = 'Current episode must be at least 1'
    }
  }

  if (form.imdbRating.trim() !== '') {
    const imdbRating = Number(form.imdbRating)
    if (Number.isNaN(imdbRating) || imdbRating < 0 || imdbRating > 10) {
      errors.imdbRating = 'IMDb rating must be between 0 and 10'
    }
  }

  if (form.rottenTomatoesRating.trim() !== '') {
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

  if (form.rottenTomatoesPopcornmeter.trim() !== '') {
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

  if (form.personalRating.trim() !== '') {
    const personalRating = Number(form.personalRating)
    if (
      Number.isNaN(personalRating) ||
      personalRating < 1 ||
      personalRating > 5
    ) {
      errors.personalRating = 'Personal rating must be between 1 and 5'
    }
  }

  return errors
}

function buildPayload(form: FormState): UpdateSeriesRequest {
  const payload: UpdateSeriesRequest = {
    title: form.title.trim(),
    status: form.status,
  }

  if (form.year.trim() !== '') payload.year = Number(form.year)
  if (form.genres.trim() !== '') payload.genres = form.genres.trim()
  if (form.tags.trim() !== '') payload.tags = form.tags.trim()
  if (form.totalSeasons.trim() !== '')
    payload.totalSeasons = Number(form.totalSeasons)
  if (form.totalEpisodes.trim() !== '')
    payload.totalEpisodes = Number(form.totalEpisodes)
  if (form.currentSeason.trim() !== '')
    payload.currentSeason = Number(form.currentSeason)
  if (form.currentEpisode.trim() !== '')
    payload.currentEpisode = Number(form.currentEpisode)
  if (form.imdbRating.trim() !== '')
    payload.imdbRating = Number(form.imdbRating)
  if (form.rottenTomatoesRating.trim() !== '')
    payload.rottenTomatoesRating = Number(form.rottenTomatoesRating)
  if (form.rottenTomatoesPopcornmeter.trim() !== '')
    payload.rottenTomatoesPopcornmeter = Number(form.rottenTomatoesPopcornmeter)
  if (form.personalRating.trim() !== '')
    payload.personalRating = Number(form.personalRating)
  if (form.personalNotes.trim() !== '')
    payload.personalNotes = form.personalNotes.trim()
  if (form.posterUrl.trim() !== '') payload.posterUrl = form.posterUrl.trim()
  payload.excludeFromRecommendations = form.excludeFromRecommendations

  return payload
}

export function EditSeriesForm({
  series,
  onCancel,
  onSuccess,
}: EditSeriesFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(series))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [posterPreviewError, setPosterPreviewError] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const updateField =
    (field: keyof FormState) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handlePosterUrlChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({ ...prev, posterUrl: event.target.value }))
    setPosterPreviewError(false)
  }

  const handleExcludeFromRecommendationsChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({
      ...prev,
      excludeFromRecommendations: event.target.checked,
    }))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !submitting) {
      onCancel()
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(true)

    try {
      const updated = await seriesApi.update(series.id, buildPayload(form))
      setSubmitting(false)
      onSuccess(updated)
    } catch (err) {
      setSubmitting(false)
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        if (err.details) {
          setFieldErrors(err.details as FieldErrors)
        }
      } else {
        setSubmitError('An unexpected error occurred. Please try again.')
      }
    }
  }

  return (
    <div className={styles.overlay}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior (frontend_spec_004.md FRONTEND-004-AC-19); the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-series-heading"
        onKeyDown={handleKeyDown}
      >
        <h2 id="edit-series-heading" className={styles.heading}>
          Edit Series
        </h2>

        {submitError && (
          <div className={styles.submitError} role="alert">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="title">Title *</label>
            <input
              ref={titleInputRef}
              id="title"
              type="text"
              required
              value={form.title}
              onChange={updateField('title')}
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            />
            {fieldErrors.title && (
              <span id="title-error" className={styles.fieldError}>
                {fieldErrors.title}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="year">Year</label>
            <input
              id="year"
              type="number"
              value={form.year}
              onChange={updateField('year')}
              aria-describedby={fieldErrors.year ? 'year-error' : undefined}
            />
            {fieldErrors.year && (
              <span id="year-error" className={styles.fieldError}>
                {fieldErrors.year}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="genres">Genres</label>
            <input
              id="genres"
              type="text"
              value={form.genres}
              onChange={updateField('genres')}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="tags">Tags</label>
            <input
              id="tags"
              type="text"
              value={form.tags}
              onChange={updateField('tags')}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="totalSeasons">Total Seasons</label>
            <input
              id="totalSeasons"
              type="number"
              value={form.totalSeasons}
              onChange={updateField('totalSeasons')}
              aria-describedby={
                fieldErrors.totalSeasons ? 'totalSeasons-error' : undefined
              }
            />
            {fieldErrors.totalSeasons && (
              <span id="totalSeasons-error" className={styles.fieldError}>
                {fieldErrors.totalSeasons}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="totalEpisodes">Total Episodes</label>
            <input
              id="totalEpisodes"
              type="number"
              value={form.totalEpisodes}
              onChange={updateField('totalEpisodes')}
              aria-describedby={
                fieldErrors.totalEpisodes ? 'totalEpisodes-error' : undefined
              }
            />
            {fieldErrors.totalEpisodes && (
              <span id="totalEpisodes-error" className={styles.fieldError}>
                {fieldErrors.totalEpisodes}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="currentSeason">Current Season</label>
            <input
              id="currentSeason"
              type="number"
              value={form.currentSeason}
              onChange={updateField('currentSeason')}
              aria-describedby={
                fieldErrors.currentSeason ? 'currentSeason-error' : undefined
              }
            />
            {fieldErrors.currentSeason && (
              <span id="currentSeason-error" className={styles.fieldError}>
                {fieldErrors.currentSeason}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="currentEpisode">Current Episode</label>
            <input
              id="currentEpisode"
              type="number"
              value={form.currentEpisode}
              onChange={updateField('currentEpisode')}
              aria-describedby={
                fieldErrors.currentEpisode ? 'currentEpisode-error' : undefined
              }
            />
            {fieldErrors.currentEpisode && (
              <span id="currentEpisode-error" className={styles.fieldError}>
                {fieldErrors.currentEpisode}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={form.status}
              onChange={updateField('status')}
            >
              <option value={SeriesStatus.BACKLOG}>Backlog</option>
              <option value={SeriesStatus.WATCHING}>Watching</option>
              <option value={SeriesStatus.COMPLETED}>Completed</option>
              <option value={SeriesStatus.DROPPED}>Dropped</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="imdbRating">IMDb Rating</label>
            <input
              id="imdbRating"
              type="number"
              step="0.1"
              value={form.imdbRating}
              onChange={updateField('imdbRating')}
              aria-describedby={
                fieldErrors.imdbRating ? 'imdbRating-error' : undefined
              }
            />
            {fieldErrors.imdbRating && (
              <span id="imdbRating-error" className={styles.fieldError}>
                {fieldErrors.imdbRating}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="rottenTomatoesRating">
              Rotten Tomatoes Rating (Tomatometer)
            </label>
            <input
              id="rottenTomatoesRating"
              type="number"
              value={form.rottenTomatoesRating}
              onChange={updateField('rottenTomatoesRating')}
              aria-describedby={
                fieldErrors.rottenTomatoesRating
                  ? 'rottenTomatoesRating-error'
                  : undefined
              }
            />
            {fieldErrors.rottenTomatoesRating && (
              <span
                id="rottenTomatoesRating-error"
                className={styles.fieldError}
              >
                {fieldErrors.rottenTomatoesRating}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="rottenTomatoesPopcornmeter">
              Rotten Tomatoes Rating (Popcornmeter)
            </label>
            <input
              id="rottenTomatoesPopcornmeter"
              type="number"
              value={form.rottenTomatoesPopcornmeter}
              onChange={updateField('rottenTomatoesPopcornmeter')}
              aria-describedby={
                fieldErrors.rottenTomatoesPopcornmeter
                  ? 'rottenTomatoesPopcornmeter-error'
                  : undefined
              }
            />
            {fieldErrors.rottenTomatoesPopcornmeter && (
              <span
                id="rottenTomatoesPopcornmeter-error"
                className={styles.fieldError}
              >
                {fieldErrors.rottenTomatoesPopcornmeter}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="personalRating">Personal Rating</label>
            <input
              id="personalRating"
              type="number"
              value={form.personalRating}
              onChange={updateField('personalRating')}
              aria-describedby={
                fieldErrors.personalRating ? 'personalRating-error' : undefined
              }
            />
            {fieldErrors.personalRating && (
              <span id="personalRating-error" className={styles.fieldError}>
                {fieldErrors.personalRating}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="personalNotes">Personal Notes</label>
            <textarea
              id="personalNotes"
              value={form.personalNotes}
              onChange={updateField('personalNotes')}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="posterUrl">Poster URL</label>
            <input
              id="posterUrl"
              type="text"
              value={form.posterUrl}
              onChange={handlePosterUrlChange}
            />
            {form.posterUrl.trim() !== '' && !posterPreviewError && (
              <img
                src={form.posterUrl}
                alt=""
                className={styles.posterPreview}
                onError={() => setPosterPreviewError(true)}
              />
            )}
          </div>

          <div className={styles.checkboxField}>
            <label htmlFor="excludeFromRecommendations">
              Exclude from recommendations
            </label>
            <input
              id="excludeFromRecommendations"
              type="checkbox"
              checked={form.excludeFromRecommendations}
              onChange={handleExcludeFromRecommendationsChange}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
