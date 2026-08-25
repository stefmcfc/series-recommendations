import { useEffect, useRef, useState } from 'react'
import styles from './KeywordPicker.module.css'

interface KeywordPickerProps {
  readonly id: string
  readonly label: string
  readonly selected: string[]
  readonly onChange: (next: string[]) => void
  readonly options?: string[]
  readonly placeholder?: string
  readonly focusOnMount?: boolean
  readonly allowFreeText?: boolean
  readonly maxSuggestionsWhenEmpty?: number
}

function isSameKeyword(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
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

  // Suggestions used to decide what Enter adds in constrained (non-free-text)
  // mode -- only ever derived from what's actually typed, so the pre-existing
  // "Enter with an empty input does nothing" behavior (frontend_spec_029)
  // stays unchanged even now that empty-input default suggestions exist.
  const typedMatches =
    options && trimmedInput !== ''
      ? options.filter(
          (option) =>
            option.toLowerCase().includes(trimmedInput.toLowerCase()) &&
            !selected.some((keyword) => isSameKeyword(keyword, option)),
        )
      : []

  // FRONTEND-032-AC-04/05: when the input is empty, offer the first N
  // (or, if maxSuggestionsWhenEmpty is omitted, all) non-selected options as
  // suggestions -- options already arrive most-common-first, so a prefix
  // slice is sufficient (no re-sorting needed).
  const emptyInputSuggestions =
    options && trimmedInput === ''
      ? options
          .filter(
            (option) =>
              !selected.some((keyword) => isSameKeyword(keyword, option)),
          )
          .slice(0, maxSuggestionsWhenEmpty ?? options.length)
      : []

  const visibleSuggestions =
    trimmedInput !== '' ? typedMatches : emptyInputSuggestions

  const addKeyword = (raw: string) => {
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
      // supplied or whether the text matches one of them.
      if (allowFreeText) {
        addKeyword(inputValue)
      } else if (options) {
        if (typedMatches.length > 0) addKeyword(typedMatches[0])
      } else {
        addKeyword(inputValue)
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
            <li key={option}>
              <button
                type="button"
                className={styles.suggestionButton}
                onClick={() => addKeyword(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <ul className={styles.chips}>
          {selected.map((keyword) => (
            <li key={keyword} className={styles.chip}>
              <span>{keyword}</span>
              <button
                type="button"
                aria-label={`Remove ${keyword}`}
                className={styles.chipRemove}
                onClick={() => removeKeyword(keyword)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
