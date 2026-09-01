package uk.co.stefirby.seriestracker.service.recommendation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * A small, dependency-free TTL- and capacity-bounded cache wrapping {@code
 * RecommendationSourcingService#sourceFromPool}'s expensive TMDB-sourcing work (SERIES-035-AC-01
 * through AC-05). Deliberately not a general-purpose Spring Cache (no {@code @Cacheable}) or a
 * third-party library (Caffeine etc.) -- this project has no existing caching dependency, and a
 * plain {@link ConcurrentHashMap}-backed cache with a handful of entries is sufficient for a
 * single-user app's naturally small distinct-query variety per session.
 *
 * <p>{@link Clock}-injected per this project's established convention ({@code
 * config/ClockConfig.java}) rather than calling {@link Instant#now()} directly, so TTL expiry is
 * testable with {@link Clock#fixed} without a real wait.
 */
@Component
public class RecommendationPoolCache {

    /**
     * {@code insertionOrder} is a purely internal, monotonically-increasing tiebreaker for
     * {@link #evictOldest} -- two entries can share an identical {@code cachedAt} when a fixed
     * (e.g. test) {@link Clock} doesn't advance between inserts, and eviction must still resolve
     * deterministically to the one inserted first.
     */
    private record CacheEntry(List<RawCandidate> value, Instant cachedAt, long insertionOrder) {
    }

    private final Clock clock;
    private final Duration ttl;
    private final int maxEntries;
    private final Map<PoolCacheKey, CacheEntry> entries = new ConcurrentHashMap<>();
    private final AtomicLong insertionSequence = new AtomicLong();

    public RecommendationPoolCache(Clock clock,
                                    @Value("${app.recommendations.pool-cache-ttl-minutes:10}") int ttlMinutes,
                                    @Value("${app.recommendations.pool-cache-max-entries:50}") int maxEntries) {
        this.clock = clock;
        this.ttl = Duration.ofMinutes(ttlMinutes);
        this.maxEntries = maxEntries;
    }

    /**
     * Returns the live (non-expired) cached value for {@code key} if one exists; otherwise calls
     * {@code loader.get()}, stores the result, and returns it (SERIES-035-AC-01/02/03).
     */
    List<RawCandidate> getOrCompute(PoolCacheKey key, Supplier<List<RawCandidate>> loader) {
        CacheEntry live = entries.get(key);
        if (live != null && !isExpired(live)) {
            return live.value();
        }

        List<RawCandidate> value = loader.get();
        insert(key, value);
        return value;
    }

    private boolean isExpired(CacheEntry entry) {
        return clock.instant().isAfter(entry.cachedAt().plus(ttl));
    }

    /** SERIES-035-AC-05: sweeps expired entries first; if still at capacity, evicts the oldest remaining entry. */
    private void insert(PoolCacheKey key, List<RawCandidate> value) {
        if (entries.size() >= maxEntries && !entries.containsKey(key)) {
            evictExpired();
            if (entries.size() >= maxEntries) {
                evictOldest();
            }
        }
        entries.put(key, new CacheEntry(value, clock.instant(), insertionSequence.getAndIncrement()));
    }

    private void evictExpired() {
        entries.entrySet().removeIf(e -> isExpired(e.getValue()));
    }

    private void evictOldest() {
        Comparator<CacheEntry> oldestFirst = Comparator.comparing(CacheEntry::cachedAt)
            .thenComparingLong(CacheEntry::insertionOrder);
        entries.entrySet().stream()
            .min(Map.Entry.comparingByValue(oldestFirst))
            .map(Map.Entry::getKey)
            .ifPresent(entries::remove);
    }
}
