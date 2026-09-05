package uk.co.stefirby.seriestracker.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import spock.lang.Specification
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.exception.ConflictException
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.model.KeywordEntity
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.KeywordRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.keyword.KeywordSyncService

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

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
    seriesService = new SeriesService(seriesRepository, keywordSyncService, Clock.systemDefaultZone())
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

  def "SERIES-046-AC-07: create persists a multi-country originCountry unchanged"() {
    given: "a SeriesDto with a comma-joined multi-country originCountry"
        def dto = new SeriesDto(title: "MobLand", originCountry: "GB,US")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "the full value is persisted unchanged"
        created.originCountry == "GB,US"
  }

  def "SERIES-046-AC-08: a multi-country value round-trips through create without truncation"() {
    given: "a SeriesDto with a comma-joined multi-country originCountry longer than 2 characters"
        def dto = new SeriesDto(title: "MobLand", originCountry: "GB,US,FR")

    when: "create(dto) is called and the entity is re-fetched from the real (non-mocked) repository"
        def created = seriesService.create(dto)
        def reloaded = seriesRepository.findById(created.id).get()

    then: "the full value persisted and reloaded without truncation"
        reloaded.originCountry == "GB,US,FR"
  }

  def "SERIES-023-AC-11: create persists overview unchanged from the incoming dto"() {
    given: "a SeriesDto with overview set"
        def dto = new SeriesDto(title: "The Office", overview: "A mockumentary sitcom.")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "overview is persisted unchanged"
        created.overview == "A mockumentary sitcom."

    and: "overview is retrievable after persistence"
        seriesService.getById(created.id).overview == "A mockumentary sitcom."
  }

  def "SERIES-023-AC-12: a manually-added series with no overview stays null"() {
    given: "a SeriesDto with no overview set"
        def dto = new SeriesDto(title: "Homemade Show")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "overview is null"
        created.overview == null
  }

  def "SERIES-039-AC-02: create persists lastAirYear unchanged from the incoming dto"() {
    given: "a SeriesDto with lastAirYear set"
        def dto = new SeriesDto(title: "The Office", lastAirYear: 2013)

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "lastAirYear is persisted unchanged"
        created.lastAirYear == 2013

    and: "lastAirYear is retrievable after persistence"
        seriesService.getById(created.id).lastAirYear == 2013
  }

  def "SERIES-039-AC-02: a manually-added series with no lastAirYear stays null"() {
    given: "a SeriesDto with no lastAirYear set"
        def dto = new SeriesDto(title: "Homemade Show")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "lastAirYear is null"
        created.lastAirYear == null
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
        1 * keywordSyncService.syncKeywords(_ as SeriesEntity, 4046)
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
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 1, name: "spy"))
        def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 2, name: "mi5"))
        entity.setKeywords([spy, mi5] as Set)
        seriesRepository.save(entity)

    when: "the series is fetched"
        def result = seriesService.getById(created.id)

    then: "keywords come back as sorted name strings"
        result.keywords == ["mi5", "spy"]
  }

  def "SERIES-008-AC-03: create defaults excludeFromRecommendations to false when unset"() {
    given: "a SeriesDto with no excludeFromRecommendations value"
        def dto = new SeriesDto(title: "Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "excludeFromRecommendations defaults to false"
        result.excludeFromRecommendations == false
  }

  def "SERIES-008-AC-03: create persists excludeFromRecommendations when explicitly set"() {
    given: "a SeriesDto with excludeFromRecommendations true"
        def dto = new SeriesDto(title: "Kids Show", excludeFromRecommendations: true)

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the flag is persisted"
        result.excludeFromRecommendations == true
        seriesService.getById(result.id).excludeFromRecommendations == true
  }

  def "SERIES-008-AC-03: update only overwrites excludeFromRecommendations when explicitly provided"() {
    given: "an existing series with excludeFromRecommendations = true"
        def existing = seriesService.create(new SeriesDto(title: "Show", excludeFromRecommendations: true))

    when: "update is called with a DTO that omits excludeFromRecommendations (null)"
        seriesService.update(existing.id, new SeriesDto(title: "Show (renamed)"))

    then: "the flag is unchanged"
        seriesService.getById(existing.id).excludeFromRecommendations == true

    when: "update is called with excludeFromRecommendations explicitly set to false"
        seriesService.update(existing.id, new SeriesDto(excludeFromRecommendations: false))

    then: "the flag is cleared"
        seriesService.getById(existing.id).excludeFromRecommendations == false
  }

  def "SERIES-008-AC-19: create defaults flaggedForRewatch to false when unset"() {
    given: "a SeriesDto with no flaggedForRewatch value"
        def dto = new SeriesDto(title: "Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "flaggedForRewatch defaults to false"
        result.flaggedForRewatch == false
  }

  def "SERIES-008-AC-19: create persists flaggedForRewatch when explicitly set"() {
    given: "a SeriesDto with flaggedForRewatch true"
        def dto = new SeriesDto(title: "Rewatch Candidate", flaggedForRewatch: true)

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the flag is persisted"
        result.flaggedForRewatch == true
        seriesService.getById(result.id).flaggedForRewatch == true
  }

  def "SERIES-008-AC-19: update only overwrites flaggedForRewatch when explicitly provided"() {
    given: "an existing series with flaggedForRewatch = true"
        def existing = seriesService.create(new SeriesDto(title: "Show", flaggedForRewatch: true))

    when: "update is called with a DTO that omits flaggedForRewatch (null)"
        seriesService.update(existing.id, new SeriesDto(title: "Show (renamed)"))

    then: "the flag is unchanged"
        seriesService.getById(existing.id).flaggedForRewatch == true

    when: "update is called with flaggedForRewatch explicitly set to false"
        seriesService.update(existing.id, new SeriesDto(flaggedForRewatch: false))

    then: "the flag is cleared"
        seriesService.getById(existing.id).flaggedForRewatch == false
  }

  def "SERIES-027-AC-03: create sets rottenTomatoesPopcornmeter when provided"() {
    given: "a SeriesDto with a rottenTomatoesPopcornmeter value"
        def dto = new SeriesDto(title: "Show", rottenTomatoesPopcornmeter: 88)

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the value is persisted"
        result.rottenTomatoesPopcornmeter == 88
        seriesService.getById(result.id).rottenTomatoesPopcornmeter == 88
  }

  def "SERIES-027-AC-03: create leaves rottenTomatoesPopcornmeter null when unset"() {
    given: "a SeriesDto with no rottenTomatoesPopcornmeter value"
        def dto = new SeriesDto(title: "Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the value is null"
        result.rottenTomatoesPopcornmeter == null
  }

  def "SERIES-027-AC-03: update only overwrites rottenTomatoesPopcornmeter when explicitly provided"() {
    given: "an existing series with rottenTomatoesPopcornmeter = 88"
        def existing = seriesService.create(new SeriesDto(title: "Show", rottenTomatoesPopcornmeter: 88))

    when: "update is called with a DTO that omits rottenTomatoesPopcornmeter (null)"
        seriesService.update(existing.id, new SeriesDto(title: "Show (renamed)"))

    then: "the value is unchanged"
        seriesService.getById(existing.id).rottenTomatoesPopcornmeter == 88

    when: "update is called with rottenTomatoesPopcornmeter explicitly set to 92"
        seriesService.update(existing.id, new SeriesDto(rottenTomatoesPopcornmeter: 92))

    then: "the value is updated"
        seriesService.getById(existing.id).rottenTomatoesPopcornmeter == 92
  }

  def "should reject series creation with invalid IMDb rating"() {
    given: "a series DTO with an out-of-range IMDb rating"
        def dto = new SeriesDto(title: "Show", imdbRating: 15.0)

    when: "the series is created"
        seriesService.create(dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-028-AC-01: creating a series with an already-tracked imdbId is rejected"() {
    given: "an existing tracked series"
        seriesService.create(new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747"))

    when: "the same imdbId is submitted again"
        seriesService.create(new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747"))

    then: "a ConflictException is thrown naming the conflicting title, and no second row was created"
        def ex = thrown(ConflictException)
        ex.message.contains("Breaking Bad")
        seriesRepository.findAll().count { it.imdbId == "tt0903747" } == 1
  }

  def "SERIES-028-AC-02: two series with the same title but no imdbId are both allowed"() {
    given: "an existing series with no imdbId"
        seriesService.create(new SeriesDto(title: "Some Show"))

    when: "another series with the same title and no imdbId is created"
        def result = seriesService.create(new SeriesDto(title: "Some Show"))

    then: "creation succeeds"
        result.id != null
        seriesRepository.findAll().count { it.title == "Some Show" } == 2
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

  def "SERIES-009-AC-06: getAll defaults to dateAdded descending"() {
    given: "three series added in sequence"
        seriesService.create(new SeriesDto(title: "First Added"))
        seriesService.create(new SeriesDto(title: "Second Added"))
        seriesService.create(new SeriesDto(title: "Third Added"))

    when: "getAll() is called with no sort params"
        def results = seriesService.getAll(null, null)

    then: "results are ordered by dateAdded, most recent first"
        results*.title == ["Third Added", "Second Added", "First Added"]
  }

  def "SERIES-009-AC-05: getAll shares the same sortBy resolution search() uses"() {
    given: "three series with different personal ratings"
        seriesService.create(new SeriesDto(title: "Shared Sort A", personalRating: 3))
        seriesService.create(new SeriesDto(title: "Shared Sort B", personalRating: 5))
        seriesService.create(new SeriesDto(title: "Shared Sort C"))

    when: "getAll() is called with sortBy=personalRating, sortDirection=desc"
        def results = seriesService.getAll("personalRating", "desc")

    then: "results follow the same nulls-last descending order search() applies"
        def scoped = results.findAll { it.title.startsWith("Shared Sort") }
        scoped*.personalRating == [5, 3, null]
  }

  def "SERIES-009-AC-02: getAll rejects an invalid sortBy value"() {
    when: "getAll() is called with an invalid sortBy value"
        seriesService.getAll("notAField", null)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-009-AC-03: getAll rejects an invalid sortDirection value"() {
    when: "getAll() is called with an invalid sortDirection value"
        seriesService.getAll(null, "sideways")

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
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

  def "SERIES-041-AC-04: create rejects a year beyond current year + 1"() {
    given: "a fixed clock at 2026-08-31"
        def fixedClock = Clock.fixed(Instant.parse("2026-08-31T00:00:00Z"), ZoneOffset.UTC)
        def service = new SeriesService(seriesRepository, keywordSyncService, fixedClock)

    when: "create is called with year 2028 (current year + 2)"
        service.create(new SeriesDto(title: "Show", year: 2028))

    then: "an IllegalArgumentException is thrown"
        def ex = thrown(IllegalArgumentException)
        ex.message.contains("1900")

    when: "create is called with year 2027 (current year + 1, the boundary)"
        def result = service.create(new SeriesDto(title: "Show 2", year: 2027))

    then: "it succeeds"
        result.year == 2027
  }

  def "SERIES-041-AC-04: update rejects a year below 1900"() {
    given: "an existing series with no year set"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update sets year to 1899"
        seriesService.update(existing.id, new SeriesDto(year: 1899))

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-041-AC-05: update accepts a year of exactly 1900, the boundary"() {
    given: "an existing series with no year set"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update sets year to 1900"
        def result = seriesService.update(existing.id, new SeriesDto(year: 1900))

    then: "it succeeds"
        result.year == 1900
  }

  def "SERIES-040-AC-01: update cannot change year once it is already set"() {
    given: "an existing series with year = 2019"
        def existing = seriesService.create(new SeriesDto(title: "Show", year: 2019))

    when: "update attempts to change year to 2020, alongside an unrelated field change"
        seriesService.update(existing.id, new SeriesDto(title: "Show", year: 2020, personalNotes: "great"))

    then: "year is unchanged, but the unrelated field still applied"
        def result = seriesService.getById(existing.id)
        result.year == 2019
        result.personalNotes == "great"
  }

  def "SERIES-040-AC-01: update cannot change genres/totalSeasons/totalEpisodes/imdbRating once already set"() {
    given: "an existing series with all four fields set"
        def existing = seriesService.create(new SeriesDto(
          title: "Show", genres: "Drama", totalSeasons: 5, totalEpisodes: 60, imdbRating: 8.0
        ))

    when: "update attempts to change all four"
        seriesService.update(existing.id, new SeriesDto(
          genres: "Comedy", totalSeasons: 6, totalEpisodes: 70, imdbRating: 9.0
        ))

    then: "none of the four locked fields changed"
        def result = seriesService.getById(existing.id)
        result.genres == "Drama"
        result.totalSeasons == 5
        result.totalEpisodes == 60
        result.imdbRating == 8.0
  }

  def "SERIES-040-AC-01: update cannot change title once it is already set"() {
    given: "an existing series with a title"
        def existing = seriesService.create(new SeriesDto(title: "Original Title"))

    when: "update attempts to rename it"
        seriesService.update(existing.id, new SeriesDto(title: "Renamed Title"))

    then: "the title is unchanged"
        seriesService.getById(existing.id).title == "Original Title"
  }

  def "SERIES-040-AC-02: update CAN set year when it is currently null"() {
    given: "an existing, manually-added series with no year"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update sets year for the first time"
        seriesService.update(existing.id, new SeriesDto(year: 2019))

    then: "year is set"
        seriesService.getById(existing.id).year == 2019
  }

  def "SERIES-040-AC-02: update CAN set genres/totalSeasons/totalEpisodes/imdbRating when currently null"() {
    given: "an existing, manually-added series with none of the four fields set"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update sets all four for the first time"
        def result = seriesService.update(existing.id, new SeriesDto(
          genres: "Comedy", totalSeasons: 6, totalEpisodes: 70, imdbRating: 9.0
        ))

    then: "all four are set"
        result.genres == "Comedy"
        result.totalSeasons == 6
        result.totalEpisodes == 70
        result.imdbRating == 9.0
  }

  def "SERIES-030-AC-01: clearedFields nulls personalRating"() {
    given: "a series with a personal rating set"
        def entity = seriesRepository.save(new SeriesEntity(title: "Show", personalRating: 4))

    when: "PATCH is requested with clearedFields: [personalRating]"
        def dto = new SeriesDto()
        dto.clearedFields = ["personalRating"]
        def result = seriesService.update(entity.id, dto)

    then: "personalRating is null in the response"
        result.personalRating == null

    and: "it's null in the persisted entity too"
        seriesRepository.findById(entity.id).get().personalRating == null
  }

  def "SERIES-030-AC-02: unrelated fields are unaffected by clearedFields"() {
    given: "a series with title, personalRating, and genres set"
        def entity = seriesRepository.save(new SeriesEntity(title: "Show", personalRating: 4, genres: "Drama"))

    when: "PATCH clears only personalRating"
        def dto = new SeriesDto()
        dto.clearedFields = ["personalRating"]
        def result = seriesService.update(entity.id, dto)

    then: "genres and title are untouched"
        result.genres == "Drama"
        result.title == "Show"
  }

  def "SERIES-030-AC-03: an unrecognized field name in clearedFields is rejected"() {
    given: "a series exists"
        def entity = seriesRepository.save(new SeriesEntity(title: "Show"))

    when: "PATCH is requested with clearedFields containing an unclearable/unknown field"
        def dto = new SeriesDto()
        dto.clearedFields = ["title"]
        seriesService.update(entity.id, dto)

    then: "an IllegalArgumentException is thrown (mapped to 400 by GlobalExceptionHandler)"
        thrown(IllegalArgumentException)

    and: "the entity is unchanged"
        seriesRepository.findById(entity.id).get().title == "Show"
  }

  def "SERIES-030-AC-04: a field cannot be both cleared and set in the same request"() {
    given: "a series exists"
        def entity = seriesRepository.save(new SeriesEntity(title: "Show", personalRating: 4))

    when: "PATCH both clears and sets personalRating"
        def dto = new SeriesDto()
        dto.clearedFields = ["personalRating"]
        dto.personalRating = 3
        seriesService.update(entity.id, dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-030-AC-05: clearing totalSeasons is applied before currentSeason validation"() {
    given: "a series with totalSeasons=5, currentSeason=3"
        def entity = seriesRepository.save(
            new SeriesEntity(title: "Show", totalSeasons: 5, currentSeason: 3))

    when: "PATCH clears totalSeasons and sets currentSeason=8 in the same request"
        def dto = new SeriesDto()
        dto.clearedFields = ["totalSeasons"]
        dto.currentSeason = 8
        def result = seriesService.update(entity.id, dto)

    then: "no exception -- there's no longer a totalSeasons to exceed"
        result.currentSeason == 8
        result.totalSeasons == null
  }

  def "SERIES-030-AC-06: required/boolean fields cannot be cleared"() {
    given: "a series exists"
        def entity = seriesRepository.save(new SeriesEntity(title: "Show", status: SeriesStatus.WATCHING))

    when: "PATCH attempts to clear #fieldName"
        def dto = new SeriesDto()
        dto.clearedFields = [fieldName]
        seriesService.update(entity.id, dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)

    where:
        fieldName << ["title", "status", "excludeFromRecommendations", "flaggedForRewatch"]
  }
}
