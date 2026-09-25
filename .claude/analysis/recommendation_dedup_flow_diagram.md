# Recommendation Sourcing/Dedup Flow — Diagram

**Status**: Standalone visual reference, grounded directly against the code on 2026-09-24, corrected 2026-09-25 (`series_spec_068`'s configurable `SourceOrderComparator.forStrategy(criteria)` and the pre-existing `RecommendationPoolCache` were both missing from the original pass — see the two inline fixes and the updated Reading notes). Not yet cross-referenced from `scoring_weight_recommendations.md` (Section 0/0b cover the same flow in prose, and now also cover both of these) — link the two later once this is confirmed useful.

Covers: which class/method calls which, and exactly where a call crosses into TMDB's API or the local database, for the two sourcing paths that feed `RecommendationService.doRecommend` — "Use My Series" (`sourceAndFilterFromPool`) vs. the three direct-TMDB modes (`sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`, all funneled through `sourceWithBackfill`).

## Sequence diagram

```mermaid
sequenceDiagram
    participant RS as RecommendationService
    participant Src as RecommendationSourcingService
    participant Dedup as RecommendationDeduplicationService
    participant Tmdb as TmdbClient
    participant TmdbApi as TMDB API (external HTTP)
    participant SeriesRepo as SeriesRepository
    participant IgnoredRepo as IgnoredSeriesRepository
    participant Db as Database (SQLite/Postgres)

    Note over RS: doRecommend(criteria, limit)

    alt sourceMode = useMySeries ("Use My Series")
        RS->>RS: sourceAndFilterFromPool(criteria, limit)
        RS->>Src: sourceFromPool(criteria, limit)
        Note right of Src: RecommendationPoolCache.getOrCompute(key, ...)<br/>key = (seriesIds, limit) only — TTL 10min, max 50 entries.<br/>Cache hit skips everything below down to "Src-->>RS" entirely.
        Src->>Src: resolveSourcePool(criteria)<br/>(sorted by SourceOrderComparator.forStrategy(criteria), capped to maxSourceSeries)
        loop for each source series in pool
            Src->>Tmdb: findTvIdByImdbId(source.imdbId)
            Tmdb->>TmdbApi: GET /find/{imdb_id}?external_source=imdb_id
            Src->>Tmdb: recommendations(tmdbId) [or similar(tmdbId) if empty]
            Tmdb->>TmdbApi: GET /tv/{tmdbId}/recommendations (or /similar)
        end
        opt distinct title-based candidates < limit
            Src->>Tmdb: discover(genreIds, [], defaultSort, NONE)<br/>(genre-frequency supplement)
            Tmdb->>TmdbApi: GET /discover/tv
        end
        Src-->>RS: List~RawCandidate~ (raw, un-deduped) — cached under key above
        Note over RS: capped to maxCandidates (50) BEFORE dedup —<br/>bounds worst-case externalIds call volume for this mode only
        RS->>Dedup: dedupeAndExclude(capped, SourceOrderComparator.forStrategy(criteria))
        Note right of Dedup: fresh, call-scoped externalIdCache (no earlier calls to share with)
    else sourceMode = trending / topRated / discover (Custom Search)
        RS->>Src: sourceTrending(...) / sourceTopRated(...) / sourceByGenreOrKeyword(...)
        Src->>Src: sourceWithBackfill(sourceName, criteria, limit, pageFetcher)
        loop page = 1..maxDiscoverPages (default 6), until limit reached or page empty
            Src->>Tmdb: pageFetcher.apply(page)
            Tmdb->>TmdbApi: GET /trending/tv/{window}<br/>or GET /tv/top_rated<br/>or GET /discover/tv
            Src->>Dedup: dedupeAndExclude(pageRaw, sharedExternalIdCache, SourceOrderComparator.INSTANCE)
            Note right of Dedup: same cache reused every page
            Dedup-->>Src: List~DedupedCandidate~ (this page only)
            Src->>Src: applyOutputFilters(pageDeduped, criteria)
            Src->>Src: merge survivors into accumulator, keyed by tmdbId<br/>(a repeat tmdbId across pages merges sourceSeries, doesn't duplicate)
        end
        Src-->>RS: List~DedupedCandidate~ (already deduped + filtered)
        Note over RS: maxCandidates cap applied AFTER dedup here —<br/>pure post-hoc truncation, no call-volume tradeoff
    end

    Note over Dedup: accumulateCandidate(rc) — runs once per RawCandidate, either path
    loop for each RawCandidate rc
        alt rc.tmdbId already in externalIdCache
            Note over Dedup: cache hit — no network call
        else not yet resolved
            Dedup->>Tmdb: externalIds(rc.tmdbId)
            Tmdb->>TmdbApi: GET /tv/{tmdbId}/external_ids
            TmdbApi-->>Tmdb: imdb_id (or absent)
            Tmdb-->>Dedup: Optional~String~ imdbId
        end

        alt imdbId absent
            Note over Dedup: candidate dropped entirely — never appears in results, not just excluded from dedup
        else imdbId already grouped this call
            Dedup->>Dedup: append rc.sourceSeries to the existing group
        else new, unseen imdbId
            Dedup->>SeriesRepo: existsByImdbId(imdbId)
            SeriesRepo->>Db: SELECT ... WHERE imdb_id = ?
            Dedup->>IgnoredRepo: existsByImdbId(imdbId)
            IgnoredRepo->>Db: SELECT ... WHERE imdb_id = ?
            alt already tracked or already ignored
                Note over Dedup: candidate excluded
            else
                Dedup->>Dedup: candidateByImdbId.put(imdbId, candidate)<br/>seed sourcesByImdbId with rc.sourceSeries
            end
        end
    end

    Dedup->>Dedup: orderSources() per group, via whichever comparator the caller passed in<br/>(forStrategy(criteria) for "Use My Series", INSTANCE for the other three modes — see both branches above)
    Dedup-->>RS: List~DedupedCandidate~
```

## Identity/dedup-key relationships

Grounded by directly reading `SeriesEntity.java`/`IgnoredSeriesEntity.java`/`RawCandidate.java` on 2026-09-24 — neither tracked-series entity carries a `tmdbId` column today, which is why `imdbId` resolution can't be skipped even for a `tmdbId`-first dedup strategy (see the "dedupe on tmdbId?" discussion this diagram accompanies).

```mermaid
classDiagram
    class TmdbCandidate {
        +int tmdbId
        +String title
        +... other raw TMDB fields
    }
    class RawCandidate {
        +TmdbCandidate candidate
        +SeriesEntity sourceSeries
    }
    class DedupedCandidate {
        +TmdbCandidate candidate
        +List~SeriesEntity~ sourceSeries
        +String imdbId
    }
    class SeriesEntity {
        +UUID id
        +String imdbId
        +BigDecimal tmdbRating
        +Integer tmdbVoteCount
    }
    class IgnoredSeriesEntity {
        +UUID id
        +String imdbId
    }
    class SeriesRepository {
        +existsByImdbId(String) boolean
    }
    class IgnoredSeriesRepository {
        +existsByImdbId(String) boolean
    }

    note for RawCandidate "no imdbId field — resolved later, per-request only"
    note for SeriesEntity "NO tmdbId column"
    note for IgnoredSeriesEntity "NO tmdbId column"

    RawCandidate --> TmdbCandidate : candidate
    RawCandidate --> SeriesEntity : sourceSeries (nullable)
    DedupedCandidate --> TmdbCandidate : candidate
    DedupedCandidate --> SeriesEntity : sourceSeries (0..many)
    SeriesRepository ..> SeriesEntity : queries by imdbId only
    IgnoredSeriesRepository ..> IgnoredSeriesEntity : queries by imdbId only
```

## Reading notes

- **Only one path caps before dedup**: "Use My Series" (`sourceAndFilterFromPool`, top branch) is the sole mode where the `maxCandidates` cap is applied to the *raw* list before `dedupeAndExclude` runs — because it's the only mode whose raw pool isn't already deduped/filtered page-by-page beforehand. The other three modes cap *after* `sourceWithBackfill` returns an already-deduped result, so their cap is pure truncation with no call-volume implication.
- **Two caching layers exist today, at different scopes — corrected 2026-09-25, this previously said `externalIdCache` was the only one.**
  - `externalIdCache` is per-request only (a fresh `HashMap` per top-level `doRecommend` call, or shared across `sourceWithBackfill`'s pages within that one call) — nothing persists a `tmdbId → imdbId` mapping across separate requests. A popular show's `external_ids` lookup is repeated on every new request that surfaces it, regardless of mode.
  - `RecommendationPoolCache` (top branch only, see the `Note right of Src` above) is a second, longer-lived layer scoped to "Use My Series" mode's `sourceFromPool` call as a whole — keyed on `(seriesIds, limit)`, TTL 10 minutes, capped at 50 entries. A repeat request with the same selection/limit skips every TMDB call in the top branch entirely (the `findTvIdByImdbId`/`recommendations`/`similar`/genre-supplement loop), not just the `external_ids` lookups — a coarser, cross-request cache sitting *above* `externalIdCache`, not a replacement for it. The other three modes have no equivalent — every request re-runs `sourceWithBackfill` from scratch.
- **A dropped-for-no-`imdbId` candidate is silently invisible**, not merely excluded from dedup grouping — `accumulateCandidate` returns before ever reaching the `candidateByImdbId`/`sourcesByImdbId` maps, so it never reaches ranking, output filters, or the response at all.
- **The comparator used for ordering source series is no longer always `INSTANCE`** (corrected 2026-09-25, `series_spec_068`) — `resolveSourcePool`'s pool-capping sort and `orderSources`' per-candidate multi-source sort both now take whichever comparator the caller resolved: `SourceOrderComparator.forStrategy(criteria)` for "Use My Series" (3 possible strategies, `personalRatingThenDate` still the default), `INSTANCE` unconditionally for the other three modes (moot there, since they never attach a source series to a candidate).
