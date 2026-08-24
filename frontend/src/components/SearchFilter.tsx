import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import { SeriesStatus } from '../types/series'
import type { SearchCriteria } from '../types/series'
import styles from './SearchFilter.module.css'

interface SearchFilterProps {
  onSearch: (criteria: SearchCriteria) => void
  onClear: () => void
}

interface FormState {
  title: string
  genres: string
  keywordsSelected: string[]
  status: SeriesStatus | ''
  minPersonalRating: string
  maxPersonalRating: string
  minImdbRating: string
  maxImdbRating: string
  startedNotFinished: boolean
}

const initialFormState: FormState = {
  title: '',
  genres: '',
  keywordsSelected: [],
  status: '',
  minPersonalRating: '',
  maxPersonalRating: '',
  minImdbRating: '',
  maxImdbRating: '',
  startedNotFinished: false,
}

function buildCriteria(form: FormState): SearchCriteria {
  const criteria: SearchCriteria = {}

  if (form.title.trim() !== '') criteria.title = form.title.trim()

  const genres = form.genres
    .split(',')
    .map((genre) => genre.trim())
    .filter((genre) => genre !== '')
  if (genres.length > 0) criteria.genres = genres

  if (form.keywordsSelected.length > 0)
    criteria.keywords = form.keywordsSelected

  if (form.status !== '') criteria.status = form.status

  if (form.minPersonalRating.trim() !== '')
    criteria.minPersonalRating = Number(form.minPersonalRating)
  if (form.maxPersonalRating.trim() !== '')
    criteria.maxPersonalRating = Number(form.maxPersonalRating)
  if (form.minImdbRating.trim() !== '')
    criteria.minImdbRating = Number(form.minImdbRating)
  if (form.maxImdbRating.trim() !== '')
    criteria.maxImdbRating = Number(form.maxImdbRating)

  if (form.startedNotFinished) criteria.startedNotFinished = true

  return criteria
}

export function SearchFilter({ onSearch, onClear }: SearchFilterProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])
  const [keywordOptionsError, setKeywordOptionsError] = useState<string | null>(
    null,
  )
  const [keywordsOpen, setKeywordsOpen] = useState(false)

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

  const handleKeywordToggle =
    (keyword: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      setForm((prev) => ({
        ...prev,
        keywordsSelected: checked
          ? [...prev.keywordsSelected, keyword]
          : prev.keywordsSelected.filter((k) => k !== keyword),
      }))
    }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(buildCriteria(form))
  }

  const handleClear = () => {
    setForm(initialFormState)
    onClear()
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
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
        <label htmlFor="search-genres">Genres</label>
        <input
          id="search-genres"
          type="text"
          value={form.genres}
          onChange={updateField('genres')}
        />
      </div>

      <div className={styles.field}>
        <button
          type="button"
          className={styles.keywordsToggle}
          aria-expanded={keywordsOpen}
          onClick={() => setKeywordsOpen((open) => !open)}
        >
          {form.keywordsSelected.length > 0
            ? `Keywords (${form.keywordsSelected.length} selected)`
            : 'Keywords'}
        </button>
        {keywordOptionsError && (
          <p className={styles.keywordError} role="alert">
            {keywordOptionsError}
          </p>
        )}
        {keywordsOpen && !keywordOptionsError && (
          <div className={styles.keywordPicker}>
            {keywordOptions.map((keyword) => (
              <div key={keyword} className={styles.keywordOption}>
                <input
                  id={`search-keyword-${keyword}`}
                  type="checkbox"
                  checked={form.keywordsSelected.includes(keyword)}
                  onChange={handleKeywordToggle(keyword)}
                />
                <label htmlFor={`search-keyword-${keyword}`}>{keyword}</label>
              </div>
            ))}
          </div>
        )}
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
        <label htmlFor="search-min-personal-rating">Min Personal Rating</label>
        <input
          id="search-min-personal-rating"
          type="number"
          value={form.minPersonalRating}
          onChange={updateField('minPersonalRating')}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="search-max-personal-rating">Max Personal Rating</label>
        <input
          id="search-max-personal-rating"
          type="number"
          value={form.maxPersonalRating}
          onChange={updateField('maxPersonalRating')}
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
        <label htmlFor="search-max-imdb-rating">Max IMDb Rating</label>
        <input
          id="search-max-imdb-rating"
          type="number"
          step="0.1"
          value={form.maxImdbRating}
          onChange={updateField('maxImdbRating')}
        />
      </div>

      <div className={styles.checkboxField}>
        <label htmlFor="search-started-not-finished">
          Started, not finished
        </label>
        <input
          id="search-started-not-finished"
          type="checkbox"
          checked={form.startedNotFinished}
          onChange={updateCheckbox('startedNotFinished')}
        />
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
  )
}
