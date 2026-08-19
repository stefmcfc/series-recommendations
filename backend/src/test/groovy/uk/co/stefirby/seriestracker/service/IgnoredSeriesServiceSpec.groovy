package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository

@SpringBootTest
@ActiveProfiles("test")
class IgnoredSeriesServiceSpec extends Specification {

  @Autowired
  IgnoredSeriesService ignoredSeriesService

  @Autowired
  IgnoredSeriesRepository ignoredSeriesRepository

  def cleanup() {
    ignoredSeriesRepository.deleteAll()
  }

  def "SERIES-006-AC-30/32: ignoring a series persists it and reports it as newly created"() {
    given: "a valid ignore DTO"
        def dto = new IgnoredSeriesDto("tt1234567", "Some Show", "Not interested")

    when: "the series is ignored"
        def outcome = ignoredSeriesService.ignore(dto)

    then: "the outcome is newly created, and every field is persisted"
        outcome.created()
        outcome.dto().id() != null
        outcome.dto().imdbId() == "tt1234567"
        outcome.dto().title() == "Some Show"
        outcome.dto().reason() == "Not interested"
        outcome.dto().ignoredAt() != null
  }

  def "SERIES-006-AC-33: a blank imdbId throws IllegalArgumentException"() {
    given: "an ignore DTO with a blank imdbId"
        def dto = new IgnoredSeriesDto("  ", "Some Show", null)

    when: "the series is ignored"
        ignoredSeriesService.ignore(dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-006-AC-33: a null imdbId throws IllegalArgumentException"() {
    given: "an ignore DTO with no imdbId"
        def dto = new IgnoredSeriesDto(null, "Some Show", null)

    when: "the series is ignored"
        ignoredSeriesService.ignore(dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-006-AC-33: a blank title throws IllegalArgumentException"() {
    given: "an ignore DTO with a blank title"
        def dto = new IgnoredSeriesDto("tt1234567", "   ", null)

    when: "the series is ignored"
        ignoredSeriesService.ignore(dto)

    then: "an IllegalArgumentException is thrown"
        thrown(IllegalArgumentException)
  }

  def "SERIES-006-AC-34: re-ignoring the same imdbId is idempotent, returning the existing entry"() {
    given: "a series has already been ignored"
        def created = ignoredSeriesService.ignore(new IgnoredSeriesDto("tt1234567", "Some Show", null))

    when: "the same imdbId is ignored again with a different title"
        def outcome = ignoredSeriesService.ignore(new IgnoredSeriesDto("tt1234567", "Different Title", null))

    then: "the outcome reports it was not newly created, and returns the original entry"
        !outcome.created()
        outcome.dto().id() == created.dto().id()
        outcome.dto().title() == "Some Show"

    and: "no duplicate row is persisted"
        ignoredSeriesRepository.count() == 1
  }
}
