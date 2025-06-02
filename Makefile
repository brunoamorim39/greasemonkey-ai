VENV_DIR?=.venv
PYTHON?=python3

BACKEND_DIR?=backend
FRONTEND_DIR?=frontend
TOOLS_DIR?=tools
DOCKER_IMAGE?=greasemonkey-backend
DOCKER_TAG?=latest
DOCKER_PORT?=8000
FRONTEND_IMAGE?=greasemonkey-frontend
FRONTEND_TAG?=latest
FRONTEND_PORT?=8080

.PHONY: help install-deps clean build test run-backend stop-backend logs-backend run-app run-macos run-ios run-android run-web run-web-local run-web-dev run-web-frontend-only build-app build-macos build-ios build-android build-web build-web-dev serve-web flutter-clean flutter-deps

# Default target
help: ## Show this help message
	@echo "GreaseMonkey AI Development Commands"
	@echo "===================================="
	@echo ""
	@echo "Backend Commands:"
	@echo "  run-backend     - Start backend services in Docker"
	@echo "  stop-backend    - Stop backend services"
	@echo "  logs-backend    - View backend logs"
	@echo "  build-backend   - Build backend Docker image"
	@echo ""
	@echo "Flutter App Commands:"
	@echo "  run-app DEVICE=<device>  - Run Flutter app on specified device"
	@echo "  run-macos       - Run Flutter app on macOS"
	@echo "  run-ios         - Run Flutter app on iOS simulator"
	@echo "  run-android     - Run Flutter app on Android emulator"
	@echo "  run-web         - Run Flutter app on web (basic)"
	@echo ""
	@echo "Web Development Commands:"
	@echo "  run-web-local   - Run Flutter web locally with hot reload (port 8080)"
	@echo "  run-web-dev     - Run full stack (backend + frontend) for web development"
	@echo "  run-web-frontend-only - Run Flutter web frontend only (no backend)"
	@echo "  build-web-dev   - Build web app for development (with source maps)"
	@echo "  serve-web       - Build and serve web app with Python server"
	@echo ""
	@echo "Build Commands:"
	@echo "  build-app DEVICE=<device> - Build Flutter app for specified device"
	@echo "  build-macos     - Build macOS app"
	@echo "  build-ios       - Build iOS app"
	@echo "  build-android   - Build Android APK"
	@echo "  build-web       - Build web app"
	@echo ""
	@echo "Development Commands:"
	@echo "  install-deps    - Install all dependencies"
	@echo "  flutter-deps    - Install Flutter dependencies"
	@echo "  flutter-clean   - Clean Flutter build cache"
	@echo "  clean           - Clean all build artifacts"
	@echo "  test            - Run tests"
	@echo ""
	@echo "Full Stack Development:"
	@echo "  dev-macos       - Start backend + run macOS app"
	@echo "  dev-ios         - Start backend + run iOS app"
	@echo "  dev-android     - Start backend + run Android app"
	@echo "  dev-web         - Start backend + run web app"
	@echo ""
	@echo "Usage Examples:"
	@echo "  make run-app DEVICE=macos"
	@echo "  make dev-macos"
	@echo "  make build-macos"

# Variables
DEVICE ?= macos
FLUTTER_DIR = frontend

# Backend Commands
run-backend: ## Start backend services
	@echo "🚀 Starting backend services..."
	docker-compose up backend -d
	@echo "✅ Backend running at http://localhost:8000"
	@echo "📊 View logs with: make logs-backend"

stop-backend: ## Stop backend services
	@echo "🛑 Stopping backend services..."
	docker-compose down

logs-backend: ## View backend logs
	@echo "📊 Backend logs (Ctrl+C to exit)..."
	docker-compose logs -f backend

build-backend: ## Build backend Docker image
	@echo "🔨 Building backend Docker image..."
	docker-compose build backend

# Flutter App Commands
flutter-deps: ## Install Flutter dependencies
	@echo "📦 Installing Flutter dependencies..."
	cd $(FLUTTER_DIR) && flutter pub get

flutter-clean: ## Clean Flutter build cache
	@echo "🧹 Cleaning Flutter build cache..."
	cd $(FLUTTER_DIR) && flutter clean
	cd $(FLUTTER_DIR) && flutter pub get

run-app: flutter-deps ## Run Flutter app on specified device (use DEVICE=<device>)
	@echo "🚀 Running Flutter app on $(DEVICE)..."
	cd $(FLUTTER_DIR) && flutter run -d $(DEVICE)

run-macos: ## Run Flutter app on macOS
	@echo "🍎 Running Flutter app on macOS..."
	$(MAKE) run-app DEVICE=macos

run-ios: ## Run Flutter app on iOS simulator
	@echo "📱 Running Flutter app on iOS simulator..."
	$(MAKE) run-app DEVICE="iPhone 15"

run-android: ## Run Flutter app on Android emulator
	@echo "🤖 Running Flutter app on Android emulator..."
	$(MAKE) run-app DEVICE=android

run-web: ## Run Flutter app on web
	@echo "🌐 Running Flutter app on web..."
	$(MAKE) run-app DEVICE=chrome

run-web-local: ## Run Flutter web app locally with hot reload on port 8080
	@echo "🌐 Starting Flutter web app locally with hot reload..."
	@echo "🔥 Hot reload enabled - save files to see changes instantly"
	@echo "📱 Mobile view: Add '?mobile=true' to URL"
	@echo "🔗 Opening at: http://localhost:8080"
	cd $(FRONTEND_DIR) && flutter run -d chrome --web-port $(FRONTEND_PORT) --web-hostname 0.0.0.0

run-web-dev: ## Run Flutter web app in development mode with backend
	@echo "🚀 Starting full web development environment..."
	@echo "🔧 Backend will be available at: http://localhost:8000"
	@echo "🌐 Frontend will be available at: http://localhost:8080"
	$(MAKE) run-backend
	@echo "⏳ Waiting for backend to start..."
	@timeout /t 3 /nobreak >nul 2>&1 || sleep 3
	$(MAKE) run-web-local

run-web-frontend-only: ## Run Flutter web frontend only (no backend)
	@echo "🌐 Starting Flutter web frontend only..."
	@echo "⚠️  Backend features won't work without running backend separately"
	@echo "🔗 Opening at: http://localhost:8080"
	cd $(FRONTEND_DIR) && flutter run -d chrome --web-port $(FRONTEND_PORT) --web-hostname 0.0.0.0

# Build Commands
build-app: flutter-deps ## Build Flutter app for specified device (use DEVICE=<device>)
	@echo "🔨 Building Flutter app for $(DEVICE)..."
	cd $(FLUTTER_DIR) && flutter build $(DEVICE)

build-macos: ## Build macOS app
	@echo "🍎 Building macOS app..."
	cd $(FLUTTER_DIR) && flutter build macos

build-ios: ## Build iOS app
	@echo "📱 Building iOS app..."
	cd $(FLUTTER_DIR) && flutter build ios

build-android: ## Build Android APK
	@echo "🤖 Building Android APK..."
	cd $(FLUTTER_DIR) && flutter build apk

build-web: ## Build web app
	@echo "🌐 Building web app..."
	cd $(FLUTTER_DIR) && flutter build web

build-web-dev: ## Build web app for development (with source maps)
	@echo "🔨 Building web app for development..."
	cd $(FRONTEND_DIR) && flutter build web --debug --source-maps

serve-web: build-web ## Build and serve web app locally with Python server
	@echo "🌐 Building and serving web app..."
	cd $(FRONTEND_DIR)/build/web && python -m http.server 8080
	@echo "🔗 Web app available at: http://localhost:8080"

# Full Stack Development (Backend + Frontend)
dev-macos: ## Start backend and run macOS app
	@echo "🚀 Starting full development environment for macOS..."
	$(MAKE) run-backend
	@echo "⏳ Waiting for backend to start..."
	@sleep 3
	$(MAKE) run-macos

dev-ios: ## Start backend and run iOS app
	@echo "🚀 Starting full development environment for iOS..."
	$(MAKE) run-backend
	@echo "⏳ Waiting for backend to start..."
	@sleep 3
	$(MAKE) run-ios

dev-android: ## Start backend and run Android app
	@echo "🚀 Starting full development environment for Android..."
	$(MAKE) run-backend
	@echo "⏳ Waiting for backend to start..."
	@sleep 3
	$(MAKE) run-android

dev-web: ## Start backend and run web app
	@echo "🚀 Starting full development environment for web..."
	$(MAKE) run-backend
	@echo "⏳ Waiting for backend to start..."
	@sleep 3
	$(MAKE) run-web

# Development Commands
install-deps: ## Install all dependencies
	@echo "📦 Installing all dependencies..."
	$(MAKE) flutter-deps
	@echo "✅ All dependencies installed!"

clean: ## Clean all build artifacts
	@echo "🧹 Cleaning all build artifacts..."
	$(MAKE) flutter-clean
	docker-compose down --volumes --remove-orphans
	docker system prune -f

test: ## Run tests
	@echo "🧪 Running tests..."
	cd $(FLUTTER_DIR) && flutter test
	cd $(BACKEND_DIR) && python -m pytest

# Package/Deploy Commands
package-macos: build-macos ## Package macOS app for distribution
	@echo "📦 Packaging macOS app..."
	@echo "✅ macOS app built at: $(FLUTTER_DIR)/build/macos/Build/Products/Release/greasemonkey_ai.app"

package-ios: build-ios ## Package iOS app for distribution
	@echo "📦 Packaging iOS app..."
	cd $(FLUTTER_DIR) && flutter build ipa
	@echo "✅ iOS app built at: $(FLUTTER_DIR)/build/ios/ipa/"

package-android: build-android ## Package Android app for distribution
	@echo "📦 Packaging Android app..."
	@echo "✅ Android APK built at: $(FLUTTER_DIR)/build/app/outputs/flutter-apk/app-release.apk"

# Utility Commands
check-devices: ## List available devices
	@echo "📱 Available devices:"
	cd $(FLUTTER_DIR) && flutter devices

doctor: ## Run Flutter doctor
	@echo "🩺 Running Flutter doctor..."
	cd $(FLUTTER_DIR) && flutter doctor

# Environment setup
setup-env: ## Set up development environment
	@echo "🛠️  Setting up development environment..."
	@echo "📦 Installing Flutter dependencies..."
	$(MAKE) flutter-deps
	@echo "🩺 Running Flutter doctor..."
	$(MAKE) doctor
	@echo "✅ Environment setup complete!"
