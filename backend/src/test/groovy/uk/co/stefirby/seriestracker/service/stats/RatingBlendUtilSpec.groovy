package uk.co.stefirby.seriestracker.service.stats

import spock.lang.Specification
import uk.co.stefirby.seriestracker.model.SeriesEntity

class RatingBlendUtilSpec extends Specification {

    def "SERIES-047-AC-01: averages imdbRating and tmdbRating when both present"() {
        given: "a series with both ratings set"
            def series = new SeriesEntity(imdbRating: 8.0G, tmdbRating: 7.0G)

        expect: "the blended rating is their average"
            RatingBlendUtil.blendedRating(series) == 7.5G
    }

    def "SERIES-047-AC-01: falls back to whichever single rating is present"() {
        expect:
            RatingBlendUtil.blendedRating(new SeriesEntity(imdbRating: 8.0G)) == 8.0G
            RatingBlendUtil.blendedRating(new SeriesEntity(tmdbRating: 6.5G)) == 6.5G
    }

    def "SERIES-047-AC-01: null when neither rating is present"() {
        expect:
            RatingBlendUtil.blendedRating(new SeriesEntity()) == null
    }

    def "SERIES-047-AC-01: rounds HALF_UP to one decimal place"() {
        expect:
            RatingBlendUtil.blendedRating(new SeriesEntity(imdbRating: 8.1G, tmdbRating: 8.15G)) == 8.1G
    }
}
