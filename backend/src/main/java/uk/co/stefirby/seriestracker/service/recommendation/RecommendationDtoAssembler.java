package uk.co.stefirby.seriestracker.service.recommendation;

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.service.TmdbGenreTable;
import uk.co.stefirby.seriestracker.service.WatchProviderService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Builds a {@link RecommendationDto} from a {@link DedupedCandidate}, extracted from {@code
 * RecommendationService} (TOOLING-003-AC-11/12). Delegates streaming-provider resolution to
 * {@link WatchProviderService} rather than duplicating that lookup.
 */
@Service
public class RecommendationDtoAssembler {

    private final TmdbGenreTable genreTable;
    private final WatchProviderService watchProviderService;

    public RecommendationDtoAssembler(TmdbGenreTable genreTable, WatchProviderService watchProviderService) {
        this.genreTable = genreTable;
        this.watchProviderService = watchProviderService;
    }

    RecommendationDto toDto(DedupedCandidate dc, int effectiveMaxSourcesShown) {
        TmdbCandidate c = dc.candidate();
        List<String> sourceTitles = dc.sourceSeries().stream()
            .map(SeriesEntity::getTitle)
            .limit(effectiveMaxSourcesShown)
            .toList();
        return new RecommendationDto(
            c.title(),
            c.year(),
            genreTable.joinDisplayNames(c.genreIds()),
            c.overview(),
            c.posterPath() != null ? TmdbClient.POSTER_BASE_URL + c.posterPath() : null,
            c.voteAverage(),
            c.voteCount(),
            watchProviderService.streamingProviders(c.tmdbId()),
            dc.imdbId(),
            sourceTitles,
            dc.sourceSeries().size(),
            TmdbClient.joinOriginCountries(c.originCountries()),
            c.tmdbId()
        );
    }
}
