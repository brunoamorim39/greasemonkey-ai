#!/bin/bash

echo "🔨 Building GreaseMonkey AI Android APK locally with Docker..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -f Dockerfile.android -t greasemonkey-android-builder .

# Run the build
echo "🏗️ Building APK..."
docker run --rm -v $(pwd)/build:/workspace/build greasemonkey-android-builder

echo "✅ Build complete! APK should be in build/app/outputs/flutter-apk/"
echo "📱 Install with: adb install build/app/outputs/flutter-apk/app-release.apk"
