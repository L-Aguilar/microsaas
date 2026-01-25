# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and TypeScript config
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (backend only)
RUN npm install

# Copy server source code
COPY server/ ./server/

# Expose port
EXPOSE 8080

# Start the server using the production start command
CMD ["npm", "run", "start:prod"]
