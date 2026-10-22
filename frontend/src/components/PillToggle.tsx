import btn from '../styles/buttons.module.css'
import styles from './PillToggle.module.css'

// FRONTEND-139-AC-01/02: a single reusable pill-shaped binary toggle --
// extracted from SearchFilter.module.css's .ratingToggleChip pattern (the
// first ad hoc implementation of this control) and generalized so every
// independent on/off control in the app (Missing Ratings chips, Favourites
// Only, Tint Cards, Show series I already have) renders via one real
// component instead of five near-duplicate bespoke ones. See
// frontend_spec_139's Design Decisions for why this stays a plain binary
// toggle (no `disabled`/`id` prop, no mutually-exclusive group variant).
export interface PillToggleProps {
  readonly pressed: boolean
  readonly onChange: (next: boolean) => void
  readonly children: React.ReactNode
}

export function PillToggle({ pressed, onChange, children }: PillToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.pillToggle} ${
        pressed ? btn.btnPrimary : btn.btnSecondary
      }`}
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
    >
      {children}
    </button>
  )
}
