package uk.co.stefirby.seriestracker.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import spock.lang.Specification
import tools.jackson.databind.ObjectMapper
import uk.co.stefirby.seriestracker.exception.ConflictException
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.model.FilterProfileArea
import uk.co.stefirby.seriestracker.repository.FilterProfileRepository

import java.time.Clock

@SpringBootTest
@ActiveProfiles("test")
class FilterProfileServiceSpec extends Specification {

    @Autowired
    FilterProfileService service

    @Autowired
    FilterProfileRepository repository

    @Autowired
    Clock clock

    ObjectMapper objectMapper = new ObjectMapper()

    def cleanup() {
        repository.deleteAll()
    }

    def "SERIES-055-AC-04: creates a new profile"() {
        given: "a well-formed create request"
            def criteria = objectMapper.readTree('{"genres":["Comedy"]}')

        when: "a profile is created"
            def dto = service.create(FilterProfileArea.MY_SERIES, "Weeknight", criteria)

        then: "it round-trips with the submitted criteria"
            dto.id() != null
            dto.area() == FilterProfileArea.MY_SERIES
            dto.name() == "Weeknight"
            dto.criteria() == criteria
            dto.createdAt() != null
            dto.updatedAt() != null
    }

    def "SERIES-055-AC-05: a blank name throws IllegalArgumentException"() {
        when: "creating a profile with a blank name"
            service.create(FilterProfileArea.MY_SERIES, "   ", objectMapper.createObjectNode())

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-055-AC-05: a null name throws IllegalArgumentException"() {
        when: "creating a profile with no name"
            service.create(FilterProfileArea.MY_SERIES, null, objectMapper.createObjectNode())

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-055-AC-06: duplicate (area, name) conflicts"() {
        given: "an existing profile"
            service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

        when: "creating another with the same area and name"
            service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

        then: "a ConflictException is thrown"
            thrown(ConflictException)

        and: "no duplicate row is persisted"
            repository.count() == 1
    }

    def "SERIES-055-AC-07: same name in a different area does not conflict"() {
        given: "an existing profile in MY_SERIES"
            service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

        when: "creating a profile with the same name in RECOMMENDATION_FILTERS"
            def dto = service.create(FilterProfileArea.RECOMMENDATION_FILTERS, "Weeknight", objectMapper.createObjectNode())

        then: "it succeeds"
            dto.name() == "Weeknight"
            dto.area() == FilterProfileArea.RECOMMENDATION_FILTERS
    }

    def "SERIES-055-AC-08: criteria accepts any well-formed JSON object"() {
        given: "a criteria object with nested structure"
            def criteria = objectMapper.readTree('{"genres":["Comedy","Drama"],"yearMin":2020,"nested":{"a":1}}')

        when: "a profile is created"
            def dto = service.create(FilterProfileArea.USE_MY_SERIES, "Complex", criteria)

        then: "it round-trips unchanged"
            dto.criteria() == criteria
    }

    def "SERIES-055-AC-01: list is scoped to area and sorted by name"() {
        given: "profiles across two areas"
            service.create(FilterProfileArea.MY_SERIES, "Zebra", objectMapper.createObjectNode())
            service.create(FilterProfileArea.MY_SERIES, "Apple", objectMapper.createObjectNode())
            service.create(FilterProfileArea.USE_MY_SERIES, "Other", objectMapper.createObjectNode())

        when: "listing MY_SERIES"
            def result = service.list(FilterProfileArea.MY_SERIES)

        then: "only MY_SERIES profiles are returned, sorted by name"
            result*.name() == ["Apple", "Zebra"]
    }

    def "SERIES-055-AC-03: an area with no profiles returns an empty list"() {
        when: "listing an area with nothing saved"
            def result = service.list(FilterProfileArea.RECOMMENDATION_FILTERS)

        then: "an empty list, not an error"
            result == []
    }

    def "SERIES-055-AC-09: update only changes the fields present in the request"() {
        given: "an existing profile"
            def original = service.create(FilterProfileArea.MY_SERIES, "Original", objectMapper.readTree('{"a":1}'))

        when: "renaming without touching criteria"
            def renamed = service.update(original.id(), "Renamed", null)

        then: "the name changed but criteria did not"
            renamed.name() == "Renamed"
            renamed.criteria() == original.criteria()

        when: "updating criteria without touching name"
            def newCriteria = objectMapper.readTree('{"a":2}')
            def recriteria = service.update(original.id(), null, newCriteria)

        then: "the criteria changed but name did not"
            recriteria.name() == "Renamed"
            recriteria.criteria() == newCriteria
    }

    def "SERIES-055-AC-10: update for a nonexistent id throws EntityNotFoundException"() {
        when: "updating a profile that doesn't exist"
            service.update(UUID.randomUUID(), "Name", null)

        then: "an EntityNotFoundException is thrown"
            thrown(EntityNotFoundException)
    }

    def "SERIES-055-AC-11: renaming to a colliding name in the same area conflicts"() {
        given: "two existing profiles in the same area"
            service.create(FilterProfileArea.MY_SERIES, "A", objectMapper.createObjectNode())
            def b = service.create(FilterProfileArea.MY_SERIES, "B", objectMapper.createObjectNode())

        when: "renaming B to A"
            service.update(b.id(), "A", null)

        then: "a ConflictException is thrown"
            thrown(ConflictException)

        and: "the original profile is unmodified"
            repository.findById(b.id()).get().name == "B"
    }

    def "SERIES-055-AC-12: renaming to its own current name succeeds (no-op)"() {
        given: "an existing profile"
            def profile = service.create(FilterProfileArea.MY_SERIES, "Same", objectMapper.createObjectNode())

        when: "renaming it to its own current name"
            def updated = service.update(profile.id(), "Same", null)

        then: "it succeeds, not a conflict"
            updated.name() == "Same"
    }

    def "SERIES-055-AC-13: a successful update sets updatedAt but leaves createdAt unchanged"() {
        given: "an existing profile"
            def profile = service.create(FilterProfileArea.MY_SERIES, "Timed", objectMapper.createObjectNode())

        when: "it is updated"
            def updated = service.update(profile.id(), "TimedRenamed", null)

        then: "createdAt is unchanged, updatedAt is set"
            updated.createdAt() == profile.createdAt()
            updated.updatedAt() != null
    }

    def "SERIES-055-AC-14: delete removes the profile"() {
        given: "an existing profile"
            def profile = service.create(FilterProfileArea.MY_SERIES, "ToDelete", objectMapper.createObjectNode())

        when: "it is deleted"
            service.delete(profile.id())

        then: "it is no longer in the repository"
            !repository.existsById(profile.id())
    }

    def "SERIES-055-AC-15: delete for a nonexistent id throws EntityNotFoundException"() {
        when: "deleting a profile that doesn't exist"
            service.delete(UUID.randomUUID())

        then: "an EntityNotFoundException is thrown"
            thrown(EntityNotFoundException)
    }

    def "SERIES-056-AC-05: create trims the name before storing and before the uniqueness check"() {
        when: "a profile is created with leading/trailing whitespace in the name"
            def dto = service.create(FilterProfileArea.MY_SERIES, "  Weeknight  ", objectMapper.createObjectNode())

        then: "the stored name is trimmed"
            dto.name() == "Weeknight"
    }

    def "SERIES-056-AC-07: a whitespace-padded name conflicts with an existing trimmed one"() {
        given: "an existing profile"
            service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

        when: "creating another with leading whitespace but the same trimmed name"
            service.create(FilterProfileArea.MY_SERIES, " Weeknight", objectMapper.createObjectNode())

        then: "a ConflictException is thrown, not a second profile created"
            thrown(ConflictException)

        and: "no duplicate row is persisted"
            repository.count() == 1
    }

    def "SERIES-056-AC-06: update trims the name before the uniqueness check, and a whitespace-only rename to itself is a no-op"() {
        given: "an existing profile"
            def created = service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

        when: "renaming with only whitespace difference"
            def updated = service.update(created.id(), " Weeknight ", null)

        then: "no conflict, name stored trimmed"
            updated.name() == "Weeknight"
    }
}
