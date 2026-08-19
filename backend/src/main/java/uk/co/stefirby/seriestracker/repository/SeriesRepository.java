package uk.co.stefirby.seriestracker.repository;

import uk.co.stefirby.seriestracker.model.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface SeriesRepository extends JpaRepository<SeriesEntity, UUID> {

    // SERIES-006-AC-23: used by RecommendationService to exclude candidates the user has
    // already added.
    boolean existsByImdbId(String imdbId);
}
