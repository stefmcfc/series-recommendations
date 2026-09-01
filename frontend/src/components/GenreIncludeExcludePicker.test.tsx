import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'

describe('FRONTEND-067-AC-01: closed by default', () => {
  it('renders the trigger button with no dialog present', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy', 'Drama']}
        included={[]}
        excluded={[]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Genres/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-067-AC-02: trigger summary', () => {
  it('shows counts when a selection is active', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy', 'Drama', 'Horror']}
        included={['Comedy', 'Drama']}
        excluded={['Horror']}
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Genres — 2 included, 1 excluded' }),
    ).toBeInTheDocument()
  })

  it('shows only the label when nothing is selected', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={[]}
        excluded={[]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Genres' })).toBeInTheDocument()
  })
})

describe('FRONTEND-067-AC-03: opens modal with one control per genre', () => {
  it('lists every genreOptions entry after clicking the trigger', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy', 'Drama']}
        included={[]}
        excluded={[]}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Comedy: neutral' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Drama: neutral' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-067-AC-04: neutral -> include', () => {
  it('adds the genre to included on first click', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={[]}
        excluded={[]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    expect(onChange).toHaveBeenCalledWith({
      included: ['Comedy'],
      excluded: [],
    })
  })
})

describe('FRONTEND-067-AC-05: include -> exclude', () => {
  it('moves the genre from included to excluded, never both', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={['Comedy']}
        excluded={[]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres — 1 included' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    expect(onChange).toHaveBeenCalledWith({
      included: [],
      excluded: ['Comedy'],
    })
  })
})

describe('FRONTEND-067-AC-06: exclude -> neutral', () => {
  it('removes the genre from excluded and adds it nowhere', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={[]}
        excluded={['Comedy']}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres — 1 excluded' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: exclude' }))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: [] })
  })
})

describe('FRONTEND-067-AC-07: excludeOnly mode', () => {
  it('goes straight from neutral to excluded, skipping include', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        mode="excludeOnly"
        included={[]}
        excluded={[]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    expect(onChange).toHaveBeenCalledWith({
      included: [],
      excluded: ['Comedy'],
    })
  })
})

describe('FRONTEND-067-AC-08: Clear resets both lists', () => {
  it('calls onChange with both lists empty', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy', 'Drama']}
        included={['Comedy']}
        excluded={['Drama']}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Genres/ }))
    fireEvent.click(screen.getByTestId('test-genre-picker-clear-btn'))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: [] })
  })
})

describe('FRONTEND-067-AC-09: Done/Escape close without side effects', () => {
  it('closes on Done without calling onChange', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={[]}
        excluded={[]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on Escape without calling onChange', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={[]}
        excluded={[]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-067-AC-10: overlapping props resolve to exclude', () => {
  it('renders exclude state when a genre is in both lists', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test"
        label="Genres"
        genreOptions={['Comedy']}
        included={['Comedy']}
        excluded={['Comedy']}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Genres/ }))
    expect(
      screen.getByRole('button', { name: 'Comedy: exclude' }),
    ).toBeInTheDocument()
  })
})
