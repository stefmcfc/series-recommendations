package uk.co.stefirby.seriestracker.repository;

import uk.co.stefirby.seriestracker.model.IgnoredSeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IgnoredSeriesRepository extends JpaRepository<IgnoredSeriesEntity, UUID> {

    boolean existsByImdbId(String imdbId);

    Optional<IgnoredSeriesEntity> findByImdbId(String imdbId);
}
