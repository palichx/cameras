#!/bin/bash

# VideoGuard Docker Setup Test Script
# This script verifies that all Docker files are correctly set up

echo "================================================"
echo "VideoGuard Docker Setup Verification"
echo "================================================"
echo ""

ERRORS=0
WARNINGS=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo "✓ $1"
    else
        echo "✗ $1 - MISSING"
        ((ERRORS++))
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo "✓ $1/"
    else
        echo "✗ $1/ - MISSING"
        ((ERRORS++))
    fi
}

echo "Checking required files..."
echo ""

# Docker files
echo "Docker Configuration:"
check_file "docker-compose.yml"
check_file "docker-compose.dev.yml"
check_file "docker-compose.prod.yml"
check_file "Makefile"
check_file ".dockerignore"
echo ""

# Backend files
echo "Backend Files:"
check_file "backend/Dockerfile"
check_file "backend/Dockerfile.dev"
check_file "backend/.dockerignore"
check_file "backend/server.py"
check_file "backend/requirements.txt"
check_file "backend/healthcheck.sh"
check_file "backend/entrypoint.sh"
echo ""

# Frontend files
echo "Frontend Files:"
check_file "frontend/Dockerfile"
check_file "frontend/.dockerignore"
check_file "frontend/nginx.conf"
check_file "frontend/package.json"
check_file "frontend/src/App.js"
echo ""

# Environment files
echo "Environment Files:"
check_file ".env.example"
check_file ".env.production.example"
check_file "backend/.env.docker.example"
check_file "frontend/.env.docker.example"
echo ""

# Nginx files
echo "Nginx Configuration:"
check_dir "nginx"
check_file "nginx/nginx-ssl.conf"
echo ""

# Documentation
echo "Documentation:"
check_file "README.md"
check_file "DOCKER_README.md"
check_file "QUICKSTART.md"
check_file "HTTP_CAMERAS_GUIDE.md"
echo ""

# SSL setup
echo "SSL Setup:"
check_file "setup-ssl.sh"
echo ""

# Check if scripts are executable
echo "Checking file permissions..."
if [ -x "setup-ssl.sh" ]; then
    echo "✓ setup-ssl.sh is executable"
else
    echo "⚠ setup-ssl.sh is not executable (run: chmod +x setup-ssl.sh)"
    ((WARNINGS++))
fi

if [ -x "backend/healthcheck.sh" ]; then
    echo "✓ backend/healthcheck.sh is executable"
else
    echo "⚠ backend/healthcheck.sh is not executable"
    ((WARNINGS++))
fi

if [ -x "backend/entrypoint.sh" ]; then
    echo "✓ backend/entrypoint.sh is executable"
else
    echo "⚠ backend/entrypoint.sh is not executable"
    ((WARNINGS++))
fi
echo ""

# Check Docker installation
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✓ Docker installed: $DOCKER_VERSION"
else
    echo "✗ Docker not found - Please install Docker"
    ((ERRORS++))
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo "✓ Docker Compose installed: $COMPOSE_VERSION"
else
    echo "⚠ Docker Compose not found (checking for docker compose plugin...)"
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        echo "✓ Docker Compose plugin: $COMPOSE_VERSION"
    else
        echo "✗ Docker Compose not available"
        ((ERRORS++))
    fi
fi
echo ""

# Summary
echo "================================================"
echo "Verification Summary"
echo "================================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✓ All checks passed!"
    echo ""
    echo "You're ready to start VideoGuard!"
    echo ""
    echo "Quick start:"
    echo "  Development: make dev-up"
    echo "  Production:  make build && make up"
    echo ""
elif [ $ERRORS -eq 0 ]; then
    echo "✓ All critical checks passed"
    echo "⚠ $WARNINGS warning(s) found (non-critical)"
    echo ""
    echo "You can proceed, but consider fixing the warnings."
    echo ""
else
    echo "✗ $ERRORS error(s) found"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠ $WARNINGS warning(s) found"
    fi
    echo ""
    echo "Please fix the errors before proceeding."
    exit 1
fi
