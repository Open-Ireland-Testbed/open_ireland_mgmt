FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source
COPY . ./

# Environment variables will be set by docker-compose
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SCHEDULER_API_URL=${REACT_APP_SCHEDULER_API_URL}

# Expose port 3001 for dev server
EXPOSE 3001

# Set PORT for CRA dev server
ENV PORT=3001

CMD ["npm", "start"]

