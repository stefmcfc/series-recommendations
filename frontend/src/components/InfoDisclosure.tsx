import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './InfoDisclosure.module.css'

interface InfoDisclosureProps {
  readonly label: string
  readonly description: ReactNode
}

// FRONTEND-131-AC-01: decorative ⓘ glyph -- hand-rolled inline SVG matching
// StatusTabIcons.tsx/SettingsIcons.tsx's convention (stroke-based,
// currentColor), rather than frontend/public/icons.svg's unrelated
// social-icon sprite (zero <use href> references anywhere in this app). The
// icon is purely decorative -- the button's own aria-label already carries
// the accessible name -- so aria-hidden is set here directly rather than by
// an external wrapper (this component has no consumer that wraps it).
function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="11" />
      <line x1="12" y1="8" x2="12" y2="8" />
    </svg>
  )
}

// FRONTEND-131-AC-01/02: a small click-to-toggle disclosure -- not a
// hover-only tooltip, which fails outright on touch and is unreliable for
// keyboard/screen-reader users (this spec's Design Decisions). Closed by
// default, instant mount/unmount with no transition/animation, matching
// CollapsibleSection.tsx's own established disclosure idiom in this
// codebase. aria-controls links the toggle button to its description via an
// internally-generated id (useId(), mirroring NumberInput.tsx's own
// generatedId idiom) -- no external id prop, since nothing outside this
// component ever references it.
export function InfoDisclosure({ label, description }: InfoDisclosureProps) {
  const [open, setOpen] = useState(false)
  // FRONTEND-132 (live-review amendment): the description defaults to
  // left:0, but a wrapper near the viewport's right edge (e.g. the last
  // field in a 4-col grid) pushed it past the right edge, inflating
  // document.scrollWidth into page-level horizontal scroll (found in a
  // live browser pass, confirmed via getBoundingClientRect() -- this
  // wasn't visible in jsdom, which doesn't lay out CSS at all). Measured
  // and flipped via useLayoutEffect (runs before paint, so no visible
  // flicker) rather than guessed from viewport width alone, since the
  // wrapper's own position -- not just the window size -- determines
  // whether the fixed-width description would overflow.
  const [alignRight, setAlignRight] = useState(false)
  const descriptionId = useId()
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    if (!open || !descriptionRef.current) return
    setAlignRight(
      descriptionRef.current.getBoundingClientRect().right > window.innerWidth,
    )
  }, [open])

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? descriptionId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <InfoIcon />
      </button>
      {open && (
        <p
          ref={descriptionRef}
          id={descriptionId}
          className={`${styles.description} ${alignRight ? styles.descriptionAlignRight : ''}`}
        >
          {description}
        </p>
      )}
    </span>
  )
}
