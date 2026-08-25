package uk.co.stefirby.seriestracker.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * A single injectable {@link Clock} bean so {@code LocalDateTime.now()} calls across the app can
 * take an explicit clock instead of the system default (SonarQube {@code java:S8688}) without
 * changing behavior -- {@link Clock#systemDefaultZone()} is what {@code LocalDateTime.now()}
 * already used implicitly.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
