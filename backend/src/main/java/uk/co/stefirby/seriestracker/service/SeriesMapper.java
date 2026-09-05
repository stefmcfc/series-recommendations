package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.model.KeywordEntity;
import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.util.Comparator;

/**
 * Pure entity&lt;-&gt;DTO field-copy boilerplate extracted out of {@link SeriesService}
 * (chore/sonar-cleanup, java:S3776) -- unrelated to that class' surrounding business-rule
 * methods. No behavior change: {@link SeriesService#entityToDto(SeriesEntity)} and the
 * (private, internal-only) {@code buildEntityFromDto} now just delegate here.
 */
final class SeriesMapper {

    private SeriesMapper() {
    }

    static SeriesDto toDto(SeriesEntity entity) {
        SeriesDto dto = new SeriesDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setYear(entity.getYear());
        dto.setGenres(entity.getGenres());
        dto.setTotalSeasons(entity.getTotalSeasons());
        dto.setTotalEpisodes(entity.getTotalEpisodes());
        dto.setCurrentSeason(entity.getCurrentSeason());
        dto.setCurrentEpisode(entity.getCurrentEpisode());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setImdbRating(entity.getImdbRating());
        dto.setRottenTomatoesRating(entity.getRottenTomatoesRating());
        dto.setRottenTomatoesPopcornmeter(entity.getRottenTomatoesPopcornmeter());
        dto.setTmdbRating(entity.getTmdbRating());
        dto.setTmdbVoteCount(entity.getTmdbVoteCount());
        dto.setPersonalRating(entity.getPersonalRating());
        dto.setPersonalNotes(entity.getPersonalNotes());
        dto.setPosterUrl(entity.getPosterUrl());
        dto.setTags(entity.getTags());
        dto.setImdbId(entity.getImdbId());
        dto.setDateAdded(entity.getDateAdded());
        dto.setDateCompleted(entity.getDateCompleted());
        dto.setLastRefreshedAt(entity.getLastRefreshedAt());
        dto.setProductionStatus(entity.getProductionStatus() != null ? entity.getProductionStatus().name() : null);
        dto.setOriginCountry(entity.getOriginCountry());
        dto.setOverview(entity.getOverview());
        dto.setLastAirYear(entity.getLastAirYear());
        dto.setNewContentDetectedAt(entity.getNewContentDetectedAt());
        dto.setExcludeFromRecommendations(entity.isExcludeFromRecommendations());
        dto.setFlaggedForRewatch(entity.isFlaggedForRewatch());
        dto.setKeywords(entity.getKeywords().stream()
            .map(KeywordEntity::getName)
            .sorted(Comparator.naturalOrder())
            .toList());
        return dto;
    }

    static SeriesEntity toEntity(SeriesDto dto) {
        SeriesEntity entity = new SeriesEntity();
        entity.setTitle(dto.getTitle());
        entity.setYear(dto.getYear());
        entity.setGenres(dto.getGenres());
        entity.setTotalSeasons(dto.getTotalSeasons());
        entity.setTotalEpisodes(dto.getTotalEpisodes());
        entity.setCurrentSeason(dto.getCurrentSeason());
        entity.setCurrentEpisode(dto.getCurrentEpisode());
        entity.setImdbRating(dto.getImdbRating());
        entity.setRottenTomatoesRating(dto.getRottenTomatoesRating());
        entity.setRottenTomatoesPopcornmeter(dto.getRottenTomatoesPopcornmeter());
        entity.setTmdbRating(dto.getTmdbRating());
        entity.setTmdbVoteCount(dto.getTmdbVoteCount());
        entity.setPersonalRating(dto.getPersonalRating());
        entity.setPersonalNotes(dto.getPersonalNotes());
        entity.setPosterUrl(dto.getPosterUrl());
        entity.setTags(dto.getTags());
        entity.setImdbId(dto.getImdbId());
        entity.setOriginCountry(dto.getOriginCountry());
        entity.setOverview(dto.getOverview());
        entity.setLastAirYear(dto.getLastAirYear());
        return entity;
    }
}
