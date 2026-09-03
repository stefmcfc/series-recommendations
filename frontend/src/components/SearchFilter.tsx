import { useState, useEffect, useRef } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { SearchCriteria } from '../types/series'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'
import { KeywordPicker } from './KeywordPicker'
import { StarRating } from './StarRating'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import styles from './SearchFilter.module.css'

interface SearchFilterProps {
  // FRONTEND-071-AC-04/05: the sheet's open/closed state is now owned by
  // MySeriesView (App.tsx) and passed down, rather than SearchFilter
  // managing its own filtersOpen -- see frontend_spec_071.
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSearch: (criteria: SearchCriteria) => void
  readonly onClear: () => void
}

interface FormState {
  genresSelected: string[]
  // FRONTEND-063-AC-03: exclude-side selection for the shared
  // GenreIncludeExcludePicker, alongside the existing genresSelected
  // (include-side).
  excludeGenresSelected: string[]
  keywordsSelected: string[]
  // FRONTEND-055-AC-06: number|null (not string) to match StarRating's own
  // value/onChange shape directly -- no string parsing needed for this
  // field anymore.
  minPersonalRating: number | null
  minImdbRating: string
  minTmdbRating: string
  yearMin: string
  yearMax: string
}

const initialFormState: FormState = {
  genresSelected: [],
  excludeGenresSelected: [],
  keywordsSelected: [],
  minPersonalRating: null,
  minImdbRating: '',
  minTmdbRating: '',
  yearMin: '',
  yearMax: '',
}

function buildCriteria(form: FormState): SearchCriteria {
  const criteria: SearchCriteria = {}

  if (form.genresSelected.length > 0) criteria.genres = form.genresSelected

  if (form.excludeGenresSelected.length > 0)
    criteria.excludeGenres = form.excludeGenresSelected

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

  return criteria
}

export function SearchFilter({
  isOpen,
  onClose,
  onSearch,
  onClear,
}: SearchFilterProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])
  const [keywordOptionsError, setKeywordOptionsError] = useState<string | null>(
    null,
  )
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [browseModalOpen, setBrowseModalOpen] = useState(false)
  // FRONTEND-073-AC-02: Title used to be this sheet's first field (and this
  // ref's focus target) -- now that it's lived on the My Series page itself
  // since frontend_spec_073, the Close button is the first focusable element
  // remaining inside the sheet.
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // FRONTEND-071-AC-05: moves focus into the sheet as soon as it opens.
  // Without this, focus stays on the funnel trigger button in SeriesList --
  // a DOM sibling, not an ancestor, of this dialog -- so a real Escape
  // keypress right after opening would never reach handleSheetKeyDown at
  // all. Programmatic .focus() here (not the JSX autoFocus prop, which
  // jsx-a11y/no-autofocus disallows) on the isOpen transition.
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

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
        'genresSelected' | 'keywordsSelected' | 'minPersonalRating'
      >,
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleMinPersonalRatingChange = (value: number | null) => {
    setForm((prev) => ({ ...prev, minPersonalRating: value }))
  }

  const handleGenresChange = (next: {
    included: string[]
    excluded: string[]
  }) => {
    setForm((prev) => ({
      ...prev,
      genresSelected: next.included,
      excludeGenresSelected: next.excluded,
    }))
  }

  const handleKeywordsChange = (next: string[]) => {
    setForm((prev) => ({ ...prev, keywordsSelected: next }))
  }

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(buildCriteria(form))
    onClose()
  }

  const handleClear = () => {
    setForm(initialFormState)
    onClear()
    onClose()
  }

  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setBrowseModalOpen(false)
    }
  }

  // FRONTEND-071-AC-05: same Escape-to-close pattern as
  // handleModalKeyDown/the "Browse all keywords" modal, on the sheet's own
  // dialog root.
  const handleSheetKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-close matches AddSeriesForm's convention and the existing "Browse all keywords" modal in this file; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.sheetOverlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-series-filters-heading"
        onKeyDown={handleSheetKeyDown}
      >
        <form className={styles.sheet} onSubmit={handleSubmit}>
          <div className={styles.sheetHeader}>
            <h2 id="my-series-filters-heading" className={styles.sheetHeading}>
              Filters
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              aria-label="Close"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className={styles.filtersBody} data-testid="filters-body">
            <div className={styles.field}>
              <GenreIncludeExcludePicker
                idPrefix="search-filter-genre"
                label="Genres"
                genreOptions={genreOptions}
                included={form.genresSelected}
                excluded={form.excludeGenresSelected}
                onChange={handleGenresChange}
              />
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
      </div>

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
