package com.example.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import com.example.seriestracker.dto.SeriesDto
import com.example.seriestracker.exception.EntityNotFoundException
import com.example.seriestracker.repository.SeriesRepository
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
class SeriesServiceSpec extends Specification {

  @Autowired
  SeriesService seriesService

  @Autowired
  SeriesRepository seriesRepository

  def cleanup() {
    seriesRepository.deleteAll()
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
          status: "WATCHING"
        )

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "the series is persisted with all fields set"
        result.title == "Game of Thrones"
        result.year == 2011
        result.imdbRating == 9.2
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
