package uk.co.stefirby.seriestracker.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

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
                .version(buildProperties.getVersion()));
    }
}
