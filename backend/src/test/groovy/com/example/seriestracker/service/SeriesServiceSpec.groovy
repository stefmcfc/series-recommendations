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
    given:
    def dto = new SeriesDto(title: "The Office")

    when:
    def result = seriesService.create(dto)

    then:
    result.id != null
    result.title == "The Office"
    result.status == "BACKLOG"
    result.dateAdded != null
  }

  def "should create a series with full data"() {
    given:
    def dto = new SeriesDto(
      title: "Game of Thrones",
      year: 2011,
      genres: "Drama,Fantasy",
      totalSeasons: 8,
      imdbRating: 9.2,
      personalRating: 4,
      status: "WATCHING"
    )

    when:
    def result = seriesService.create(dto)

    then:
    result.title == "Game of Thrones"
    result.year == 2011
    result.imdbRating == 9.2
  }

  def "should reject series creation with invalid IMDb rating"() {
    given:
    def dto = new SeriesDto(title: "Show", imdbRating: 15.0)

    when:
    seriesService.create(dto)

    then:
    thrown(IllegalArgumentException)
  }

  def "should retrieve all series"() {
    given:
    seriesService.create(new SeriesDto(title: "Show 1"))
    seriesService.create(new SeriesDto(title: "Show 2"))

    when:
    def results = seriesService.getAll()

    then:
    results.size() == 2
  }

  def "should retrieve empty list when no series exist"() {
    when:
    def results = seriesService.getAll()

    then:
    results.isEmpty()
  }

  def "should retrieve series by ID"() {
    given:
    def created = seriesService.create(new SeriesDto(title: "The Office"))

    when:
    def result = seriesService.getById(created.id)

    then:
    result.id == created.id
    result.title == "The Office"
  }

  def "should throw EntityNotFoundException when retrieving non-existent series"() {
    when:
    seriesService.getById(UUID.randomUUID())

    then:
    thrown(EntityNotFoundException)
  }

  def "should update series with new progress"() {
    given:
    def created = seriesService.create(new SeriesDto(
      title: "The Office",
      totalSeasons: 9,
      totalEpisodes: 201
    ))

    and:
    def updateDto = new SeriesDto(
      currentSeason: 5,
      currentEpisode: 10
    )

    when:
    def result = seriesService.update(created.id, updateDto)

    then:
    result.currentSeason == 5
    result.currentEpisode == 10
    result.title == "The Office"
  }

  def "should reject update with invalid currentSeason"() {
    given:
    def created = seriesService.create(new SeriesDto(
      title: "Show",
      totalSeasons: 5
    ))

    and:
    def updateDto = new SeriesDto(currentSeason: 10)

    when:
    seriesService.update(created.id, updateDto)

    then:
    thrown(IllegalArgumentException)
  }

  def "should set dateCompleted when status changed to COMPLETED"() {
    given:
    def created = seriesService.create(new SeriesDto(title: "Show"))

    and:
    def updateDto = new SeriesDto(status: "COMPLETED")

    when:
    def result = seriesService.update(created.id, updateDto)

    then:
    result.status == "COMPLETED"
    result.dateCompleted != null
  }

  def "should clear dateCompleted when status changed away from COMPLETED"() {
    given:
    def created = seriesService.create(new SeriesDto(
      title: "Show",
      status: "COMPLETED"
    ))

    and:
    def updateDto = new SeriesDto(status: "WATCHING")

    when:
    def result = seriesService.update(created.id, updateDto)

    then:
    result.status == "WATCHING"
    result.dateCompleted == null
  }

  def "should throw EntityNotFoundException when updating non-existent series"() {
    given:
    def updateDto = new SeriesDto(title: "New Title")

    when:
    seriesService.update(UUID.randomUUID(), updateDto)

    then:
    thrown(EntityNotFoundException)
  }

  def "should delete series"() {
    given:
    def created = seriesService.create(new SeriesDto(title: "Show"))

    when:
    seriesService.delete(created.id)

    then:
    noExceptionThrown()

    and:
    when:
    seriesService.getById(created.id)

    then:
    thrown(EntityNotFoundException)
  }

  def "should throw EntityNotFoundException when deleting non-existent series"() {
    when:
    seriesService.delete(UUID.randomUUID())

    then:
    thrown(EntityNotFoundException)
  }
}
