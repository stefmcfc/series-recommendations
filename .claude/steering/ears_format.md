# EARS Requirements Format

This project uses EARS (Easy Approach to Requirements Syntax) to write clear, testable requirements. All specs use EARS format with explicit references and traceability.

## EARS Format Overview

EARS is a structured, lightweight syntax that makes requirements unambiguous and testable. Every requirement follows one of these patterns:

### Pattern 1: Shall Statements (Mandatory)
```
The [system/component] shall [action]
```
- Used for core functionality that must be implemented
- Example: "The SeriesList component shall fetch all series from GET /api/v1/series"
- AC prefix: `SH-` (Shall)

### Pattern 2: Should Statements (Desirable)
```
The [system/component] should [action]
```
- Used for desired but not critical features
- Example: "The SeriesList component should display a loading spinner while fetching"
- AC prefix: `SH-` (Should; note: treated as lower priority but still tested)

### Pattern 3: May Statements (Optional)
```
The [system/component] may [action]
```
- Optional enhancements; nice-to-have
- Example: "The SeriesList may support sorting by rating"
- AC prefix: `MA-` (May; test if implemented, skip if time-constrained)

### Pattern 4: If/When Statements (Conditional)
```
If [condition], the [system/component] shall [action]
When [trigger], the [system/component] shall [action]
```
- Conditional logic or event-driven behaviour
- Example: "If a series has a null personalRating, the SeriesList shall display '—' in the rating column"
- AC prefix: `IF-` (If/When)

### Pattern 5: Shall Not Statements (Prohibitive)
```
The [system/component] shall not [action]
```
- Explicitly forbidden behaviours (security, data integrity, etc.)
- Example: "The SeriesForm shall not submit if title is blank"
- AC prefix: `SN-` (Shall Not)

---

## Structure of a Requirement

Each requirement has:

1. **Unique ID**: `SH-001`, `IF-002`, `MA-003`, etc.
2. **Statement**: One of the EARS patterns above
3. **Rationale** (optional): Why this requirement exists
4. **References**: Links to backend specs, acceptance criteria, tests, or related requirements
5. **Test Case**: How this will be verified (red/green TDD)

### Template

```markdown
### SH-001: Fetch Series List
**Statement**: The SeriesList component shall fetch all series from GET /api/v1/series on mount.

**Rationale**: Users need to see their full collection when opening the app.

**References**:
- Backend: Spec 002 - `GET /api/v1/series` returns `{ data: Series[], count: number }`
- Type: `src/types/series.ts` → `Series[]`
- Service: `src/services/seriesApi.ts` → `seriesApi.getAll()`

**Test Case (Red)**:
```
it('should fetch and display series on mount', () => {
  // Mock API to return 2 series
  vi.mock('seriesApi', () => ({ getAll: vi.fn(() => Promise.resolve([...]) }));

  // Test fails because component doesn't fetch yet
  render(<SeriesList />);
  expect(screen.getByText('Show 1')).toBeInTheDocument();
});
```

**Test Case (Green)**:
```
// Implement component to call seriesApi.getAll() in useEffect
// Pass fetched data to render
// Test now passes
```
```

---

## Why EARS + TDD Together?

1. **Traceability**: Every test corresponds to a requirement ID (SH-001, IF-002, etc.)
2. **Clarity**: No ambiguity about what "done" means
3. **Testability**: EARS statements are inherently testable
4. **Reference**: Tests and requirements are cross-linked, making debugging easier

Example:
```
SH-001 (Requirement) → SH-001.test.tsx (Test) → seriesApi.getAll() (Implementation)
```

---

## Acceptance Criteria Format

Each spec includes acceptance criteria in EARS format, e.g.:

```markdown
## Acceptance Criteria

**SH-001**: The SeriesList component shall display all fetched series.
- [ ] API call is made on mount
- [ ] Loading state shown while fetching
- [ ] Series are rendered with title, status, rating visible
- [ ] No series shown until fetch completes

**IF-002**: If the API returns an empty list, the SeriesList shall display "No series yet".
- [ ] Empty state message renders
- [ ] Add Series button is visible
- [ ] No loading spinner shown

**SN-003**: The SeriesList shall not display sensitive data (e.g., user IDs, auth tokens).
- [ ] Component receives only Series DTO (public fields)
- [ ] No internal IDs logged to console
```

---

## Cross-Referencing in Specs

When writing a spec, always reference:

1. **Backend Contract**: Which API endpoint? What's the response shape?
2. **Types**: Which TypeScript interfaces are involved?
3. **Related Requirements**: Which other SH/IF/MA IDs does this depend on?
4. **Tests**: Which test cases verify this requirement?

Example in a spec:

```markdown
### SH-002: Display Series Data
**Statement**: The SeriesList component shall render each series's title, status, and IMDb rating.

**References**:
- Backend Spec 002: GET /api/v1/series response contract
- Type: `Series` interface (src/types/series.ts)
  - id: string
  - title: string
  - status: SeriesStatus
  - imdbRating: number | null
- Depends on: SH-001 (data must be fetched first)
- Related: SH-003 (error handling if fetch fails)

**Test**: SeriesListItem.test.tsx → SH-002.test
```

---

## Naming Convention for Test Files

Link requirements to tests by ID:

```
src/components/SeriesList.tsx
src/components/__tests__/SeriesList.SH-001.test.tsx   (Fetch on mount)
src/components/__tests__/SeriesList.SH-002.test.tsx   (Render data)
src/components/__tests__/SeriesList.IF-003.test.tsx   (Empty state)
src/components/__tests__/SeriesList.SN-004.test.tsx   (No sensitive data)
```

Or simpler: Group all tests in one file and use describe blocks with IDs:

```typescript
describe('SeriesList', () => {
  describe('SH-001: Fetch on mount', () => { /* tests */ });
  describe('SH-002: Render data', () => { /* tests */ });
  describe('IF-003: Empty state', () => { /* tests */ });
  describe('SN-004: No sensitive data', () => { /* tests */ });
});
```

---

## Benefits of This Approach

✅ **Clarity**: No ambiguity about requirements
✅ **Traceability**: Requirements ↔ Tests ↔ Code
✅ **Scalability**: Easy to add new features without breaking old tests
✅ **Reviews**: Reviewers can verify against requirement IDs
✅ **Handoff**: Future work understands *why* code exists

---

## Quick Reference: EARS Patterns

| Pattern | Prefix | Example | Use When |
|---------|--------|---------|----------|
| Shall | SH- | "The component shall fetch data" | Mandatory requirement |
| Should | SH- | "The component should show loading" | Desired, best-practice |
| May | MA- | "The component may support sorting" | Optional enhancement |
| If/When | IF- | "If title is blank, shall not submit" | Conditional logic |
| Shall Not | SN- | "The component shall not expose secrets" | Prohibited behaviour |

---

## Example: Full Requirement with EARS + TDD

```markdown
### SH-005: Error Handling
**Statement**: If the API returns an error, the SeriesList component shall display an error message to the user.

**Rationale**: Users need feedback when something goes wrong, not a silent failure.

**References**:
- Backend Spec 002: GET /api/v1/series can return 500 Internal Server Error
- Type: `ApiError` interface (src/types/api.ts)
- Service: `src/services/seriesApi.ts` includes error handling wrapper
- Related SH-001 (fetch on mount), IF-004 (retry logic)

**Acceptance Criteria**:
- [ ] When fetch fails, loading state is cleared
- [ ] Error message displays: "Failed to load series. Please try again."
- [ ] Retry button is shown
- [ ] Stack trace is NOT shown to user (logged to console only)

**Test (Red)**:
```typescript
it('should show error message if fetch fails', () => {
  vi.spyOn(seriesApi, 'getAll').mockRejectedValue(new Error('Network error'));
  render(<SeriesList />);

  await waitFor(() => {
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
// Test FAILS because component doesn't handle errors yet
```

**Test (Green)**:
```typescript
// Implement error state in component
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  seriesApi.getAll()
    .catch(err => setError('Failed to load series. Please try again.'));
}, []);

// Render error message conditionally
if (error) return <div className="error">{error}</div>;

// Test now PASSES
```
```

---

## When Writing a New Spec

Always include:
1. **Requirement Statement** (EARS format with ID)
2. **References** to backend, types, related specs
3. **Acceptance Criteria** (checkboxes, each tied to a requirement ID)
4. **Test template** showing red/green structure with requirement ID in test name

The `.claude/skills/ears-spec` skill packages this workflow — use it when drafting a new spec so the structure stays consistent.
