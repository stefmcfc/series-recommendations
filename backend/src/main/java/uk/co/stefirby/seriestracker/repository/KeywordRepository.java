package uk.co.stefirby.seriestracker.repository;

import uk.co.stefirby.seriestracker.model.KeywordEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface KeywordRepository extends JpaRepository<KeywordEntity, UUID> {

    // SERIES-019-AC-04: used by KeywordSyncService to look up an existing keyword row before
    // creating a new one, so an already-known TMDB keyword is never duplicated.
    Optional<KeywordEntity> findByTmdbKeywordId(Integer tmdbKeywordId);
}
