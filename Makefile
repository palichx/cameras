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
	docker-compose build --no-cache

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

# Quick commands
quick-start: dev-up dev-logs

quick-stop: dev-down