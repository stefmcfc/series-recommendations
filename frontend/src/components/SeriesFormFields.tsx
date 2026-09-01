import type { ChangeEvent, ReactNode } from 'react'
import { SeriesStatus } from '../types/series'
import { sanitizeImageUrl } from '../utils/safeImageUrl'
import { StarRating } from './StarRating'
import styles from './SeriesFormFields.module.css'

export interface SeriesFormFieldsValues {
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
  excludeFromRecommendations: boolean
}

export type SeriesFormFieldName = keyof SeriesFormFieldsValues

type FieldChangeEvent = ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>

// FRONTEND-060: text shown alongside a field EditSeriesForm has disabled
// because series_spec_040 locks it from manual PATCH edits once non-null --
// see this component's `lockedFields` prop below.
const LOCKED_FIELD_HINT = 'Managed by refresh — use Refresh to update'

interface SeriesFormFieldsProps {
  readonly form: SeriesFormFieldsValues
  readonly fieldErrors: Partial<Record<SeriesFormFieldName, string>>
  readonly updateField: (
    field: SeriesFormFieldName,
  ) => (event: FieldChangeEvent) => void
  readonly onPersonalRatingChange: (value: number | null) => void
  readonly onPosterUrlChange: (event: ChangeEvent<HTMLInputElement>) => void
  readonly onPosterLoadError: () => void
  readonly onExcludeFromRecommendationsChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void
  readonly posterPreviewError: boolean
  readonly children?: ReactNode
  readonly source?: 'manual' | 'recommendation'
  // FRONTEND-060-AC-01/02: EditSeriesForm passes true for whichever of these
  // fields is already non-null on the series being edited (series_spec_040
  // locks them from manual PATCH edits at that point); AddSeriesForm never
  // passes this prop, so every field there stays fully interactive.
  readonly lockedFields?: Partial<
    Record<
      'year' | 'genres' | 'totalSeasons' | 'totalEpisodes' | 'imdbRating',
      boolean
    >
  >
}

function LockedFieldHint({ field }: { readonly field: string }) {
  return (
    <span
      id={`${field}-locked-hint`}
      data-testid={`${field}-locked-hint`}
      className={styles.fieldHint}
    >
      {LOCKED_FIELD_HINT}
    </span>
  )
}

// TOOLING-005-AC-03: the field blocks AddSeriesForm and EditSeriesForm both
// rendered near-identically. Title (with AddSeriesForm's TMDB lookup UI),
// dialog chrome, and the actions row stay local to each form -- see
// tooling_spec_005's Design Decisions for why. `children` renders between
// Total Episodes and Status, matching EditSeriesForm's Current Season/
// Current Episode fields' existing position.
export function SeriesFormFields({
  form,
  fieldErrors,
  updateField,
  onPersonalRatingChange,
  onPosterUrlChange,
  onPosterLoadError,
  onExcludeFromRecommendationsChange,
  posterPreviewError,
  children,
  source = 'manual',
  lockedFields,
}: SeriesFormFieldsProps) {
  const safePosterUrl =
    form.posterUrl.trim() !== '' ? sanitizeImageUrl(form.posterUrl) : null

  return (
    <>
      <div className={styles.field}>
        <label htmlFor="year">Year</label>
        <input
          id="year"
          type="number"
          value={form.year}
          onChange={updateField('year')}
          disabled={lockedFields?.year}
          aria-describedby={
            lockedFields?.year
              ? 'year-locked-hint'
              : fieldErrors.year
                ? 'year-error'
                : undefined
          }
        />
        {lockedFields?.year && <LockedFieldHint field="year" />}
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
          disabled={lockedFields?.genres}
          aria-describedby={
            lockedFields?.genres ? 'genres-locked-hint' : undefined
          }
        />
        {lockedFields?.genres && <LockedFieldHint field="genres" />}
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

      {source !== 'recommendation' && (
        <div className={styles.field}>
          <label htmlFor="totalSeasons">Total Seasons</label>
          <input
            id="totalSeasons"
            type="number"
            value={form.totalSeasons}
            onChange={updateField('totalSeasons')}
            disabled={lockedFields?.totalSeasons}
            aria-describedby={
              lockedFields?.totalSeasons
                ? 'totalSeasons-locked-hint'
                : fieldErrors.totalSeasons
                  ? 'totalSeasons-error'
                  : undefined
            }
          />
          {lockedFields?.totalSeasons && (
            <LockedFieldHint field="totalSeasons" />
          )}
          {fieldErrors.totalSeasons && (
            <span id="totalSeasons-error" className={styles.fieldError}>
              {fieldErrors.totalSeasons}
            </span>
          )}
        </div>
      )}

      {source !== 'recommendation' && (
        <div className={styles.field}>
          <label htmlFor="totalEpisodes">Total Episodes</label>
          <input
            id="totalEpisodes"
            type="number"
            value={form.totalEpisodes}
            onChange={updateField('totalEpisodes')}
            disabled={lockedFields?.totalEpisodes}
            aria-describedby={
              lockedFields?.totalEpisodes
                ? 'totalEpisodes-locked-hint'
                : fieldErrors.totalEpisodes
                  ? 'totalEpisodes-error'
                  : undefined
            }
          />
          {lockedFields?.totalEpisodes && (
            <LockedFieldHint field="totalEpisodes" />
          )}
          {fieldErrors.totalEpisodes && (
            <span id="totalEpisodes-error" className={styles.fieldError}>
              {fieldErrors.totalEpisodes}
            </span>
          )}
        </div>
      )}

      {children}

      <div className={styles.field}>
        <label htmlFor="status">Status</label>
        {source === 'recommendation' ? (
          <span id="status">{form.status}</span>
        ) : (
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
        )}
      </div>

      {source !== 'recommendation' && (
        <div className={styles.field}>
          <label htmlFor="imdbRating">IMDb Rating</label>
          <input
            id="imdbRating"
            type="number"
            step="0.1"
            value={form.imdbRating}
            onChange={updateField('imdbRating')}
            disabled={lockedFields?.imdbRating}
            aria-describedby={
              lockedFields?.imdbRating
                ? 'imdbRating-locked-hint'
                : fieldErrors.imdbRating
                  ? 'imdbRating-error'
                  : undefined
            }
          />
          {lockedFields?.imdbRating && <LockedFieldHint field="imdbRating" />}
          {fieldErrors.imdbRating && (
            <span id="imdbRating-error" className={styles.fieldError}>
              {fieldErrors.imdbRating}
            </span>
          )}
        </div>
      )}

      {source !== 'recommendation' && (
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
            <span id="rottenTomatoesRating-error" className={styles.fieldError}>
              {fieldErrors.rottenTomatoesRating}
            </span>
          )}
        </div>
      )}

      {source !== 'recommendation' && (
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
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabelText}>Personal Rating</span>
        <StarRating
          value={
            form.personalRating === '' ? null : Number(form.personalRating)
          }
          onChange={onPersonalRatingChange}
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
          onChange={onPosterUrlChange}
        />
        {safePosterUrl && !posterPreviewError && (
          <img
            src={safePosterUrl}
            alt=""
            className={styles.posterPreview}
            onError={onPosterLoadError}
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
          onChange={onExcludeFromRecommendationsChange}
        />
      </div>
    </>
  )
}
