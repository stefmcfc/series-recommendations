package uk.co.stefirby.seriestracker.service.tmdb

import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.client.tmdb.TmdbWatchProvider
import uk.co.stefirby.seriestracker.dto.RecommendationDto
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import spock.lang.Specification

import java.time.LocalDateTime

class WatchProviderServiceSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    TmdbClient tmdbClient = Mock()

    WatchProviderService watchProviderService = new WatchProviderService(seriesRepository, tmdbClient, "GB")

    private static SeriesEntity completedSeries(String title, String imdbId, LocalDateTime dateCompleted) {
        new SeriesEntity(title: title, imdbId: imdbId, status: SeriesStatus.COMPLETED, dateCompleted: dateCompleted)
    }

    def "SERIES-020-AC-05: streamingProviders maps TmdbClient.watchProviders, region app.tmdb.watch-region-configured"() {
        given: "TMDB resolves one GB flatrate provider for tmdbId 500"
            tmdbClient.watchProviders(500, "GB") >> [new TmdbWatchProvider("Netflix", "/abc.jpg")]

        when: "streamingProviders(500) is called"
            def result = watchProviderService.streamingProviders(500)

        then: "the mapped provider with a built logo URL is returned"
            result == [new RecommendationDto.StreamingProvider("Netflix", TmdbClient.PROVIDER_LOGO_BASE_URL + "/abc.jpg")]
    }

    def "SERIES-020-AC-05: a null logoPath maps to a null logoUrl, not a concatenated string"() {
        given: "TMDB resolves one provider with no logo path"
            tmdbClient.watchProviders(500, "GB") >> [new TmdbWatchProvider("Netflix", null)]

        when: "streamingProviders(500) is called"
            def result = watchProviderService.streamingProviders(500)

        then: "logoUrl is null"
            result[0].logoUrl() == null
    }

    def "SERIES-020-AC-06/AC-07: a watchProviders failure yields an empty list, not a failed request"() {
        given: "TMDB's watchProviders lookup throws"
            tmdbClient.watchProviders(500, "GB") >> {
                throw new ExternalServiceException("TMDB down")
            }

        when: "streamingProviders(500) is called"
            def result = watchProviderService.streamingProviders(500)

        then: "an empty list is returned, no exception propagates"
            result == []
    }

    def "SERIES-020-AC-07: no flatrate providers found yields an empty list, never null"() {
        given: "TMDB returns no providers (default Mock() stub)"
            tmdbClient.watchProviders(500, "GB") >> []

        when: "streamingProviders(500) is called"
            def result = watchProviderService.streamingProviders(500)

        then: "an empty list is returned, never null"
            result != null
            result == []
    }

    def "SERIES-026-AC-01/05: getStreamingProvidersForSeries resolves a tmdbId and reuses the streamingProviders helper"() {
        given: "a tracked series with a resolvable imdbId"
            def id = UUID.randomUUID()
            def series = completedSeries("Ozark", "tt5071412", null)
            seriesRepository.findById(id) >> Optional.of(series)
            tmdbClient.findTvIdByImdbId("tt5071412") >> Optional.of(69740)
            tmdbClient.watchProviders(69740, "GB") >> [new TmdbWatchProvider("Netflix", "/abc.jpg")]

        when: "getStreamingProvidersForSeries(id) is called"
            def result = watchProviderService.getStreamingProvidersForSeries(id)

        then: "the mapped provider (built via the shared helper) is returned"
            result == [new RecommendationDto.StreamingProvider("Netflix", TmdbClient.PROVIDER_LOGO_BASE_URL + "/abc.jpg")]
    }

    def "SERIES-026-AC-02: getStreamingProvidersForSeries throws EntityNotFoundException for an unknown id"() {
        given: "no series exists for the requested id"
            def id = UUID.randomUUID()
            seriesRepository.findById(id) >> Optional.empty()

        when: "getStreamingProvidersForSeries(id) is called"
            watchProviderService.getStreamingProvidersForSeries(id)

        then: "an EntityNotFoundException is thrown"
            thrown(EntityNotFoundException)
    }

    def "SERIES-026-AC-03: getStreamingProvidersForSeries returns an empty list when imdbId is null/blank"() {
        given: "a tracked series with a blank imdbId"
            def id = UUID.randomUUID()
            def series = completedSeries("No IMDb Link", imdbId, null)
            seriesRepository.findById(id) >> Optional.of(series)

        when: "getStreamingProvidersForSeries(id) is called"
            def result = watchProviderService.getStreamingProvidersForSeries(id)

        then: "an empty list is returned, no TMDB call is made"
            result == []
            0 * tmdbClient.findTvIdByImdbId(_)

        where:
            imdbId << [null, ""]
    }

    def "SERIES-026-AC-04: getStreamingProvidersForSeries returns an empty list when the imdbId can't be resolved to a tmdbId"() {
        given: "a tracked series whose imdbId TMDB can't resolve"
            def id = UUID.randomUUID()
            def series = completedSeries("Obscure Show", "tt9999999", null)
            seriesRepository.findById(id) >> Optional.of(series)
            tmdbClient.findTvIdByImdbId("tt9999999") >> Optional.empty()

        when: "getStreamingProvidersForSeries(id) is called"
            def result = watchProviderService.getStreamingProvidersForSeries(id)

        then: "an empty list is returned"
            result == []
    }

    def "SERIES-026-AC-05: a watchProviders failure yields an empty list, not an exception"() {
        given: "a tracked series with a resolvable tmdbId, but TMDB's watch-providers call fails"
            def id = UUID.randomUUID()
            def series = completedSeries("Ozark", "tt5071412", null)
            seriesRepository.findById(id) >> Optional.of(series)
            tmdbClient.findTvIdByImdbId("tt5071412") >> Optional.of(69740)
            tmdbClient.watchProviders(69740, "GB") >> {
                throw new ExternalServiceException("TMDB down")
            }

        when: "getStreamingProvidersForSeries(id) is called"
            def result = watchProviderService.getStreamingProvidersForSeries(id)

        then: "an empty list is returned, not an exception"
            result == []
    }
}
