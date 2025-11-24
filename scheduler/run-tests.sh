#!/bin/bash
# Test runner script for Lab Scheduler
# 
# This script runs tests directly on the host system.
# For Docker-based testing (recommended), use: ./run-tests-docker.sh

# Don't exit on error - we want to handle npm missing gracefully
set +e

echo "🧪 Running Lab Scheduler Test Suite (Host System)"
echo "=================================================="
echo ""
echo -e "\033[1;33m💡 Tip: For consistent testing across environments, use:\033[0m"
echo -e "\033[1;33m   ./run-tests-docker.sh\033[0m"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend tests
echo -e "\n${BLUE}Running Backend Tests...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate 2>/dev/null || true
pip install -q -r requirements.txt
if pytest -v --tb=short; then
    BACKEND_TESTS_PASSED=true
else
    BACKEND_TESTS_PASSED=false
fi
cd ..

# Frontend tests
echo -e "\n${BLUE}Running Frontend Tests...${NC}"
cd frontend

# Try to load nvm if available (must be in a subshell to work properly)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    # Source nvm in current shell
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    # Ensure default node version is used
    if [ -d "$NVM_DIR/versions/node" ]; then
        nvm use default 2>/dev/null || true
    fi
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  npm is not installed or not in PATH.${NC}"
    echo -e "${YELLOW}   For Docker-based testing (recommended), use:${NC}"
    echo -e "${YELLOW}   ./run-tests-docker.sh${NC}"
    echo -e "${YELLOW}   Or install Node.js from: https://nodejs.org/${NC}"
    FRONTEND_TESTS_SKIPPED=true
else
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install --silent
    fi
    npm run test:ci
    FRONTEND_TESTS_SKIPPED=false
fi
cd ..

# Final summary
echo ""
if [ "$FRONTEND_TESTS_SKIPPED" = true ]; then
    if [ "$BACKEND_TESTS_PASSED" = true ]; then
        echo -e "${GREEN}✅ Backend tests passed!${NC}"
    else
        echo -e "${YELLOW}❌ Backend tests failed!${NC}"
    fi
    echo -e "${YELLOW}⚠️  Frontend tests were skipped (npm not available)${NC}"
    echo -e "${YELLOW}   To run frontend tests, please install Node.js and npm:${NC}"
    echo -e "${YELLOW}   https://nodejs.org/${NC}"
    exit $([ "$BACKEND_TESTS_PASSED" = true ] && echo 0 || echo 1)
else
    if [ "$BACKEND_TESTS_PASSED" = true ]; then
        echo -e "${GREEN}✅ All tests completed!${NC}"
        exit 0
    else
        echo -e "${YELLOW}❌ Some tests failed.${NC}"
        exit 1
    fi
fi

