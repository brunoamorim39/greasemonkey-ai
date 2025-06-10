# GreaseMonkey AI PWA Development Makefile
# ======================================

# Variables
PWA_DIR = pwa
DOCKER_COMPOSE = docker-compose

.PHONY: help dev dev-no-stripe build prod stop clean logs install test status up down restart stripe-stop stripe-logs

# Default target
help: ## Show this help message
	@echo "GreaseMonkey AI PWA Development Commands"
	@echo "======================================="
	@echo ""
	@echo "🚀 Development Commands:"
	@echo "  dev             - Start PWA development environment (includes Stripe)"
	@echo "  dev-no-stripe   - Start PWA without Stripe webhooks"
	@echo "  prod-test       - Test production build locally"
	@echo ""
	@echo "🔨 Build Commands:"
	@echo "  build           - Build PWA for production"
	@echo "  build-dev       - Build PWA for development"
	@echo ""
	@echo "🌟 Production Commands:"
	@echo "  prod            - Run production environment"
	@echo ""
	@echo "🔧 Service Management:"
	@echo "  stop            - Stop PWA service"
	@echo "  restart         - Restart PWA service"
	@echo "  status          - Show service status"
	@echo "  logs            - View PWA logs"
	@echo "  stripe-stop     - Stop Stripe webhook forwarding"
	@echo "  stripe-logs     - View Stripe webhook logs"
	@echo ""
	@echo "📦 Setup & Maintenance:"
	@echo "  install         - Install dependencies"
	@echo "  clean           - Clean build artifacts and containers"
	@echo "  clean-all       - Nuclear clean (removes node_modules too)"
	@echo "  test            - Run tests"
	@echo ""
	@echo "Usage Examples:"
	@echo "  make dev        # Start PWA development (includes Stripe)"
	@echo "  make dev-no-stripe # Start PWA without Stripe webhooks"
	@echo "  make prod-test  # Test production build"
	@echo "  make clean      # Clean everything and start fresh"

# Development Commands
dev: install build ## Start PWA development environment
	@echo "🚀 Starting PWA development environment..."
	@echo "🧹 Cleaning up existing containers..."
	$(DOCKER_COMPOSE) down --remove-orphans
	@echo "🔧 Removing any orphaned containers..."
	@docker container prune -f || true
	@echo "📱 PWA will be available at: http://localhost:3000"
	@echo "🔥 Hot reload enabled"
	@echo "💳 Stripe webhooks forwarding enabled"
	@echo "✨ All-in-one: Frontend + API routes + Stripe webhooks"
	$(DOCKER_COMPOSE) up pwa stripe -d
	@echo "✅ PWA development environment started!"
	@echo ""
	@echo "🔗 Open: http://localhost:3000"
	@echo "💳 Stripe webhooks: Forwarding to /api/stripe/webhook"
	@echo "📊 Following logs (Ctrl+C to exit)..."
	@echo ""
	$(DOCKER_COMPOSE) logs -f pwa stripe

dev-no-stripe: install build ## Start PWA development without Stripe webhooks
	@echo "🚀 Starting PWA development environment (no Stripe)..."
	@echo "🧹 Cleaning up existing containers..."
	$(DOCKER_COMPOSE) down --remove-orphans
	@echo "🔧 Removing any orphaned containers..."
	@docker container prune -f || true
	@echo "📱 PWA will be available at: http://localhost:3000"
	@echo "🔥 Hot reload enabled"
	@echo "⚠️  Stripe webhooks disabled - payments won't work"
	@echo "✨ Minimal setup: Frontend + API routes only"
	$(DOCKER_COMPOSE) up pwa -d
	@echo "✅ PWA development environment started!"
	@echo ""
	@echo "🔗 Open: http://localhost:3000"
	@echo "📊 Following logs (Ctrl+C to exit)..."
	@echo ""
	$(DOCKER_COMPOSE) logs -f pwa

prod-test: ## Test production build locally
	@echo "🧪 Testing production build..."
	@echo "🧹 Cleaning up existing containers..."
	$(DOCKER_COMPOSE) down --remove-orphans
	@echo "📱 Production PWA will be available at: http://localhost:3001"
	$(DOCKER_COMPOSE) --profile prod up pwa-prod -d
	@echo "✅ Production test environment started!"

# Build Commands
build: install ## Build PWA for production
	@echo "🔨 Building PWA for production..."
	$(DOCKER_COMPOSE) build pwa

# Production Commands
prod: build ## Run production environment
	@echo "🌟 Starting production environment..."
	$(DOCKER_COMPOSE) --profile prod up pwa-prod -d
	@echo "✅ Production environment started!"
	@echo "🔗 PWA: http://localhost:3001"

# Service Management
stop: ## Stop PWA service
	@echo "🛑 Stopping PWA service..."
	$(DOCKER_COMPOSE) down
	@echo "✅ PWA service stopped"

restart: ## Restart PWA service
	@echo "🔄 Restarting PWA service..."
	$(DOCKER_COMPOSE) restart pwa
	@echo "✅ PWA service restarted"

status: ## Show service status
	@echo "📊 Service Status:"
	$(DOCKER_COMPOSE) ps

logs: ## View PWA logs
	@echo "📊 PWA logs (Ctrl+C to exit)..."
	$(DOCKER_COMPOSE) logs -f pwa stripe

# Setup & Maintenance
install: ## Install dependencies
	@echo "📦 Installing PWA dependencies..."
	@cd $(PWA_DIR) && npm install
	@echo "✅ Dependencies installed"

clean: ## Clean build artifacts and containers
	@echo "🧹 Cleaning build artifacts and containers..."
	$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "🗑️  Removing unused containers..."
	@docker container prune -f || true
	@echo "🗑️  Removing unused images..."
	@docker image prune -f || true
	@echo "🗑️  Removing unused networks..."
	@docker network prune -f || true
	@echo "🗑️  Cleaning .next directory using Docker..."
	@docker run --rm -v "$(CURDIR)/$(PWA_DIR):/workspace" alpine:latest sh -c "rm -rf /workspace/.next" || true
	@echo "✅ Cleanup complete (node_modules preserved)"

clean-all: ## Nuclear clean - removes everything including node_modules
	@echo "🧹 Nuclear clean - removing EVERYTHING..."
	$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "🗑️  Removing unused containers..."
	@docker container prune -f || true
	@echo "🗑️  Removing unused images..."
	@docker image prune -f || true
	@echo "🗑️  Removing unused networks..."
	@docker network prune -f || true
	@echo "🗑️  Removing unused volumes..."
	@docker volume prune -f || true
	@echo "🗑️  Cleaning build files using Docker..."
	@docker run --rm -v "$(CURDIR)/$(PWA_DIR):/workspace" alpine:latest sh -c "rm -rf /workspace/.next /workspace/node_modules" || true
	@echo "✅ Nuclear cleanup complete"
	@echo "⚠️  Run 'make install' or 'make dev' to reinstall dependencies"

test: ## Run tests
	@echo "🧪 Running tests..."
	@echo "⚠️  No tests configured yet for PWA"
	@echo "✅ Tests completed"

# Stripe Management
stripe-stop: ## Stop Stripe webhook forwarding
	@echo "🛑 Stopping Stripe webhook forwarding..."
	$(DOCKER_COMPOSE) --profile stripe stop stripe
	$(DOCKER_COMPOSE) --profile stripe rm -f stripe
	@echo "✅ Stripe webhook forwarding stopped"

stripe-logs: ## View Stripe webhook logs
	@echo "📊 Stripe webhook logs (Ctrl+C to exit)..."
	$(DOCKER_COMPOSE) logs -f stripe

# Aliases for convenience
up: dev ## Alias for dev
down: stop ## Alias for stop
