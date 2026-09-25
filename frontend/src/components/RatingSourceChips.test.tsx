import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { RatingSourceChips } from './RatingSourceChips'

// FRONTEND-132-AC-03/AC-04: new, small, single-purpose chip multi-select --
// controlled (selected/onChange), covering series_spec_068's four
// sourceRatingBlendSources values (imdb/tmdb/tomatometer/popcornmeter).
describe('FRONTEND-132-AC-03: renders 4 toggleable chips', () => {
  it('renders IMDb/TMDB/Tomatometer/Popcornmeter with the correct pressed state', () => {
    render(<RatingSourceChips selected={['imdb', 'tmdb']} onChange={vi.fn()} />)

    const group = screen.getByRole('group', {
      name: /Custom Rating Blend sources/i,
    })
    expect(
      within(group).getByRole('button', { name: 'IMDb', pressed: true }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('button', { name: 'TMDB', pressed: true }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('button', {
        name: 'Tomatometer',
        pressed: false,
      }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('button', {
        name: 'Popcornmeter',
        pressed: false,
      }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-132 amendment: info disclosure explains the last-chip guard', () => {
  it('reveals the last-chip-cannot-be-deselected explanation on click', () => {
    render(<RatingSourceChips selected={['imdb']} onChange={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: /about custom rating blend sources/i,
      }),
    )
    expect(
      screen.getByText(/clicking the last remaining chip does nothing/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-132-AC-04: chip toggle behavior', () => {
  it('toggles a source in and out, but refuses to deselect the last remaining source', () => {
    const onChange = vi.fn()
    render(<RatingSourceChips selected={['imdb']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'IMDb' }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'TMDB' }))
    expect(onChange).toHaveBeenCalledWith(['imdb', 'tmdb'])
  })

  it('removes a source that is not the last one selected', () => {
    const onChange = vi.fn()
    render(
      <RatingSourceChips selected={['imdb', 'tmdb']} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'IMDb' }))
    expect(onChange).toHaveBeenCalledWith(['tmdb'])
  })
})
