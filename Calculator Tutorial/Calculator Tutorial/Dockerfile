# Production Dockerfile for Modern Glassmorphism Calculator
# Base image: Ultra-lightweight Alpine Linux with Nginx web server
FROM nginx:alpine

# Label metadata
LABEL maintainer="Calculator Project"
LABEL description="Production container for Glassmorphism Calculator, Currency & Unit Converter PWA"

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy web app static files into Nginx public directory
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY script.js /usr/share/nginx/html/script.js
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY sw.js /usr/share/nginx/html/sw.js
COPY icon-512.svg /usr/share/nginx/html/icon-512.svg
COPY calculator-mobile.html /usr/share/nginx/html/calculator-mobile.html

# Expose HTTP port 80
EXPOSE 80

# Health check to ensure the container is serving traffic
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
