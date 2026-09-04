package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import spock.lang.Specification

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.function.Supplier

class RecommendationPoolCacheSpec extends Specification {

    /** A settable test {@link Clock}, so a single long-lived cache instance can observe TTL expiry without a real wait (SERIES-035-AC-03). */
    private static class MutableClock extends Clock {
        Instant instant
        private final ZoneId zone

        MutableClock(Instant instant, ZoneId zone) {
            this.instant = instant
            this.zone = zone
        }

        @Override
        ZoneId getZone() { zone }

        @Override
        Clock withZone(ZoneId zone) { new MutableClock(instant, zone) }

        @Override
        Instant instant() { instant }
    }

    private static RawCandidate rawCandidate(int tmdbId) {
        new RawCandidate(new TmdbCandidate(tmdbId, "Candidate ${tmdbId}", 2020, "overview", "/poster.jpg",
            new BigDecimal("8.0"), [18], 100, "en", []), null)
    }

    def "SERIES-035-AC-01: a cache miss calls the loader and returns its result"() {
        given: "an empty cache"
            def cache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
            def key = new PoolCacheKey([], 20)
            def someCandidate = rawCandidate(1)
            def loader = Mock(Supplier)

        when: "getOrCompute is called"
            def result = cache.getOrCompute(key, loader)

        then: "the loader is called once, and its result is returned"
            1 * loader.get() >> [someCandidate]
            result == [someCandidate]
    }

    def "SERIES-035-AC-02: a repeat call with an equal key within TTL is a cache hit"() {
        given: "a cache with one entry already populated"
            def cache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
            def key = new PoolCacheKey([UUID.fromString("11111111-1111-1111-1111-111111111111")], 20)
            def someCandidate = rawCandidate(1)
            cache.getOrCompute(key, Mock(Supplier) { 1 * get() >> [someCandidate] })

        when: "getOrCompute is called again with an equal key"
            def result = cache.getOrCompute(key, Mock(Supplier) { 0 * get() })

        then: "the cached value is returned without invoking the loader"
            result == [someCandidate]
    }

    def "SERIES-035-AC-03: an expired entry is a cache miss"() {
        given: "a cache with a 10-minute TTL, and a settable clock starting fixed"
            def start = Instant.parse("2026-08-29T10:00:00Z")
            def clock = new MutableClock(start, ZoneOffset.UTC)
            def cache = new RecommendationPoolCache(clock, 10, 50)
            def key = new PoolCacheKey([], 20)
            def oldCandidate = rawCandidate(1)
            def freshCandidate = rawCandidate(2)
            cache.getOrCompute(key, Mock(Supplier) { 1 * get() >> [oldCandidate] })

        when: "getOrCompute is called again 11 minutes later"
            clock.instant = start.plus(Duration.ofMinutes(11))
            def result = cache.getOrCompute(key, Mock(Supplier) { 1 * get() >> [freshCandidate] })

        then: "the loader is called again and the fresh value is returned"
            result == [freshCandidate]
    }

    def "SERIES-035-AC-04: PoolCacheKey normalizes seriesIds order for equality"() {
        given: "two ids"
            def a = UUID.fromString("11111111-1111-1111-1111-111111111111")
            def b = UUID.fromString("22222222-2222-2222-2222-222222222222")

        expect: "keys built from the same ids in different orders are equal"
            new PoolCacheKey([a, b], 20) == new PoolCacheKey([b, a], 20)
    }

    def "SERIES-035-AC-05: inserting past capacity evicts the oldest entry"() {
        given: "a cache with capacity 2, holding two live (non-expired) entries"
            def clock = Clock.fixed(Instant.parse("2026-08-29T10:00:00Z"), ZoneOffset.UTC)
            def cache = new RecommendationPoolCache(clock, 10, 2)
            def oldest = new PoolCacheKey([], 1)
            def newer = new PoolCacheKey([], 2)
            cache.getOrCompute(oldest, Mock(Supplier) { 1 * get() >> [] })
            cache.getOrCompute(newer, Mock(Supplier) { 1 * get() >> [] })

        when: "a third distinct key is inserted"
            def third = new PoolCacheKey([], 3)
            cache.getOrCompute(third, Mock(Supplier) { 1 * get() >> [] })

        and: "the oldest key is requested again"
            def freshOldest = rawCandidate(99)
            def result = cache.getOrCompute(oldest, Mock(Supplier) { 1 * get() >> [freshOldest] })

        then: "the oldest entry was evicted, so this is a fresh miss"
            result == [freshOldest]
    }
}
