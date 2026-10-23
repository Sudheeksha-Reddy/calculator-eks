# ---------- Stage 1: install dependencies (npm is needed only here) ----------
FROM node:24-alpine AS deps

WORKDIR /app

# Copy only the dependency files first, so Docker can cache the
# npm install layer when only app code changes
COPY package.json package-lock.json ./

# Install exact versions from package-lock.json, without dev dependencies
RUN npm ci --omit=dev

# ---------- Stage 2: final runtime image (no npm inside) ----------
FROM node:24-alpine

WORKDIR /app

# Tells Node and Express this is production
ENV NODE_ENV=production

# Remove package managers: the app does not need them at runtime, and their
# bundled packages were the source of the HIGH vulnerabilities Trivy found
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Take only the installed dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Run as the built-in non-root "node" user, not root
USER node

# Documents the port the app listens on
EXPOSE 3000

# Command that starts the container
CMD ["node", "src/server.js"]
