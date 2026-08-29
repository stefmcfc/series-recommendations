import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { SearchCriteria } from '../types/series'
import { KeywordPicker } from './KeywordPicker'
import { StarRating } from './StarRating'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import styles from './SearchFilter.module.css'

interface SearchFilterProps {
  readonly onSearch: (criteria: SearchCriteria) => void
  readonly onClear: () => void
}

interface FormState {
  title: string
  genresSelected: string[]
  keywordsSelected: string[]
  // FRONTEND-055-AC-06: number|null (not string) to match StarRating's own
  // value/onChange shape directly -- no string parsing needed for this
  // field anymore.
  minPersonalRating: number | null
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
  minPersonalRating: null,
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

  if (form.minPersonalRating != null)
    criteria.minPersonalRating = form.minPersonalRating
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
  // FRONTEND-055-AC-04 (amended 2026-08-29): defaults to closed, matching
  // RecommendationControls.tsx's own filtersOpen default exactly, so both
  // panels behave consistently. (Originally specced to default open,
  // reasoning SearchFilter was the primary filter surface -- reversed per
  // direct instruction; see this spec's Design Decisions.)
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    (
      field: Exclude<
        keyof FormState,
        | 'genresSelected'
        | 'keywordsSelected'
        | 'minPersonalRating'
        | 'flaggedForRewatch'
      >,
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleMinPersonalRatingChange = (value: number | null) => {
    setForm((prev) => ({ ...prev, minPersonalRating: value }))
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
                <span>Min Personal Rating</span>
                <StarRating
                  value={form.minPersonalRating}
                  onChange={handleMinPersonalRatingChange}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="search-min-imdb-rating">Min IMDb Rating</label>
                <input
                  id="search-min-imdb-rating"
                  type="number"
                  min="0"
                  max="10"
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
                  min="0"
                  max="10"
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
                  min={MIN_VALID_YEAR}
                  max={MAX_VALID_YEAR}
                  value={form.yearMin}
                  onChange={updateField('yearMin')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="search-year-max">Max Year</label>
                <input
                  id="search-year-max"
                  type="number"
                  min={MIN_VALID_YEAR}
                  max={MAX_VALID_YEAR}
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
