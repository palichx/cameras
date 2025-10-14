# VideoGuard - Makefile for Docker operations

.PHONY: help build up down logs clean restart backend-logs frontend-logs db-logs dev-up dev-down prod-up prod-down

# Default target
help:
	@echo "VideoGuard - Docker Management Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev-up          - Start development environment"
	@echo "  make dev-down        - Stop development environment"
	@echo "  make dev-logs        - View development logs"
	@echo ""
	@echo "Production:"
	@echo "  make build           - Build production images"
	@echo "  make build-nc        - Build without cache (for troubleshooting)"
	@echo "  make up              - Start production environment"
	@echo "  make down            - Stop production environment"
	@echo "  make restart         - Restart production environment"
	@echo ""
	@echo "Logs:"
	@echo "  make logs            - View all logs"
	@echo "  make backend-logs    - View backend logs"
	@echo "  make frontend-logs   - View frontend logs"
	@echo "  make db-logs         - View database logs"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean           - Remove containers, volumes, and images"
	@echo "  make prune           - Remove unused Docker resources"
	@echo "  make verify          - Verify Docker setup"
	@echo ""
	@echo "Troubleshooting:"
	@echo "  make build-ubuntu    - Build using Ubuntu base image"
	@echo "  make build-minimal   - Build minimal version"
	@echo "  make shell-backend   - Open backend container shell"
	@echo "  make shell-frontend  - Open frontend container shell"

# Development commands
dev-up:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "\nDevelopment environment started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8001"
	@echo "MongoDB:  mongodb://admin:admin123@localhost:27017"

dev-down:
	@echo "Stopping development environment..."
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

# Production commands
build:
	@echo "Building production images..."
	docker-compose build

build-nc:
	@echo "Building production images (no cache)..."
	docker-compose build --no-cache

build-ubuntu:
	@echo "Building with Ubuntu base image..."
	cd backend && cp Dockerfile Dockerfile.backup && cp Dockerfile.ubuntu Dockerfile && cd ..
	docker-compose build backend
	@echo "Build complete! Restore original Dockerfile if needed: cd backend && mv Dockerfile.backup Dockerfile"

build-minimal:
	@echo "Building minimal version..."
	cd backend && cp Dockerfile Dockerfile.backup && cp Dockerfile.minimal Dockerfile && cd ..
	docker-compose build backend
	@echo "Build complete! Restore original Dockerfile if needed: cd backend && mv Dockerfile.backup Dockerfile"

build-frontend-npm:
	@echo "Building frontend with npm instead of yarn..."
	cd frontend && cp Dockerfile Dockerfile.backup && cp Dockerfile.npm Dockerfile && cd ..
	docker-compose build frontend
	@echo "Build complete! Restore: cd frontend && mv Dockerfile.backup Dockerfile"

build-frontend-simple:
	@echo "Building frontend with simplified Dockerfile..."
	cd frontend && cp Dockerfile Dockerfile.backup && cp Dockerfile.simple Dockerfile && cd ..
	docker-compose build frontend
	@echo "Build complete! Restore: cd frontend && mv Dockerfile.backup Dockerfile"

up:
	@echo "Starting production environment..."
	docker-compose up -d
	@echo "\nProduction environment started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8001"

down:
	@echo "Stopping production environment..."
	docker-compose down

restart:
	@echo "Restarting production environment..."
	docker-compose restart

# Logs
logs:
	docker-compose logs -f

backend-logs:
	docker-compose logs -f backend

frontend-logs:
	docker-compose logs -f frontend

db-logs:
	docker-compose logs -f mongodb

# Maintenance
clean:
	@echo "Cleaning up Docker resources..."
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	@echo "Removing images..."
	docker rmi videoguard-backend videoguard-frontend 2>/dev/null || true
	@echo "Clean complete!"

prune:
	@echo "Removing unused Docker resources..."
	docker system prune -af --volumes
	@echo "Prune complete!"

verify:
	@echo "Verifying Docker setup..."
	@./verify-docker-setup.sh

# Health checks
health:
	@echo "Checking service health..."
	@echo "\nBackend:"
	@curl -f http://localhost:8001/api/ || echo "Backend not responding"
	@echo "\n\nFrontend:"
	@curl -f http://localhost:3000/health || echo "Frontend not responding"
	@echo "\n\nMongoDB:"
	@docker exec videoguard-mongodb mongosh --eval "db.adminCommand('ping')" --quiet || echo "MongoDB not responding"

# Database operations
db-shell:
	@echo "Opening MongoDB shell..."
	docker exec -it videoguard-mongodb mongosh -u admin -p admin123

db-backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	docker exec videoguard-mongodb mongodump --uri="mongodb://admin:admin123@localhost:27017" --out=/tmp/backup
	docker cp videoguard-mongodb:/tmp/backup ./backups/backup-$$(date +%Y%m%d-%H%M%S)
	@echo "Backup created in ./backups/"

db-restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup directory name: " backup && \
	docker cp ./backups/$$backup videoguard-mongodb:/tmp/restore && \
	docker exec videoguard-mongodb mongorestore --uri="mongodb://admin:admin123@localhost:27017" /tmp/restore

# Troubleshooting
shell-backend:
	@echo "Opening backend container shell..."
	docker exec -it videoguard-backend bash || docker exec -it videoguard-backend-dev bash

shell-frontend:
	@echo "Opening frontend container shell..."
	docker exec -it videoguard-frontend sh || docker exec -it videoguard-frontend-dev sh

shell-db:
	@echo "Opening MongoDB container shell..."
	docker exec -it videoguard-mongodb bash

inspect-backend:
	@echo "Inspecting backend image..."
	docker run --rm videoguard-backend dpkg -l | grep -E 'libgl|opencv|ffmpeg'

test-build:
	@echo "Testing build with verbose output..."
	docker-compose build --progress=plain 2>&1 | tee build.log

# Quick commands
quick-start: dev-up dev-logs

quick-stop: dev-down