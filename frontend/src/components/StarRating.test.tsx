import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { StarRating } from './StarRating'

describe('FRONTEND-013-AC-01/04: read-only mode', () => {
  it('renders no interactive elements when onChange is omitted', () => {
    render(<StarRating value={3} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is queryable by its group aria-label', () => {
    render(<StarRating value={3} />)
    expect(screen.getByLabelText('Personal rating')).toBeInTheDocument()
  })

  it('renders all 5 stars unfilled when value is null, no numeric fallback text', () => {
    render(<StarRating value={null} />)
    const group = screen.getByLabelText('Personal rating')
    expect(group.textContent).toBe('★★★★★')
    expect(screen.queryByText(/^[0-9]$/)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-02: interactive mode', () => {
  it('calls onChange(n) when clicking an unselected star', () => {
    const onChange = vi.fn()
    render(<StarRating value={2} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('calls onChange(null) when clicking the currently-selected star', () => {
    const onChange = vi.fn()
    render(<StarRating value={3} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Rate 3 star(s)'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders 5 buttons within the labelled group', () => {
    render(<StarRating value={2} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.getByLabelText('Personal rating')).toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-03: accessible labels/aria-pressed', () => {
  it('marks stars up to the current value as pressed', () => {
    render(<StarRating value={3} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Rate 1 star(s)')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Rate 3 star(s)')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Rate 4 star(s)')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('FRONTEND-013-AC-04: null value in interactive mode', () => {
  it('renders aria-pressed=false on every button', () => {
    render(<StarRating value={null} onChange={vi.fn()} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
  })
})
