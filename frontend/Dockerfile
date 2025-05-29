# Use the official Flutter image to build the web app
FROM ghcr.io/cirruslabs/flutter:latest AS build

# Create a non-root user and group (Debian-style)
RUN groupadd -r appgroup && useradd -r -g appgroup -ms /bin/bash -d /app appuser

WORKDIR /app

# Copy pubspec files and get dependencies first to leverage Docker cache
COPY pubspec.* .

# Change ownership of /app to the new user for subsequent operations
RUN chown -R appuser:appgroup /app

# Allow appuser to write to specific Flutter SDK directories
# This must be done as root before switching user
RUN mkdir -p /sdks/flutter/bin/cache && \
    chown -R appuser:appgroup /sdks/flutter/bin/cache && \
    mkdir -p /sdks/flutter/packages/flutter_tools && \
    chown -R appuser:appgroup /sdks/flutter/packages/flutter_tools

# Switch to the non-root user
USER appuser

# Add the Flutter SDK directory to git's safe.directory to prevent dubious ownership errors
# This needs to run as the user who will execute flutter commands.
RUN git config --global --add safe.directory /sdks/flutter

RUN flutter pub get

# Copy the rest of the application code
# Important: Ensure ownership is correct after copying if files are owned by root from host
# COPY --chown=appuser:appgroup . .
# However, COPY . . should be fine if USER appuser is already set,
# as subsequent commands run as appuser.
# Let's copy first, then ensure ownership for the build step if needed,
# but flutter build web should also run as appuser.
COPY . .

# Ensure .env file is accessible if needed during build (though it's better to pass build args for keys)
# If PICOVOICE_ACCESS_KEY is needed at build time, consider using --build-arg in docker-compose
# COPY .env .env

RUN flutter build web

# Use a simple web server to serve the built files
FROM nginx:alpine
# Nginx by default serves on port 80. If you need 8080, you'd configure nginx
# For simplicity, we'll map host 8080 to container 80.
COPY --from=build /app/build/web /usr/share/nginx/html
# EXPOSE 80 (nginx default, EXPOSE is documentation, actual port is mapped in docker-compose)
CMD ["nginx", "-g", "daemon off;"]
