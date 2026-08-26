import styles from './StarRating.module.css'

interface StarRatingProps {
  readonly value: number | null
  readonly onChange?: (value: number | null) => void
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const

// FRONTEND-013-AC-01: read-only (display) when onChange is omitted,
// interactive (5 buttons) when provided.
export function StarRating({ value, onChange }: StarRatingProps) {
  const filledUpTo = value ?? 0

  if (!onChange) {
    return (
      <span className={styles.stars} aria-label="Personal rating">
        {STAR_VALUES.map((n) => (
          <span
            key={n}
            aria-hidden="true"
            className={n <= filledUpTo ? styles.starFilled : styles.starEmpty}
          >
            ★
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={styles.stars} aria-label="Personal rating">
      {STAR_VALUES.map((n) => (
        <button
          key={n}
          type="button"
          className={`${styles.starButton} ${n <= filledUpTo ? styles.starFilled : styles.starEmpty}`}
          aria-label={`Rate ${n} star(s)`}
          aria-pressed={n <= filledUpTo}
          onClick={() => onChange(n === value ? null : n)}
        >
          ★
        </button>
      ))}
    </span>
  )
}
