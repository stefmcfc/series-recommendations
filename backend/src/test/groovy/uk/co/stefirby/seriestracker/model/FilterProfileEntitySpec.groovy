package uk.co.stefirby.seriestracker.model

import spock.lang.Specification
import jakarta.validation.Validator
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import tools.jackson.databind.node.ObjectNode
import tools.jackson.databind.ObjectMapper

/**
 * series_spec_056_filter_profile_name_validation.md -- entity-level Bean Validation on
 * {@link FilterProfileEntity#name}, mirroring {@code SeriesEntitySpec}'s structure.
 */
@SpringBootTest
class FilterProfileEntitySpec extends Specification {

    @Autowired
    Validator validator

    ObjectNode emptyCriteria() {
        new ObjectMapper().createObjectNode()
    }

    def "SERIES-056-AC-01: accepts a name of exactly 255 characters"() {
        given: "a profile with a 255-character name"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: "a" * 255, criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "no violations are raised"
            violations.isEmpty()
    }

    def "SERIES-056-AC-02: rejects a name of 256 characters"() {
        given: "a profile with a 256-character name"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: "a" * 256, criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "a violation is raised for the name field"
            violations.any { it.propertyPath.toString() == "name" }
    }

    def "SERIES-056-AC-03: rejects a name containing a newline, carriage return, or tab"() {
        given: "a profile with a name containing #character"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: "Bad${character}Name", criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "a violation is raised for the name field"
            violations.any { it.propertyPath.toString() == "name" }

        where:
            character << ["\n", "\r", "\t"]
    }

    def "SERIES-056-AC-04: accepts a name containing quotes, punctuation, and unicode"() {
        given: "a profile with an unusual but non-control-character name"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: name, criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "no violations are raised"
            violations.isEmpty()

        where:
            name << ["O'Brien's picks", "Comedy; Drama", "日本語プロファイル", "🎬 Weeknight"]
    }
}
