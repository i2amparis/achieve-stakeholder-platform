# SvelteKit app for production (adapter-node).
# SITE_ORIGIN must be the public URL of the site, e.g. https://demo.example.org:
# SvelteKit uses it for the CSRF check on form posts.

FROM node:24.22.2-alpine AS build
WORKDIR /app
ARG SITE_ORIGIN
ENV SITE_ORIGIN=${SITE_ORIGIN}
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN test -n "$SITE_ORIGIN" || (echo "Build arg SITE_ORIGIN is required" && exit 1) \
	&& npx svelte-kit sync && npm run build && npm prune --omit=dev

FROM node:24.22.2-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "build"]
