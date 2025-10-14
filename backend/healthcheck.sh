#!/bin/bash

# Health check script for backend
set -e

# Check if server is responding
curl -f http://localhost:8001/api/ || exit 1

echo "Backend is healthy"