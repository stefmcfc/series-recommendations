# Tooling Spec 012: Docker Compose Production-Style Images (Backend + Frontend)

**Status**: Implemented (2026-10-20). Built exactly as specced: `backend/Dockerfile` (multi-stage,
`eclipse-temurin:25-jdk-alpine` build → `eclipse-temurin:25-jre-alpine` runtime), `frontend/Dockerfile`
(multi-stage, `node:22-alpine` build → `nginx:alpine` runtime), `frontend/nginx.conf` (SPA
history-mode fallback + `/api/` → `http://backend:8080/api/` reverse proxy), root
`docker-compose.yml` (`backend`/`frontend` services, named `series-data` volume mounted at
`/app/data`, healthcheck on `GET /api/v1/series`), root `.env.example`, and `backend/gradlew` +
`backend/.gitattributes` (`/gradlew text eol=lf`, so a Windows checkout with `core.autocrlf=true`
never corrupts the shebang) per Decision 1. One correction found during the build, not originally
anticipated: `frontend/Dockerfile`'s build stage initially only `COPY`'d `package.json`/
`package-lock.json` before `npm ci`, which failed with an `ERESOLVE` peer-dependency error — the
existing `frontend/.npmrc` (`legacy-peer-deps=true`, needed for `eslint-plugin-jsx-a11y` vs
`eslint ^10`, same root cause `RUNBOOK.md`'s CI section already documents) wasn't present yet when
`npm ci` ran. Fixed by also `COPY`ing `.npmrc` in that same layer, before `npm ci`. Verified
end-to-end, by direct execution, not just reading the files back: `backend/gradlew wrapper
--gradle-version 9.7.1` regenerated an identical `gradlew.bat`/`gradle-wrapper.jar`/
`gradle-wrapper.properties` trio (only `backend/gradlew` itself was new — confirmed via `git diff`
before staging, no silent version drift); `docker build -t series-backend ./backend` exited `0`
and `docker run --rm --entrypoint java series-backend -version` printed `openjdk version
"25.0.4.1"`; `docker build -t series-frontend ./frontend` exited `0`; `docker compose up --build
-d` brought both services up, `docker compose ps` showed `backend` healthy and `frontend` running;
`curl http://localhost:4173/` returned the SPA's `index.html`, `curl
http://localhost:4173/api/v1/series` returned the backend's JSON (proxy confirmed working), and
`curl -o /dev/null -w '%{http_code}' http://localhost:4173/settings` returned `200` (history-mode
fallback, not nginx's default 404); a `POST /api/v1/series` through the frontend's proxied
endpoint added "Docker Test Series"; `docker compose down` (no `-v`) followed by `docker compose
up -d` (no rebuild) still showed that series via `GET /api/v1/series`, confirming the named volume
persisted it; `docker history --no-trunc` on both images, grepped for `ARG`/`ENV` lines mentioning
`API`/`KEY`, showed none (AC-06); finished with `docker compose down -v` to remove the volume and
leave no running containers.
**Priority**: P3 — infra/tooling, no user-facing behaviour change
**Depends on**: none
**Area**: Tooling (repo-wide) — no backend/frontend feature code touched. Touches the
`CLAUDE.md`/`tech.md` Gradle-wrapper hard rule (see Decision 1).

## Overview

Today this app only runs directly on the host: `gradlew.bat bootRun` (backend, `:8080`) and `npm
run dev` (frontend, `:5173`), either manually (`RUNBOOK.md`) or via `scripts/start-dev.sh`
(`tooling_spec_009`). There is no way to run the whole app in containers.

This spec adds production-style, multi-stage Dockerfiles for both the backend and frontend, plus a
`docker-compose.yml` that wires them together, so the whole app can be started with one `docker
compose up --build`. This is modeled directly on the sibling project
`behavioural-activation`'s `tooling_spec_006_docker_production_images.md`, adapted for this
project's real differences: SQLite (not Postgres) as the datasource, no existing auth layer, and —
until this spec — no Unix `gradlew` checked in.

**Out of scope**: PostgreSQL migration (the production datasource is "planned, not yet configured
anywhere in this repo" per `tech.md` — swapping it in is its own future spec, not bundled into
containerizing what exists today), cloud/Fly.io/Railway deployment, Tailscale, TLS/HTTPS
termination, CI building/pushing these images, multi-arch (`linux/arm64`) builds, OMDb/TMDB API
key secrets management beyond the existing gitignored `backend/application-local.yml`/env-var
pattern already documented in `RUNBOOK.md`.

### Decision 1: add `backend/gradlew` (Unix wrapper), superseding the existing hard rule

`CLAUDE.md` and `.claude/steering/tech.md` currently state, as a hard rule, that only
`gradlew.bat` is checked in and a Unix `gradlew` should not be added "unless asked — it risks
wrapper-jar/version drift with no one to keep it in sync." A Linux-based Docker build stage cannot
invoke `gradlew.bat`, so this spec requires exactly that: the user was asked directly (given the
hard-rule conflict) and chose to add `backend/gradlew` and supersede the rule, rather than the two
alternatives considered (an image with no build stage that just packages a host-built jar; an
official `gradle:*` image for the build stage — rejected because `behavioural-activation` already
hit a real gap this way, with no exact-matching `gradle:<version>-jdk25` tag published for its
pinned version).

**Decision**: `backend/gradlew` (and its `backend/gradle/wrapper/gradle-wrapper.jar` companion,
already present for `gradlew.bat`) is added to the repo, generated via `gradle wrapper` so it's
byte-for-byte the official launcher for the exact version already pinned in
`gradle-wrapper.properties` (`9.7.1`) — not hand-written. `backend/Dockerfile`'s build stage
invokes it directly (`./gradlew bootJar -x test --no-daemon`), mirroring
`behavioural-activation`'s pattern exactly: the Gradle version used inside the image is
guaranteed to match local/CI builds by construction, since both wrapper scripts point at the same
`gradle-wrapper.properties`. `CLAUDE.md`'s hard rule and `tech.md`'s Build Tools section are
updated in the same change as this spec's implementation to describe both wrappers as checked in,
and to note that `gradlew` must be kept in sync with `gradlew.bat` (same Gradle version, same
wrapper jar) going forward — regenerate both together via `gradle wrapper` on a version bump, never
hand-edit one.

### Decision 2: keep SQLite — no Postgres service in `docker-compose.yml`

Unlike `behavioural-activation` (Postgres via a Compose `postgres` service), this app's only
configured datasource is SQLite, file-backed at `backend/data/series.db`
(`backend/src/main/resources/application.yml`). PostgreSQL is named as the intended production
target in `tech.md` but "not yet configured anywhere in this repo" — no driver swap, no dialect
change, no connection-string handling exists for it today.

**Decision**: this spec containerizes what the app actually runs today. The `backend` Compose
service mounts a named volume at `/app/data` (matching the existing relative `./data/series.db`
path, just rooted inside the container) so the SQLite file persists across `docker compose
down`/`up` cycles, exactly like the host's gitignored `backend/data/` does today. No `postgres`
service is added. Migrating the datasource to Postgres is a candidate for a future, separate spec
if the "Now — self-hosted, personal use" hosting stage is ever revisited for this app — not bundled
here.

### Decision 3: frontend serves via nginx, reverse-proxying `/api` — no CORS config change

Mirrors `behavioural-activation`'s Decision 2 for the same reason: the frontend's production
`Dockerfile` builds the static Vite bundle (`npm run build` → `frontend/dist/`) in a Node build
stage, then serves it from an `nginx:alpine` runtime stage with a `location /api/ { proxy_pass
http://backend:8080/api/; }` block (`backend` being the Compose service's DNS name on the Compose
network) — mirroring the exact same proxy pattern `frontend/vite.config.ts` already uses for dev
(`'/api': { target: 'http://localhost:8080' }`). The browser only ever talks to one origin, so
`app.cors.allowed-origins`/`APP_CORS_ALLOWED_ORIGINS` never needs to change for the containerized
flow, even though (unlike `behavioural-activation` at the time its spec was written) this app
already supports overriding that value via env var — the simpler same-origin approach is still
preferred over exercising that override, for the same reasons Decision 2 of the reference spec
gives: one mechanism for this problem, not two.

## Requirement 1: Backend production Dockerfile

**User story**: As the person running this app, I want a Docker image that runs the Spring Boot
backend without needing Java or Gradle installed on the host.

### TOOLING-012-AC-01 [AUTO]: Backend image builds successfully
**Statement**: `backend/Dockerfile` shall define a multi-stage build: a build stage based on
`eclipse-temurin:25-jdk-alpine` running the project's own checked-in `./gradlew bootJar -x test
--no-daemon` (per Decision 1), and a runtime stage based on `eclipse-temurin:25-jre-alpine` that
copies only the built jar (`backend/build/libs/*.jar`) from the build stage and runs it via `java
-jar`. Running `docker build -t series-backend ./backend` shall exit `0` and produce a runnable
image.

**Rationale**: A multi-stage build keeps the final runtime image small (no JDK/Gradle-wrapper
cache in the shipped layer) while guaranteeing the exact same Gradle version as any local/CI build,
per Decision 1.

**References**:
- New file: `backend/Dockerfile`
- New file: `backend/.dockerignore` (excludes `build/`, `.gradle/`, `data/`, `logs/`, `*.log`,
  `application-local.yml`, `.idea/`, `*.iml` — so the build context doesn't ship host build
  artifacts, the local SQLite file, or local secrets into the image)
- New file: `backend/gradlew` (Decision 1)
- `backend/gradle/wrapper/gradle-wrapper.properties` (pins Gradle `9.7.1`, already present)
- `backend/build.gradle.kts` (Java 25 toolchain, Spring Boot `4.1.1`, `bootJar` task)

**Test Case (Green)**: `docker build -t series-backend ./backend` from the repo root exits `0`;
`docker run --rm series-backend java -version` (or an equivalent smoke check) confirms a Java 25
runtime inside the image.

### TOOLING-012-AC-02 [AUTO]: Backend image runs and serves traffic using only existing env-var config
**Statement**: The backend image shall start the Spring Boot application using only environment
variables already supported by `application.yml` (`APP_CORS_ALLOWED_ORIGINS`,
`APP_OMDB_API_KEY`/`APP_OMDB_BASE_URL`, `APP_TMDB_API_KEY`/`APP_TMDB_BASE_URL` and its other
`APP_TMDB_*` overrides) plus a container-appropriate SQLite path — no new Spring property or code
change required to run inside a container.

**Rationale**: Confirms containerizing doesn't require adding any new externalised config, only
pointing the existing SQLite URL at the mounted volume path (Decision 2).

**References**: `backend/src/main/resources/application.yml`, `RUNBOOK.md`'s Environment
Variables table

**Test Case (Green)**: run the image with `SPRING_DATASOURCE_URL=jdbc:sqlite:/app/data/series.db?busy_timeout=30000`
set and `/app/data` mounted from a Compose volume; `GET /api/v1/series` against the mapped port
returns `200` with an empty (or seeded) list, confirming the app started and Flyway migrations ran
against the mounted file.

## Requirement 2: Frontend production Dockerfile

**User story**: As the person running this app, I want a Docker image that serves the built
frontend without needing Node installed on the host, and without needing to separately configure
CORS to let it talk to the backend.

### TOOLING-012-AC-03 [AUTO]: Frontend image builds successfully
**Statement**: `frontend/Dockerfile` shall define a multi-stage build: a Node build stage running
`npm ci` then `npm run build` (producing `frontend/dist/`), and an `nginx:alpine` runtime stage
that copies `dist/` into nginx's web root plus a project-provided nginx config. Running `docker
build -t series-frontend ./frontend` shall exit `0` and produce a runnable image.

**References**:
- New file: `frontend/Dockerfile`
- New file: `frontend/.dockerignore` (excludes `node_modules/`, `dist/`, `coverage/`, `.env*`)
- New file: `frontend/nginx.conf`
- `frontend/package.json` (`npm run build` → `tsc -b && vite build`)

**Test Case (Green)**: `docker build -t series-frontend ./frontend` from the repo root exits `0`.

### TOOLING-012-AC-04 [AUTO]: Frontend container serves the SPA and proxies `/api` same-origin
**Statement**: The frontend container's nginx config shall (a) serve `frontend/dist/`'s static
files, falling back to `index.html` for any path that doesn't match a real static file (this app
uses `react-router-dom` in history mode, per `frontend/package.json`), and (b) proxy any request
under `/api/` to `http://backend:8080/api/` (the `backend` Compose service's DNS name), path
otherwise unchanged. No CORS configuration is added anywhere — satisfied precisely because the
browser only ever sees one origin, per Decision 3.

**Rationale**: Mirrors `vite.config.ts`'s existing dev-time proxy at the production layer, so
`seriesApi.ts`'s relative-path-friendly `VITE_API_BASE` handling needs no change between dev and
containerized-prod.

**References**:
- `frontend/vite.config.ts` (the dev-time proxy this mirrors)
- `frontend/src/services/seriesApi.ts` (consumes `VITE_API_BASE`, already relative-path-friendly)

**Test Case (Green)**: with both containers running via Compose, `curl
http://localhost:<frontend-port>/` returns the SPA's `index.html`; `curl
http://localhost:<frontend-port>/api/v1/series` returns the backend's JSON response (proving the
proxy reaches the backend container); a client-side route like `/settings` also returns
`index.html` (not nginx's default 404) on a direct request/refresh.

## Requirement 3: `docker-compose.yml` runs the whole app

**User story**: As the person running this app, I want one `docker compose up` to start the
backend and frontend together with a persistent SQLite volume, instead of running two scripts
directly on the host.

### TOOLING-012-AC-05 [AUTO]: `backend` and `frontend` services defined in `docker-compose.yml`
**Statement**: A new root-level `docker-compose.yml` shall define a `backend` service (built from
`backend/Dockerfile`, a named volume mounted at `/app/data` for SQLite persistence, a healthcheck
hitting `GET /api/v1/series`, `OMDB_API_KEY`/`TMDB_API_KEY` sourced from an `env_file: .env` entry
rather than inlined) and a `frontend` service (built from `frontend/Dockerfile`, `depends_on:
backend` with `condition: service_healthy`, exposing a mapped port for host access). Running
`docker compose up --build` from the repo root shall bring up both services, with the frontend
reachable from the host browser and able to list/add/search series end-to-end.

**References**:
- New file: `docker-compose.yml`
- New file: `.env.example` (root) — documents `APP_OMDB_API_KEY`/`APP_TMDB_API_KEY` placeholders,
  consistent with `RUNBOOK.md`'s existing env-var-for-secrets pattern
- `backend/src/main/resources/application.yml` (env vars the backend service is configured through)

**Test Case (Green)**: `docker compose up --build -d` from the repo root; `docker compose ps`
shows both services healthy/running; opening the mapped frontend port in a browser allows adding a
series and seeing it listed. `docker compose down` cleanly stops both; a subsequent `docker compose
up` (no `-v`) still shows the previously added series, confirming the named volume persisted it.
`docker compose down -v` removes the volume for a clean-slate retest.

### TOOLING-012-AC-06 [MANUAL]: No secret is baked into an image layer
**Statement**: Neither `backend/Dockerfile` nor `frontend/Dockerfile` shall `COPY`, `ARG`, or `ENV`
any real credential (`APP_OMDB_API_KEY`, `APP_TMDB_API_KEY`) into an image layer. All such values
shall be supplied only at container-run time via `docker-compose.yml`'s `environment`/`env_file`,
sourced from a gitignored `.env`.

**Rationale**: Matches this project's existing "never commit secrets" rule
(`.claude/steering/tech.md`'s Secrets section) — a value baked into an image layer is recoverable
from the image itself (`docker history`/layer inspection) even if never committed to git.

**References**: `.gitignore` (root), `backend/Dockerfile`, `frontend/Dockerfile`,
`docker-compose.yml`

**Verification**: `[MANUAL]` — review both Dockerfiles for any `ARG`/`ENV` line naming a
credential, and confirm `docker history series-backend`/`series-frontend` shows no secret value in
any layer command.

## Cross-references

| Reference | What it provides |
|---|---|
| `backend/build.gradle.kts` | Java 25 toolchain, Spring Boot `4.1.1`, `bootJar` output location |
| `backend/gradlew` (new), `backend/gradle/wrapper/` | Checked-in Unix wrapper the build-stage image invokes directly (Decision 1) |
| `backend/src/main/resources/application.yml` | Env vars/SQLite URL the backend container is configured through |
| `frontend/vite.config.ts` | Dev-time `/api` proxy this spec's nginx config mirrors in prod |
| `frontend/package.json` | `npm run build` → `frontend/dist/` |
| `RUNBOOK.md` | Existing `.env`/`application-local.yml` secrets pattern; gains a new "Running via Docker Compose" section |
| `.claude/steering/tech.md` | Build Tools section (gradlew hard rule, Decision 1), Secrets section, Database section |
| `CLAUDE.md` | Gradle-wrapper hard rule, updated per Decision 1 |
| `behavioural-activation/.claude/specs/tooling_spec_006_docker_production_images.md` | The sibling-project spec this one is modeled on |

## Acceptance Criteria Summary

- [x] TOOLING-012-AC-01 — `backend/Dockerfile` multi-stage build succeeds via the checked-in `gradlew`, JRE 25 runtime
- [x] TOOLING-012-AC-02 — backend image runs using only existing env-var config plus a mounted SQLite path, no new Spring property needed
- [x] TOOLING-012-AC-03 — `frontend/Dockerfile` multi-stage build succeeds
- [x] TOOLING-012-AC-04 — frontend container serves the SPA with history-mode fallback and proxies `/api` same-origin, no CORS change
- [x] TOOLING-012-AC-05 — `docker-compose.yml` defines `backend`/`frontend` with a persistent SQLite volume; `docker compose up --build` runs the whole app end-to-end
- [x] TOOLING-012-AC-06 — no secret is baked into an image layer; all sourced from a gitignored `.env` at container-run time
