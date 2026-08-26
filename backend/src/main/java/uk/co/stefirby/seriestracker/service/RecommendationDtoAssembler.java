package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
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

    public RecommendationDto toDto(DedupedCandidate dc, int effectiveMaxSourcesShown) {
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
            c.originCountry(),
            c.tmdbId()
        );
    }
}
