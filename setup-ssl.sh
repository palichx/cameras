#!/bin/bash

# SSL Certificate Setup Script for VideoGuard
# This script helps obtain and setup SSL certificates using Let's Encrypt

set -e

DOMAIN=${1:-yourdomain.com}
EMAIL=${2:-admin@yourdomain.com}

echo "====================================="
echo "VideoGuard SSL Certificate Setup"
echo "====================================="
echo ""
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Check if domain is provided
if [ "$DOMAIN" = "yourdomain.com" ]; then
    echo "Error: Please provide your actual domain name"
    echo "Usage: ./setup-ssl.sh yourdomain.com admin@yourdomain.com"
    exit 1
fi

# Create directories
echo "Creating directories..."
mkdir -p nginx/ssl
mkdir -p certbot/www

# Create initial nginx config without SSL
echo "Creating temporary nginx config..."
cat > nginx/nginx-temp.conf << 'EOF'
user nginx;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name _;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 200 "Waiting for SSL certificate...";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Start nginx temporarily
echo "Starting temporary nginx server..."
docker run -d --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/nginx/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/certbot/www:/var/www/certbot:ro \
    nginx:alpine

echo "Waiting for nginx to start..."
sleep 3

# Obtain certificate
echo "Obtaining SSL certificate from Let's Encrypt..."
docker run --rm \
    -v $(pwd)/certbot/www:/var/www/certbot \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Stop temporary nginx
echo "Stopping temporary nginx..."
docker stop nginx-temp
docker rm nginx-temp

# Copy certificates
echo "Copying certificates..."
cp nginx/ssl/live/$DOMAIN/fullchain.pem nginx/ssl/
cp nginx/ssl/live/$DOMAIN/privkey.pem nginx/ssl/

# Update nginx config with actual domain
echo "Updating nginx configuration..."
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/nginx-ssl.conf

echo ""
echo "====================================="
echo "SSL Certificate Setup Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Update .env file with your domain: DOMAIN=$DOMAIN"
echo "2. Update docker-compose.prod.yml with your domain"
echo "3. Start the application: make prod-up"
echo ""
echo "Certificate will be available at:"
echo "  - nginx/ssl/fullchain.pem"
echo "  - nginx/ssl/privkey.pem"
echo ""
echo "Certificate renewal:"
echo "  - Automatic renewal setup: ./setup-ssl-renewal.sh"
echo ""
