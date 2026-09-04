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
  // FRONTEND-044-AC-01: EditSeriesForm's opt-in signal to render a Clear
  // button beside each of the 10 applicable fields below; AddSeriesForm
  // never passes this, so its render is untouched.
  readonly onClearField?: (field: SeriesFormFieldName) => void
}

// FRONTEND-044-AC-01/02/03: renders nothing when onClearField is omitted
// (AddSeriesForm's render stays untouched); otherwise a small Clear button,
// disabled once the field is already blank, that reports the field name up
// to EditSeriesForm on click. EditSeriesForm's own onClearField handler owns
// both blanking the field and tracking it in clearedFields -- this component
// never mutates form state directly.
function ClearFieldButton({
  field,
  label,
  value,
  onClearField,
}: {
  readonly field: SeriesFormFieldName
  readonly label: string
  readonly value: string
  readonly onClearField?: (field: SeriesFormFieldName) => void
}) {
  if (!onClearField) return null
  return (
    <button
      type="button"
      className={styles.clearButton}
      aria-label={`Clear ${label}`}
      disabled={value.trim() === ''}
      onClick={() => onClearField(field)}
    >
      &times;
    </button>
  )
}

// typescript:S3358: a locked field's hint takes precedence over a validation
// error (a locked field can't realistically have one, since its value never
// changes once disabled) -- extracted so the two-level "locked, then error,
// then neither" choice reads as one named step instead of a nested ternary
// repeated at every locked-capable field below.
function resolveDescribedBy(
  locked: boolean | undefined,
  lockedId: string,
  error: string | undefined,
  errorId: string,
): string | undefined {
  if (locked) return lockedId
  if (error) return errorId
  return undefined
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
  onClearField,
}: SeriesFormFieldsProps) {
  const safePosterUrl =
    form.posterUrl.trim() !== '' ? sanitizeImageUrl(form.posterUrl) : null

  return (
    <>
      <div className={styles.field}>
        <label htmlFor="year">Year</label>
        <div className={styles.fieldRow}>
          <input
            id="year"
            type="number"
            value={form.year}
            onChange={updateField('year')}
            disabled={lockedFields?.year}
            aria-describedby={resolveDescribedBy(
              lockedFields?.year,
              'year-locked-hint',
              fieldErrors.year,
              'year-error',
            )}
          />
          <ClearFieldButton
            field="year"
            label="Year"
            value={form.year}
            onClearField={onClearField}
          />
        </div>
        {lockedFields?.year && <LockedFieldHint field="year" />}
        {fieldErrors.year && (
          <span id="year-error" className={styles.fieldError}>
            {fieldErrors.year}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="genres">Genres</label>
        <div className={styles.fieldRow}>
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
          <ClearFieldButton
            field="genres"
            label="Genres"
            value={form.genres}
            onClearField={onClearField}
          />
        </div>
        {lockedFields?.genres && <LockedFieldHint field="genres" />}
      </div>

      <div className={styles.field}>
        <label htmlFor="tags">Tags</label>
        <div className={styles.fieldRow}>
          <input
            id="tags"
            type="text"
            value={form.tags}
            onChange={updateField('tags')}
          />
          <ClearFieldButton
            field="tags"
            label="Tags"
            value={form.tags}
            onClearField={onClearField}
          />
        </div>
      </div>

      {source !== 'recommendation' && (
        <div className={styles.field}>
          <label htmlFor="totalSeasons">Total Seasons</label>
          <div className={styles.fieldRow}>
            <input
              id="totalSeasons"
              type="number"
              value={form.totalSeasons}
              onChange={updateField('totalSeasons')}
              disabled={lockedFields?.totalSeasons}
              aria-describedby={resolveDescribedBy(
                lockedFields?.totalSeasons,
                'totalSeasons-locked-hint',
                fieldErrors.totalSeasons,
                'totalSeasons-error',
              )}
            />
            <ClearFieldButton
              field="totalSeasons"
              label="Total Seasons"
              value={form.totalSeasons}
              onClearField={onClearField}
            />
          </div>
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
          <div className={styles.fieldRow}>
            <input
              id="totalEpisodes"
              type="number"
              value={form.totalEpisodes}
              onChange={updateField('totalEpisodes')}
              disabled={lockedFields?.totalEpisodes}
              aria-describedby={resolveDescribedBy(
                lockedFields?.totalEpisodes,
                'totalEpisodes-locked-hint',
                fieldErrors.totalEpisodes,
                'totalEpisodes-error',
              )}
            />
            <ClearFieldButton
              field="totalEpisodes"
              label="Total Episodes"
              value={form.totalEpisodes}
              onClearField={onClearField}
            />
          </div>
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
          <div className={styles.fieldRow}>
            <input
              id="imdbRating"
              type="number"
              step="0.1"
              value={form.imdbRating}
              onChange={updateField('imdbRating')}
              disabled={lockedFields?.imdbRating}
              aria-describedby={resolveDescribedBy(
                lockedFields?.imdbRating,
                'imdbRating-locked-hint',
                fieldErrors.imdbRating,
                'imdbRating-error',
              )}
            />
            <ClearFieldButton
              field="imdbRating"
              label="IMDb Rating"
              value={form.imdbRating}
              onClearField={onClearField}
            />
          </div>
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
          <div className={styles.fieldRow}>
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
            <ClearFieldButton
              field="rottenTomatoesRating"
              label="Rotten Tomatoes Rating (Tomatometer)"
              value={form.rottenTomatoesRating}
              onClearField={onClearField}
            />
          </div>
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
          <div className={styles.fieldRow}>
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
            <ClearFieldButton
              field="rottenTomatoesPopcornmeter"
              label="Rotten Tomatoes Rating (Popcornmeter)"
              value={form.rottenTomatoesPopcornmeter}
              onClearField={onClearField}
            />
          </div>
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
        <div className={styles.fieldRow}>
          <textarea
            id="personalNotes"
            value={form.personalNotes}
            onChange={updateField('personalNotes')}
          />
          <ClearFieldButton
            field="personalNotes"
            label="Personal Notes"
            value={form.personalNotes}
            onClearField={onClearField}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="posterUrl">Poster URL</label>
        <div className={styles.fieldRow}>
          <input
            id="posterUrl"
            type="text"
            value={form.posterUrl}
            onChange={onPosterUrlChange}
          />
          <ClearFieldButton
            field="posterUrl"
            label="Poster URL"
            value={form.posterUrl}
            onClearField={onClearField}
          />
        </div>
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
