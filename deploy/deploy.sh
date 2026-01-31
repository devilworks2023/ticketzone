#!/bin/bash

# TicketZone - Deploy Script for Hestia VPS
# Server: 82.223.44.155
# Usage: Run this script from the project root directory

set -e

echo "=========================================="
echo "  TicketZone - Deployment Script"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo -e "${RED}Error: app.json not found.${NC}"
    echo "Please run this script from the project root directory."
    echo "Example: cd /home/tiri/web/tickets.devil-works.com/public_html && bash deploy/deploy.sh"
    exit 1
fi

if [ ! -d "deploy" ]; then
    echo -e "${RED}Error: deploy folder not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project structure verified${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is available${NC}"

# Stop existing container if running
echo ""
echo "Stopping existing containers..."
docker stop ticketzone-web 2>/dev/null || true
docker rm ticketzone-web 2>/dev/null || true

# Build and run
echo ""
echo "Building and starting TicketZone..."
echo "This may take a few minutes on first build..."
echo ""

cd deploy
docker compose up -d --build

echo ""
echo -e "${GREEN}=========================================="
echo "  Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Container: ticketzone-web"
echo "Port: 3080"
echo ""
echo "Check status: docker ps"
echo "View logs: docker logs ticketzone-web"
echo ""
echo -e "${YELLOW}Configure Hestia proxy to forward to port 3080${NC}"
echo ""
