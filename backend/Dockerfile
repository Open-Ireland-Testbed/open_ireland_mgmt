FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code into /app/backend to preserve package structure
COPY backend/ /app/backend/

# Set default port if not provided
ENV BACKEND_PORT=20001

# Expose the backend port
EXPOSE 20001

# Use shell form to allow environment variable expansion
# Note: main.py is at /app/backend/main.py, so we use backend.main:app
CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-20001} --reload"

