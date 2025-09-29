#!/bin/bash

# Build script for BytesRevealer Nginx Docker image
# This script ensures a clean build without cache issues

echo "========================================="
echo "BytesRevealer Nginx Docker Build Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    print_message "Error: Docker is not installed!" "$RED"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_message "Warning: docker-compose not found, using 'docker compose'" "$YELLOW"
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Parse arguments
USE_SIMPLE=false
FORCE_CLEAN=false

for arg in "$@"; do
    case $arg in
        --simple)
            USE_SIMPLE=true
            shift
            ;;
        --clean)
            FORCE_CLEAN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --simple    Use simple docker-compose configuration"
            echo "  --clean     Force clean build (remove all images)"
            echo "  --help      Show this help message"
            exit 0
            ;;
    esac
done

# Select docker-compose file
if [ "$USE_SIMPLE" = true ]; then
    COMPOSE_FILE="docker-compose.nginx-simple.yml"
    print_message "Using simple configuration: $COMPOSE_FILE" "$GREEN"
else
    COMPOSE_FILE="docker-compose.nginx.yml"
    print_message "Using standard configuration: $COMPOSE_FILE" "$GREEN"
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    print_message "Error: $COMPOSE_FILE not found!" "$RED"
    exit 1
fi

# Check if Dockerfile.nginx exists
if [ ! -f "Dockerfile.nginx" ]; then
    print_message "Error: Dockerfile.nginx not found!" "$RED"
    exit 1
fi

# Check if nginx config exists
if [ ! -f "nginx/nginx-optimized.conf" ]; then
    print_message "Error: nginx/nginx-optimized.conf not found!" "$RED"
    exit 1
fi

# Clean old images if requested
if [ "$FORCE_CLEAN" = true ]; then
    print_message "\nCleaning old images..." "$YELLOW"
    docker images | grep bytesrevealer | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    docker system prune -f
fi

# Stop existing container
print_message "\nStopping existing container (if any)..." "$YELLOW"
$COMPOSE_CMD -f $COMPOSE_FILE down 2>/dev/null || true

# Build the image
print_message "\nBuilding Docker image..." "$GREEN"
print_message "This may take a few minutes on first build..." "$YELLOW"

# Build with explicit no-cache
if $COMPOSE_CMD -f $COMPOSE_FILE build --no-cache; then
    print_message "\nBuild successful!" "$GREEN"
else
    print_message "\nBuild failed! Check the error messages above." "$RED"
    exit 1
fi

# Start the container
print_message "\nStarting container..." "$GREEN"
if $COMPOSE_CMD -f $COMPOSE_FILE up -d; then
    print_message "Container started successfully!" "$GREEN"
else
    print_message "Failed to start container!" "$RED"
    exit 1
fi

# Wait for health check
print_message "\nWaiting for health check..." "$YELLOW"
sleep 5

# Check container status
if docker ps | grep -q bytesrevealer-nginx; then
    print_message "\n✓ BytesRevealer is running!" "$GREEN"
    print_message "Access it at: http://localhost:8080" "$GREEN"

    # Show container info
    echo -e "\nContainer Information:"
    docker ps --filter "name=bytesrevealer-nginx" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    # Show logs (last 10 lines)
    echo -e "\nRecent logs:"
    docker logs bytesrevealer-nginx --tail 10 2>&1 || true
else
    print_message "\n✗ Container is not running!" "$RED"
    print_message "Checking logs..." "$YELLOW"
    docker logs bytesrevealer-nginx --tail 50 2>&1 || true
    exit 1
fi

print_message "\n=========================================" "$GREEN"
print_message "Deployment Complete!" "$GREEN"
print_message "=========================================" "$GREEN"

echo -e "\nUseful commands:"
echo "  View logs:    docker logs -f bytesrevealer-nginx"
echo "  Stop:         $COMPOSE_CMD -f $COMPOSE_FILE down"
echo "  Restart:      $COMPOSE_CMD -f $COMPOSE_FILE restart"
echo "  Status:       docker ps | grep bytesrevealer"