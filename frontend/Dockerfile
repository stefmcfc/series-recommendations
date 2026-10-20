# Build stage: produces the static Vite bundle. VITE_API_BASE is baked in as a relative path
# (not the dev-time absolute http://localhost:8080/api/v1 default in seriesApi.ts) so the built
# bundle calls same-origin /api/v1/... in production, which nginx below reverse-proxies to the
# backend Compose service -- see tooling_spec_012's Decision 3.
FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ENV VITE_API_BASE=/api/v1
RUN npm run build

# Runtime stage: nginx serves the static bundle and reverse-proxies /api/ to the backend
# Compose service, keeping the browser on a single origin -- see tooling_spec_012's Decision 3.
# No secret is COPY'd, ARG'd, or ENV'd here (TOOLING-012-AC-06) -- the frontend never needs
# APP_OMDB_API_KEY/APP_TMDB_API_KEY itself, only the backend does.
FROM nginx:alpine
COPY --from=build /workspace/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# docker:S6471 -- run as the image's existing unprivileged "nginx" user instead of root.
# /var/cache/nginx (worker temp dirs, created lazily at startup) and /run (nginx.pid) are the
# only two paths nginx actually needs to write to that root owns by default; nginx.conf's pid
# path is /run/nginx.pid, and /var/run is just a symlink to it. Paired with nginx.conf's
# listen 8080 (binding <1024 needs a capability grant a non-root process doesn't have).
RUN chown -R nginx:nginx /var/cache/nginx /run
USER nginx
EXPOSE 8080
