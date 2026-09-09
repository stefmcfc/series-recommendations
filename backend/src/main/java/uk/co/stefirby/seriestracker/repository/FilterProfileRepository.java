package uk.co.stefirby.seriestracker.repository;

import uk.co.stefirby.seriestracker.model.FilterProfileArea;
import uk.co.stefirby.seriestracker.model.FilterProfileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FilterProfileRepository extends JpaRepository<FilterProfileEntity, UUID> {

    List<FilterProfileEntity> findByAreaOrderByNameAsc(FilterProfileArea area);

    Optional<FilterProfileEntity> findByAreaAndName(FilterProfileArea area, String name);
}
