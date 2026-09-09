package uk.co.stefirby.seriestracker.model

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import spock.lang.Specification
import tools.jackson.databind.ObjectMapper
import uk.co.stefirby.seriestracker.repository.FilterProfileRepository

/**
 * series_spec_055_filter_profiles.md: confirms {@link JsonNodeConverter} round-trips a nested
 * {@code JsonNode} through an actual save/reload cycle unchanged -- not just the converter
 * methods in isolation.
 */
@SpringBootTest
@ActiveProfiles("test")
class JsonNodeConverterSpec extends Specification {

    @Autowired
    FilterProfileRepository repository

    @PersistenceContext
    EntityManager entityManager

    ObjectMapper objectMapper = new ObjectMapper()

    def cleanup() {
        repository.deleteAll()
    }

    @Transactional
    def "nested JSON round-trips through save/reload unchanged"() {
        given: "an entity with nested criteria"
            def entity = new FilterProfileEntity()
            entity.setArea(FilterProfileArea.MY_SERIES)
            entity.setName("Test")
            entity.setCriteria(objectMapper.readTree('{"genres":["Comedy","Drama"],"yearMin":2020}'))
            entity.setCreatedAt(java.time.LocalDateTime.now())
            entity.setUpdatedAt(java.time.LocalDateTime.now())

        when: "saved and reloaded"
            def saved = repository.save(entity)
            entityManager.flush()
            entityManager.clear()
            def reloaded = repository.findById(saved.id).get()

        then: "the criteria is unchanged"
            reloaded.criteria == objectMapper.readTree('{"genres":["Comedy","Drama"],"yearMin":2020}')
    }

    @Transactional
    def "an empty JSON object round-trips unchanged"() {
        given: "an entity with an empty object as criteria"
            def entity = new FilterProfileEntity()
            entity.setArea(FilterProfileArea.RECOMMENDATION_FILTERS)
            entity.setName("Empty")
            entity.setCriteria(objectMapper.createObjectNode())
            entity.setCreatedAt(java.time.LocalDateTime.now())
            entity.setUpdatedAt(java.time.LocalDateTime.now())

        when: "saved and reloaded"
            def saved = repository.save(entity)
            entityManager.flush()
            entityManager.clear()
            def reloaded = repository.findById(saved.id).get()

        then: "the criteria is still an empty object"
            reloaded.criteria == objectMapper.createObjectNode()
    }

    def "SERIES-056-AC-08: malformed persisted JSON fails with a clear IllegalStateException, not an unhandled JacksonException"() {
        given: "a converter and a malformed JSON string"
            def converter = new JsonNodeConverter()

        when: "converting the malformed string back to a JsonNode"
            converter.convertToEntityAttribute("{not valid json")

        then: "an IllegalStateException is thrown, not a raw JacksonException"
            thrown(IllegalStateException)
    }

    def "SERIES-056-AC-08: well-formed JSON still round-trips unchanged"() {
        given: "a converter and a well-formed JSON string"
            def converter = new JsonNodeConverter()

        when: "converting it back to a JsonNode"
            def node = converter.convertToEntityAttribute('{"genres":["Comedy"]}')

        then: "it parses correctly"
            node.get("genres").get(0).asString() == "Comedy"
    }
}
