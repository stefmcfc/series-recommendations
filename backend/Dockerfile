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
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
