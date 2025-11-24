FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . ./

# Environment variable will be set by docker-compose
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

# Expose port 3000 for dev server
EXPOSE 3000

# Set PORT environment variable for React dev server
ENV PORT=3000

CMD ["npm", "start"]






