package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.OmdbClient;
import uk.co.stefirby.seriestracker.client.OmdbLookupResult;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Backs {@code GET /api/v1/series/lookup}. Delegates to {@link OmdbClient} and maps its
 * result onto {@link SeriesLookupDto}.
 *
 * <p>{@link EntityNotFoundException} (no OMDb match, SERIES-005-AC-16) and
 * {@link ExternalServiceException} (upstream failure or unset API key, SERIES-005-AC-17)
 * both originate in {@link OmdbClient} and are allowed to propagate unchanged -- this class
 * doesn't need to catch and rethrow them itself.
 */
@Service
public class SeriesLookupService {

    private static final Logger log = LoggerFactory.getLogger(SeriesLookupService.class);

    private final OmdbClient omdbClient;

    public SeriesLookupService(OmdbClient omdbClient) {
        this.omdbClient = omdbClient;
    }

    public SeriesLookupDto lookup(String title) {
        log.info("Looking up series via OMDb: {}", title);
        OmdbLookupResult result = omdbClient.lookup(title);
        return toDto(result);
    }

    private SeriesLookupDto toDto(OmdbLookupResult result) {
        SeriesLookupDto dto = new SeriesLookupDto();
        dto.setTitle(result.title());
        dto.setYear(result.year());
        dto.setGenres(result.genres());
        dto.setTotalSeasons(result.totalSeasons());
        dto.setTotalEpisodes(result.totalEpisodes());
        dto.setImdbRating(result.imdbRating());
        dto.setMetacriticRating(result.metacriticRating());
        dto.setRottenTomatoesRating(result.rottenTomatoesRating());
        dto.setPosterUrl(result.posterUrl());
        return dto;
    }
}
