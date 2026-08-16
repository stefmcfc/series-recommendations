# EARS Requirements Format

This project uses EARS (Easy Approach to Requirements Syntax) to write clear, testable requirements. All specs use EARS format with explicit references, verification markers, and traceability to tests.

> **Scope note**: this convention applies from `series_spec_005`/`frontend_spec_003` onward. The existing specs (`series_spec_001`–`004`, `frontend_spec_001`–`002`) predate it and use an older `SH-`/`IF-`/`MA-`/`SN-` ID scheme — they are not being retrofitted (they're already implemented and the IDs are referenced from their own test files). Don't renumber or rewrite them; just don't use their scheme for new specs.

## EARS Patterns

Every requirement statement follows one of the five canonical EARS patterns. Use the simplest one that captures the requirement — complex ACs may combine clauses (When … , if … , then …).

| Pattern | Template | Example |
|---|---|---|
| Ubiquitous | The `<system>` shall `<response>` | The `SeriesEntity` shall default `status` to `BACKLOG` on creation |
| Event-driven | When `<trigger>`, the `<system>` shall `<response>` | When `GET /api/v1/series` is requested, the `SeriesController` shall return all series as JSON |
| State-driven | While `<state>`, the `<system>` shall `<response>` | While a fetch is in flight, the `SeriesList` component shall display a loading spinner |
| Unwanted behaviour | If `<condition>`, then the `<system>` shall `<response>` | If `seriesApi.getAll()` rejects, then the `SeriesList` component shall display an error message with a Retry button |
| Optional feature | Where `<feature is present>`, the `<system>` shall `<response>` | Where an `onSeriesClick` handler is provided, the `SeriesList` component shall call it with the clicked series' `id` |

**Name the system concretely** — the component, endpoint, service class, or entity. Never a bare "the system".

## Reference IDs

Every acceptance criterion gets a unique, human-readable ID in the form:

```
<AREA>-<SPEC-NUMBER>-AC-<NN>
```

- `AREA` is `SERIES` for backend specs, `FRONTEND` for frontend specs, or `TOOLING` for repo-wide tooling/CI/build-config specs that aren't backend or frontend feature work — matching the spec file's own prefix (`series_spec_005_*.md` → `SERIES-005`, `frontend_spec_003_*.md` → `FRONTEND-003`, `tooling_spec_001_*.md` → `TOOLING-001`).
- `NN` is a two-digit sequence number within that spec, assigned in the order requirements appear.

Example: `SERIES-005-AC-01`, `FRONTEND-003-AC-07`.

This reuses the numbering the spec files already carry rather than inventing a separate stage system — this project doesn't work in predefined stages, so an ID scheme built around them (`STAGE-N-AC-NN`) wouldn't fit. A spec's own filename is already the short, meaningful "what's being changed" label (mirroring how branches are named — `feature/<slug>`), so the ID just needs to be traceable back to it.

### Conversion rules

1. **Reference IDs are immutable.** Once assigned, never renumber, merge, or delete an ID — other specs, tests, and cross-reference tables may point to it.
2. **Splitting**: if one requirement contains several distinct obligations, use sub-letters under the same ID (`SERIES-005-AC-01a`, `SERIES-005-AC-01b`) rather than new numbers.
3. **No weakening**: every obligation in a requirement's prose must survive into its AC statement(s). If a requirement is ambiguous, resolve toward the stricter reading and note the decision in the spec.

## Verification markers

Every AC carries a marker immediately after its reference ID, stating how it's actually verified:

- `[AUTO]` — verified by an automated test (Spock spec, Vitest test) or the build pipeline itself (compilation, CI).
- `[MANUAL]` — verified by human review. A `[MANUAL]` AC must state *how* it's checked (e.g. "visual check in browser against the design note above") and, where one exists, note the route to automating it later.

`[AUTO]` should be the overwhelming majority in this project — both backend (Spock) and frontend (Vitest + RTL) support testing almost everything. Treat any new `[MANUAL]` as something to justify, not a default.

## Structure of a spec

Each `.claude/specs/*.md` file has:

1. **Header**: title, `Status` (Not started / In progress / Implemented, with a pointer to implementing files once true), `Priority`, `Depends on`, backend/frontend area.
2. **Overview**: one paragraph — what this delivers and why.
3. **Requirements**: grouped "Requirement N" sections, each with a one-line user story and its EARS-format acceptance criteria (ID + `[AUTO]`/`[MANUAL]` marker + statement).
4. **Cross-references**: a table linking to the specific endpoints, types, or specs this one depends on or contracts against.
5. **TDD test case sketches** (red, before implementation) in the target framework — Spock `given/when/then` for backend, Vitest + RTL for frontend — one per AC, named after its reference ID.
6. **Acceptance Criteria Summary**: a flat checklist mirroring every AC above, unchecked (`- [ ]`) until implemented.

### Template

```markdown
### SERIES-005-AC-01 [AUTO]: Fetch Series List
**Statement**: When `GET /api/v1/series` is requested, the `SeriesController` shall return all series as `{ data: Series[], count: number }`.

**Rationale**: Users need to see their full collection when opening the app.

**References**:
- Type: `SeriesDto` (backend `dto/`), `Series` (frontend `src/types/series.ts`)
- Related: `SERIES-005-AC-02` (empty-list case)

**Test Case (Red)**:
\```groovy
def "SERIES-005-AC-01: returns all series as JSON"() {
    given: "two series exist in the repository"
        // ...

    when: "GET /api/v1/series is requested"
        // ...

    then: "the response is 200 with both series in data, count 2"
        // ...
}
\```

**Test Case (Green)**: implement the controller/service until the spec above passes.
```

## Mapping to Spock

- **While/Where** (state, preconditions) → `given:` block
- **When** (trigger) → `when:` block
- **shall** (response) → `then:` assertions
- **If/then** (unwanted behaviour) → `when:` + `then:` with `thrown(...)` or error-status assertions

A ubiquitous requirement typically becomes a `then:`/`expect:`-only spec.

### Block labels

Every `given:`/`when:`/`then:`/`expect:`/`and:` block in a Spock spec carries a string label describing that step in plain language — bare, unlabelled blocks aren't used. Where a block maps directly onto an EARS clause (see table above), the label echoes that clause's own wording, so the spec reads as the requirement's sentence split across blocks:

- `given "<state>":` — mirrors a While/Where clause, or states setup when the AC has no explicit precondition.
- `when "<trigger>":` — mirrors the When clause.
- `then "<response>":` — mirrors the shall clause.
- `and "<...>":` — a further assertion or action within the same phase; label it independently rather than leaving it bare.
- `expect "<response>":` — collapses when+then into one block for a direct, side-effect-free assertion; still labelled.

Code beneath a labelled block is indented one level deeper than the label, so the label reads as a heading for the statements under it:

```groovy
def "SERIES-005-AC-01: returns all series as JSON"() {
    given: "two series exist in the repository"
        repository.save(new SeriesEntity(title: "Show A"))
        repository.save(new SeriesEntity(title: "Show B"))

    when: "GET /api/v1/series is requested"
        def response = client.get().uri("/api/v1/series").exchange()

    then: "the response is 200 with both series in data"
        response.expectStatus().isOk()

    and: "count reflects the total"
        response.expectBody().jsonPath("$.count").isEqualTo(2)
}
```

This applies to every Spock spec in `backend/src/test/groovy/`, including the existing ones.

## Why EARS + TDD together

1. **Traceability**: every test corresponds to a requirement ID.
2. **Clarity**: no ambiguity about what "done" means.
3. **Testability**: EARS statements are inherently testable.
4. **Reviews**: reviewers can verify against requirement IDs.

## Naming convention for frontend test files

Group tests in one file, using `describe` blocks named after the requirement ID:

```typescript
describe('FRONTEND-003-AC-01: fetch on mount', () => { /* tests */ })
describe('FRONTEND-003-AC-02: loading state', () => { /* tests */ })
```

## When writing a new spec

Always include:
1. Requirement statements in EARS format, each with a `<AREA>-<NNN>-AC-<NN>` ID and `[AUTO]`/`[MANUAL]` marker
2. References to backend/frontend types, endpoints, and related specs
3. An Acceptance Criteria Summary checklist
4. Test case sketches showing red/green structure, named after the requirement ID

The `.claude/skills/ears-spec` skill packages this workflow — use it when drafting a new spec so the structure stays consistent.
