package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import spock.lang.Specification

import java.time.LocalDateTime

/**
 * series_spec_068_recommendation_source_ranking_strategy.md (SERIES-068-AC-01/03/07):
 * {@code SourceOrderComparator}'s move from one fixed {@code INSTANCE} to a small static
 * factory resolving the right comparator from {@code RecommendationCriteria}.
 */
class SourceOrderComparatorSpec extends Specification {

    private static SeriesEntity series(String title, Integer personalRating = null, LocalDateTime dateCompleted = null,
                                        BigDecimal imdbRating = null, BigDecimal tmdbRating = null) {
        new SeriesEntity(title: title, status: SeriesStatus.COMPLETED, personalRating: personalRating,
            dateCompleted: dateCompleted, imdbRating: imdbRating, tmdbRating: tmdbRating)
    }

    def "SERIES-068-AC-01/03: an unset sourceRankingStrategy resolves to the existing personalRating/dateCompleted comparator"() {
        given: "criteria with no sourceRankingStrategy set"
            def criteria = new RecommendationCriteria()
            def low = series("Low", 2, LocalDateTime.now())
            def high = series("High", 5, LocalDateTime.now())

        when: "sorting with the resolved comparator"
            def sorted = [low, high].toSorted(SourceOrderComparator.forStrategy(criteria))

        then: "the order matches the default personalRating-desc/dateCompleted-desc comparator"
            sorted*.title == ["High", "Low"]
    }

    def "SERIES-068-AC-02/03: sourceRankingStrategy=personalRatingThenDate resolves to the default comparator explicitly"() {
        given: "criteria explicitly requesting the default strategy"
            def criteria = new RecommendationCriteria(sourceRankingStrategy: "personalRatingThenDate")
            def low = series("Low", 2, LocalDateTime.now())
            def high = series("High", 5, LocalDateTime.now())

        when: "sorting with the resolved comparator"
            def sorted = [low, high].toSorted(SourceOrderComparator.forStrategy(criteria))

        then: "the order matches the default personalRating-desc/dateCompleted-desc comparator"
            sorted*.title == ["High", "Low"]
    }

    def "SERIES-068-AC-07: personalRatingThenCustomBlend orders by personalRating first, blend as tiebreak"() {
        given: "two series with different personalRatings, blend order reversed"
            def criteria = new RecommendationCriteria(sourceRankingStrategy: "personalRatingThenCustomBlend")
            def lowRatingHighBlend = series("LowRatingHighBlend", 2, null, 9.0G, 9.0G)
            def highRatingLowBlend = series("HighRatingLowBlend", 5, null, 1.0G, 1.0G)

        when: "sorting with the resolved comparator"
            def sorted = [lowRatingHighBlend, highRatingLowBlend].toSorted(SourceOrderComparator.forStrategy(criteria))

        then: "personalRating wins over the blend"
            sorted*.title == ["HighRatingLowBlend", "LowRatingHighBlend"]
    }

    def "SERIES-068-AC-07: customBlendThenPersonalRating orders by blend first, personal rating as tiebreak"() {
        given: "two source series with the same personalRating but different Custom Rating Blend results"
            def criteria = new RecommendationCriteria(sourceRankingStrategy: "customBlendThenPersonalRating")
            def seriesA = series("SeriesA", 4, null, 9.0G, 9.0G)
            def seriesB = series("SeriesB", 4, null, 1.0G, 1.0G)

        when: "sorting with the resolved comparator"
            def sorted = [seriesB, seriesA].toSorted(SourceOrderComparator.forStrategy(criteria))

        then: "series A (higher blend) sorts first despite equal personalRating"
            sorted.first().title == "SeriesA"
    }

    def "SERIES-068-AC-07: customBlendThenPersonalRating honors a custom sourceRatingBlendSources selection"() {
        given: "criteria selecting only tomatometer/popcornmeter for the blend"
            def criteria = new RecommendationCriteria(sourceRankingStrategy: "customBlendThenPersonalRating",
                sourceRatingBlendSources: ["tomatometer", "popcornmeter"])
            def highImdbLowRt = new SeriesEntity(title: "HighImdbLowRt", status: SeriesStatus.COMPLETED,
                imdbRating: 9.0G, rottenTomatoesRating: 10, rottenTomatoesPopcornmeter: 10)
            def lowImdbHighRt = new SeriesEntity(title: "LowImdbHighRt", status: SeriesStatus.COMPLETED,
                imdbRating: 1.0G, rottenTomatoesRating: 90, rottenTomatoesPopcornmeter: 90)

        when: "sorting with the resolved comparator"
            def sorted = [highImdbLowRt, lowImdbHighRt].toSorted(SourceOrderComparator.forStrategy(criteria))

        then: "only the selected RT sources drive the order, ignoring imdbRating entirely"
            sorted*.title == ["LowImdbHighRt", "HighImdbLowRt"]
    }
}
