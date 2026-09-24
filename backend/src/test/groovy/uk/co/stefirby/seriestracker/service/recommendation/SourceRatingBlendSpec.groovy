package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.model.SeriesEntity
import spock.lang.Specification

/**
 * series_spec_068_recommendation_source_ranking_strategy.md, Requirement 2. Deliberately
 * distinct from {@code RatingBlendUtilSpec} -- this blend is user-configurable and normalizes
 * the two Rotten Tomatoes fields, unlike {@code RatingBlendUtil}'s fixed imdb/tmdb-only mean.
 */
class SourceRatingBlendSpec extends Specification {

    def "SERIES-068-AC-06: blends only the selected sources, normalizing Rotten Tomatoes to a 0-10 scale"() {
        given: "a series with imdbRating=8.0, tmdbRating=7.0, rottenTomatoesPopcornmeter=90"
            def entity = new SeriesEntity(imdbRating: 8.0G, tmdbRating: 7.0G, rottenTomatoesPopcornmeter: 90)

        when: "computing the blend for imdb+popcornmeter only"
            def result = SourceRatingBlend.compute(entity, Set.of("imdb", "popcornmeter"))

        then: "the result averages 8.0 and 9.0 (90/10), ignoring tmdbRating entirely"
            result == 8.5G
    }

    def "SERIES-068-AC-06: normalizes rottenTomatoesRating (tomatometer) from a 0-100 scale to 0-10"() {
        given: "a series with only rottenTomatoesRating=70 set"
            def entity = new SeriesEntity(rottenTomatoesRating: 70)

        when: "computing the blend for tomatometer only"
            def result = SourceRatingBlend.compute(entity, Set.of("tomatometer"))

        then: "the result is 7.0"
            result == 7.0G
    }

    def "SERIES-068-AC-06: returns null when none of the selected sources have a value"() {
        given: "a series with only tmdbRating set"
            def entity = new SeriesEntity(tmdbRating: 7.0G)

        when: "computing the blend for imdb+tomatometer only"
            def result = SourceRatingBlend.compute(entity, Set.of("imdb", "tomatometer"))

        then: "the result is null"
            result == null
    }

    def "SERIES-068-AC-06: an unselected source is ignored even when the series has a value for it"() {
        given: "a series with imdbRating and tmdbRating both set"
            def entity = new SeriesEntity(imdbRating: 8.0G, tmdbRating: 2.0G)

        when: "computing the blend for imdb only"
            def result = SourceRatingBlend.compute(entity, Set.of("imdb"))

        then: "only imdbRating feeds the result"
            result == 8.0G
    }

    // -- SERIES-068-AC-04: default resolution at the point of use, not on the DTO --

    def "SERIES-068-AC-04: resolveSources defaults to imdb+tmdb when unset"() {
        given: "a RecommendationCriteria with no sourceRatingBlendSources set"
            def criteria = new RecommendationCriteria()

        expect: "the resolved default matches RatingBlendUtil's own historical pair"
            SourceRatingBlend.resolveSources(criteria) == Set.of("imdb", "tmdb")
    }

    def "SERIES-068-AC-04: resolveSources honors an explicit selection"() {
        given: "a RecommendationCriteria with an explicit sourceRatingBlendSources"
            def criteria = new RecommendationCriteria(sourceRatingBlendSources: ["tomatometer", "popcornmeter"])

        expect: "the resolved set matches the explicit selection"
            SourceRatingBlend.resolveSources(criteria) == Set.of("tomatometer", "popcornmeter")
    }
}
