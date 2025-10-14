#!/bin/bash

# Git Setup Verification Script for VideoGuard
# Checks that all necessary files are properly tracked in Git

echo "================================================"
echo "VideoGuard Git Setup Verification"
echo "================================================"
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠ Not a git repository${NC}"
    echo "Run: git init"
    exit 1
fi

echo "Checking critical files..."
echo ""

# Function to check if file is tracked or would be tracked
check_tracked() {
    local file=$1
    local required=$2
    
    if [ ! -f "$file" ]; then
        if [ "$required" = "required" ]; then
            echo -e "${RED}✗ $file - MISSING${NC}"
            ((ERRORS++))
        fi
        return
    fi
    
    # Check if file is ignored
    if git check-ignore -q "$file" 2>/dev/null; then
        echo -e "${RED}✗ $file - IGNORED by .gitignore${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ $file${NC}"
    fi
}

# Critical files that MUST be in git
echo "Critical Files (must be tracked):"
check_tracked "package.json" "optional"
check_tracked "docker-compose.yml" "required"
check_tracked "docker-compose.dev.yml" "required"
check_tracked "Makefile" "required"
check_tracked "README.md" "required"
echo ""

echo "Backend Files:"
check_tracked "backend/requirements.txt" "required"
check_tracked "backend/Dockerfile" "required"
check_tracked "backend/server.py" "required"
check_tracked "backend/.dockerignore" "required"
echo ""

echo "Frontend Files:"
check_tracked "frontend/package.json" "required"
check_tracked "frontend/yarn.lock" "required"
check_tracked "frontend/Dockerfile" "required"
check_tracked "frontend/nginx.conf" "required"
check_tracked "frontend/.dockerignore" "required"
check_tracked "frontend/src/App.js" "required"
echo ""

# Check that large files are ignored
echo "Checking that large files are ignored..."
echo ""

check_ignored() {
    local pattern=$1
    local description=$2
    
    # Check if pattern is in .gitignore
    if grep -q "^${pattern}$" .gitignore 2>/dev/null || \
       grep -q "^${pattern}/" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓ $description is ignored${NC}"
    else
        echo -e "${YELLOW}⚠ $description is NOT ignored${NC}"
        echo "  Add to .gitignore: $pattern"
        ((WARNINGS++))
    fi
}

check_ignored "node_modules" "node_modules/"
check_ignored ".venv" "Python virtual env"
check_ignored "*.log" "Log files"
check_ignored ".env" "Environment files"
echo ""

# Check yarn.lock specifically
echo "Checking yarn.lock status..."
if [ -f "frontend/yarn.lock" ]; then
    if git check-ignore -q "frontend/yarn.lock"; then
        echo -e "${RED}✗ yarn.lock is IGNORED - This will break Docker build!${NC}"
        echo "  Fix: Remove .yarn/* from .gitignore or add !yarn.lock"
        ((ERRORS++))
    else
        if git ls-files --error-unmatch frontend/yarn.lock >/dev/null 2>&1; then
            echo -e "${GREEN}✓ yarn.lock is tracked in git${NC}"
        else
            echo -e "${YELLOW}⚠ yarn.lock exists but not committed yet${NC}"
            echo "  Run: git add frontend/yarn.lock"
            ((WARNINGS++))
        fi
    fi
else
    echo -e "${RED}✗ frontend/yarn.lock does not exist${NC}"
    echo "  Run: cd frontend && yarn install"
    ((ERRORS++))
fi
echo ""

# Check for common mistakes
echo "Checking for common mistakes..."
echo ""

# Check if node_modules is tracked
if git ls-files | grep -q "node_modules"; then
    echo -e "${RED}✗ node_modules is tracked in git (should be ignored)${NC}"
    echo "  Fix: git rm -r --cached node_modules && echo 'node_modules/' >> .gitignore"
    ((ERRORS++))
else
    echo -e "${GREEN}✓ node_modules is not tracked${NC}"
fi

# Check if .env files are tracked
if git ls-files | grep -E "\.env$" | grep -v ".env.example"; then
    echo -e "${RED}✗ .env file is tracked (contains secrets!)${NC}"
    echo "  Fix: git rm --cached .env && echo '.env' >> .gitignore"
    echo "  IMPORTANT: Change all secrets that were in the file!"
    ((ERRORS++))
else
    echo -e "${GREEN}✓ No .env files tracked${NC}"
fi

# Check if recordings are tracked
if git ls-files | grep -E "recordings/.*\.(mp4|avi)"; then
    echo -e "${YELLOW}⚠ Video recordings are tracked (large files)${NC}"
    echo "  Consider: git rm --cached recordings/*.mp4"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓ No large video files tracked${NC}"
fi

# Check if __pycache__ is tracked
if git ls-files | grep -q "__pycache__"; then
    echo -e "${RED}✗ __pycache__ is tracked${NC}"
    echo "  Fix: git rm -r --cached **/__pycache__ && echo '__pycache__/' >> .gitignore"
    ((ERRORS++))
else
    echo -e "${GREEN}✓ __pycache__ is not tracked${NC}"
fi
echo ""

# Check .gitignore patterns
echo "Checking .gitignore patterns..."
echo ""

required_patterns=(
    "node_modules"
    "\.env"
    "__pycache__"
    "\.log"
)

for pattern in "${required_patterns[@]}"; do
    if grep -q "$pattern" .gitignore; then
        echo -e "${GREEN}✓ Pattern $pattern found in .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠ Pattern $pattern NOT found in .gitignore${NC}"
        ((WARNINGS++))
    fi
done
echo ""

# Repository size check
echo "Repository size check..."
REPO_SIZE=$(du -sh .git 2>/dev/null | cut -f1)
echo "Repository size: $REPO_SIZE"

if command -v git &> /dev/null; then
    LARGE_FILES=$(git rev-list --objects --all | \
        git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
        awk '/^blob/ {if($3>1000000) print $3/1048576 " MB\t" $4}' | \
        sort -rn | head -5)
    
    if [ -n "$LARGE_FILES" ]; then
        echo ""
        echo "Largest files in repository:"
        echo "$LARGE_FILES"
    fi
fi
echo ""

# Summary
echo "================================================"
echo "Verification Summary"
echo "================================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your git setup is correct. Ready to commit!"
    echo ""
    echo "Next steps:"
    echo "  git add ."
    echo "  git commit -m 'Initial commit'"
    echo "  git push"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed${NC}"
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "You can proceed, but consider fixing the warnings."
else
    echo -e "${RED}✗ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    fi
    echo ""
    echo "Please fix the errors before committing."
    echo ""
    echo "See GIT_GUIDE.md for detailed instructions."
    exit 1
fi
