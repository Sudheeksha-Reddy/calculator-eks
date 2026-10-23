# Base image: Node 24 on Alpine Linux (small, around 50 MB)
FROM node:24-alpine

# All following commands run inside /app in the image
WORKDIR /app

# Tells Node and npm this is production (skips dev-only behaviour)
ENV NODE_ENV=production

# Copy only the dependency files first, so Docker can cache the
# npm install layer when only app code changes
COPY package.json package-lock.json ./

# Install exact versions from package-lock.json, without dev dependencies
RUN npm ci --omit=dev

# Copy the app code (tests stay out, see .dockerignore)
COPY src ./src

# Run as the built-in non-root "node" user, not root
USER node

# Documents the port the app listens on
EXPOSE 3000

# Command that starts the container
CMD ["node", "src/server.js"]
