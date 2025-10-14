#!/bin/bash

# Script to add all necessary files to Git for VideoGuard

echo "================================================"
echo "Adding VideoGuard Files to Git"
echo "================================================"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "Error: Not a git repository"
    echo "Run: git init"
    exit 1
fi

echo "Adding critical files..."
echo ""

# Function to add file and check
add_file() {
    local file=$1
    if [ -f "$file" ]; then
        git add "$file" 2>/dev/null
        if git diff --cached --name-only | grep -q "$file"; then
            echo "✓ Added: $file"
        else
            echo "⚠ Already tracked or unchanged: $file"
        fi
    else
        echo "✗ Not found: $file"
    fi
}

# Root level files
echo "Root Level:"
add_file "package.json"
add_file "docker-compose.yml"
add_file "docker-compose.dev.yml"
add_file "docker-compose.prod.yml"
add_file "Makefile"
add_file ".dockerignore"
add_file ".gitignore"
add_file "README.md"
add_file "QUICKSTART.md"
add_file "DOCKER_README.md"
add_file "HTTP_CAMERAS_GUIDE.md"
add_file "GIT_GUIDE.md"
add_file "DOCKER_TROUBLESHOOTING.md"
add_file "YARN_LOCK_TROUBLESHOOTING.md"
add_file "FIX_YARN_LOCK.md"
add_file ".env.example"
add_file "setup-ssl.sh"
add_file "verify-docker-setup.sh"
add_file "verify-git-setup.sh"
echo ""

# Backend files
echo "Backend Files:"
add_file "backend/server.py"
add_file "backend/requirements.txt"
add_file "backend/Dockerfile"
add_file "backend/Dockerfile.dev"
add_file "backend/Dockerfile.ubuntu"
add_file "backend/Dockerfile.minimal"
add_file "backend/.dockerignore"
add_file "backend/.gitignore"
add_file "backend/healthcheck.sh"
add_file "backend/entrypoint.sh"
add_file "backend/.env.docker.example"
echo ""

# Frontend files
echo "Frontend Files:"
add_file "frontend/package.json"
add_file "frontend/yarn.lock"
add_file "frontend/Dockerfile"
add_file "frontend/Dockerfile.npm"
add_file "frontend/Dockerfile.simple"
add_file "frontend/nginx.conf"
add_file "frontend/.dockerignore"
add_file "frontend/.gitignore"
add_file "frontend/.env.docker.example"
add_file "frontend/tailwind.config.js"
add_file "frontend/postcss.config.js"
echo ""

# Add all src files
echo "Frontend Source Files:"
if [ -d "frontend/src" ]; then
    git add frontend/src/
    echo "✓ Added: frontend/src/"
fi

if [ -d "frontend/public" ]; then
    git add frontend/public/
    echo "✓ Added: frontend/public/"
fi
echo ""

# Nginx config
echo "Nginx Configuration:"
add_file "nginx/nginx-ssl.conf"
echo ""

# Show what will be committed
echo "================================================"
echo "Summary of Changes"
echo "================================================"
echo ""

STAGED_COUNT=$(git diff --cached --name-only | wc -l)

if [ $STAGED_COUNT -eq 0 ]; then
    echo "No new files to commit. All files are already tracked."
else
    echo "Files staged for commit: $STAGED_COUNT"
    echo ""
    echo "Staged files:"
    git diff --cached --name-only
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff --cached"
    echo "  2. Commit: git commit -m 'Add VideoGuard project files'"
    echo "  3. Push: git push origin main"
fi

# Check for files that might be ignored
echo ""
echo "Checking for potentially ignored files..."
echo ""

CRITICAL_FILES=(
    "frontend/yarn.lock"
    "frontend/package.json"
    "backend/requirements.txt"
    "docker-compose.yml"
)

IGNORED_COUNT=0
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        if git check-ignore -q "$file"; then
            echo "⚠ WARNING: $file is ignored by .gitignore"
            ((IGNORED_COUNT++))
        fi
    fi
done

if [ $IGNORED_COUNT -gt 0 ]; then
    echo ""
    echo "⚠ Found $IGNORED_COUNT critical files that are ignored!"
    echo "Fix .gitignore and run this script again."
else
    echo "✓ All critical files are trackable"
fi
