# Build stage: invokes the project's own checked-in Gradle wrapper (gradlew) directly, so the
# Gradle version always matches gradle/wrapper/gradle-wrapper.properties exactly -- no separate
# official Gradle image / version-matching step needed. See tooling_spec_012's Decision 1.
FROM eclipse-temurin:25-jdk-alpine AS build
WORKDIR /workspace
COPY gradlew ./
COPY gradle ./gradle
COPY build.gradle.kts settings.gradle.kts ./
COPY src ./src
RUN chmod +x gradlew && ./gradlew bootJar -x test --no-daemon

# Runtime stage: slim JRE, only the built jar copied across. No secret (APP_OMDB_API_KEY/
# APP_TMDB_API_KEY) is COPY'd, ARG'd, or ENV'd here -- those are supplied only at
# `docker compose up` run-time via docker-compose.yml's environment/env_file (TOOLING-012-AC-06).
FROM eclipse-temurin:25-jre-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar app.jar
# docker:S6471 -- run as a non-root user rather than the image's root default. /app/data is
# created (empty) and chowned here, not just /app itself, because Docker initializes a named
# volume's ownership from whatever already exists at its mount point in the image on first
# use -- so the series-data volume (mounted at /app/data by docker-compose.yml) comes up
# already writable by this user instead of root.
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/data && chown -R app:app /app
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
