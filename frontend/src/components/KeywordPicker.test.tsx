import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { KeywordPicker } from './KeywordPicker'

describe('FRONTEND-029-AC-01: labelled input', () => {
  it('renders an input reachable by its label text', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-02: free-text mode adds on Enter', () => {
  it('adds the trimmed input value on Enter and clears the input', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: '  spy  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['spy'])
    expect(input).toHaveValue('')
  })

  it('does not add an empty (whitespace-only) value on Enter', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-03/04: vocabulary-constrained mode filters and adds via click', () => {
  it('shows matching suggestions as the user types, and adds one on click', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
        options={['spy', 'period drama', 'heist']}
        // FRONTEND-032-AC-04: capped at 0 so this test's premise ("nothing
        // shown before typing") is isolated from the new empty-input default
        // suggestions behavior (covered separately below), keeping this
        // test focused on typed-filter behavior only.
        maxSuggestionsWhenEmpty={0}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    expect(
      screen.queryByRole('button', { name: 'spy' }),
    ).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'sp' } })
    expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'heist' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'spy' }))
    expect(onChange).toHaveBeenCalledWith(['spy'])
    expect(input).toHaveValue('')
  })

  it('shows all non-selected options as suggestions for an empty input (FRONTEND-032-AC-05: no maxSuggestionsWhenEmpty cap)', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'heist']}
      />,
    )

    expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'heist' })).toBeInTheDocument()
  })

  it('renders no suggestions when typed text matches no option', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'heist']}
      />,
    )

    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'zzz' },
    })
    expect(
      screen.queryByRole('button', { name: 'spy' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'heist' }),
    ).not.toBeInTheDocument()
  })

  it('adds the first-listed match on Enter while suggestions are showing', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
        options={['spy', 'spy thriller']}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['spy'])
    expect(input).toHaveValue('')
  })

  it('does not add anything on Enter when the typed text matches no option', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
        options={['spy']}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-05: duplicate add is a no-op', () => {
  it('does not call onChange when the keyword is already selected (free text, case-insensitive)', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={['spy']}
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'SPY' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when the keyword is already selected (constrained mode)', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={['spy']}
        onChange={onChange}
        options={['spy', 'heist']}
      />,
    )

    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'spy' },
    })
    expect(
      screen.queryByRole('button', { name: 'spy' }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-06: chip remove button', () => {
  it('removes the keyword when its remove button is clicked', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={['spy', 'heist']}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove spy' }))
    expect(onChange).toHaveBeenCalledWith(['heist'])
  })
})

describe('FRONTEND-029-AC-07: Backspace-on-empty removes the last chip', () => {
  it('removes the last selected keyword on Backspace when the input is empty', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={['spy', 'heist']}
        onChange={onChange}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith(['spy'])
  })

  it('does not remove a chip on Backspace when the input has text', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={['spy']}
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange on Backspace when the input is empty and nothing is selected', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-08: chip list item is not itself interactive', () => {
  it('the chip <li> has no role or tabIndex', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={['spy']}
        onChange={vi.fn()}
      />,
    )
    const chip = screen.getByText('spy').closest('li')
    expect(chip).not.toHaveAttribute('role')
    expect(chip).not.toHaveAttribute('tabindex')
  })
})

describe('FRONTEND-032-AC-01: allowFreeText defaults to false', () => {
  it('does not add non-matching free text on Enter when allowFreeText is omitted', () => {
    render(
      <KeywordPicker
        id="k"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'heist']}
      />,
    )
    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'zzz-not-a-match' },
    })
    fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Enter' })
    expect(screen.queryByText('zzz-not-a-match')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-032-AC-02: Enter adds free text when allowFreeText is true', () => {
  it('adds the typed text even though options are present and none match', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="k"
        label="Keywords"
        selected={[]}
        onChange={onChange}
        options={['spy', 'heist']}
        allowFreeText
      />,
    )
    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'zombie apocalypse' },
    })
    fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['zombie apocalypse'])
  })
})

describe('FRONTEND-032-AC-03: clicking a suggestion still adds that option when allowFreeText is true', () => {
  it('adds the clicked suggestion, not the raw typed text', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="k"
        label="Keywords"
        selected={[]}
        onChange={onChange}
        options={['spy', 'heist']}
        allowFreeText
      />,
    )
    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'sp' },
    })
    fireEvent.click(screen.getByText('spy'))
    expect(onChange).toHaveBeenCalledWith(['spy'])
  })
})

describe('FRONTEND-032-AC-04: empty input shows the first maxSuggestionsWhenEmpty options', () => {
  it('shows only the first N options, preserving order, excluding already-selected', () => {
    render(
      <KeywordPicker
        id="k"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'heist', 'crime', 'drama', 'noir']}
        maxSuggestionsWhenEmpty={3}
      />,
    )
    expect(screen.getByText('spy')).toBeInTheDocument()
    expect(screen.getByText('heist')).toBeInTheDocument()
    expect(screen.getByText('crime')).toBeInTheDocument()
    expect(screen.queryByText('drama')).not.toBeInTheDocument()
    expect(screen.queryByText('noir')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-032-AC-05: omitting maxSuggestionsWhenEmpty shows all options when empty', () => {
  it('renders every option with no query typed', () => {
    const many = Array.from({ length: 15 }, (_, i) => `keyword-${i}`)
    render(
      <KeywordPicker
        id="k"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={many}
      />,
    )
    expect(screen.getByText('keyword-0')).toBeInTheDocument()
    expect(screen.getByText('keyword-14')).toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-01: PickerOption[] generalization does not affect string[] behavior', () => {
  it('existing string[] options behavior is unaffected', () => {
    render(
      <KeywordPicker
        id="k"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'grim']}
      />,
    )
    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'sp' },
    })
    expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-02: PickerOption[] selects by id, displays by label', () => {
  it('selects by id, displays by label', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="s"
        label="Series"
        selected={[]}
        onChange={onChange}
        options={[{ id: 'abc-123', label: 'Ozark (COMPLETED)' }]}
      />,
    )
    fireEvent.change(screen.getByLabelText('Series'), {
      target: { value: 'ozark' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ozark (COMPLETED)' }))
    expect(onChange).toHaveBeenCalledWith(['abc-123'])
  })

  it('an already-selected id is not offered again, matched by id not label', () => {
    render(
      <KeywordPicker
        id="s"
        label="Series"
        selected={['abc-123']}
        onChange={vi.fn()}
        options={[{ id: 'abc-123', label: 'Ozark (COMPLETED)' }]}
      />,
    )
    expect(screen.getByText('Ozark (COMPLETED)')).toBeInTheDocument() // renders as a chip
    expect(
      screen.queryByRole('button', { name: 'Ozark (COMPLETED)' }),
    ).not.toBeInTheDocument() // not also a suggestion
  })
})

describe('FRONTEND-035-AC-03: allowFreeText is a no-op for PickerOption[] options', () => {
  it('Enter with no match adds nothing for PickerOption[] options', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="s"
        label="Series"
        selected={[]}
        onChange={onChange}
        options={[{ id: 'abc-123', label: 'Ozark (COMPLETED)' }]}
      />,
    )
    fireEvent.change(screen.getByLabelText('Series'), {
      target: { value: 'no such show' },
    })
    fireEvent.keyDown(screen.getByLabelText('Series'), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('placeholder prop', () => {
  it('passes the placeholder through to the input', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        placeholder="Type a keyword"
      />,
    )
    expect(screen.getByPlaceholderText('Type a keyword')).toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-01: pinned options always appear first', () => {
  it('shows pinned options even when typed text does not match them', () => {
    render(
      <KeywordPicker
        id="test-picker"
        label="Countries"
        selected={[]}
        onChange={vi.fn()}
        options={['US', 'GB', 'JP', 'FR']}
        pinnedOptions={['US', 'GB']}
      />,
    )

    fireEvent.change(screen.getByLabelText(/countries/i), {
      target: { value: 'jp' },
    })

    const suggestions = screen.getAllByRole('button', { name: /^(us|gb|jp)$/i })
    expect(suggestions[0]).toHaveTextContent(/us/i)
    expect(suggestions[1]).toHaveTextContent(/gb/i)
  })
})

describe('FRONTEND-047-AC-02: selecting a pinned option adds a chip', () => {
  it('calls onChange with the pinned option selected', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="test-picker"
        label="Countries"
        selected={[]}
        onChange={onChange}
        options={['US', 'GB']}
        pinnedOptions={['US', 'GB']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^us$/i }))

    expect(onChange).toHaveBeenCalledWith(['US'])
  })
})

describe('FRONTEND-047-AC-03: existing consumers are unaffected', () => {
  it('behaves exactly as before when pinnedOptions is omitted', () => {
    render(
      <KeywordPicker
        id="test-picker"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'thriller']}
      />,
    )

    expect(screen.getByRole('button', { name: /^spy$/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-077-AC-01: hideInput suppresses input and suggestions', () => {
  it('renders no text input or suggestions when hideInput is true', () => {
    render(
      <KeywordPicker
        id="test"
        label="Keywords"
        selected={['drama']}
        onChange={vi.fn()}
        options={['drama', 'comedy']}
        hideInput
      />,
    )
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: /suggestions/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-077-AC-02: pills still render and remain removable', () => {
  it('renders pills and removes one on click, even with hideInput', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="test"
        label="Keywords"
        selected={['drama', 'comedy']}
        onChange={onChange}
        options={['drama', 'comedy']}
        hideInput
      />,
    )
    expect(screen.getByText('drama')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove drama' }))
    expect(onChange).toHaveBeenCalledWith(['comedy'])
  })
})

describe('FRONTEND-077-AC-03: label remains visible without an input', () => {
  it('still shows the label text when hideInput is true', () => {
    render(
      <KeywordPicker
        id="test"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['drama']}
        hideInput
      />,
    )
    expect(screen.getByText('Keywords')).toBeInTheDocument()
  })

  it('does not render a <label htmlFor> for the field once the input is gone', () => {
    render(
      <KeywordPicker
        id="test"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['drama']}
        hideInput
      />,
    )
    expect(screen.queryByLabelText('Keywords')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-01 (PickerOption[] options): pinned codes resolve to full labels', () => {
  it('shows the pinned option using its label from the options list, not the raw code', () => {
    render(
      <KeywordPicker
        id="countries"
        label="Countries"
        selected={[]}
        onChange={vi.fn()}
        options={[
          { id: 'US', label: 'United States' },
          { id: 'GB', label: 'United Kingdom' },
          { id: 'JP', label: 'Japan' },
        ]}
        pinnedOptions={['US', 'GB']}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'United States' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'United Kingdom' }),
    ).toBeInTheDocument()
  })
})
