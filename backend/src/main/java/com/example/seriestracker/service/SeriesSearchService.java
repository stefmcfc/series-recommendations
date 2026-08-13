package com.example.seriestracker.service;

import com.example.seriestracker.dto.SeriesDto;
import com.example.seriestracker.dto.SeriesSearchCriteria;
import com.example.seriestracker.model.SeriesEntity;
import com.example.seriestracker.model.SeriesStatus;
import com.example.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SeriesSearchService {

    private static final Logger log = LoggerFactory.getLogger(SeriesSearchService.class);

    private final SeriesRepository repository;
    private final SeriesService seriesService;

    public SeriesSearchService(SeriesRepository repository, SeriesService seriesService) {
        this.repository = repository;
        this.seriesService = seriesService;
    }

    @Transactional(readOnly = true)
    public List<SeriesDto> search(SeriesSearchCriteria criteria) {
        log.debug("Searching series with criteria: title={}, status={}", criteria.getTitle(), criteria.getStatus());

        if (criteria.getStatus() != null && !criteria.getStatus().isBlank()) {
            try {
                SeriesStatus.valueOf(criteria.getStatus());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid status: " + criteria.getStatus()
                    + ". Must be one of: WATCHING, COMPLETED, DROPPED, BACKLOG");
            }
        }

        return repository.findAll().stream()
            .filter(s -> matchesTitle(s, criteria.getTitle()))
            .filter(s -> matchesGenres(s, criteria.getGenres()))
            .filter(s -> matchesStatus(s, criteria.getStatus()))
            .filter(s -> matchesPersonalRating(s, criteria.getMinPersonalRating(), criteria.getMaxPersonalRating()))
            .filter(s -> matchesImdbRating(s, criteria.getMinImdbRating(), criteria.getMaxImdbRating()))
            .filter(s -> matchesStartedNotFinished(s, criteria.getStartedNotFinished()))
            .sorted(Comparator.comparing(SeriesEntity::getDateAdded).reversed())
            .map(seriesService::entityToDto)
            .collect(Collectors.toList());
    }

    private boolean matchesTitle(SeriesEntity s, String title) {
        if (title == null || title.isBlank()) return true;
        return s.getTitle().toLowerCase().contains(title.toLowerCase());
    }

    private boolean matchesGenres(SeriesEntity s, List<String> genres) {
        if (genres == null || genres.isEmpty()) return true;
        if (s.getGenres() == null || s.getGenres().isBlank()) return false;
        String lower = s.getGenres().toLowerCase();
        return genres.stream().anyMatch(g -> lower.contains(g.toLowerCase()));
    }

    private boolean matchesStatus(SeriesEntity s, String status) {
        if (status == null || status.isBlank()) return true;
        return s.getStatus() != null && s.getStatus().name().equals(status);
    }

    private boolean matchesPersonalRating(SeriesEntity s, Integer min, Integer max) {
        if (s.getPersonalRating() == null) return min == null && max == null;
        if (min != null && s.getPersonalRating() < min) return false;
        if (max != null && s.getPersonalRating() > max) return false;
        return true;
    }

    private boolean matchesImdbRating(SeriesEntity s, BigDecimal min, BigDecimal max) {
        if (s.getImdbRating() == null) return min == null && max == null;
        if (min != null && s.getImdbRating().compareTo(min) < 0) return false;
        if (max != null && s.getImdbRating().compareTo(max) > 0) return false;
        return true;
    }

    private boolean matchesStartedNotFinished(SeriesEntity s, Boolean startedNotFinished) {
        if (startedNotFinished == null || !startedNotFinished) return true;
        return (s.getStatus() == SeriesStatus.WATCHING || s.getStatus() == SeriesStatus.DROPPED)
            && s.getCurrentSeason() != null;
    }
}
