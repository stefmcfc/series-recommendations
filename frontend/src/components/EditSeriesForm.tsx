import { useEffect, useRef, useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series, UpdateSeriesRequest } from '../types/series'
import { isFormDirty } from '../utils/formDirtyCheck'
import { ConfirmDialog } from './ConfirmDialog'
import { SeriesFormFields } from './SeriesFormFields'
import {
  validateYear,
  validateTotalSeasons,
  validateTotalEpisodes,
  validateImdbRating,
  validateRottenTomatoesRating,
  validateRottenTomatoesPopcornmeter,
} from '../utils/seriesFormValidation'
import styles from './EditSeriesForm.module.css'

interface EditSeriesFormProps {
  readonly series: Series
  readonly onCancel: () => void
  readonly onSuccess: (series: Series) => void
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

function validateCurrentSeason(form: FormState, errors: FieldErrors): void {
  if (form.currentSeason.trim() === '') return
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

function validateCurrentEpisode(form: FormState, errors: FieldErrors): void {
  if (form.currentEpisode.trim() === '') return
  const currentEpisode = Number(form.currentEpisode)
  if (Number.isNaN(currentEpisode) || currentEpisode < 1) {
    errors.currentEpisode = 'Current episode must be at least 1'
  }
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  if (form.title.trim() === '') {
    errors.title = 'Title is required'
  }

  validateYear(form, errors)
  validateTotalSeasons(form, errors)
  validateTotalEpisodes(form, errors)
  validateCurrentSeason(form, errors)
  validateCurrentEpisode(form, errors)
  validateImdbRating(form, errors)
  validateRottenTomatoesRating(form, errors)
  validateRottenTomatoesPopcornmeter(form, errors)

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
  // FRONTEND-043: a second, never-updated snapshot of the form's initial
  // state, captured once at mount -- the comparison baseline for the
  // discard-unsaved-changes confirm dialog. Note the setter is never called.
  const [initialForm] = useState(() => toFormState(series))
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  // FRONTEND-060-AC-01/02: series_spec_040 locks these fields from manual
  // PATCH edits once each is non-null -- mirror that here so the UI never
  // shows an editable control for something the API will silently ignore.
  const lockedFields = {
    year: series.year != null,
    genres: series.genres != null,
    totalSeasons: series.totalSeasons != null,
    totalEpisodes: series.totalEpisodes != null,
    imdbRating: series.imdbRating != null,
  }
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [posterPreviewError, setPosterPreviewError] = useState(false)
  // FRONTEND-060-AC-03: the Title input is now permanently disabled, so it
  // can no longer receive focus (disabled elements are unfocusable) --
  // initial focus moves to the dialog container itself instead of Title.
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
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

  const handlePersonalRatingChange = (value: number | null) => {
    setForm((prev) => ({
      ...prev,
      personalRating: value === null ? '' : String(value),
    }))
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

  // FRONTEND-043-AC-07/09: gates Cancel/Escape behind a confirm dialog when
  // the form has unsaved changes; closes immediately (today's behavior) when
  // it's unchanged from its initial state.
  const handleCancelClick = () => {
    if (isFormDirty(form, initialForm)) {
      setShowDiscardConfirm(true)
    } else {
      onCancel()
    }
  }

  const handleKeyDown = useEscapeToClose(() => {
    if (!submitting) {
      handleCancelClick()
    }
  })

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
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
      {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- a bigger, riskier change than this div+role warrants right now (jsdom's <dialog> support has known gaps). Deliberately not converted. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior (frontend_spec_004.md FRONTEND-004-AC-19); the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-series-heading"
        tabIndex={-1}
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
              id="title"
              type="text"
              required
              disabled
              value={form.title}
              onChange={updateField('title')}
              aria-describedby={
                fieldErrors.title ? 'title-error' : 'title-locked-hint'
              }
            />
            <span
              id="title-locked-hint"
              data-testid="title-locked-hint"
              className={styles.fieldHint}
            >
              Managed by refresh — use Refresh to update
            </span>
            {fieldErrors.title && (
              <span id="title-error" className={styles.fieldError}>
                {fieldErrors.title}
              </span>
            )}
          </div>

          <SeriesFormFields
            form={form}
            fieldErrors={fieldErrors}
            updateField={updateField}
            onPersonalRatingChange={handlePersonalRatingChange}
            onPosterUrlChange={handlePosterUrlChange}
            onPosterLoadError={() => setPosterPreviewError(true)}
            onExcludeFromRecommendationsChange={
              handleExcludeFromRecommendationsChange
            }
            posterPreviewError={posterPreviewError}
            lockedFields={lockedFields}
          >
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
                  fieldErrors.currentEpisode
                    ? 'currentEpisode-error'
                    : undefined
                }
              />
              {fieldErrors.currentEpisode && (
                <span id="currentEpisode-error" className={styles.fieldError}>
                  {fieldErrors.currentEpisode}
                </span>
              )}
            </div>
          </SeriesFormFields>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancelClick}
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

      {showDiscardConfirm && (
        <ConfirmDialog
          message="Discard these changes? Your edits will be lost."
          confirmLabel="Discard"
          onConfirm={onCancel}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  )
}
