import { useEffect, useRef, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type {
  CreateSeriesRequest,
  LookupCandidate,
  LookupTmdbCandidate,
  OmdbLookupResult,
  Series,
} from '../types/series'
import styles from './AddSeriesForm.module.css'

interface AddSeriesFormProps {
  onCancel: () => void
  onSuccess: (series: Series) => void
  initialValues?: Partial<CreateSeriesRequest>
}

interface FormState {
  title: string
  alternateTitle: string
  year: string
  genres: string
  tags: string
  totalSeasons: string
  totalEpisodes: string
  status: SeriesStatus
  imdbRating: string
  metacriticRating: string
  rottenTomatoesRating: string
  personalRating: string
  personalNotes: string
  posterUrl: string
  imdbId: string
}

const initialFormState: FormState = {
  title: '',
  alternateTitle: '',
  year: '',
  genres: '',
  tags: '',
  totalSeasons: '',
  totalEpisodes: '',
  status: SeriesStatus.BACKLOG,
  imdbRating: '',
  metacriticRating: '',
  rottenTomatoesRating: '',
  personalRating: '',
  personalNotes: '',
  posterUrl: '',
  imdbId: '',
}

type FieldErrors = Partial<Record<keyof FormState, string>>

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

  if (form.imdbRating.trim() !== '') {
    const imdbRating = Number(form.imdbRating)
    if (Number.isNaN(imdbRating) || imdbRating < 0 || imdbRating > 10) {
      errors.imdbRating = 'IMDb rating must be between 0 and 10'
    }
  }

  if (form.metacriticRating.trim() !== '') {
    const metacriticRating = Number(form.metacriticRating)
    if (
      Number.isNaN(metacriticRating) ||
      metacriticRating < 0 ||
      metacriticRating > 100
    ) {
      errors.metacriticRating = 'Metacritic rating must be between 0 and 100'
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

function buildPayload(form: FormState): CreateSeriesRequest {
  const payload: CreateSeriesRequest = {
    title: form.title.trim(),
    status: form.status,
  }

  if (form.alternateTitle.trim() !== '')
    payload.alternateTitle = form.alternateTitle.trim()
  if (form.year.trim() !== '') payload.year = Number(form.year)
  if (form.genres.trim() !== '') payload.genres = form.genres.trim()
  if (form.tags.trim() !== '') payload.tags = form.tags.trim()
  if (form.totalSeasons.trim() !== '')
    payload.totalSeasons = Number(form.totalSeasons)
  if (form.totalEpisodes.trim() !== '')
    payload.totalEpisodes = Number(form.totalEpisodes)
  if (form.imdbRating.trim() !== '')
    payload.imdbRating = Number(form.imdbRating)
  if (form.metacriticRating.trim() !== '')
    payload.metacriticRating = Number(form.metacriticRating)
  if (form.rottenTomatoesRating.trim() !== '')
    payload.rottenTomatoesRating = Number(form.rottenTomatoesRating)
  if (form.personalRating.trim() !== '')
    payload.personalRating = Number(form.personalRating)
  if (form.personalNotes.trim() !== '')
    payload.personalNotes = form.personalNotes.trim()
  if (form.posterUrl.trim() !== '') payload.posterUrl = form.posterUrl.trim()
  if (form.imdbId.trim() !== '') payload.imdbId = form.imdbId.trim()

  return payload
}

function applyLookupResult(
  form: FormState,
  result: OmdbLookupResult,
  referenceTitle: string,
  preferReferenceAsTitle = false,
): FormState {
  const trimmedReference = referenceTitle.trim()
  const useReferenceAsTitle = preferReferenceAsTitle && trimmedReference !== ''
  const primaryTitle = useReferenceAsTitle ? trimmedReference : result.title
  const alternateCandidate = (
    useReferenceAsTitle ? result.title : trimmedReference
  ).trim()

  const next: FormState = { ...form, title: primaryTitle }

  if (
    alternateCandidate !== '' &&
    alternateCandidate.toLowerCase() !== primaryTitle.trim().toLowerCase()
  ) {
    next.alternateTitle = alternateCandidate
  }

  if (result.year != null) next.year = String(result.year)
  if (result.genres != null) next.genres = result.genres
  if (result.totalSeasons != null)
    next.totalSeasons = String(result.totalSeasons)
  if (result.totalEpisodes != null)
    next.totalEpisodes = String(result.totalEpisodes)
  if (result.imdbRating != null) next.imdbRating = String(result.imdbRating)
  if (result.metacriticRating != null)
    next.metacriticRating = String(result.metacriticRating)
  if (result.rottenTomatoesRating != null)
    next.rottenTomatoesRating = String(result.rottenTomatoesRating)
  if (result.posterUrl != null) next.posterUrl = result.posterUrl
  if (result.imdbId != null) next.imdbId = result.imdbId

  return next
}

function buildInitialFormState(
  initialValues?: Partial<CreateSeriesRequest>,
): FormState {
  if (!initialValues) return initialFormState

  const next: FormState = { ...initialFormState }

  if (initialValues.title != null) next.title = initialValues.title
  if (initialValues.alternateTitle != null)
    next.alternateTitle = initialValues.alternateTitle
  if (initialValues.year != null) next.year = String(initialValues.year)
  if (initialValues.genres != null) next.genres = initialValues.genres
  if (initialValues.tags != null) next.tags = initialValues.tags
  if (initialValues.totalSeasons != null)
    next.totalSeasons = String(initialValues.totalSeasons)
  if (initialValues.totalEpisodes != null)
    next.totalEpisodes = String(initialValues.totalEpisodes)
  if (initialValues.status != null) next.status = initialValues.status
  if (initialValues.imdbRating != null)
    next.imdbRating = String(initialValues.imdbRating)
  if (initialValues.metacriticRating != null)
    next.metacriticRating = String(initialValues.metacriticRating)
  if (initialValues.rottenTomatoesRating != null)
    next.rottenTomatoesRating = String(initialValues.rottenTomatoesRating)
  if (initialValues.personalRating != null)
    next.personalRating = String(initialValues.personalRating)
  if (initialValues.personalNotes != null)
    next.personalNotes = initialValues.personalNotes
  if (initialValues.posterUrl != null) next.posterUrl = initialValues.posterUrl
  if (initialValues.imdbId != null) next.imdbId = initialValues.imdbId

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
  const [candidates, setCandidates] = useState<LookupCandidate[]>([])
  const [resolvingCandidate, setResolvingCandidate] = useState(false)
  const [tmdbCandidates, setTmdbCandidates] = useState<LookupTmdbCandidate[]>(
    [],
  )
  const [resolvingTmdbCandidate, setResolvingTmdbCandidate] = useState(false)
  const [showTmdbEscapeHatch, setShowTmdbEscapeHatch] = useState(false)
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

  const applyResolvedResult = (
    result: OmdbLookupResult,
    referenceTitle: string,
    preferReferenceAsTitle = false,
  ) => {
    setForm((prev) =>
      applyLookupResult(prev, result, referenceTitle, preferReferenceAsTitle),
    )
    setPosterPreviewError(false)
  }

  const handleLookup = async () => {
    const title = form.title.trim()
    if (title === '' || lookingUp) return

    setLookupError(null)
    setCandidates([])
    setTmdbCandidates([])
    setShowTmdbEscapeHatch(false)
    setLookingUp(true)

    try {
      const results = await seriesApi.searchByTitle(title)

      if (results.length === 0) {
        setLookupError('No matches found for that title.')
        setShowTmdbEscapeHatch(true)
        return
      }

      if (results.length === 1) {
        const [candidate] = results
        if (candidate.imdbId != null) {
          const result = await seriesApi.lookupByImdbId(candidate.imdbId)
          applyResolvedResult(result, title)
        }
        return
      }

      setCandidates(results)
      setShowTmdbEscapeHatch(true)
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

  const handleSelectCandidate = async (candidate: LookupCandidate) => {
    if (resolvingCandidate || candidate.imdbId == null) return

    setLookupError(null)
    setResolvingCandidate(true)

    try {
      const result = await seriesApi.lookupByImdbId(candidate.imdbId)
      applyResolvedResult(result, form.title.trim())
      setCandidates([])
    } catch (err) {
      if (err instanceof ApiError) {
        setLookupError(err.message)
      } else {
        setLookupError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setResolvingCandidate(false)
    }
  }

  const handleCancelCandidates = () => {
    setCandidates([])
  }

  const handleSearchTmdb = async () => {
    const title = form.title.trim()
    if (title === '' || resolvingTmdbCandidate) return

    setLookupError(null)
    setCandidates([])
    setTmdbCandidates([])
    setResolvingTmdbCandidate(true)

    try {
      const results = await seriesApi.searchTmdb(title)

      if (results.length === 0) {
        setLookupError('No matches found on TMDB either.')
        setShowTmdbEscapeHatch(false)
        return
      }

      if (results.length === 1) {
        const [candidate] = results
        const result = await seriesApi.resolveTmdbCandidate(candidate.tmdbId)
        applyResolvedResult(result, candidate.title, true)
        setShowTmdbEscapeHatch(false)
        return
      }

      setTmdbCandidates(results)
      setShowTmdbEscapeHatch(false)
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

  const handleSelectTmdbCandidate = async (candidate: LookupTmdbCandidate) => {
    if (resolvingTmdbCandidate) return

    setLookupError(null)
    setResolvingTmdbCandidate(true)

    try {
      const result = await seriesApi.resolveTmdbCandidate(candidate.tmdbId)
      applyResolvedResult(result, candidate.title, true)
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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior (frontend_spec_003.md FRONTEND-003-AC-08); the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div
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
            {showTmdbEscapeHatch &&
              candidates.length === 0 &&
              tmdbCandidates.length === 0 && (
                <button
                  type="button"
                  className={styles.candidatesCancelButton}
                  data-testid="search-tmdb-btn"
                  disabled={resolvingTmdbCandidate}
                  onClick={handleSearchTmdb}
                >
                  {resolvingTmdbCandidate
                    ? 'Searching TMDB...'
                    : 'Search TMDB instead'}
                </button>
              )}
            {candidates.length > 0 && (
              <div
                className={styles.candidates}
                data-testid="lookup-candidates"
              >
                <ul className={styles.candidateList}>
                  {candidates.map((candidate) => (
                    <li key={`${candidate.imdbId ?? candidate.title}`}>
                      <button
                        type="button"
                        className={styles.candidateButton}
                        data-testid="lookup-candidate"
                        disabled={resolvingCandidate}
                        onClick={() => handleSelectCandidate(candidate)}
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
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.candidatesCancelButton}
                  data-testid="lookup-candidates-cancel"
                  disabled={resolvingCandidate}
                  onClick={handleCancelCandidates}
                >
                  Cancel
                </button>
                {showTmdbEscapeHatch && (
                  <button
                    type="button"
                    className={styles.candidatesCancelButton}
                    data-testid="search-tmdb-btn"
                    disabled={resolvingTmdbCandidate}
                    onClick={handleSearchTmdb}
                  >
                    {resolvingTmdbCandidate
                      ? 'Searching TMDB...'
                      : 'Search TMDB instead'}
                  </button>
                )}
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

          <div className={styles.field}>
            <label htmlFor="alternateTitle">Alternate Title</label>
            <input
              id="alternateTitle"
              type="text"
              value={form.alternateTitle}
              onChange={updateField('alternateTitle')}
            />
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
            <label htmlFor="metacriticRating">Metacritic Rating</label>
            <input
              id="metacriticRating"
              type="number"
              value={form.metacriticRating}
              onChange={updateField('metacriticRating')}
              aria-describedby={
                fieldErrors.metacriticRating
                  ? 'metacriticRating-error'
                  : undefined
              }
            />
            {fieldErrors.metacriticRating && (
              <span id="metacriticRating-error" className={styles.fieldError}>
                {fieldErrors.metacriticRating}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="rottenTomatoesRating">Rotten Tomatoes Rating</label>
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
