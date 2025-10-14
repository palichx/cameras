#!/bin/bash

# Entrypoint script for backend
set -e

# Wait for MongoDB to be ready
echo "Waiting for MongoDB..."
while ! nc -z mongodb 27017; do
  sleep 1
done
echo "MongoDB is ready!"

# Create recordings directory if it doesn't exist
mkdir -p /app/backend/recordings
echo "Recordings directory ready"

# Run database migrations if needed
# python migrations.py

# Start the application
exec "$@"