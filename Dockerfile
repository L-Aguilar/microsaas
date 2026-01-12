# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy server source code
COPY server/ ./server/
COPY shared/ ./shared/
COPY Procfile ./

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
