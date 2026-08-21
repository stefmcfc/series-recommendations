package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.OmdbClient;
import uk.co.stefirby.seriestracker.client.OmdbRatings;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbSearchCandidate;
import uk.co.stefirby.seriestracker.client.TmdbSeriesDetail;
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto;
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Backs {@code GET /api/v1/series/lookup/search-tmdb} and {@code GET /api/v1/series/lookup
 * /resolve-tmdb} -- per {@code series_spec_017_tmdb_primary_lookup.md}, TMDB is now this
 * app's sole search/detail source ({@link TmdbClient}); {@link OmdbClient} is narrowed to a
 * single best-effort enrichment call for {@code imdbRating}/{@code rottenTomatoesRating},
 * keyed off whatever {@code imdbId} TMDB itself resolves.
 *
 * <p>A failed/absent OMDb enrichment call is never fatal to a resolve request
 * (SERIES-017-AC-07) -- both {@link EntityNotFoundException} (no OMDb record) and
 * {@link ExternalServiceException} (a genuine upstream failure) are caught and logged,
 * leaving {@code imdbRating}/{@code rottenTomatoesRating} {@code null} on the result. This is
 * a deliberate posture change from the old TMDB-fallback design (SERIES-012-AC-17), where an
 * {@code ExternalServiceException} from OMDb was allowed to propagate -- correct when OMDb
 * was a required fallback data source, no longer correct now that it supplies only two
 * optional rating fields.
 */
@Service
public class SeriesLookupService {

    private static final Logger log = LoggerFactory.getLogger(SeriesLookupService.class);

    private final OmdbClient omdbClient;
    private final TmdbClient tmdbClient;
    private final TmdbGenreTable genreTable;

    public SeriesLookupService(OmdbClient omdbClient, TmdbClient tmdbClient, TmdbGenreTable genreTable) {
        this.omdbClient = omdbClient;
        this.tmdbClient = tmdbClient;
        this.genreTable = genreTable;
    }

    /**
     * TMDB-backed search (SERIES-012-AC-12, unchanged by this spec per SERIES-017-AC-01), a
     * manual escape hatch for when a title is catalogued under a different AKA/alternate name.
     * An empty result is a normal outcome, not an error (SERIES-012-AC-13/SERIES-017-AC-03).
     */
    public List<TmdbLookupCandidateDto> searchTmdb(String title) {
        log.info("Searching series via TMDB: {}", title);
        return tmdbClient.search(title).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    /**
     * Resolves a TMDB search candidate to full lookup detail, TMDB-primary
     * (SERIES-017-AC-04/06/07/08): the result is built exclusively from
     * {@code TmdbClient.details(tmdbId)}, never attempting {@code OmdbClient} as a primary
     * source. If {@code TmdbClient.externalIds(tmdbId)} resolves a non-blank {@code imdbId},
     * {@code OmdbClient.ratingsForImdbId} is then called to merge {@code imdbRating}/
     * {@code rottenTomatoesRating} on top -- any failure from that call is caught and logged,
     * never failing the overall resolve request. When no {@code imdbId} resolves, no OMDb call
     * is attempted at all.
     */
    public SeriesLookupDto resolveTmdbCandidate(int tmdbId) {
        log.info("Resolving TMDB candidate: tmdbId={}", tmdbId);
        TmdbSeriesDetail detail = tmdbClient.details(tmdbId);
        SeriesLookupDto dto = toDto(detail);

        Optional<String> imdbIdOpt = tmdbClient.externalIds(tmdbId);
        String imdbId = imdbIdOpt.filter(id -> !id.isBlank()).orElse(null);
        dto.setImdbId(imdbId);

        if (imdbId != null) {
            try {
                OmdbRatings ratings = omdbClient.ratingsForImdbId(imdbId);
                dto.setImdbRating(ratings.imdbRating());
                dto.setRottenTomatoesRating(ratings.rottenTomatoesRating());
            } catch (EntityNotFoundException | ExternalServiceException e) {
                log.info("OMDb ratings enrichment unavailable for imdbId={} (resolved from tmdbId={}): {}",
                    imdbId, tmdbId, e.getMessage());
            }
        }

        return dto;
    }

    private TmdbLookupCandidateDto toDto(TmdbSearchCandidate candidate) {
        TmdbLookupCandidateDto dto = new TmdbLookupCandidateDto();
        dto.setTmdbId(candidate.tmdbId());
        dto.setTitle(candidate.title());
        dto.setYear(candidate.year());
        dto.setOriginalTitle(candidate.originalTitle());
        dto.setPosterUrl(candidate.posterPath() != null ? TmdbClient.POSTER_BASE_URL + candidate.posterPath() : null);
        dto.setOriginCountry(candidate.originCountry());
        return dto;
    }

    /**
     * Builds the TMDB-primary base of a {@link SeriesLookupDto} (SERIES-017-AC-04): every
     * field here comes exclusively from TMDB's own detail. {@code imdbId} and any OMDb-sourced
     * ratings are merged in afterward by {@link #resolveTmdbCandidate(int)}.
     */
    private SeriesLookupDto toDto(TmdbSeriesDetail detail) {
        SeriesLookupDto dto = new SeriesLookupDto();
        dto.setTitle(detail.title());
        dto.setYear(detail.year());
        dto.setGenres(joinGenres(detail.genreIds()));
        dto.setTotalSeasons(detail.numberOfSeasons());
        dto.setTotalEpisodes(detail.numberOfEpisodes());
        dto.setPosterUrl(detail.posterPath() != null ? TmdbClient.POSTER_BASE_URL + detail.posterPath() : null);
        dto.setTmdbRating(detail.voteAverage());
        dto.setTmdbVoteCount(detail.voteCount());
        dto.setOriginCountry(detail.originCountry());
        dto.setProductionStatus(detail.productionStatus() != null ? detail.productionStatus().name() : null);
        return dto;
    }

    private String joinGenres(List<Integer> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) {
            return null;
        }
        String joined = genreIds.stream()
            .map(genreTable::displayNameFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
        return joined.isEmpty() ? null : joined;
    }
}
