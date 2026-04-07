FROM node:20-alpine AS build

# Create build directory
WORKDIR /usr/src/app

# Copy root configurations
COPY package*.json ./

# Copy client and server code
COPY src/ ./src/
COPY client/ ./client/
COPY routes*.json ./

# Install root dependencies
RUN npm ci

# Build the client
RUN cd client && npm ci && npm run build

# --- Production Image ---
FROM node:20-alpine

WORKDIR /usr/src/app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy necessary files from build stage
COPY --from=build /usr/src/app/src/ ./src/
COPY --from=build /usr/src/app/client/dist/ ./client/dist/
COPY --from=build /usr/src/app/routes.json ./

# Expose port
EXPOSE 3000

# Start the gateway
CMD [ "npm", "start" ]
