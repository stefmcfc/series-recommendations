import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StreamingProviders } from './StreamingProviders'

describe('FRONTEND-036-AC-01: provider list rendering', () => {
  it('renders provider name and logo when present', () => {
    render(
      <StreamingProviders
        providers={[
          {
            name: 'Netflix',
            logoUrl: 'https://image.tmdb.org/t/p/w92/abc.jpg',
          },
        ]}
      />,
    )
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByAltText('Netflix')).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w92/abc.jpg',
    )
  })

  it('renders the name alone when logoUrl is null', () => {
    render(
      <StreamingProviders
        providers={[{ name: 'BBC iPlayer', logoUrl: null }]}
      />,
    )
    expect(screen.getByText('BBC iPlayer')).toBeInTheDocument()
    expect(screen.queryByAltText('BBC iPlayer')).not.toBeInTheDocument()
  })

  it('renders the not-streaming note when empty', () => {
    render(<StreamingProviders providers={[]} />)
    expect(
      screen.getByText('Not currently streaming in the UK'),
    ).toBeInTheDocument()
  })
})
