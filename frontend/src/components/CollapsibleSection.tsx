import { useState } from 'react'
import type { ReactNode } from 'react'
import styles from './CollapsibleSection.module.css'

interface CollapsibleSectionProps {
  readonly title: string
  readonly defaultOpen: boolean
  readonly activeCount: number
  readonly children: ReactNode
  readonly toggleClassName?: string
  readonly badgeClassName?: string
  readonly bodyClassName?: string
  // FRONTEND-123-AC-03: SearchFilter.tsx's 5 sections keep their <h3>
  // document-outline semantics, but only around the toggle button itself --
  // never around the conditionally-rendered body. Wrapping the whole
  // component (toggle + open body) in <h3> would fold every field label's
  // text inside the open body into the heading's accessible name, breaking
  // exact-match heading queries like `getByRole('heading', { name: 'Ratings'
  // })`. Optional and unused by RecommendationFiltersBox.tsx/
  // UseMySeriesPanel.tsx's own toggles, which were never <h3>-wrapped and
  // don't need to become so (this spec's Design Decisions).
  readonly headingTag?: 'h2' | 'h3' | 'h4'
}

// FRONTEND-123-AC-02: shared "toggle button + active-count badge +
// conditional body" component, extracted from RecommendationFiltersBox.tsx's
// hand-rolled disclosure (lines 94, 165-184 as of frontend_spec_123) rather
// than adding a third/fourth/fifth/sixth copy of the same pattern. No
// animation -- instant mount/unmount, matching every existing
// implementation of this pattern in this codebase.
export function CollapsibleSection({
  title,
  defaultOpen,
  activeCount,
  children,
  toggleClassName,
  badgeClassName,
  bodyClassName,
  headingTag: HeadingTag,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  // A plain-text toggle with no icon gave no visual hint it was interactive
  // (found in review of frontend_spec_123's SearchFilter.tsx sections) -- the
  // chevron rotates via CSS based on aria-expanded, no JS branching needed.
  const toggle = (
    <button
      type="button"
      className={
        toggleClassName ? `${styles.toggle} ${toggleClassName}` : styles.toggle
      }
      aria-expanded={open}
      onClick={() => setOpen((prev) => !prev)}
    >
      <span>{title}</span>
      <span className={styles.toggleRight}>
        {activeCount > 0 && (
          <span
            className={
              badgeClassName
                ? `${styles.badge} ${badgeClassName}`
                : styles.badge
            }
          >
            {activeCount}
          </span>
        )}
      </span>
    </button>
  )

  return (
    <>
      {HeadingTag ? (
        <HeadingTag className={styles.headingReset}>{toggle}</HeadingTag>
      ) : (
        toggle
      )}
      {open && <div className={bodyClassName}>{children}</div>}
    </>
  )
}
