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

// typescript:S4323 -- `string[] | PickerOption[]` repeated across
// KeywordPickerProps and several helper signatures; a type alias replaces
// the union.
export type PickerOptions = string[] | PickerOption[]

interface KeywordPickerProps {
  readonly id: string
  readonly label: string
  readonly selected: string[]
  readonly onChange: (next: string[]) => void
  readonly options?: PickerOptions
  // FRONTEND-047-AC-01/02/03: options that always appear first in the
  // suggestion list, regardless of the currently typed search text --
  // resolved against `options` (by id) so a caller can pin by code/id alone
  // (e.g. ['US', 'GB']) while `options` itself supplies the human-readable
  // label (e.g. PickerOption[] country names). Falls back to the pinned
  // entry's own normalized id/label when no match is found in `options`.
  readonly pinnedOptions?: PickerOptions
  readonly placeholder?: string
  readonly focusOnMount?: boolean
  readonly allowFreeText?: boolean
  readonly maxSuggestionsWhenEmpty?: number
  // FRONTEND-077-AC-01/02/03: suppresses the text input and its suggestions
  // list, leaving only the selected-pills list (still removable). Used at
  // call sites that already have a paired "Browse..." modal providing full
  // search/typing elsewhere on the same panel, where the inline input would
  // otherwise duplicate it.
  readonly hideInput?: boolean
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
function normalizeOptions(options: PickerOptions | undefined): PickerOption[] {
  if (!options) return []
  if (options.length === 0) return []
  const first = options[0]
  if (typeof first === 'string') {
    return (options as string[]).map((value) => ({ id: value, label: value }))
  }
  return options as PickerOption[]
}

function isPickerOptionArray(options: PickerOptions | undefined): boolean {
  if (!options || options.length === 0) return false
  return typeof options[0] !== 'string'
}

// FRONTEND-047-AC-01: resolves each pinned entry against `normalizedOptions`
// (by id) so a caller can pin by bare code/id while `options` itself
// supplies the human-readable label -- e.g. Country's
// pinnedOptions={['US', 'GB']} resolves through the full country list to
// "United States"/"United Kingdom" rather than displaying the raw code.
// Falls back to the pinned entry's own normalized id/label when `options`
// has no matching entry.
function resolvePinnedOptions(
  pinnedOptions: PickerOptions | undefined,
  normalizedOptions: PickerOption[],
): PickerOption[] {
  const ownNormalized = normalizeOptions(pinnedOptions)
  return ownNormalized.map(
    (pinned) =>
      normalizedOptions.find((option) => option.id === pinned.id) ?? pinned,
  )
}

export function KeywordPicker({
  id,
  label,
  selected,
  onChange,
  options,
  pinnedOptions,
  placeholder,
  focusOnMount,
  allowFreeText = false,
  maxSuggestionsWhenEmpty,
  hideInput = false,
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

  const rawVisibleSuggestions =
    trimmedInput !== '' ? typedMatches : emptyInputSuggestions

  // FRONTEND-047-AC-01: pinned options always lead the suggestion list,
  // regardless of typed text, deduped by id against whatever the normal
  // suggestion logic would already surface so a pinned option never appears
  // twice. Already-selected pinned options are excluded, same as any other
  // option (FRONTEND-047-AC-02's design note).
  const visiblePinned = resolvePinnedOptions(
    pinnedOptions,
    normalizedOptions,
  ).filter((option) => !selected.includes(option.id))
  const pinnedIds = new Set(visiblePinned.map((option) => option.id))
  const visibleSuggestions = [
    ...visiblePinned,
    ...rawVisibleSuggestions.filter((option) => !pinnedIds.has(option.id)),
  ]

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
      {hideInput ? (
        // FRONTEND-077-AC-03: no <input> for a <label htmlFor> to point at
        // once hideInput suppresses it -- a plain <span> keeps the field
        // group visibly named for accessibility, matching the precedent
        // SearchFilter.tsx's Min Personal Rating field already uses.
        <span>{label}</span>
      ) : (
        <>
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

          {visibleSuggestions.length > 0 && (
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
        </>
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
