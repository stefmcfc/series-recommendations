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

  it('renders no suggestions for an empty input', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        options={['spy', 'heist']}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'spy' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'heist' }),
    ).not.toBeInTheDocument()
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
