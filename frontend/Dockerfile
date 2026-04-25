# syntax=docker/dockerfile:1

# ---------- builder ----------
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# .env.production (if present) is read automatically by `vite build` and bakes
# any VITE_* values into the bundle. Created by the deploy script before build.
COPY . .
RUN npm run build


# ---------- runtime ----------
FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
