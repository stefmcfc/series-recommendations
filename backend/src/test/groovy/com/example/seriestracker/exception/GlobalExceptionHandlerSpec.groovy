package com.example.seriestracker.exception

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import org.slf4j.LoggerFactory
import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import com.example.seriestracker.service.SeriesService
import org.springframework.core.MethodParameter
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException

import java.lang.reflect.Method
import java.util.UUID

import static org.mockito.ArgumentMatchers.any
import static org.mockito.Mockito.when
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GlobalExceptionHandlerSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  @MockitoBean
  SeriesService seriesService

  def "TOOLING-001-AC-01: unhandled exception returns generic 500, no internals leaked"() {
    given: "a service call that throws an unexpected RuntimeException with sensitive details"
        when(seriesService.getAll()).thenThrow(
          new RuntimeException("db connection string: postgres://user:pass@host/db"))

    when: "the endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series"))

    then: "the response is a 500 with a generic error body"
        result.andExpect(status().isInternalServerError())
        result.andExpect(jsonPath('$.error').value("Internal server error"))

    and: "the real exception message is not present in the response body"
        !result.andReturn().response.contentAsString.contains("db connection string")
  }

  def "TOOLING-001-AC-02: unhandled exception is logged server-side with message and stack trace"() {
    given: "a Logback ListAppender attached to the GlobalExceptionHandler logger"
        Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler)
        ListAppender<ILoggingEvent> appender = new ListAppender<>()
        appender.start()
        logger.addAppender(appender)

    and: "a service call that throws an unexpected RuntimeException"
        when(seriesService.getAll()).thenThrow(new RuntimeException("boom"))

    when: "the endpoint is invoked"
        mockMvc.perform(get("/api/v1/series"))

    then: "the exception's message and stack trace are logged at ERROR level"
        def events = appender.list
        events.size() >= 1
        events[0].level == Level.ERROR
        events[0].throwableProxy != null
        events[0].throwableProxy.message == "boom"
        events[0].throwableProxy.stackTraceElementProxyArray.length > 0

    cleanup:
        logger.detachAppender(appender)
  }

  def "existing specific handler for EntityNotFoundException still resolves ahead of the catch-all"() {
    given: "the service reports the series as not found"
        when(seriesService.getById(any(UUID.class)))
          .thenThrow(new EntityNotFoundException("Series not found with id: 00000000-0000-0000-0000-000000000000"))

    when: "a GET request is made for a non-existent series ID"
        def result = mockMvc.perform(get("/api/v1/series/00000000-0000-0000-0000-000000000000"))

    then: "the specific 404 handler still applies, not the generic 500 catch-all"
        result.andExpect(status().isNotFound())
  }

  def "handleValidation joins field errors into a single message with 400 status"() {
    given: "a real MethodArgumentNotValidException with multiple field errors"
        def bindingResult = new BeanPropertyBindingResult(new Object(), "seriesDto")
        bindingResult.addError(new FieldError("seriesDto", "title", "must not be blank"))
        bindingResult.addError(new FieldError("seriesDto", "imdbRating", "must be <= 10.0"))

        Method handlerMethod = GlobalExceptionHandler.getDeclaredMethod(
          "handleValidation", MethodArgumentNotValidException)
        def methodParameter = new MethodParameter(handlerMethod, 0)
        def ex = new MethodArgumentNotValidException(methodParameter, bindingResult)

    when: "the handler processes the exception directly"
        def response = new GlobalExceptionHandler().handleValidation(ex)

    then: "a 400 response is returned with a joined field-error message"
        response.statusCode.value() == 400
        response.body.error == "title: must not be blank, imdbRating: must be <= 10.0"
  }
}
