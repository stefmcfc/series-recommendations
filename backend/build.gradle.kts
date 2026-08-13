plugins {
    java
    id("org.springframework.boot") version "4.0.0"
    id("io.spring.dependency-management") version "1.1.7"
    groovy
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")

    // SQLite
    implementation("org.xerial:sqlite-jdbc:3.46.1.3")
    implementation("org.hibernate.orm:hibernate-community-dialects:7.0.0.Final")

    // Flyway
    implementation("org.flywaydb:flyway-core")

    // Test - Groovy 5 supports Java 25 class files
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.spockframework:spock-core:2.4-groovy-5.0")
    testImplementation("org.spockframework:spock-spring:2.4-groovy-5.0")
    testImplementation("org.apache.groovy:groovy:5.0.0")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
