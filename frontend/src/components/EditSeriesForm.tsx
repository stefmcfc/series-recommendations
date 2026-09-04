import { useEffect, useRef, useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useTmdbLookup } from '../hooks/useTmdbLookup'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type {
  Series,
  SeriesLookupResult,
  UpdateSeriesRequest,
} from '../types/series'
import { formatCountryName } from '../utils/countryName'
import { isFormDirty } from '../utils/formDirtyCheck'
import { mergeCommonLookupFields } from '../utils/seriesLookupMerge'
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

// FRONTEND-044: the 13 fields series_spec_030 allows in a PATCH's
// `clearedFields` -- all string-valued in FormState, so blanking one via
// `[field]: ''` is always type-safe. Mirrors series_spec_030's own
// CLEARABLE_FIELDS allow-list on the backend.
type ClearableFieldName =
  | 'year'
  | 'genres'
  | 'tags'
  | 'totalSeasons'
  | 'totalEpisodes'
  | 'currentSeason'
  | 'currentEpisode'
  | 'imdbRating'
  | 'rottenTomatoesRating'
  | 'rottenTomatoesPopcornmeter'
  | 'personalRating'
  | 'personalNotes'
  | 'posterUrl'

const CLEARABLE_FIELD_NAMES: readonly ClearableFieldName[] = [
  'year',
  'genres',
  'tags',
  'totalSeasons',
  'totalEpisodes',
  'currentSeason',
  'currentEpisode',
  'imdbRating',
  'rottenTomatoesRating',
  'rottenTomatoesPopcornmeter',
  'personalRating',
  'personalNotes',
  'posterUrl',
]

function isClearableField(field: keyof FormState): field is ClearableFieldName {
  return (CLEARABLE_FIELD_NAMES as readonly string[]).includes(field)
}

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

function buildPayload(
  form: FormState,
  clearedFields: ReadonlySet<ClearableFieldName>,
): UpdateSeriesRequest {
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

  // FRONTEND-044-AC-04: omitted entirely (not sent as []) when nothing was
  // cleared, matching this codebase's wire-minimization convention.
  if (clearedFields.size > 0) {
    payload.clearedFields = [...clearedFields]
  }

  return payload
}

// FRONTEND-045-AC-05: shares the common fields' merge logic with
// AddSeriesForm.applyLookupResult via mergeCommonLookupFields --
// EditSeriesForm's FormState doesn't track the TMDB-only metadata fields
// (imdbId, tmdbRating, tmdbVoteCount, originCountry, productionStatus,
// tmdbId, overview) AddSeriesForm additionally merges, since those are
// managed by the separate Refresh flow (frontend_spec_060) here, not by
// Look Up.
function applyLookupResult(
  form: FormState,
  result: SeriesLookupResult,
): FormState {
  return mergeCommonLookupFields(form, result)
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
  // FRONTEND-044-AC-04/05: fields explicitly cleared via a Clear button (or,
  // for Personal Rating, via deselecting its star) -- mutually exclusive
  // with that field carrying a value by construction (see updateField/
  // handlePosterUrlChange/handlePersonalRatingChange below).
  const [clearedFields, setClearedFields] = useState<Set<ClearableFieldName>>(
    () => new Set(),
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [posterPreviewError, setPosterPreviewError] = useState(false)
  // FRONTEND-045-AC-03/06: a resolved-but-not-yet-applied lookup result --
  // non-null implies the overwrite-confirm dialog is open. Unlike
  // AddSeriesForm, resolving never applies the result directly; it's held
  // here until the user confirms or cancels.
  const [pendingLookupResult, setPendingLookupResult] =
    useState<SeriesLookupResult | null>(null)
  // FRONTEND-060-AC-03: the Title input is now permanently disabled, so it
  // can no longer receive focus (disabled elements are unfocusable) --
  // initial focus moves to the dialog container itself instead of Title.
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // FRONTEND-044-AC-05: typing any new non-blank value into a previously
  // cleared field removes it from clearedFields again -- a field is either
  // carrying a value or explicitly marked cleared, never both.
  const unclearField = (field: keyof FormState) => {
    if (!isClearableField(field)) return
    setClearedFields((prev) => {
      if (!prev.has(field)) return prev
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  const updateField =
    (field: keyof FormState) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const value = event.target.value
      setForm((prev) => ({ ...prev, [field]: value }))
      if (value.trim() !== '') unclearField(field)
    }

  // FRONTEND-044-AC-06: EditSeriesForm's existing personalRating callback
  // additionally marks/unmarks 'personalRating' in clearedFields based on
  // whether the new value is null -- StarRating's own click-to-deselect
  // gesture (frontend_spec_013) is Personal Rating's entire Clear affordance,
  // deliberately not a 11th SeriesFormFields-rendered button.
  const handlePersonalRatingChange = (value: number | null) => {
    setForm((prev) => ({
      ...prev,
      personalRating: value === null ? '' : String(value),
    }))
    setClearedFields((prev) => {
      const alreadyMarked = prev.has('personalRating')
      if (value === null && !alreadyMarked) {
        return new Set(prev).add('personalRating')
      }
      if (value !== null && alreadyMarked) {
        const next = new Set(prev)
        next.delete('personalRating')
        return next
      }
      return prev
    })
  }

  const handlePosterUrlChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, posterUrl: value }))
    setPosterPreviewError(false)
    if (value.trim() !== '') unclearField('posterUrl')
  }

  // FRONTEND-044-AC-02/07: shared by SeriesFormFields' 10 Clear buttons (via
  // onClearField, typed keyof SeriesFormFieldsValues -- a superset including
  // non-clearable fields like 'status' the guard below rejects) and
  // EditSeriesForm's own inline Current Season/Current Episode Clear
  // buttons -- blanks the field's displayed value and marks it cleared in
  // one step, so the UI and the pending "will be cleared" intent never
  // disagree.
  const handleClearField = (field: keyof FormState) => {
    if (!isClearableField(field)) return
    setForm((prev) => ({ ...prev, [field]: '' }))
    setClearedFields((prev) => new Set(prev).add(field))
    if (field === 'posterUrl') setPosterPreviewError(false)
  }

  const handleExcludeFromRecommendationsChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({
      ...prev,
      excludeFromRecommendations: event.target.checked,
    }))
  }

  const {
    lookingUp,
    lookupError,
    tmdbCandidates,
    resolvingTmdbCandidate,
    handleLookup,
    handleSelectTmdbCandidate,
    handleCancelTmdbCandidates,
  } = useTmdbLookup(form.title, setPendingLookupResult)

  // FRONTEND-045-AC-05: "Overwrite" applies the pending resolved result via
  // the same merge AddSeriesForm uses, then clears the pending state.
  const handleConfirmOverwrite = () => {
    if (pendingLookupResult) {
      setForm((prev) => applyLookupResult(prev, pendingLookupResult))
      setPosterPreviewError(false)
    }
    setPendingLookupResult(null)
  }

  // FRONTEND-045-AC-06: "Keep Current Values" discards the resolved result
  // entirely -- no field mutation, form stays exactly as it was.
  const handleCancelOverwrite = () => {
    setPendingLookupResult(null)
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
      const updated = await seriesApi.update(
        series.id,
        buildPayload(form, clearedFields),
      )
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
            <div className={styles.titleRow}>
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
              <button
                type="button"
                className={styles.lookupButton}
                data-testid="lookup-btn"
                disabled={form.title.trim() === '' || lookingUp}
                onClick={handleLookup}
              >
                {lookingUp ? 'Looking up...' : 'Look Up'}
              </button>
            </div>
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
            {lookupError && (
              <div className={styles.lookupError} role="alert">
                {lookupError}
              </div>
            )}
            {tmdbCandidates.length > 0 && (
              <div
                className={styles.candidates}
                data-testid="lookup-tmdb-candidates"
              >
                <ul className={styles.candidateList}>
                  {tmdbCandidates.map((candidate) => (
                    <li key={candidate.tmdbId}>
                      <button
                        type="button"
                        className={styles.candidateButton}
                        data-testid="lookup-tmdb-candidate"
                        disabled={resolvingTmdbCandidate}
                        onClick={() => handleSelectTmdbCandidate(candidate)}
                      >
                        {candidate.posterUrl && (
                          <img
                            src={candidate.posterUrl}
                            alt=""
                            className={styles.candidatePoster}
                          />
                        )}
                        <span>
                          {candidate.title}
                          {candidate.year != null ? ` (${candidate.year})` : ''}
                          {candidate.originalTitle != null &&
                          candidate.originalTitle !== candidate.title
                            ? ` — ${candidate.originalTitle}`
                            : ''}
                          {candidate.originCountry != null
                            ? ` — ${formatCountryName(candidate.originCountry)}`
                            : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.candidatesCancelButton}
                  data-testid="lookup-tmdb-candidates-cancel"
                  disabled={resolvingTmdbCandidate}
                  onClick={handleCancelTmdbCandidates}
                >
                  Cancel
                </button>
              </div>
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
            onClearField={handleClearField}
          >
            <div className={styles.field}>
              <label htmlFor="currentSeason">Current Season</label>
              <div className={styles.fieldRow}>
                <input
                  id="currentSeason"
                  type="number"
                  value={form.currentSeason}
                  onChange={updateField('currentSeason')}
                  aria-describedby={
                    fieldErrors.currentSeason
                      ? 'currentSeason-error'
                      : undefined
                  }
                />
                <button
                  type="button"
                  className={styles.clearButton}
                  aria-label="Clear Current Season"
                  disabled={form.currentSeason.trim() === ''}
                  onClick={() => handleClearField('currentSeason')}
                >
                  &times;
                </button>
              </div>
              {fieldErrors.currentSeason && (
                <span id="currentSeason-error" className={styles.fieldError}>
                  {fieldErrors.currentSeason}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="currentEpisode">Current Episode</label>
              <div className={styles.fieldRow}>
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
                <button
                  type="button"
                  className={styles.clearButton}
                  aria-label="Clear Current Episode"
                  disabled={form.currentEpisode.trim() === ''}
                  onClick={() => handleClearField('currentEpisode')}
                >
                  &times;
                </button>
              </div>
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

      {pendingLookupResult && (
        <ConfirmDialog
          message="Looking this up will overwrite the fields below with fresh TMDB data. Continue?"
          confirmLabel="Overwrite"
          cancelLabel="Keep Current Values"
          onConfirm={handleConfirmOverwrite}
          onCancel={handleCancelOverwrite}
        />
      )}
    </div>
  )
}
