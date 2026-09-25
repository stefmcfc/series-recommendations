import { InfoDisclosure } from './InfoDisclosure'
import styles from './RatingSourceChips.module.css'

interface RatingSourceChipsProps {
  readonly selected: string[]
  readonly onChange: (next: string[]) => void
}

// FRONTEND-132-AC-03/SERIES-068: mirrors series_spec_068's
// sourceRatingBlendSources value set exactly -- these four ids are the only
// values the backend accepts.
const RATING_SOURCE_OPTIONS: { id: string; label: string }[] = [
  { id: 'imdb', label: 'IMDb' },
  { id: 'tmdb', label: 'TMDB' },
  { id: 'tomatometer', label: 'Tomatometer' },
  { id: 'popcornmeter', label: 'Popcornmeter' },
]

// FRONTEND-132-AC-03/04: a new, small, single-purpose chip multi-select --
// not a reuse of GenreIncludeExcludePicker (this spec's Design Decisions:
// that component's 3-state include/exclude/neutral semantics don't fit a
// plain "select any subset of 4" control). Controlled component --
// `selected`/`onChange` are the only way state changes, mirroring
// GenreIncludeExcludePicker's own controlled shape. Refuses to let the last
// selected chip be deselected (series_spec_068 requires at least one blend
// source), so `onChange` is simply never called for that click rather than
// being called with an empty array the caller would then have to reject.
export function RatingSourceChips({
  selected,
  onChange,
}: RatingSourceChipsProps) {
  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend>Custom Rating Blend sources</legend>
      {/* FRONTEND-132 amendment: the one non-obvious behavior here -- a
          click on the last remaining selected chip is a silent no-op, per
          handleToggle above -- was never explained anywhere in the UI.
          Matches this app's established pattern of an InfoDisclosure per
          non-obvious control (frontend_spec_131) rather than adding this
          detail to the parent "Source Ranking Strategy" InfoDisclosure,
          which already covers what the blend itself means. */}
      <InfoDisclosure
        label="About Custom Rating Blend sources"
        description="Choose which rating sources feed the Custom Rating Blend used by the two blend-based ranking strategies above. At least one source must stay selected — clicking the last remaining chip does nothing."
      />
      <div className={styles.chips}>
        {RATING_SOURCE_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              className={styles.chip}
              aria-pressed={isSelected}
              onClick={() => handleToggle(option.id)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
