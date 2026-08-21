package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.client.TmdbKeyword
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.KeywordEntity
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.KeywordRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository

@SpringBootTest
@ActiveProfiles("test")
class KeywordSyncServiceSpec extends Specification {

    @Autowired
    KeywordRepository keywordRepository

    @Autowired
    SeriesRepository seriesRepository

    TmdbClient tmdbClient = Mock()
    KeywordSyncService keywordSyncService

    def setup() {
        keywordSyncService = new KeywordSyncService(keywordRepository, tmdbClient)
    }

    def cleanup() {
        seriesRepository.deleteAll()
        keywordRepository.deleteAll()
    }

    def "SERIES-019-AC-09/10: syncs a series' keywords, reusing an existing keyword row by tmdbKeywordId"() {
        given: "a series, and TMDB returning two keywords, one already known"
            def series = new SeriesEntity(title: "Spooks")
            def existing = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            tmdbClient.showKeywords(4046) >> [
                new TmdbKeyword(470, "spy"),
                new TmdbKeyword(190904, "mi5"),
            ]

        when: "syncKeywords is called"
            keywordSyncService.syncKeywords(series, 4046)

        then: "the existing 'spy' row is reused, a new 'mi5' row is created, both linked"
            series.keywords*.tmdbKeywordId.toSet() == [470, 190904] as Set
            keywordRepository.findByTmdbKeywordId(470).get().id == existing.id

        and: "no duplicate 'spy' row was created"
            keywordRepository.count() == 2
    }

    def "SERIES-019-AC-10: a refresh unlinks a keyword no longer present, without deleting the shared keyword row"() {
        given: "a series currently linked to 'spy' and 'mi5', TMDB now returning only 'spy'"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
            def series = seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy, mi5] as Set))
            tmdbClient.showKeywords(4046) >> [new TmdbKeyword(470, "spy")]

        when: "syncKeywords is called"
            keywordSyncService.syncKeywords(series, 4046)

        then: "the series is now linked only to 'spy'"
            series.keywords*.tmdbKeywordId == [470]

        and: "the 'mi5' keyword row itself still exists"
            keywordRepository.findByTmdbKeywordId(190904).isPresent()
    }

    def "SERIES-019-AC-11: a TMDB failure leaves the existing keyword set unchanged"() {
        given: "a series already linked to 'spy', TMDB now failing"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def series = seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
            tmdbClient.showKeywords(4046) >> { throw new ExternalServiceException("TMDB down") }

        when: "syncKeywords is called"
            keywordSyncService.syncKeywords(series, 4046)

        then: "no exception propagates, and the keyword set is untouched"
            series.keywords*.tmdbKeywordId == [470]
    }

    def "SERIES-019-AC-12: syncKeywords does not itself persist the entity"() {
        given: "a series and TMDB returning one keyword"
            def series = new SeriesEntity(title: "Spooks")
            tmdbClient.showKeywords(4046) >> [new TmdbKeyword(470, "spy")]

        when: "syncKeywords is called"
            keywordSyncService.syncKeywords(series, 4046)

        then: "the series itself was never saved by syncKeywords"
            series.id == null
    }

    def "SERIES-019-AC-09: an empty TMDB keyword list clears the series' keyword set"() {
        given: "a series currently linked to 'spy', TMDB now returning no keywords"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def series = seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
            tmdbClient.showKeywords(4046) >> []

        when: "syncKeywords is called"
            keywordSyncService.syncKeywords(series, 4046)

        then: "the series' keyword set is now empty"
            series.keywords.isEmpty()

        and: "the 'spy' keyword row itself still exists"
            keywordRepository.findByTmdbKeywordId(470).isPresent()
    }
}
