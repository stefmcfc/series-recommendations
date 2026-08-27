import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './KeywordPicker.module.css'

export interface PickerOption {
  readonly id: string
  readonly label: string
  // Optional rich rendering for the suggestion button/chip (e.g. bold/italic
  // segments). `label` stays the plain-text source of truth for search
  // matching, dedup, and the button/chip's flattened accessible name --
  // `display` is a purely visual override, defaulting to `label` when absent.
  readonly display?: ReactNode
}

interface KeywordPickerProps {
  readonly id: string
  readonly label: string
  readonly selected: string[]
  readonly onChange: (next: string[]) => void
  readonly options?: string[] | PickerOption[]
  readonly placeholder?: string
  readonly focusOnMount?: boolean
  readonly allowFreeText?: boolean
  readonly maxSuggestionsWhenEmpty?: number
}

function isSameKeyword(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

// FRONTEND-035-AC-01: options may be a plain string[] (legacy keyword usage,
// where an option's own text is both its display label and its
// selection/dedup key) or a PickerOption[] (a distinct id/label pair, needed
// when display text isn't a safe selection key -- e.g. two tracked series
// sharing a title). Normalize whatever shape was passed into a uniform
// PickerOption[] up front so every other code path only ever deals with one
// shape; for a string[] entry, id === label === the string itself, which
// reproduces the pre-existing string[] behavior exactly.
function normalizeOptions(
  options: string[] | PickerOption[] | undefined,
): PickerOption[] {
  if (!options) return []
  if (options.length === 0) return []
  const first = options[0]
  if (typeof first === 'string') {
    return (options as string[]).map((value) => ({ id: value, label: value }))
  }
  return options as PickerOption[]
}

function isPickerOptionArray(
  options: string[] | PickerOption[] | undefined,
): boolean {
  if (!options || options.length === 0) return false
  return typeof options[0] !== 'string'
}

export function KeywordPicker({
  id,
  label,
  selected,
  onChange,
  options,
  placeholder,
  focusOnMount,
  allowFreeText = false,
  maxSuggestionsWhenEmpty,
}: KeywordPickerProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusOnMount) {
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus-on-mount only, intentionally not re-running if focusOnMount changes later
  }, [])

  const trimmedInput = inputValue.trim()
  const normalizedOptions = normalizeOptions(options)
  // FRONTEND-035-AC-03: allowFreeText is meaningless when options is
  // PickerOption[] -- a freshly typed string can't resolve to a valid id for
  // a series that doesn't exist in the tracked collection.
  const freeTextEnabled = allowFreeText && !isPickerOptionArray(options)

  // Suggestions used to decide what Enter adds in constrained (non-free-text)
  // mode -- only ever derived from what's actually typed, so the pre-existing
  // "Enter with an empty input does nothing" behavior (frontend_spec_029)
  // stays unchanged even now that empty-input default suggestions exist.
  const typedMatches =
    options && trimmedInput !== ''
      ? normalizedOptions.filter(
          (option) =>
            option.label.toLowerCase().includes(trimmedInput.toLowerCase()) &&
            !selected.includes(option.id),
        )
      : []

  // FRONTEND-032-AC-04/05: when the input is empty, offer the first N
  // (or, if maxSuggestionsWhenEmpty is omitted, all) non-selected options as
  // suggestions -- options already arrive most-common-first, so a prefix
  // slice is sufficient (no re-sorting needed).
  const emptyInputSuggestions =
    options && trimmedInput === ''
      ? normalizedOptions
          .filter((option) => !selected.includes(option.id))
          .slice(0, maxSuggestionsWhenEmpty ?? normalizedOptions.length)
      : []

  const visibleSuggestions =
    trimmedInput !== '' ? typedMatches : emptyInputSuggestions

  const addOption = (option: PickerOption) => {
    if (selected.includes(option.id)) return
    onChange([...selected, option.id])
    setInputValue('')
  }

  const addFreeText = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') return
    if (selected.some((keyword) => isSameKeyword(keyword, trimmed))) return

    onChange([...selected, trimmed])
    setInputValue('')
  }

  const removeKeyword = (keyword: string) => {
    onChange(selected.filter((k) => k !== keyword))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      // FRONTEND-032-AC-02: when allowFreeText is true, Enter always adds
      // whatever's currently typed, regardless of whether options were
      // supplied or whether the text matches one of them. FRONTEND-035-AC-03:
      // this branch never applies when options is PickerOption[].
      if (freeTextEnabled) {
        addFreeText(inputValue)
      } else if (options) {
        if (typedMatches.length > 0) addOption(typedMatches[0])
      } else {
        addFreeText(inputValue)
      }
      return
    }

    if (event.key === 'Backspace' && inputValue === '' && selected.length > 0) {
      onChange(selected.slice(0, -1))
    }
  }

  return (
    <div className={styles.container}>
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        placeholder={placeholder}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {options && visibleSuggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {visibleSuggestions.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className={styles.suggestionButton}
                onClick={() => addOption(option)}
              >
                {option.display ?? option.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <ul className={styles.chips}>
          {selected.map((keyword) => {
            const match = normalizedOptions.find(
              (option) => option.id === keyword,
            )
            return (
              <li key={keyword} className={styles.chip}>
                <span>{match?.display ?? match?.label ?? keyword}</span>
                <button
                  type="button"
                  aria-label={`Remove ${keyword}`}
                  className={styles.chipRemove}
                  onClick={() => removeKeyword(keyword)}
                >
                  &times;
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
