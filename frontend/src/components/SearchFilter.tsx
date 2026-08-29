import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import { SeriesStatus } from '../types/series'
import type { SearchCriteria } from '../types/series'
import { KeywordPicker } from './KeywordPicker'
import styles from './SearchFilter.module.css'

interface SearchFilterProps {
  readonly onSearch: (criteria: SearchCriteria) => void
  readonly onClear: () => void
}

interface FormState {
  title: string
  genresSelected: string[]
  keywordsSelected: string[]
  status: SeriesStatus | ''
  minPersonalRating: string
  minImdbRating: string
  minTmdbRating: string
  yearMin: string
  yearMax: string
  flaggedForRewatch: boolean
}

const initialFormState: FormState = {
  title: '',
  genresSelected: [],
  keywordsSelected: [],
  status: '',
  minPersonalRating: '',
  minImdbRating: '',
  minTmdbRating: '',
  yearMin: '',
  yearMax: '',
  flaggedForRewatch: false,
}

function buildCriteria(form: FormState): SearchCriteria {
  const criteria: SearchCriteria = {}

  if (form.title.trim() !== '') criteria.title = form.title.trim()

  if (form.genresSelected.length > 0) criteria.genres = form.genresSelected

  if (form.keywordsSelected.length > 0)
    criteria.keywords = form.keywordsSelected

  if (form.status !== '') criteria.status = form.status

  if (form.minPersonalRating.trim() !== '')
    criteria.minPersonalRating = Number(form.minPersonalRating)
  if (form.minImdbRating.trim() !== '')
    criteria.minImdbRating = Number(form.minImdbRating)
  if (form.minTmdbRating.trim() !== '')
    criteria.minTmdbRating = Number(form.minTmdbRating)
  if (form.yearMin.trim() !== '') criteria.yearMin = Number(form.yearMin)
  if (form.yearMax.trim() !== '') criteria.yearMax = Number(form.yearMax)

  if (form.flaggedForRewatch) criteria.flaggedForRewatch = true

  return criteria
}

export function SearchFilter({ onSearch, onClear }: SearchFilterProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])
  const [keywordOptionsError, setKeywordOptionsError] = useState<string | null>(
    null,
  )
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [browseModalOpen, setBrowseModalOpen] = useState(false)
  // FRONTEND-055-AC-04: defaults to open, unlike RecommendationControls'
  // own filtersOpen default of false -- SearchFilter is the primary,
  // most-used filter surface on the main "My Series" page (see this spec's
  // Design Decisions for why the default deliberately differs).
  const [filtersOpen, setFiltersOpen] = useState(true)

  useEffect(() => {
    seriesApi
      .getKeywordStats()
      .then((stats) => setKeywordOptions(stats.map((stat) => stat.name)))
      .catch(() =>
        setKeywordOptionsError(
          'Failed to load keyword filter options. Please try again.',
        ),
      )
  }, [])

  useEffect(() => {
    seriesApi
      .getGenreOptions()
      .then(setGenreOptions)
      .catch(() => undefined)
  }, [])

  const updateField =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const updateCheckbox =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.checked }))
    }

  const handleGenreToggle =
    (genre: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      setForm((prev) => ({
        ...prev,
        genresSelected: checked
          ? [...prev.genresSelected, genre]
          : prev.genresSelected.filter((g) => g !== genre),
      }))
    }

  const handleKeywordsChange = (next: string[]) => {
    setForm((prev) => ({ ...prev, keywordsSelected: next }))
  }

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(buildCriteria(form))
  }

  const handleClear = () => {
    setForm(initialFormState)
    onClear()
  }

  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setBrowseModalOpen(false)
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.filtersSection}>
          <button
            type="button"
            className={styles.filtersToggle}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? 'Hide Filters' : 'Show Filters'}
          </button>

          {filtersOpen && (
            <div className={styles.filtersBody} data-testid="filters-body">
              <div className={styles.field}>
                <label htmlFor="search-title">Title</label>
                <input
                  id="search-title"
                  type="text"
                  value={form.title}
                  onChange={updateField('title')}
                />
              </div>

              <div className={styles.field}>
                <span>Genres</span>
                <div className={styles.seriesPicker}>
                  {genreOptions.length === 0 ? (
                    <p className={styles.hint}>No genres to choose from yet.</p>
                  ) : (
                    genreOptions.map((genre) => (
                      <div key={genre} className={styles.seriesOption}>
                        <input
                          id={`genre-checkbox-${genre}`}
                          type="checkbox"
                          checked={form.genresSelected.includes(genre)}
                          onChange={handleGenreToggle(genre)}
                        />
                        <label htmlFor={`genre-checkbox-${genre}`}>
                          {genre}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <KeywordPicker
                  id="search-keywords"
                  label="Keywords"
                  selected={form.keywordsSelected}
                  onChange={handleKeywordsChange}
                  options={keywordOptionsError ? [] : keywordOptions}
                  placeholder="Type to filter tracked keywords"
                  allowFreeText
                  // A default suggestion list here (rather than only once typing)
                  // read as cluttered in this field's narrower layout, and the
                  // "Browse all keywords" modal already covers browsing without
                  // typing -- so this field only shows matches once you type.
                  maxSuggestionsWhenEmpty={0}
                />
                {keywordOptionsError && (
                  <p className={styles.keywordError} role="alert">
                    {keywordOptionsError}
                  </p>
                )}
                <button
                  type="button"
                  className={styles.browseKeywordsButton}
                  onClick={() => setBrowseModalOpen(true)}
                >
                  Browse all keywords
                </button>
              </div>

              <div className={styles.field}>
                <label htmlFor="search-status">Status</label>
                <select
                  id="search-status"
                  value={form.status}
                  onChange={updateField('status')}
                >
                  <option value="">Any status</option>
                  <option value={SeriesStatus.WATCHING}>Watching</option>
                  <option value={SeriesStatus.COMPLETED}>Completed</option>
                  <option value={SeriesStatus.DROPPED}>Dropped</option>
                  <option value={SeriesStatus.BACKLOG}>Backlog</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="search-min-personal-rating">
                  Min Personal Rating
                </label>
                <input
                  id="search-min-personal-rating"
                  type="number"
                  value={form.minPersonalRating}
                  onChange={updateField('minPersonalRating')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="search-min-imdb-rating">Min IMDb Rating</label>
                <input
                  id="search-min-imdb-rating"
                  type="number"
                  step="0.1"
                  value={form.minImdbRating}
                  onChange={updateField('minImdbRating')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="search-min-tmdb-rating">Min TMDB Rating</label>
                <input
                  id="search-min-tmdb-rating"
                  type="number"
                  step="0.1"
                  value={form.minTmdbRating}
                  onChange={updateField('minTmdbRating')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="search-year-min">Min Year</label>
                <input
                  id="search-year-min"
                  type="number"
                  value={form.yearMin}
                  onChange={updateField('yearMin')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="search-year-max">Max Year</label>
                <input
                  id="search-year-max"
                  type="number"
                  value={form.yearMax}
                  onChange={updateField('yearMax')}
                />
              </div>

              <div className={styles.checkboxField}>
                <label htmlFor="search-flagged-for-rewatch">
                  Flagged for rewatch
                </label>
                <input
                  id="search-flagged-for-rewatch"
                  type="checkbox"
                  checked={form.flaggedForRewatch}
                  onChange={updateCheckbox('flaggedForRewatch')}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.clearButton}
            data-testid="clear-filters-btn"
            onClick={handleClear}
          >
            Clear Filters
          </button>
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </div>
      </form>

      {browseModalOpen && (
        <div className={styles.overlay}>
          {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- a bigger, riskier change than this div+role warrants right now (jsdom's <dialog> support has known gaps). Deliberately not converted. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching AddSeriesForm's convention (frontend_spec_003.md FRONTEND-003-AC-08); the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
          <div // NOSONAR: typescript:S6819, see comment above
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-keywords-heading"
            onKeyDown={handleModalKeyDown}
          >
            <h2 id="browse-keywords-heading" className={styles.dialogHeading}>
              Browse Keywords
            </h2>

            <KeywordPicker
              id="browse-keywords"
              label="Keywords"
              selected={form.keywordsSelected}
              onChange={handleKeywordsChange}
              options={keywordOptionsError ? [] : keywordOptions}
              placeholder="Type to filter tracked keywords"
              focusOnMount
              allowFreeText
              // FRONTEND-032-AC-10: no maxSuggestionsWhenEmpty here -- this
              // modal is the dedicated "browse everything" surface, so it
              // intentionally omits the cap the inline field uses.
            />

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.doneButton}
                onClick={() => setBrowseModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
