# Admin panel (Next.js) for Cloud Run.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_MAP_STYLE_LIGHT=https://tiles.openfreemap.org/styles/positron
ARG NEXT_PUBLIC_MAP_STYLE_DARK=https://tiles.openfreemap.org/styles/dark
ARG NEXT_PUBLIC_API_PUBLIC_ORIGIN=https://api.baskaistanbulyok.com
ENV NEXT_PUBLIC_MAP_STYLE_LIGHT=$NEXT_PUBLIC_MAP_STYLE_LIGHT
ENV NEXT_PUBLIC_MAP_STYLE_DARK=$NEXT_PUBLIC_MAP_STYLE_DARK
ENV NEXT_PUBLIC_API_PUBLIC_ORIGIN=$NEXT_PUBLIC_API_PUBLIC_ORIGIN
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
