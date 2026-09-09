// FRONTEND-101-AC-07: hand-rolled inline SVG icons for SettingsPage's five
// sections. Stroke-based with currentColor so they pick up --text-h/theme
// changes automatically in light/dark with zero extra CSS -- no new npm
// dependency, matching this app's general avoidance of libraries for small,
// self-contained UI needs (e.g. the custom KeywordPicker, native
// drag-and-drop). Each icon is purely decorative -- SettingsSection wraps it
// with aria-hidden="true", so no aria-label/title is set here.
const SVG_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function AppearanceIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

export function RefreshIcon() {
  return (
    <svg {...SVG_PROPS}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export function ExportIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 9 12 4 17 9" />
      <line x1="12" y1="4" x2="12" y2="16" />
    </svg>
  )
}

export function ImportIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="12" y1="16" x2="12" y2="4" />
    </svg>
  )
}

export function FavouritesIcon() {
  return (
    <svg {...SVG_PROPS}>
      <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2" />
    </svg>
  )
}

// FRONTEND-102-AC-05: globe icon for the new "Watch Region" section, same
// decorative/aria-hidden treatment as the other five (see the file-level
// comment above).
export function WatchRegionIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

// FRONTEND-108-AC-09: sliders/filter icon for the new "Filter Profiles"
// section, same decorative/aria-hidden treatment as the other six (see the
// file-level comment above).
export function FilterProfilesIcon() {
  return (
    <svg {...SVG_PROPS}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="11" cy="18" r="2" />
    </svg>
  )
}
