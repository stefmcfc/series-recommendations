package uk.co.stefirby.seriestracker.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Metadata for the springdoc-generated OpenAPI spec ({@code /v3/api-docs}) and the interactive
 * Swagger UI it powers ({@code /swagger-ui.html}). No further configuration is required for
 * springdoc itself to work -- adding {@code springdoc-openapi-starter-webmvc-ui} to the classpath
 * is enough; this bean only supplies a title, description, and version so the generated docs
 * identify this app rather than showing springdoc's generic defaults (series_spec_066).
 *
 * <p>{@link BuildProperties} is auto-configured by Spring Boot's {@code ProjectInfoAutoConfiguration}
 * from {@code META-INF/build-info.properties}, which the {@code springBoot { buildInfo() }} block in
 * {@code build.gradle.kts} generates at build time -- so {@link Info#version(String)} here always
 * matches this project's real {@code version} rather than a hardcoded/stale copy.
 */
@Configuration
public class OpenApiConfig {

    private final BuildProperties buildProperties;

    public OpenApiConfig(BuildProperties buildProperties) {
        this.buildProperties = buildProperties;
    }

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("TV Series Tracker API")
                .description("A personal app for logging TV series you're watching, tracking "
                    + "viewing progress, and storing ratings from multiple sources "
                    + "(IMDb, TMDB, Rotten Tomatoes).")
                .version(buildProperties.getVersion()))
            .components(new Components()
                .addResponses("BadRequest", errorResponse(
                    "Bad request -- e.g. a missing/invalid required field or an unrecognized "
                        + "parameter value.",
                    "title: must not be blank"))
                .addResponses("NotFound", errorResponse(
                    "The requested resource does not exist.",
                    "Series not found with id: 3fa85f64-5717-4562-b3fc-2c963f66afa6"))
                .addResponses("Conflict", errorResponse(
                    "The request conflicts with an existing resource (e.g. a duplicate name/ID "
                        + "within the same scope, or a job already running).",
                    "A series with this IMDb ID is already tracked: The Office"))
                .addResponses("BadGateway", errorResponse(
                    "An upstream service (TMDB/OMDb) call failed.",
                    "Unable to reach the series lookup service. Please try again.")));
    }

    // series_spec_070_openapi_examples.md (SERIES-070-AC-01): every error response in this app
    // shares this one uniform ApiResponse<Void> envelope (GlobalExceptionHandler) -- only the
    // description and example message vary by case, so this helper is defined once and reused
    // for all 4 named responses rather than repeating the envelope's shape 4 times.
    private ApiResponse errorResponse(String description, String exampleMessage) {
        Map<String, Object> example = new LinkedHashMap<>();
        example.put("data", null);
        example.put("error", exampleMessage);
        example.put("count", 0);
        example.put("excludedCount", 0);
        return new ApiResponse()
            .description(description)
            .content(new Content()
                .addMediaType("application/json", new MediaType().example(example)));
    }
}
