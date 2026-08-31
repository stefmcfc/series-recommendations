package uk.co.stefirby.seriestracker.service.recommendation;

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Scoring, sort, and diversity-cap (Requirement 7, SERIES-007-AC-21/22), extracted from
 * {@code RecommendationService} (TOOLING-003-AC-19/20).
 */
@Service
public class RecommendationRankingService {

    private final RecommendationDtoAssembler dtoAssembler;

    /**
     * Selects the {@link #applyDiversityCap} strategy (SERIES-015-AC-14): {@code "best-source"}
     * (default) caps on each candidate's single best contributing source only; {@code
     * "all-sources"} caps on every contributing source. Any value other than exactly {@code
     * "all-sources"} is treated as {@code "best-source"} -- no startup validation/rejection of
     * an unrecognized value (SERIES-015-AC-18).
     */
    private final String diversityCapMode;

    public RecommendationRankingService(RecommendationDtoAssembler dtoAssembler,
                                         @Value("${app.recommendations.diversity-cap-mode:best-source}") String diversityCapMode) {
        this.dtoAssembler = dtoAssembler;
        this.diversityCapMode = diversityCapMode;
    }

    ScoredCandidate score(DedupedCandidate dc, int effectiveMaxSourcesShown) {
        double tmdbRating = dc.candidate().voteAverage() != null ? dc.candidate().voteAverage().doubleValue() : 0.0;
        RecommendationDto dto = dtoAssembler.toDto(dc, effectiveMaxSourcesShown);

        double rankScore;
        if (!dc.sourceSeries().isEmpty()) {
            // SERIES-015-AC-07: the max personalRating across all contributing sources --
            // equivalently the first entry's personalRating under the canonical ordering
            // (SERIES-015-AC-05), since that ordering is personalRating-descending.
            Integer maxPersonalRating = dc.sourceSeries().getFirst().getPersonalRating();
            double personalRatingTerm = maxPersonalRating != null ? maxPersonalRating * 2 : 0;
            rankScore = (tmdbRating * 0.5) + (personalRatingTerm * 0.5);
        } else {
            rankScore = tmdbRating;
        }

        List<String> allSourceTitles = dc.sourceSeries().stream()
            .map(SeriesEntity::getTitle)
            .toList();
        return new ScoredCandidate(dto, rankScore, allSourceTitles);
    }

    /**
     * Branches the ranking sort on {@link RecommendationCriteria#getSortBy()}
     * (SERIES-015-AC-19/20/21): {@code "score"} (default) sorts by {@code rankScore}
     * descending; {@code "recommendationCount"} sorts by {@code totalSourceCount} descending,
     * with {@code rankScore} descending as a tiebreaker. Any other value falls back to {@code
     * "score"}.
     */
    Comparator<ScoredCandidate> resolveSortComparator(RecommendationCriteria c) {
        if ("recommendationCount".equals(c.getSortBy())) {
            return Comparator
                .comparingInt((ScoredCandidate sc) -> sc.dto().totalSourceCount())
                .thenComparingDouble(ScoredCandidate::rankScore)
                .reversed();
        }
        return Comparator.comparingDouble(ScoredCandidate::rankScore).reversed();
    }

    /**
     * SERIES-015-AC-15/16/17/18: either mode never caps a candidate with no contributing
     * sources. {@code "best-source"} (default, and the fallback for any unrecognized {@link
     * #diversityCapMode} value) checks/increments only the candidate's best contributing
     * source (the first entry under the canonical ordering); {@code "all-sources"}
     * checks/increments every contributing source.
     */
    List<ScoredCandidate> applyDiversityCap(List<ScoredCandidate> ranked, int maxPerSource) {
        boolean allSourcesMode = "all-sources".equals(diversityCapMode);
        Map<String, Integer> perSourceCount = new HashMap<>();
        List<ScoredCandidate> result = new ArrayList<>();
        for (ScoredCandidate sc : ranked) {
            if (admitsCandidate(sc, allSourcesMode, perSourceCount, maxPerSource)) {
                result.add(sc);
            }
        }
        return result;
    }

    /**
     * Decides whether {@code sc} stays under the diversity cap, incrementing {@code
     * perSourceCount} as a side effect when it does -- extracted from {@link
     * #applyDiversityCap}'s loop to keep the two mode branches (java:S3776) out of the loop
     * body itself.
     */
    private boolean admitsCandidate(ScoredCandidate sc, boolean allSourcesMode,
                                     Map<String, Integer> perSourceCount, int maxPerSource) {
        List<String> sourceTitles = sc.allSourceTitles();
        if (sourceTitles.isEmpty()) {
            return true;
        }
        return allSourcesMode
            ? admitAllSources(sourceTitles, perSourceCount, maxPerSource)
            : admitBestSource(sourceTitles, perSourceCount, maxPerSource);
    }

    private boolean admitAllSources(List<String> sourceTitles, Map<String, Integer> perSourceCount, int maxPerSource) {
        boolean anySourceAtCap = sourceTitles.stream()
            .anyMatch(title -> perSourceCount.getOrDefault(title, 0) >= maxPerSource);
        if (anySourceAtCap) {
            return false;
        }
        for (String title : sourceTitles) {
            perSourceCount.merge(title, 1, Integer::sum);
        }
        return true;
    }

    private boolean admitBestSource(List<String> sourceTitles, Map<String, Integer> perSourceCount, int maxPerSource) {
        String bestSourceTitle = sourceTitles.getFirst();
        int count = perSourceCount.getOrDefault(bestSourceTitle, 0);
        if (count >= maxPerSource) {
            return false;
        }
        perSourceCount.put(bestSourceTitle, count + 1);
        return true;
    }
}
