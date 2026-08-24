# Frontend Spec 032: Hybrid Keyword Suggestions (Type-Ahead + Free Text + Most Common)

**Status**: Implemented (2026-08-24). Files touched: `frontend/src/components/KeywordPicker.tsx` (`allowFreeText`, `maxSuggestionsWhenEmpty` props; empty-input default suggestions split from typed-filter matches so Enter-key semantics in constrained mode stay unchanged), `frontend/src/components/KeywordPicker.test.tsx` (22 tests: FRONTEND-032-AC-01 through AC-05 added, one FRONTEND-029 test updated to reflect the new "shows all by default" behavior, one capped at `maxSuggestionsWhenEmpty={0}` to isolate typed-filter behavior from the new default-suggestions behavior), `frontend/src/utils/keywordSuggestions.ts` (new — `resolveKeywordSuggestionsLimit`/`KEYWORD_SUGGESTIONS_LIMIT`, split out from `KeywordPicker.tsx` to satisfy `react-refresh/only-export-components`) + `keywordSuggestions.test.ts` (1 test, AC-06), `frontend/src/components/RecommendationControls.tsx` (fetches `getKeywordStats()` on mount, passes `options`/`allowFreeText`/`maxSuggestionsWhenEmpty` to the `Genre & Keyword` `KeywordPicker`, silent-catch on failure) + `RecommendationControls.test.tsx` (49 tests total: FRONTEND-029-AC-11's old "does not fetch" test replaced with FRONTEND-032-AC-07/AC-08 tests, per this spec superseding that behavior), `frontend/src/components/SearchFilter.tsx` (inline field gains `allowFreeText`/`maxSuggestionsWhenEmpty`; modal instance gains `allowFreeText` only, no cap) + `SearchFilter.test.tsx` (19 tests: FRONTEND-032-AC-09/AC-10 added, one FRONTEND-029 test updated since "no suggestions until typed" is no longer accurate for the inline field's new default-suggestions behavior), `RUNBOOK.md` (AC-11, `VITE_KEYWORD_SUGGESTIONS_LIMIT` row added to the Frontend env var table), `CHANGELOG.md` (`[Unreleased]` entry). Verification: `npm test` — 401/401 passing across 15 files; `npm run lint` — clean. Real-browser pass done via a headless-Chrome/puppeteer-core script driving both the List page (inline field + Browse-all modal) and Recommendations page (`Genre & Keyword` mode), confirming: inline fields cap default suggestions at `KEYWORD_SUGGESTIONS_LIMIT` (10, the 67-keyword tracked vocabulary in the dev DB), the modal shows all 67 uncapped, free text is accepted and added as a chip on both surfaces, and an `axe-core` (full ruleset, not just color-contrast) pass in both `light`/`dark` `prefers-color-scheme` across every driven state found zero violations attributable to this spec's changes — the only violations present (`_country`/`_sortLabel` on `SeriesList`, `page-has-heading-one`, the TMDB `_attribution_` footer) were confirmed pre-existing via `git stash` of this spec's component changes and re-running the same audit against the prior code.
**Priority**: Medium
**Depends on**: `frontend_spec_029_searchable_keyword_picker.md`
**Area**: Frontend (`KeywordPicker.tsx`, `RecommendationControls.tsx`, `SearchFilter.tsx`)

## Overview

`frontend_spec_029` gave `KeywordPicker` two mutually-exclusive modes selected by whether an `options` prop is
passed: free-text-only (Recommendations page — type anything, Enter adds it, no suggestions) or
vocabulary-constrained-only (List page — type to filter tracked keywords, click/Enter-on-match to add, nothing
else is accepted). Live use on 2026-08-24 surfaced two real gaps in that split:

1. **Neither field offers both at once.** The Recommendations field can't suggest keywords you already have
   tracked while you type; the List page field can't accept a keyword you know exists on TMDB but haven't
   tracked yet. The user's actual want is a genuine hybrid on **both** surfaces: type-ahead suggestions against
   known keywords, but free text always still accepted.
2. **No "most common" surfacing.** Neither field shows anything until you start typing — there's no way to see
   your most-used keywords up front, which would help someone who doesn't remember exact spelling or just wants
   to browse likely options. `GET /api/v1/series/keywords` (backing `seriesApi.getKeywordStats()`) already
   returns keywords sorted by `seriesCount` descending by default (`series_spec_019_keyword_tracking.md`) — so
   "most common first" is already the order `KeywordStat[]` comes back in; this spec surfaces that order as a
   default suggestion list rather than requiring a query first.

A closely-related third gap, found while designing the fix: `SearchFilter`'s "Browse all keywords" modal
(`frontend_spec_029` Requirement 4) reuses the exact same `KeywordPicker` as the inline field, which today only
shows suggestions once you type something — so the modal doesn't actually let you *browse* anything without
already knowing what to search for, despite its name. This spec fixes that too: the modal shows the full list
by default, capped only by scrolling, not by count.

## Design Decisions

- **The suggestion-count cap is a frontend-only concern**, not a backend one: the full tracked-keyword list is
  already fetched in one call at this app's personal-collection scale (same "fine at this app's scale"
  reasoning `KeywordStatsService`'s own javadoc already established), so capping how many are *displayed* by
  default is pure UI truncation, not a data-volume or performance problem worth a new query parameter.
- **The cap is configurable via a Vite env var**, `VITE_KEYWORD_SUGGESTIONS_LIMIT` (default `10` if unset),
  following this project's existing pattern of env-var-configurable tunables (`app.tmdb.refresh-delay-ms`, etc.)
  — this satisfies "parametrized amount, no redeploy" without building a settings UI, which is a separate,
  bigger idea now tracked in `FUTURE_IDEAS.md` under "Configuration" rather than being built here.
  Undefined/unparseable values fall back to the default rather than erroring.
- **The cap applies only to the empty-query default view**, not to filtered results while typing — once you've
  typed something, every matching option is shown (already effectively bounded by how specific your query is).
- **The "Browse all keywords" modal gets no cap** (shows every tracked keyword, scrollable) — it's the
  dedicated "I want to see everything" surface, so a truncated list there would defeat its own purpose. This is
  a new, explicit `KeywordPicker` prop (`maxSuggestionsWhenEmpty`), not a separate component — omitting the prop
  means "show all," matching the modal's existing "bigger space, same picker" precedent.
- **Free text and suggestion-click are not mutually exclusive on either field now**: pressing Enter always adds
  whatever's currently typed (mirroring `frontend_spec_029`'s existing free-text `Enter` behavior exactly),
  while clicking a suggestion adds that specific option — both paths go through the same `addKeyword`, so
  there's no divergent validation between them.
- **Recommendations page fetch-failure handling deliberately differs from the List page's.** `SearchFilter`
  already shows a scoped inline error if `getKeywordStats()` fails (`frontend_spec_024`), because keywords are
  that field's *only* way to filter. On the Recommendations page, free text is still fully usable without
  suggestions, so a fetch failure there should degrade silently to "no suggestions today" (empty `options`) —
  showing an alarming error for a non-blocking enhancement would be worse than just not showing suggestions.

## Requirement 1: `KeywordPicker` supports free text alongside suggestions

**User story**: As a user picking keywords, I want to see likely matches as I type but still be able to enter
something that isn't in the list, so the field never blocks me.

### FRONTEND-032-AC-01 [AUTO]
**Statement**: `KeywordPicker` shall accept a new optional `allowFreeText?: boolean` prop (default `false`,
preserving `frontend_spec_029`'s existing constrained-only behavior when omitted).

**References**: Component: `frontend/src/components/KeywordPicker.tsx`.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-01: allowFreeText defaults to false (existing constrained behavior unchanged)', () => {
  render(<KeywordPicker id="k" label="Keywords" selected={[]} onChange={vi.fn()}
    options={['spy', 'heist']} />)
  fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'zzz-not-a-match' } })
  fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Enter' })
  expect(screen.queryByText('zzz-not-a-match')).not.toBeInTheDocument()
})
```

**Test Case (Green)**: add the prop to `KeywordPickerProps`, threaded into the `Enter`-key handler in AC-02.

### FRONTEND-032-AC-02 [AUTO]
**Statement**: When `allowFreeText` is `true` and `Enter` is pressed, `KeywordPicker` shall add the current
input's trimmed text as a keyword (exactly as today's free-text-only mode does), regardless of whether it
matches an entry in `options` or whether `options` was supplied at all.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-02: Enter adds free text even with options present, when allowFreeText is true', () => {
  const onChange = vi.fn()
  render(<KeywordPicker id="k" label="Keywords" selected={[]} onChange={onChange}
    options={['spy', 'heist']} allowFreeText />)
  fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'zombie apocalypse' } })
  fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith(['zombie apocalypse'])
})
```

**Test Case (Green)**: change the `Enter` handler so that when `allowFreeText` is true, it calls
`addKeyword(inputValue)` directly (same as the no-`options` path today) instead of only acting on `matches`.

### FRONTEND-032-AC-03 [AUTO]
**Statement**: Clicking a rendered suggestion shall continue to add that specific option (unchanged from
`frontend_spec_029`), regardless of `allowFreeText`'s value.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-03: clicking a suggestion still adds that option when allowFreeText is true', () => {
  const onChange = vi.fn()
  render(<KeywordPicker id="k" label="Keywords" selected={[]} onChange={onChange}
    options={['spy', 'heist']} allowFreeText />)
  fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'sp' } })
  fireEvent.click(screen.getByText('spy'))
  expect(onChange).toHaveBeenCalledWith(['spy'])
})
```

**Test Case (Green)**: no change needed if AC-02's `Enter`-handler change doesn't touch the existing
suggestion-`onClick` path — included as an explicit regression check.

## Requirement 2: Default suggestions show the most common keywords first

**User story**: As a user opening a keyword field, I want to see likely keywords immediately, not just after I
start typing, so I can browse rather than guess.

### FRONTEND-032-AC-04 [AUTO]
**Statement**: `KeywordPicker` shall accept a new optional `maxSuggestionsWhenEmpty?: number` prop. While the
input is empty and `options` is non-empty, it shall render the **first** `maxSuggestionsWhenEmpty` entries of
`options` (excluding any already in `selected`) as suggestions, preserving `options`' own given order.

**Rationale**: `options` already arrives pre-sorted most-common-first (`GET /series/keywords`'s default
`seriesCount`-descending order, `series_spec_019`) — taking a prefix slice is sufficient, no client-side
re-sorting needed.

**References**: Component: `frontend/src/components/KeywordPicker.tsx`, the `matches` computation (currently
only non-empty when `trimmedInput !== ''`).

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-04: shows the first N options as suggestions when input is empty', () => {
  render(<KeywordPicker id="k" label="Keywords" selected={[]} onChange={vi.fn()}
    options={['spy', 'heist', 'crime', 'drama', 'noir']} maxSuggestionsWhenEmpty={3} />)
  expect(screen.getByText('spy')).toBeInTheDocument()
  expect(screen.getByText('heist')).toBeInTheDocument()
  expect(screen.getByText('crime')).toBeInTheDocument()
  expect(screen.queryByText('drama')).not.toBeInTheDocument()
})
```

**Test Case (Green)**: extend the `matches` computation: when `trimmedInput === ''` and `options` is set, derive
suggestions from `options.filter(not already selected).slice(0, maxSuggestionsWhenEmpty)` instead of `[]`.

### FRONTEND-032-AC-05 [AUTO]
**Statement**: When `maxSuggestionsWhenEmpty` is **not** provided and `options` is set, `KeywordPicker` shall
show **all** non-selected `options` as suggestions while the input is empty (no cap) — this is the "browse all"
behavior the modal needs.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-05: shows all options when maxSuggestionsWhenEmpty is omitted', () => {
  const many = Array.from({ length: 15 }, (_, i) => `keyword-${i}`)
  render(<KeywordPicker id="k" label="Keywords" selected={[]} onChange={vi.fn()} options={many} />)
  expect(screen.getByText('keyword-0')).toBeInTheDocument()
  expect(screen.getByText('keyword-14')).toBeInTheDocument()
})
```

**Test Case (Green)**: `slice(0, maxSuggestionsWhenEmpty ?? options.length)`.

### FRONTEND-032-AC-06 [AUTO]
**Statement**: A shared frontend constant shall resolve `VITE_KEYWORD_SUGGESTIONS_LIMIT` from
`import.meta.env`, defaulting to `10` when unset or non-numeric.

**References**: New export, e.g. `frontend/src/components/KeywordPicker.tsx` or a shared constants module —
implementer's choice, following whatever pattern this codebase already uses for a single shared env-derived
constant (check `frontend/src/services/seriesApi.ts`'s own `VITE_API_BASE` handling for precedent).

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-06: falls back to 10 when VITE_KEYWORD_SUGGESTIONS_LIMIT is unset', () => {
  expect(resolveKeywordSuggestionsLimit(undefined)).toBe(10)
  expect(resolveKeywordSuggestionsLimit('15')).toBe(15)
  expect(resolveKeywordSuggestionsLimit('not-a-number')).toBe(10)
})
```

**Test Case (Green)**: implement the resolver function and use it as the default for `RecommendationControls`'
and `SearchFilter`'s inline (non-modal) `maxSuggestionsWhenEmpty` prop.

## Requirement 3: Recommendations page gains suggestions

**User story**: As a user filtering recommendations by keyword, I want to see my own tracked keywords as
suggestions while still being able to type something new, so I'm not stuck guessing spellings for keywords I
already use elsewhere in the app.

### FRONTEND-032-AC-07 [AUTO]
**Statement**: `RecommendationControls` shall fetch `seriesApi.getKeywordStats()` on mount (mirroring
`SearchFilter`'s existing fetch) and pass the resulting keyword names as `options` to its `Genre & Keyword`
mode's `KeywordPicker`, alongside `allowFreeText` and the shared suggestions-limit constant from AC-06.

**References**: Component: `frontend/src/components/RecommendationControls.tsx`. API: `seriesApi.getKeywordStats()`
(`frontend/src/services/seriesApi.ts`, already exists).

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-07: fetches keyword stats and offers them as suggestions', async () => {
  vi.mocked(seriesApi.getKeywordStats).mockResolvedValue([
    { name: 'spy', seriesCount: 3, averagePersonalRating: 4 },
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('Genre & Keyword'))
  await waitFor(() => expect(screen.getByText('spy')).toBeInTheDocument())
})
```

**Test Case (Green)**: add the `useEffect`/state pair, pass `options`/`allowFreeText` through.

### FRONTEND-032-AC-08 [AUTO]
**Statement**: If `getKeywordStats()` rejects, `RecommendationControls` shall leave the `Genre & Keyword`
field's `options` empty (free text remains fully usable) without rendering any visible error — per this spec's
Design Decisions, a failed *enhancement* fetch on an already-functional free-text field should degrade silently,
unlike `SearchFilter`'s stricter treatment where keywords are the field's only input method.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-08: silently degrades to free-text-only on fetch failure', async () => {
  vi.mocked(seriesApi.getKeywordStats).mockRejectedValue(new Error('fail'))
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('Genre & Keyword'))
  await waitFor(() => expect(seriesApi.getKeywordStats).toHaveBeenCalled())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  const input = screen.getByLabelText('Keywords')
  fireEvent.change(input, { target: { value: 'still works' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByText('still works')).toBeInTheDocument()
})
```

**Test Case (Green)**: `.catch(() => undefined)` (or equivalent), leaving `keywordOptions` at its initial `[]`.

## Requirement 4: List page field and modal both gain free text; modal shows everything

**User story**: As a user filtering my tracked series, I want the keyword field to accept a keyword I know
exists even if it's not yet in my tracked vocabulary's suggestion list, and I want "Browse all keywords" to
actually show me everything.

### FRONTEND-032-AC-09 [AUTO]
**Statement**: `SearchFilter`'s inline `Keywords` field shall pass `allowFreeText` and the shared
suggestions-limit constant (AC-06) to its `KeywordPicker`, in addition to its existing `options`.

**References**: Component: `frontend/src/components/SearchFilter.tsx`, the inline (non-modal) `KeywordPicker`
instance.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-09: inline List-page field accepts free text', () => {
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  const input = screen.getByPlaceholderText(/type to filter tracked keywords/i)
  fireEvent.change(input, { target: { value: 'brand-new-keyword' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByText('brand-new-keyword')).toBeInTheDocument()
})
```

**Test Case (Green)**: add the two props to the inline instance.

### FRONTEND-032-AC-10 [AUTO]
**Statement**: `SearchFilter`'s "Browse all keywords" modal's `KeywordPicker` instance shall also pass
`allowFreeText`, but shall **omit** `maxSuggestionsWhenEmpty` so every tracked keyword is shown by default
(AC-05), fixing the modal's previous behavior of showing nothing until a query was typed.

**References**: Component: `frontend/src/components/SearchFilter.tsx`, the modal's `KeywordPicker` instance.

**Test Case (Red)**:
```typescript
it('FRONTEND-032-AC-10: modal shows the full tracked keyword list with no query typed', async () => {
  vi.mocked(seriesApi.getKeywordStats).mockResolvedValue(
    Array.from({ length: 15 }, (_, i) => ({ name: `kw-${i}`, seriesCount: 15 - i, averagePersonalRating: null })),
  )
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  fireEvent.click(await screen.findByText('Browse all keywords'))
  expect(await screen.findByText('kw-0')).toBeInTheDocument()
  expect(screen.getByText('kw-14')).toBeInTheDocument()
})
```

**Test Case (Green)**: modal instance passes `allowFreeText` but not `maxSuggestionsWhenEmpty`.

## Requirement 5: Documentation

### FRONTEND-032-AC-11 [MANUAL — visual/config check]
**Statement**: `RUNBOOK.md`'s environment variables table shall document `VITE_KEYWORD_SUGGESTIONS_LIMIT`
alongside this project's other env-var-configurable tunables, including its default (`10`) and what it
controls.

**Verification**: reviewer confirms the RUNBOOK entry reads clearly and matches the actual default in code.

## Cross-references

| Reference | Relationship |
|---|---|
| `frontend_spec_029_searchable_keyword_picker.md` | Establishes `KeywordPicker`'s existing dual-mode shape this spec extends into a true hybrid |
| `series_spec_019_keyword_tracking.md` | `GET /series/keywords`'s default `seriesCount`-descending order, relied on by Requirement 2 |
| `frontend_spec_024_keyword_tracking.md` | `SearchFilter`'s existing stricter error-handling precedent, contrasted with this spec's Recommendations-page silent-degrade choice |
| `FUTURE_IDEAS.md` "Configuration" | The deferred settings-menu idea this spec deliberately does *not* build, in favor of an env var |

## Acceptance Criteria Summary

- [x] FRONTEND-032-AC-01: `allowFreeText` prop defaults to `false`
- [x] FRONTEND-032-AC-02: `Enter` adds free text when `allowFreeText` is `true`, regardless of matches
- [x] FRONTEND-032-AC-03: clicking a suggestion still adds that option when `allowFreeText` is `true`
- [x] FRONTEND-032-AC-04: empty input shows first `maxSuggestionsWhenEmpty` options as suggestions
- [x] FRONTEND-032-AC-05: omitting `maxSuggestionsWhenEmpty` shows all options when empty
- [x] FRONTEND-032-AC-06: `VITE_KEYWORD_SUGGESTIONS_LIMIT` resolves with a default of `10`
- [x] FRONTEND-032-AC-07: Recommendations page fetches keyword stats and offers them as suggestions
- [x] FRONTEND-032-AC-08: Recommendations page degrades silently (no error banner) on fetch failure
- [x] FRONTEND-032-AC-09: List page inline field accepts free text
- [x] FRONTEND-032-AC-10: "Browse all keywords" modal shows the full list by default
- [x] FRONTEND-032-AC-11: RUNBOOK documents `VITE_KEYWORD_SUGGESTIONS_LIMIT`
