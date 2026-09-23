import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CollapsibleSection } from './CollapsibleSection'

// FRONTEND-123-AC-02: CollapsibleSection is the shared "toggle button +
// active-count badge + conditional body" component extracted from
// RecommendationFiltersBox.tsx's hand-rolled disclosure -- see
// frontend_spec_123_filter_layout_and_collapsible_sections.md.
describe('FRONTEND-123-AC-02: CollapsibleSection', () => {
  it('renders children when defaultOpen is true', () => {
    render(
      <CollapsibleSection
        title="Test Section"
        defaultOpen={true}
        activeCount={0}
      >
        <p>Body content</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Test Section' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('hides children when defaultOpen is false, and shows them after a click', () => {
    render(
      <CollapsibleSection
        title="Test Section"
        defaultOpen={false}
        activeCount={0}
      >
        <p>Body content</p>
      </CollapsibleSection>,
    )
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Test Section' }))
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('shows the active-count badge only when activeCount > 0', () => {
    const { rerender } = render(
      <CollapsibleSection
        title="Test Section"
        defaultOpen={true}
        activeCount={0}
      >
        <p>Body</p>
      </CollapsibleSection>,
    )
    expect(screen.queryByText('2')).not.toBeInTheDocument()
    rerender(
      <CollapsibleSection
        title="Test Section"
        defaultOpen={true}
        activeCount={2}
      >
        <p>Body</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // Not in the spec's Red test cases verbatim, but exercises the
  // headingTag prop SearchFilter.tsx needs (see Design Decisions: the <h3>
  // wraps only the toggle button, never the conditionally-rendered body --
  // otherwise the heading's accessible name would fold in the whole open
  // body's text).
  it('wraps only the toggle button in headingTag, not the body', () => {
    render(
      <CollapsibleSection
        title="Ratings"
        defaultOpen={true}
        activeCount={0}
        headingTag="h3"
      >
        <p>Field label text</p>
      </CollapsibleSection>,
    )
    const heading = screen.getByRole('heading', { name: 'Ratings' })
    expect(heading.tagName).toBe('H3')
    expect(heading).not.toHaveTextContent('Field label text')
  })
})
