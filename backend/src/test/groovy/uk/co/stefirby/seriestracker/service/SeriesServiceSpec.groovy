package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.repository.KeywordRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
class SeriesServiceSpec extends Specification {

  @Autowired
  SeriesRepository seriesRepository

  @Autowired
  KeywordRepository keywordRepository

  KeywordSyncService keywordSyncService = Mock()

  SeriesService seriesService

  def setup() {
    seriesService = new SeriesService(seriesRepository, keywordSyncService)
  }

  def cleanup() {
    seriesRepository.deleteAll()
    keywordRepository.deleteAll()
  }

  def "should create a series with minimal data"() {
    given: "a series DTO with only a title"
        def dto = new SeriesDto(title: "The Office")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the series is persisted with default values"
        result.id != null
        result.title == "The Office"
        result.status == "BACKLOG"
        result.dateAdded != null
  }

  def "should create a series with full data"() {
    given: "a series DTO with a full set of fields"
        def dto = new SeriesDto(
          title: "Game of Thrones",
          year: 2011,
          genres: "Drama,Fantasy",
          totalSeasons: 8,
          imdbRating: 9.2,
          personalRating: 4,
          status: "WATCHING",
          posterUrl: "https://example.com/got-poster.jpg"
        )

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the series is persisted with all fields set"
        result.title == "Game of Thrones"
        result.year == 2011
        result.imdbRating == 9.2
        result.posterUrl == "https://example.com/got-poster.jpg"
  }

  def "SERIES-005-AC-03: should create a series without a posterUrl, leaving it null"() {
    given: "a series DTO with no posterUrl"
        def dto = new SeriesDto(title: "No Poster Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "posterUrl is null, like other unset optional fields"
        result.posterUrl == null
  }

  def "SERIES-006-AC-01/02/03: imdbId flows through create and is persisted"() {
    given: "a SeriesDto with imdbId set"
        def dto = new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747")

    when: "the series is created"
        def created = seriesService.create(dto)

    then: "imdbId round-trips"
        created.imdbId == "tt0903747"

    and: "imdbId is persisted and retrievable"
        seriesService.getById(created.id).imdbId == "tt0903747"
  }

  def "SERIES-006-AC-03: should create a series without an imdbId, leaving it null"() {
    given: "a series DTO with no imdbId"
        def dto = new SeriesDto(title: "No Imdb Id Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "imdbId is null, like other unset optional fields"
        result.imdbId == null
  }

  def "SERIES-006-AC-03: should update a series's imdbId"() {
    given: "a series has been created without an imdbId"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    and: "an update DTO with an imdbId"
        def updateDto = new SeriesDto(imdbId: "tt1234567")

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "imdbId is set, and other fields are unchanged"
        result.imdbId == "tt1234567"
        result.title == "Show"
  }

  def "SERIES-005-AC-03: should update a series's posterUrl"() {
    given: "a series has been created without a posterUrl"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    and: "an update DTO with a posterUrl"
        def updateDto = new SeriesDto(posterUrl: "https://example.com/poster.jpg")

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "posterUrl is set, and other fields are unchanged"
        result.posterUrl == "https://example.com/poster.jpg"
        result.title == "Show"
  }

  def "SERIES-017-AC-12: tmdbRating/tmdbVoteCount flow through create and are persisted"() {
    given: "a SeriesDto with tmdbRating and tmdbVoteCount set"
        def dto = new SeriesDto(title: "Spooks", tmdbRating: 7.8, tmdbVoteCount: 245)

    when: "the series is created"
        def created = seriesService.create(dto)

    then: "tmdbRating/tmdbVoteCount round-trip"
        created.tmdbRating == 7.8
        created.tmdbVoteCount == 245

    and: "tmdbRating/tmdbVoteCount are persisted and retrievable"
        def fetched = seriesService.getById(created.id)
        fetched.tmdbRating == 7.8
        fetched.tmdbVoteCount == 245
  }

  def "SERIES-017-AC-12: should create a series without tmdbRating/tmdbVoteCount, leaving them null"() {
    given: "a series DTO with no tmdbRating/tmdbVoteCount"
        def dto = new SeriesDto(title: "No TMDB Rating Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "tmdbRating/tmdbVoteCount are null, like other unset optional fields"
        result.tmdbRating == null
        result.tmdbVoteCount == null
  }

  def "SERIES-021-AC-06/08: create persists originCountry and productionStatus unchanged from the incoming dto"() {
    given: "a SeriesDto with originCountry and productionStatus set"
        def dto = new SeriesDto(title: "The Office", originCountry: "GB", productionStatus: "ENDED")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "both fields are persisted unchanged"
        created.originCountry == "GB"
        created.productionStatus == "ENDED"

    and: "both fields are retrievable after persistence"
        def fetched = seriesService.getById(created.id)
        fetched.originCountry == "GB"
        fetched.productionStatus == "ENDED"
  }

  def "SERIES-021-AC-06/08: create leaves originCountry/productionStatus null when unset"() {
    given: "a SeriesDto with no originCountry/productionStatus"
        def dto = new SeriesDto(title: "No Origin Country Show")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "both fields are null, like other unset optional fields"
        created.originCountry == null
        created.productionStatus == null
  }

  def "SERIES-014-AC-06/07: tags flows through create and is persisted"() {
    given: "a SeriesDto with tags set"
        def dto = new SeriesDto(title: "The Wire", tags: "rewatch candidate,background watching")

    when: "the series is created"
        def created = seriesService.create(dto)

    then: "tags round-trips"
        created.tags == "rewatch candidate,background watching"

    and: "tags is persisted and retrievable"
        seriesService.getById(created.id).tags == "rewatch candidate,background watching"
  }

  def "SERIES-014-AC-08: should create a series without tags, leaving it null"() {
    given: "a series DTO with no tags"
        def dto = new SeriesDto(title: "No Tags Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "tags is null, like other unset optional fields"
        result.tags == null
  }

  def "SERIES-014-AC-09: should update a series's tags"() {
    given: "a series has been created without tags"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    and: "an update DTO with tags"
        def updateDto = new SeriesDto(tags: "rewatch candidate")

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "tags is set, and other fields are unchanged"
        result.tags == "rewatch candidate"
        result.title == "Show"
  }

  def "SERIES-014-AC-09: an update omitting tags leaves the stored value unchanged"() {
    given: "a series has been created with tags"
        def created = seriesService.create(new SeriesDto(title: "Show", tags: "rewatch candidate"))

    and: "an update DTO that omits tags but changes another field"
        def updateDto = new SeriesDto(personalRating: 5)

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "tags is unchanged, matching every other optional field's update semantics"
        result.tags == "rewatch candidate"
        result.personalRating == 5
  }

  def "SERIES-019-AC-24: create syncs keywords when the incoming dto carries a tmdbId"() {
    given: "a SeriesDto with tmdbId set"
        def dto = new SeriesDto(title: "Spooks", tmdbId: 4046)

    when: "create(dto) is called"
        seriesService.create(dto)

    then: "syncKeywords is called with the resolved entity and tmdbId"
        1 * keywordSyncService.syncKeywords(_ as uk.co.stefirby.seriestracker.model.SeriesEntity, 4046)
  }

  def "SERIES-019-AC-24: create does not attempt a sync when tmdbId is absent"() {
    given: "a SeriesDto with no tmdbId (a manually-added series)"
        def dto = new SeriesDto(title: "Homemade Show")

    when: "create(dto) is called"
        seriesService.create(dto)

    then: "syncKeywords is never called"
        0 * keywordSyncService.syncKeywords(_, _)
  }

  def "SERIES-019-AC-23: tmdbId is never echoed back by entityToDto"() {
    given: "a SeriesDto with tmdbId set"
        def dto = new SeriesDto(title: "Spooks", tmdbId: 4046)

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "the returned dto does not carry tmdbId back"
        created.tmdbId == null
  }

  def "FRONTEND-024-AC-02: keywords is an empty list, never null, when a series has none"() {
    given: "a SeriesDto with no keywords"
        def dto = new SeriesDto(title: "No Keywords Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "keywords is an empty list"
        result.keywords == []
  }

  def "FRONTEND-024-AC-02: entityToDto maps a series' keyword names, sorted alphabetically"() {
    given: "a persisted series with two keywords attached directly to the entity"
        def created = seriesService.create(new SeriesDto(title: "Spooks"))
        def entity = seriesRepository.findById(created.id).get()
        def spy = keywordRepository.save(new uk.co.stefirby.seriestracker.model.KeywordEntity(tmdbKeywordId: 1, name: "spy"))
        def mi5 = keywordRepository.save(new uk.co.stefirby.seriestracker.model.KeywordEntity(tmdbKeywordId: 2, name: "mi5"))
        entity.setKeywords([spy, mi5] as Set)
        seriesRepository.save(entity)

    when: "the series is fetched"
        def result = seriesService.getById(created.id)

    then: "keywords come back as sorted name strings"
        result.keywords == ["mi5", "spy"]
  }

  def "should reject series creation with invalid IMDb rating"() {
    given: "a series DTO with an out-of-range IMDb rating"
        def dto = new SeriesDto(title: "Show", imdbRating: 15.0)

    when: "the series is created"
        seriesService.create(dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "should retrieve all series"() {
    given: "two series have been created"
        seriesService.create(new SeriesDto(title: "Show 1"))
        seriesService.create(new SeriesDto(title: "Show 2"))

    when: "all series are retrieved"
        def results = seriesService.getAll()

    then: "both series are returned"
        results.size() == 2
  }

  def "should retrieve empty list when no series exist"() {
    when: "all series are retrieved"
        def results = seriesService.getAll()

    then: "an empty list is returned"
        results.isEmpty()
  }

  def "should retrieve series by ID"() {
    given: "a series has been created"
        def created = seriesService.create(new SeriesDto(title: "The Office"))

    when: "the series is retrieved by its ID"
        def result = seriesService.getById(created.id)

    then: "the matching series is returned"
        result.id == created.id
        result.title == "The Office"
  }

  def "should throw EntityNotFoundException when retrieving non-existent series"() {
    when: "a series is retrieved using a random, non-existent ID"
        seriesService.getById(UUID.randomUUID())

    then: "an EntityNotFoundException is thrown"
        thrown(EntityNotFoundException)
  }

  def "should update series with new progress"() {
    given: "a series has been created with total seasons and episodes"
        def created = seriesService.create(new SeriesDto(
          title: "The Office",
          totalSeasons: 9,
          totalEpisodes: 201
        ))

    and: "an update DTO with new progress values"
        def updateDto = new SeriesDto(
          currentSeason: 5,
          currentEpisode: 10
        )

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "the progress fields are updated and other fields are unchanged"
        result.currentSeason == 5
        result.currentEpisode == 10
        result.title == "The Office"
  }

  def "should reject update with invalid currentSeason"() {
    given: "a series has been created with a total season count"
        def created = seriesService.create(new SeriesDto(
          title: "Show",
          totalSeasons: 5
        ))

    and: "an update DTO with a currentSeason beyond the total"
        def updateDto = new SeriesDto(currentSeason: 10)

    when: "the series is updated"
        seriesService.update(created.id, updateDto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "should set dateCompleted when status changed to COMPLETED"() {
    given: "a series has been created"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    and: "an update DTO changing the status to COMPLETED"
        def updateDto = new SeriesDto(status: "COMPLETED")

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "the status and dateCompleted are updated"
        result.status == "COMPLETED"
        result.dateCompleted != null
  }

  def "should clear dateCompleted when status changed away from COMPLETED"() {
    given: "a series has been created with COMPLETED status"
        def created = seriesService.create(new SeriesDto(
          title: "Show",
          status: "COMPLETED"
        ))

    and: "an update DTO changing the status to WATCHING"
        def updateDto = new SeriesDto(status: "WATCHING")

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "the status changes and dateCompleted is cleared"
        result.status == "WATCHING"
        result.dateCompleted == null
  }

  def "should throw EntityNotFoundException when updating non-existent series"() {
    given: "an update DTO"
        def updateDto = new SeriesDto(title: "New Title")

    when: "a non-existent series is updated"
        seriesService.update(UUID.randomUUID(), updateDto)

    then: "an EntityNotFoundException is thrown"
        thrown(EntityNotFoundException)
  }

  def "should delete series"() {
    given: "a series has been created"
        def created = seriesService.create(new SeriesDto(title: "Show"))

    when: "the series is deleted"
        seriesService.delete(created.id)

    then: "no exception is thrown"
        noExceptionThrown()

    and: "the deleted series can no longer be retrieved"
        when: "the deleted series is looked up"
            seriesService.getById(created.id)

        then: "an EntityNotFoundException is thrown"
            thrown(EntityNotFoundException)
  }

  def "should throw EntityNotFoundException when deleting non-existent series"() {
    when: "a non-existent series is deleted"
        seriesService.delete(UUID.randomUUID())

    then: "an EntityNotFoundException is thrown"
        thrown(EntityNotFoundException)
  }
}
