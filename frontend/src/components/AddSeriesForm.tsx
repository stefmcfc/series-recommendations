import { useEffect, useRef, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type {
  CreateSeriesRequest,
  LookupTmdbCandidate,
  SeriesLookupResult,
  Series,
} from '../types/series'
import { formatCountryName } from '../utils/countryName'
import { SeriesFormFields } from './SeriesFormFields'
import {
  validateYear,
  validateTotalSeasons,
  validateTotalEpisodes,
  validateImdbRating,
  validateRottenTomatoesRating,
  validateRottenTomatoesPopcornmeter,
  validatePersonalRating,
} from '../utils/seriesFormValidation'
import styles from './AddSeriesForm.module.css'

interface AddSeriesFormProps {
  readonly onCancel: () => void
  readonly onSuccess: (series: Series) => void
  readonly initialValues?: Partial<CreateSeriesRequest>
}

interface FormState {
  title: string
  year: string
  genres: string
  tags: string
  totalSeasons: string
  totalEpisodes: string
  status: SeriesStatus
  imdbRating: string
  rottenTomatoesRating: string
  rottenTomatoesPopcornmeter: string
  personalRating: string
  personalNotes: string
  posterUrl: string
  imdbId: string
  tmdbRating: string
  tmdbVoteCount: string
  originCountry: string
  productionStatus: string
  tmdbId: string
  overview: string
  excludeFromRecommendations: boolean
}

const initialFormState: FormState = {
  title: '',
  year: '',
  genres: '',
  tags: '',
  totalSeasons: '',
  totalEpisodes: '',
  status: SeriesStatus.BACKLOG,
  imdbRating: '',
  rottenTomatoesRating: '',
  rottenTomatoesPopcornmeter: '',
  personalRating: '',
  personalNotes: '',
  posterUrl: '',
  imdbId: '',
  tmdbRating: '',
  tmdbVoteCount: '',
  originCountry: '',
  productionStatus: '',
  tmdbId: '',
  overview: '',
  excludeFromRecommendations: false,
}

type FieldErrors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  if (form.title.trim() === '') {
    errors.title = 'Title is required'
  }

  validateYear(form, errors)
  validateTotalSeasons(form, errors)
  validateTotalEpisodes(form, errors)
  validateImdbRating(form, errors)
  validateRottenTomatoesRating(form, errors)
  validateRottenTomatoesPopcornmeter(form, errors)
  validatePersonalRating(form, errors)

  return errors
}

function applyMetadataToPayload(
  form: FormState,
  payload: CreateSeriesRequest,
): void {
  if (form.year.trim() !== '') payload.year = Number(form.year)
  if (form.genres.trim() !== '') payload.genres = form.genres.trim()
  if (form.tags.trim() !== '') payload.tags = form.tags.trim()
  if (form.totalSeasons.trim() !== '')
    payload.totalSeasons = Number(form.totalSeasons)
  if (form.totalEpisodes.trim() !== '')
    payload.totalEpisodes = Number(form.totalEpisodes)
  if (form.posterUrl.trim() !== '') payload.posterUrl = form.posterUrl.trim()
  if (form.imdbId.trim() !== '') payload.imdbId = form.imdbId.trim()
  if (form.overview.trim() !== '') payload.overview = form.overview.trim()
}

function applyRatingsToPayload(
  form: FormState,
  payload: CreateSeriesRequest,
): void {
  if (form.imdbRating.trim() !== '')
    payload.imdbRating = Number(form.imdbRating)
  if (form.rottenTomatoesRating.trim() !== '')
    payload.rottenTomatoesRating = Number(form.rottenTomatoesRating)
  if (form.rottenTomatoesPopcornmeter.trim() !== '')
    payload.rottenTomatoesPopcornmeter = Number(form.rottenTomatoesPopcornmeter)
  if (form.personalRating.trim() !== '')
    payload.personalRating = Number(form.personalRating)
  if (form.tmdbRating.trim() !== '')
    payload.tmdbRating = Number(form.tmdbRating)
  if (form.tmdbVoteCount.trim() !== '')
    payload.tmdbVoteCount = Number(form.tmdbVoteCount)
}

function applyTmdbMetadataToPayload(
  form: FormState,
  payload: CreateSeriesRequest,
): void {
  if (form.originCountry.trim() !== '')
    payload.originCountry = form.originCountry.trim()
  if (form.productionStatus.trim() !== '')
    payload.productionStatus = form.productionStatus.trim()
  if (form.tmdbId.trim() !== '') payload.tmdbId = Number(form.tmdbId)
  if (form.personalNotes.trim() !== '')
    payload.personalNotes = form.personalNotes.trim()
  if (form.excludeFromRecommendations) payload.excludeFromRecommendations = true
}

function buildPayload(form: FormState): CreateSeriesRequest {
  const payload: CreateSeriesRequest = {
    title: form.title.trim(),
    status: form.status,
  }

  applyMetadataToPayload(form, payload)
  applyRatingsToPayload(form, payload)
  applyTmdbMetadataToPayload(form, payload)

  return payload
}

function applyLookupResult(
  form: FormState,
  result: SeriesLookupResult,
): FormState {
  const next: FormState = { ...form, title: result.title }

  if (result.year != null) next.year = String(result.year)
  if (result.genres != null) next.genres = result.genres
  if (result.totalSeasons != null)
    next.totalSeasons = String(result.totalSeasons)
  if (result.totalEpisodes != null)
    next.totalEpisodes = String(result.totalEpisodes)
  if (result.imdbRating != null) next.imdbRating = String(result.imdbRating)
  if (result.rottenTomatoesRating != null)
    next.rottenTomatoesRating = String(result.rottenTomatoesRating)
  if (result.posterUrl != null) next.posterUrl = result.posterUrl
  if (result.imdbId != null) next.imdbId = result.imdbId
  if (result.tmdbRating != null) next.tmdbRating = String(result.tmdbRating)
  if (result.tmdbVoteCount != null)
    next.tmdbVoteCount = String(result.tmdbVoteCount)
  if (result.originCountry != null) next.originCountry = result.originCountry
  if (result.productionStatus != null)
    next.productionStatus = result.productionStatus
  if (result.tmdbId != null) next.tmdbId = String(result.tmdbId)
  if (result.overview != null) next.overview = result.overview

  return next
}

function applyInitialCoreFields(
  initialValues: Partial<CreateSeriesRequest>,
  next: FormState,
): void {
  if (initialValues.title != null) next.title = initialValues.title
  if (initialValues.year != null) next.year = String(initialValues.year)
  if (initialValues.genres != null) next.genres = initialValues.genres
  if (initialValues.tags != null) next.tags = initialValues.tags
  if (initialValues.totalSeasons != null)
    next.totalSeasons = String(initialValues.totalSeasons)
  if (initialValues.totalEpisodes != null)
    next.totalEpisodes = String(initialValues.totalEpisodes)
  if (initialValues.status != null) next.status = initialValues.status
}

function applyInitialRatingsAndNotes(
  initialValues: Partial<CreateSeriesRequest>,
  next: FormState,
): void {
  if (initialValues.imdbRating != null)
    next.imdbRating = String(initialValues.imdbRating)
  if (initialValues.rottenTomatoesRating != null)
    next.rottenTomatoesRating = String(initialValues.rottenTomatoesRating)
  if (initialValues.rottenTomatoesPopcornmeter != null)
    next.rottenTomatoesPopcornmeter = String(
      initialValues.rottenTomatoesPopcornmeter,
    )
  if (initialValues.personalRating != null)
    next.personalRating = String(initialValues.personalRating)
  if (initialValues.personalNotes != null)
    next.personalNotes = initialValues.personalNotes
  if (initialValues.posterUrl != null) next.posterUrl = initialValues.posterUrl
  if (initialValues.imdbId != null) next.imdbId = initialValues.imdbId
  if (initialValues.overview != null) next.overview = initialValues.overview
}

function buildInitialFormState(
  initialValues?: Partial<CreateSeriesRequest>,
): FormState {
  if (!initialValues) return initialFormState

  const next: FormState = { ...initialFormState }
  applyInitialCoreFields(initialValues, next)
  applyInitialRatingsAndNotes(initialValues, next)

  return next
}

export function AddSeriesForm({
  onCancel,
  onSuccess,
  initialValues,
}: AddSeriesFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    buildInitialFormState(initialValues),
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [tmdbCandidates, setTmdbCandidates] = useState<LookupTmdbCandidate[]>(
    [],
  )
  const [resolvingTmdbCandidate, setResolvingTmdbCandidate] = useState(false)
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

  const applyResolvedResult = (result: SeriesLookupResult) => {
    setForm((prev) => applyLookupResult(prev, result))
    setPosterPreviewError(false)
  }

  const handleLookup = async () => {
    const title = form.title.trim()
    if (title === '' || lookingUp) return

    setLookupError(null)
    setTmdbCandidates([])
    setLookingUp(true)

    try {
      const results = await seriesApi.searchTmdb(title)

      if (results.length === 0) {
        setLookupError('No matches found for that title.')
        return
      }

      if (results.length === 1) {
        const [candidate] = results
        const result = await seriesApi.resolveTmdbCandidate(candidate.tmdbId)
        applyResolvedResult(result)
        return
      }

      setTmdbCandidates(results)
    } catch (err) {
      if (err instanceof ApiError) {
        setLookupError(err.message)
      } else {
        setLookupError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLookingUp(false)
    }
  }

  const handleSelectTmdbCandidate = async (candidate: LookupTmdbCandidate) => {
    if (resolvingTmdbCandidate) return

    setLookupError(null)
    setResolvingTmdbCandidate(true)

    try {
      const result = await seriesApi.resolveTmdbCandidate(candidate.tmdbId)
      applyResolvedResult(result)
      setTmdbCandidates([])
    } catch (err) {
      if (err instanceof ApiError) {
        setLookupError(err.message)
      } else {
        setLookupError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setResolvingTmdbCandidate(false)
    }
  }

  const handleCancelTmdbCandidates = () => {
    setTmdbCandidates([])
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !submitting) {
      onCancel()
    }
  }

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
      const created = await seriesApi.create(buildPayload(form))
      setSubmitting(false)
      onSuccess(created)
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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior (frontend_spec_003.md FRONTEND-003-AC-08); the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-series-heading"
        onKeyDown={handleKeyDown}
      >
        <h2 id="add-series-heading" className={styles.heading}>
          Add Series
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
                ref={titleInputRef}
                id="title"
                type="text"
                required
                value={form.title}
                onChange={updateField('title')}
                aria-describedby={fieldErrors.title ? 'title-error' : undefined}
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
            onPosterUrlChange={handlePosterUrlChange}
            onPosterLoadError={() => setPosterPreviewError(true)}
            onExcludeFromRecommendationsChange={
              handleExcludeFromRecommendationsChange
            }
            posterPreviewError={posterPreviewError}
          />

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
