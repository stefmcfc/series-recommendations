package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.OmdbClient;
import uk.co.stefirby.seriestracker.client.OmdbLookupResult;
import uk.co.stefirby.seriestracker.client.OmdbSearchCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbSearchCandidate;
import uk.co.stefirby.seriestracker.client.TmdbSeriesDetail;
import uk.co.stefirby.seriestracker.dto.SeriesLookupCandidateDto;
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
 * Backs {@code GET /api/v1/series/lookup}, {@code GET /api/v1/series/lookup/search}, and (per
 * {@code series_spec_012_tmdb_lookup_fallback.md}) {@code GET /api/v1/series/lookup/search-tmdb}
 * / {@code GET /api/v1/series/lookup/resolve-tmdb}. Delegates to {@link OmdbClient} and
 * {@link TmdbClient}, mapping their results onto {@link SeriesLookupDto}/
 * {@link SeriesLookupCandidateDto}/{@link TmdbLookupCandidateDto}.
 *
 * <p>{@link EntityNotFoundException} (no OMDb match, SERIES-005-AC-16 / SERIES-011-AC-07) and
 * {@link ExternalServiceException} (upstream failure or unset API key, SERIES-005-AC-17 /
 * SERIES-011-AC-08) both originate in {@link OmdbClient} and are allowed to propagate
 * unchanged -- this class doesn't need to catch and rethrow them itself, except in
 * {@link #resolveTmdbCandidate(int)}, which deliberately catches {@link EntityNotFoundException}
 * (but not {@link ExternalServiceException}) from {@code OmdbClient.lookupByImdbId} to trigger
 * its TMDB-detail degraded fallback (SERIES-012-AC-16/17).
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

    public SeriesLookupDto lookup(String title) {
        log.info("Looking up series via OMDb: {}", title);
        OmdbLookupResult result = omdbClient.lookup(title);
        return toDto(result);
    }

    public SeriesLookupDto lookupByImdbId(String imdbId) {
        log.info("Looking up series via OMDb by imdbId: {}", imdbId);
        OmdbLookupResult result = omdbClient.lookupByImdbId(imdbId);
        return toDto(result);
    }

    public List<SeriesLookupCandidateDto> search(String title) {
        log.info("Searching series via OMDb: {}", title);
        return omdbClient.search(title).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    /**
     * TMDB-backed search (SERIES-012-AC-12), a manual escape hatch for when OMDb's own
     * {@code s=} search can't find a title it catalogues under a different AKA/alternate name.
     * An empty result is a normal outcome, not an error (SERIES-012-AC-13).
     */
    public List<TmdbLookupCandidateDto> searchTmdb(String title) {
        log.info("Searching series via TMDB: {}", title);
        return tmdbClient.search(title).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    /**
     * Resolves a TMDB search candidate to full lookup detail (SERIES-012-AC-14..19): tries
     * OMDb's richer detail via the candidate's resolved {@code imdb_id} first, falling back to
     * TMDB's own (thinner) detail when TMDB has no IMDb cross-reference for it at all, or OMDb
     * genuinely has no record for the {@code imdb_id} that TMDB did resolve. A genuine upstream
     * failure ({@link ExternalServiceException}) from either client is never swallowed into the
     * fallback -- it propagates unchanged.
     */
    public SeriesLookupDto resolveTmdbCandidate(int tmdbId) {
        log.info("Resolving TMDB candidate: tmdbId={}", tmdbId);
        Optional<String> imdbIdOpt = tmdbClient.externalIds(tmdbId);

        if (imdbIdOpt.isPresent()) {
            try {
                return toDto(omdbClient.lookupByImdbId(imdbIdOpt.get()));
            } catch (EntityNotFoundException e) {
                log.info("OMDb has no record for imdbId={} (resolved from tmdbId={}); falling back to TMDB detail",
                    imdbIdOpt.get(), tmdbId);
            }
        }

        TmdbSeriesDetail detail = tmdbClient.details(tmdbId);
        return toDto(detail, imdbIdOpt.orElse(null));
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
        dto.setImdbId(result.imdbId());
        return dto;
    }

    private SeriesLookupCandidateDto toDto(OmdbSearchCandidate candidate) {
        SeriesLookupCandidateDto dto = new SeriesLookupCandidateDto();
        dto.setTitle(candidate.title());
        dto.setYear(candidate.year());
        dto.setImdbId(candidate.imdbId());
        dto.setPosterUrl(candidate.posterUrl());
        return dto;
    }

    private TmdbLookupCandidateDto toDto(TmdbSearchCandidate candidate) {
        TmdbLookupCandidateDto dto = new TmdbLookupCandidateDto();
        dto.setTmdbId(candidate.tmdbId());
        dto.setTitle(candidate.title());
        dto.setYear(candidate.year());
        dto.setOriginalTitle(candidate.originalTitle());
        dto.setPosterUrl(candidate.posterPath() != null ? TmdbClient.POSTER_BASE_URL + candidate.posterPath() : null);
        return dto;
    }

    /**
     * Builds the degraded-fallback {@link SeriesLookupDto} from TMDB's own detail
     * (SERIES-012-AC-18): {@code imdbId} is whatever {@code externalIds} resolved (possibly
     * {@code null}); {@code genres} is joined the same way
     * {@code RecommendationService.joinGenres} already does; ratings are all {@code null} --
     * no OMDb data is available in this path.
     */
    private SeriesLookupDto toDto(TmdbSeriesDetail detail, String imdbId) {
        SeriesLookupDto dto = new SeriesLookupDto();
        dto.setTitle(detail.title());
        dto.setYear(detail.year());
        dto.setGenres(joinGenres(detail.genreIds()));
        dto.setTotalSeasons(detail.numberOfSeasons());
        dto.setTotalEpisodes(detail.numberOfEpisodes());
        dto.setPosterUrl(detail.posterPath() != null ? TmdbClient.POSTER_BASE_URL + detail.posterPath() : null);
        dto.setImdbId(imdbId);
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
