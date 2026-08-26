# Tooling Spec 004: Shared Helpers for `TmdbClient`/`OmdbClient`

**Status**: Not started
**Priority**: Low
**Depends on**: none — pure internal refactor of already-implemented classes
**Area**: Backend (`client/`)

## Overview

`TmdbClient.java` (531 lines) and `OmdbClient.java` (155 lines) each hand-roll their own private
static JSON-scalar-coercion helpers and their own "blank API key → throw, wrap
`RestClientException` → throw" guard logic, even though both classes exist for the same reason
(a thin `RestClient` wrapper around one external HTTP API) and the duplicated logic is close to
byte-identical in places. This was flagged during a codebase survey on 2026-08-26 as a low-stakes,
low-priority cleanup — real duplication, but small in scope (~20-30 lines) and previously accepted
as "deliberate mirroring" per `TmdbClient`'s own class Javadoc. This spec extracts the genuinely
shared logic into a new `ExternalApiSupport` class, while explicitly preserving each client's
distinct behavior where it differs.

**Confirmed via direct comparison of both files** (not assumed):
- `TmdbClient.toInteger(Object)`/`toBigDecimal(Object)` handle both `Number` and `String` inputs.
  `OmdbClient.parseBigDecimal(Object)` only handles the `String` case (via its own `str()` first)
  — but every real value it receives is already a JSON string (OMDb always returns rating fields
  as strings, never numbers), so `TmdbClient`'s `Number`-handling branch is unreachable dead code
  for `OmdbClient`'s inputs, not a behavior gap. `TmdbClient`'s versions are a strict superset.
- `TmdbClient.str(Object)` trims and returns `null` for a blank value. `OmdbClient.str(Object)`
  does the same, **plus** treats the literal `"N/A"` (case-insensitive) as absent
  (`SERIES-005-AC-10`) — this extra step is genuine OMDb-specific business behavior, not
  duplicated logic, and must not be lost or generalized into the shared helper.
- Both classes' `fetch(...)` wrapper does: (1) throw `ExternalServiceException` with a
  service-named log line if the api key is blank, (2) call `RestClient`, (3) catch
  `RestClientException` and rethrow as `ExternalServiceException`. `TmdbClient` additionally
  normalizes a `null` response body to `Map.of()` — `OmdbClient` does not (it checks
  `body == null` itself in `ratingsForImdbId`). Neither existing Spock spec
  (`OmdbClientSpec.groovy`, `TmdbClientSpec.groovy`) asserts exact exception message text —
  confirmed by grep, only `OmdbClientSpec`'s `imdbId`-not-found test checks message *content*
  (`ex.message.contains("tt9999999")`, on a different exception entirely,
  `EntityNotFoundException`, not affected by this spec) — so consolidating the guard/wrap message
  construction is safe.

## Design Decisions

- **`ExternalApiSupport` is a plain final class of static methods**, matching the existing
  `str`/`toInteger`/`toBigDecimal` methods' own style (private statics today) — not a Spring bean,
  since it holds no state and needs no DI.
- **`OmdbClient.str()` stays as a thin wrapper**, not replaced: it calls
  `ExternalApiSupport.str(value)` first, then applies its own `"N/A"` check on the result. This
  keeps the OMDb-specific business rule visible in `OmdbClient` itself rather than baking a
  single external API's quirk into a shared helper both clients call.
- **The api-key guard becomes a shared method parameterized by service name and the Spring
  property key**, e.g. `ExternalApiSupport.requireApiKey(String apiKey, String serviceName,
  String propertyKey)`, thrown as `ExternalServiceException("<serviceName> API key is not
  configured")` and logged as `"<serviceName> call requested but <propertyKey> is not
  configured"` — matching each client's existing message shape (`"TMDB API key is not
  configured"` / `"OMDb API key is not configured"`), just constructed once instead of twice.
- **The `RestClientException` → `ExternalServiceException` wrap becomes a shared method** taking
  the caller's message (`"TMDB request failed"` / `"OMDb request failed"`) and the caught
  exception, so each client keeps its own distinct message text.
- **`TmdbClient`'s null-body → `Map.of()` normalization is not shared** — it's specific to how
  `TmdbClient`'s many callers consume the result (never null-checking); `OmdbClient` has exactly
  one caller (`ratingsForImdbId`) that already null-checks explicitly, so forcing that behavior
  onto `OmdbClient` would change what `ratingsForImdbId` currently distinguishes (`body == null`
  vs. `isFalseResponse(body)`, two different reasons for "no result").

---

## Requirement 1: Shared JSON scalar coercion helpers

**User story**: As a developer maintaining both external API clients, I want one shared
implementation of "parse this JSON value into an Integer/BigDecimal/String," so a future bug fix
or edge case doesn't need to be applied twice.

### TOOLING-004-AC-01 [AUTO]
**Statement**: A new `ExternalApiSupport` class shall provide `toInteger(Object)`,
`toBigDecimal(Object)`, and `str(Object)` static methods, with behavior identical to
`TmdbClient`'s current private implementations (`Number` or `String` input; `str` trims and
returns `null` for blank, with no `"N/A"` handling).

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java`
(existing `toInteger`/`toBigDecimal`/`str` private statics, lines 488–530).

**Test Case (Red)**:
```groovy
def "TOOLING-004-AC-01: toInteger/toBigDecimal/str match TmdbClient's existing semantics"() {
    expect: "Number and String inputs both coerce correctly"
        ExternalApiSupport.toInteger(42) == 42
        ExternalApiSupport.toInteger("42") == 42
        ExternalApiSupport.toInteger("not a number") == null
        ExternalApiSupport.toBigDecimal(8.4d) == BigDecimal.valueOf(8.4d)
        ExternalApiSupport.toBigDecimal("8.4") == new BigDecimal("8.4")
        ExternalApiSupport.str("  hello  ") == "hello"
        ExternalApiSupport.str("   ") == null
        ExternalApiSupport.str(null) == null
}
```

**Test Case (Green)**: move the three methods from `TmdbClient` into the new class unchanged.

---

### TOOLING-004-AC-02 [AUTO]
**Statement**: `TmdbClient` shall call `ExternalApiSupport.toInteger`/`toBigDecimal`/`str` in
place of its own private copies. Every existing `TmdbClientSpec.groovy` test shall pass
unmodified.

**References**: `TmdbClient.java`'s ~15 call sites of `toInteger`/`toBigDecimal`/`str`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: run the existing `TmdbClientSpec.groovy` suite unmodified; all tests stay
green.

---

### TOOLING-004-AC-03 [AUTO]
**Statement**: `OmdbClient`'s `str(Object)` shall delegate to `ExternalApiSupport.str(Object)` as
its base case, then additionally treat a case-insensitive `"N/A"` result as `null`
(`SERIES-005-AC-10`, unchanged behavior).

**References**: `OmdbClient.java`'s existing `str(Object)` (lines 145–154).

**Test Case (Red)**:
```groovy
def "TOOLING-004-AC-03: OmdbClient.str still treats N/A and blank as absent"() {
    expect:
        OmdbClient.str("N/A") == null
        OmdbClient.str("n/a") == null
        OmdbClient.str("  ") == null
        OmdbClient.str("8.4") == "8.4"
}
```

**Test Case (Green)**: `str(value)` becomes `NOT_AVAILABLE.equalsIgnoreCase(s) ? null : s` applied
to `ExternalApiSupport.str(value)`.

---

### TOOLING-004-AC-04 [AUTO]
**Statement**: `OmdbClient.parseBigDecimal(Object)` shall use `ExternalApiSupport.toBigDecimal` on
the already-`"N/A"`-normalized string from `OmdbClient.str`, preserving today's exact behavior:
`null` for an absent/blank/`"N/A"` value, `null` for an unparseable value, the parsed
`BigDecimal` otherwise. Every existing `OmdbClientSpec.groovy` test shall pass unmodified.

**References**: `OmdbClient.java`'s existing `parseBigDecimal(Object)` (lines 108–118).

**Test Case (Red)**: none new — regression guard, covered by `OmdbClientSpec.groovy`'s existing
`imdbRating`-parsing tests.
**Test Case (Green)**: run the existing `OmdbClientSpec.groovy` suite unmodified; all tests stay
green.

---

## Requirement 2: Shared API-key guard and request-failure wrapping

**User story**: As a developer adding a third external API client in the future, I want a proven,
shared "guard the api key, wrap transport failures" pattern to reuse, so I don't have to
re-derive or re-copy it a third time.

### TOOLING-004-AC-05 [AUTO]
**Statement**: `ExternalApiSupport` shall provide `requireApiKey(String apiKey, String
serviceName, String propertyKey)`, throwing `ExternalServiceException("<serviceName> API key is
not configured")` and logging an error naming `propertyKey` when `apiKey` is `null` or blank;
returning normally (no side effect) otherwise.

**References**: `TmdbClient.fetch(UnaryOperator)` (lines 334–346), `OmdbClient.ratingsForImdbId`
(lines 67–71) — the two existing, near-identical guard blocks being replaced.

**Test Case (Red)**:
```groovy
def "TOOLING-004-AC-05: requireApiKey throws for blank/null, no-ops for a real value"() {
    when: "the key is blank"
        ExternalApiSupport.requireApiKey("", "TMDB", "app.tmdb.api-key")
    then:
        thrown(ExternalServiceException)

    when: "the key is present"
        ExternalApiSupport.requireApiKey("real-key", "TMDB", "app.tmdb.api-key")
    then: "no exception"
        noExceptionThrown()
}
```

**Test Case (Green)**: extract the method; both clients call it before making a request.

---

### TOOLING-004-AC-06 [AUTO]
**Statement**: `ExternalApiSupport` shall provide `wrapFailure(RestClientException cause, String
message)` returning a new `ExternalServiceException(message, cause)`, used by both clients'
`catch (RestClientException e)` blocks in place of constructing the exception inline.

**References**: `TmdbClient.fetch` (line 344), `OmdbClient.fetch` (line 100).

**Test Case (Red)**:
```groovy
def "TOOLING-004-AC-06: wrapFailure preserves the cause and message"() {
    given:
        def cause = new RestClientException("boom")

    when:
        def wrapped = ExternalApiSupport.wrapFailure(cause, "TMDB request failed")

    then:
        wrapped.message == "TMDB request failed"
        wrapped.cause == cause
}
```

**Test Case (Green)**: extract the method; both clients' catch blocks call it and `throw` the
result.

---

### TOOLING-004-AC-07 [AUTO]
**Statement**: After `TOOLING-004-AC-01`–`AC-06` are applied, every existing
`OmdbClientSpec.groovy` and `TmdbClientSpec.groovy` test shall pass unmodified — this spec changes
no public method signature, thrown exception type, or successful-response result on either
client.

**References**: `backend/src/test/groovy/uk/co/stefirby/seriestracker/client/{OmdbClientSpec,TmdbClientSpec}.groovy`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: `gradlew.bat test` — full Spock suite green, zero test file changes needed
for `OmdbClientSpec.groovy`/`TmdbClientSpec.groovy`.

---

## Cross-References

| This spec | Source |
|---|---|
| `TmdbClient.java`'s existing `toInteger`/`toBigDecimal`/`str`/`fetch` | current implementation, no spec — predates the EARS convention on this class |
| `OmdbClient.java`'s existing `str`/`parseBigDecimal`/`fetch`, `"N/A"`-as-absent rule | `series_spec_005_omdb_lookup.md` (`SERIES-005-AC-10`) |
| `ExternalServiceException` | `backend/src/main/java/uk/co/stefirby/seriestracker/exception/ExternalServiceException.java` |

---

## Acceptance Criteria Summary

- [ ] TOOLING-004-AC-01: `ExternalApiSupport.toInteger`/`toBigDecimal`/`str` extracted from `TmdbClient`
- [ ] TOOLING-004-AC-02: `TmdbClient` uses the shared helpers, existing tests unmodified
- [ ] TOOLING-004-AC-03: `OmdbClient.str` delegates to the shared helper, keeps its own `"N/A"` rule
- [ ] TOOLING-004-AC-04: `OmdbClient.parseBigDecimal` uses the shared `toBigDecimal`, existing tests unmodified
- [ ] TOOLING-004-AC-05: shared `requireApiKey` guard, used by both clients
- [ ] TOOLING-004-AC-06: shared `wrapFailure` transport-error wrapper, used by both clients
- [ ] TOOLING-004-AC-07: full regression guard — both existing Spock spec files pass unmodified
