package com.example.seriestracker.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS configuration restricting cross-origin access to {@code /api/**} to an explicit,
 * configured allow-list of origins (never a wildcard).
 *
 * <p>Chosen approach: {@link WebMvcConfigurer#addCorsMappings}, not a standalone
 * {@code CorsConfigurationSource} bean. This app has no Spring Security on the classpath
 * (see {@code build.gradle.kts}), and {@code CorsConfigurationSource} only earns its keep
 * when a security filter chain needs to consume it directly (e.g. via
 * {@code http.cors(...)}) so CORS is evaluated before the security filters run. With plain
 * Spring MVC, {@code WebMvcConfigurer} is the current, supported, and simpler mechanism.
 *
 * <p>The allowed origin(s) are read from {@code app.cors.allowed-origins}
 * (see {@code application.yml}), overridable without a code change via the
 * {@code APP_CORS_ALLOWED_ORIGINS} environment variable (Spring's relaxed env-var binding).
 *
 * <p>{@code Content-Disposition} is explicitly exposed via {@code exposedHeaders(...)} so
 * cross-origin JavaScript (e.g. {@code axios} in the frontend's {@code seriesApi.export()})
 * can read it from {@code response.headers}. Without this, the browser still receives the
 * header at the network layer but hides it from JS per the CORS spec — a same-origin tool
 * like {@code curl} is not subject to that restriction and so won't reveal the gap.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public CorsConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(allowedOrigins)
            .allowedMethods("GET", "POST", "PATCH", "DELETE")
            .allowedHeaders("Content-Type")
            .exposedHeaders("Content-Disposition");
    }
}
