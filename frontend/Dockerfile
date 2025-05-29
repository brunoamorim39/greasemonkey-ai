# Use the official Flutter image to build the web app
FROM ghcr.io/cirruslabs/flutter:latest AS build
WORKDIR /app
COPY . .
RUN flutter pub get && flutter build web

# Use a simple web server to serve the built files
FROM nginx:alpine
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
