package uk.co.stefirby.seriestracker.repository;

import uk.co.stefirby.seriestracker.model.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SeriesRepository extends JpaRepository<SeriesEntity, UUID> {

    // SERIES-006-AC-23: used by RecommendationService to exclude candidates the user has
    // already added.
    boolean existsByImdbId(String imdbId);

    // SERIES-071-AC-04: used by RecommendationDeduplicationService to resolve the already-
    // tracked SeriesEntity itself (not just whether one exists) when includeAlreadyTracked is
    // true for a matched candidate.
    Optional<SeriesEntity> findByImdbId(String imdbId);
}
