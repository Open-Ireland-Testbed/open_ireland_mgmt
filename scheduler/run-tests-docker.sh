#!/bin/bash
# Docker-based test runner for Lab Scheduler
# This runs all tests in Docker containers, ensuring consistent environments

set -e

echo "🐳 Running Lab Scheduler Test Suite (Docker)"
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    echo -e "${YELLOW}   Please install Docker: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not available${NC}"
    echo -e "${YELLOW}   Please install Docker Compose${NC}"
    exit 1
fi

# Use docker compose (newer) or docker-compose (older)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo ""
echo -e "${BLUE}Running Backend Tests in Docker...${NC}"
echo "----------------------------------------"

# Run backend tests
if $DOCKER_COMPOSE -f docker-compose.test.yml run --rm backend-test; then
    BACKEND_TESTS_PASSED=true
    echo -e "${GREEN}✅ Backend tests passed!${NC}"
else
    BACKEND_TESTS_PASSED=false
    echo -e "${RED}❌ Backend tests failed!${NC}"
fi

echo ""
echo -e "${BLUE}Running Frontend Tests in Docker...${NC}"
echo "----------------------------------------"

# Run frontend tests
if $DOCKER_COMPOSE -f docker-compose.test.yml run --rm frontend-test; then
    FRONTEND_TESTS_PASSED=true
    echo -e "${GREEN}✅ Frontend tests passed!${NC}"
else
    FRONTEND_TESTS_PASSED=false
    echo -e "${RED}❌ Frontend tests failed!${NC}"
fi

# Cleanup
echo ""
echo "Cleaning up test containers..."
$DOCKER_COMPOSE -f docker-compose.test.yml down -v 2>/dev/null || true

# Final summary
echo ""
echo "============================================"
if [ "$BACKEND_TESTS_PASSED" = true ] && [ "$FRONTEND_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
elif [ "$BACKEND_TESTS_PASSED" = true ]; then
    echo -e "${YELLOW}⚠️  Backend tests passed, but frontend tests failed${NC}"
    exit 1
elif [ "$FRONTEND_TESTS_PASSED" = true ]; then
    echo -e "${YELLOW}⚠️  Frontend tests passed, but backend tests failed${NC}"
    exit 1
else
    echo -e "${RED}❌ Both test suites failed${NC}"
    exit 1
fi

