import { useState } from 'react'
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
