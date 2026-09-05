package uk.co.stefirby.seriestracker.service.keyword;

import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient;
import uk.co.stefirby.seriestracker.client.tmdb.TmdbKeyword;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.KeywordEntity;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.KeywordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.seriestracker.service.refresh.SeriesRefreshService;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Reconciles a series' stored keyword set against TMDB's current data (SERIES-019-AC-08),
 * callable from both the TMDB-primary resolve flow and the refresh flow ({@link
 * SeriesRefreshService}) so both share the same upsert/removal logic instead of
 * re-implementing it. See {@code series_spec_019_keyword_tracking.md}.
 *
 * <p>Best-effort and non-fatal, matching every other TMDB-derived field's posture
 * ({@code TmdbClient.showStatus}, {@code series_spec_008} SERIES-008-AC-08): a failed keyword
 * fetch leaves the entity's existing keyword set unchanged (SERIES-019-AC-11), never throws to
 * the caller. Does not itself persist {@code entity} (SERIES-019-AC-12) -- that's the caller's
 * responsibility.
 */
@Service
public class KeywordSyncService {

    private static final Logger log = LoggerFactory.getLogger(KeywordSyncService.class);

    private final KeywordRepository keywordRepository;
    private final TmdbClient tmdbClient;

    public KeywordSyncService(KeywordRepository keywordRepository, TmdbClient tmdbClient) {
        this.keywordRepository = keywordRepository;
        this.tmdbClient = tmdbClient;
    }

    @Transactional
    public void syncKeywords(SeriesEntity entity, int tmdbId) {
        List<TmdbKeyword> tmdbKeywords;
        try {
            tmdbKeywords = tmdbClient.showKeywords(tmdbId);
        } catch (ExternalServiceException e) {
            log.info("TMDB keyword sync unavailable for series {} (tmdbId={}): {}",
                entity.getId(), tmdbId, e.getMessage());
            return;
        }

        Set<KeywordEntity> resolved = new LinkedHashSet<>();
        for (TmdbKeyword tmdbKeyword : tmdbKeywords) {
            KeywordEntity keyword = keywordRepository.findByTmdbKeywordId(tmdbKeyword.id())
                .orElseGet(() -> createKeyword(tmdbKeyword));
            resolved.add(keyword);
        }
        entity.setKeywords(resolved);
    }

    private KeywordEntity createKeyword(TmdbKeyword tmdbKeyword) {
        KeywordEntity keyword = new KeywordEntity();
        keyword.setTmdbKeywordId(tmdbKeyword.id());
        keyword.setName(tmdbKeyword.name());
        return keywordRepository.save(keyword);
    }
}
