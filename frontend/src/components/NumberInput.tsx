import { useId } from 'react'
import type { ChangeEvent } from 'react'
import styles from './NumberInput.module.css'

// FRONTEND-115-AC-03: mirrors a plain <input type="number">'s value/min/max/
// step attribute surface, which in this app is a mix of numbers (e.g.
// MIN_VALID_YEAR) and numeric-literal strings (e.g. min="0") depending on
// the call site -- accepting both here means every one of the 27 migrated
// fields keeps passing whatever it already had.
type NumberLike = number | string

interface NumberInputProps {
  readonly value: NumberLike
  // FRONTEND-115-AC-03/04: typing forwards the native input's raw string
  // value unchanged (exactly like a plain <input type="number">'s onChange
  // would via event.target.value) -- never rounded through Number() first,
  // which would strip an in-progress trailing decimal point ("7.") on every
  // keystroke and make typing a decimal effectively impossible in a
  // controlled input. The increment/decrement buttons instead call back with
  // a plain computed number (FRONTEND-115-AC-04's test contract), since
  // there's no in-progress typing state to preserve for a fully-computed
  // step adjustment.
  readonly onChange: (value: NumberLike) => void
  readonly min?: NumberLike
  readonly max?: NumberLike
  readonly step?: NumberLike
  readonly disabled?: boolean
  readonly label: string
  readonly id?: string
  // Not in this spec's explicit prop list, but needed by several migrated
  // call sites (e.g. SeriesFormFields' locked-field/error hints) that already
  // wire aria-describedby onto their raw <input> -- a straightforward
  // pass-through, consistent with "mirrors a plain <input type='number'>".
  readonly ariaDescribedBy?: string
}

function toNumber(value: NumberLike | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function decimalPlaces(step: number): number {
  const text = step.toString()
  const dotIndex = text.indexOf('.')
  return dotIndex === -1 ? 0 : text.length - dotIndex - 1
}

// Rounds to the step's own decimal precision to avoid floating-point drift
// (e.g. 9.9 + 0.1 becoming 9.999999999999998 instead of 10).
function roundToStep(value: number, step: number): number {
  return Number(value.toFixed(decimalPlaces(step)))
}

function clamp(
  value: number,
  min: number | undefined,
  max: number | undefined,
): number {
  let result = value
  if (min !== undefined) result = Math.max(result, min)
  if (max !== undefined) result = Math.min(result, max)
  return result
}

// FRONTEND-115-AC-02: a native <input type="number"> (its spinner suppressed
// by index.css's global rule) plus two small custom increment/decrement
// buttons styled with --control-border, so numeric fields look consistent
// across Chrome/Firefox and light/dark theme instead of each browser's own
// native spinner UI.
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  label,
  id,
  ariaDescribedBy,
}: NumberInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const parsedMin = toNumber(min)
  const parsedMax = toNumber(max)
  const parsedStep = toNumber(step) ?? 1
  const currentValue = toNumber(value) ?? 0

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  const adjust = (direction: 1 | -1) => {
    if (disabled) return
    const next = clamp(
      roundToStep(currentValue + direction * parsedStep, parsedStep),
      parsedMin,
      parsedMax,
    )
    onChange(next)
  }

  const atMax = parsedMax !== undefined && currentValue >= parsedMax
  const atMin = parsedMin !== undefined && currentValue <= parsedMin

  return (
    <div className={styles.wrapper}>
      <label htmlFor={inputId}>{label}</label>
      <div className={styles.controlRow}>
        <input
          id={inputId}
          type="number"
          className={styles.input}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          onChange={handleInputChange}
        />
        <div className={styles.spinner}>
          {/* aria-label deliberately doesn't repeat `label` (unlike this
              app's usual "Clear ${label}"/"Remove ${keyword}" convention) --
              RTL's getByLabelText treats any element's own aria-label as a
              match too, and a large number of this app's existing tests
              query fields with an unanchored regex (e.g. /min tmdb rating/i).
              Embedding the field name here would make every one of those
              queries newly ambiguous across 27 migrated call sites. */}
          <button
            type="button"
            className={styles.spinnerButton}
            aria-label="Increase"
            disabled={disabled || atMax}
            onClick={() => adjust(1)}
          >
            &#9650;
          </button>
          <button
            type="button"
            className={styles.spinnerButton}
            aria-label="Decrease"
            disabled={disabled || atMin}
            onClick={() => adjust(-1)}
          >
            &#9660;
          </button>
        </div>
      </div>
    </div>
  )
}
