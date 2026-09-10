#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " Starting Geohost Setup on Oracle Cloud"
echo "=========================================="

# 1. Update and install dependencies
echo "[1/7] Installing system packages..."
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    golang-go gcc build-essential nginx sqlite3 curl rsync inotify-tools

# 2. Install Node.js 20 LTS if not present
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "[2/7] Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

# 3. Install cloudflared (ARM64)
if ! command -v cloudflared >/dev/null 2>&1; then
    echo "[3/7] Installing cloudflared (arm64)..."
    curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    sudo dpkg -i /tmp/cloudflared.deb || sudo apt-get install -f -y
    rm -f /tmp/cloudflared.deb
fi

# 4. Prepare directory layout
echo "[4/7] Ensuring directory structure..."
sudo mkdir -p /srv/geohost/{app,frontend,bin,nginx-configs}
sudo mkdir -p /srv/geohost/data/{quarantine,approved,rejected}
sudo chown -R ubuntu:ubuntu /srv/geohost

# 5. Build Go Backend
echo "[5/7] Building Go backend..."
cd /srv/geohost/app
go build -o /srv/geohost/bin/geohost ./cmd/server
chmod +x /srv/geohost/bin/geohost

# Install geohost systemd service
sudo cp /srv/geohost/geohost.service /etc/systemd/system/geohost.service
sudo systemctl daemon-reload
sudo systemctl enable --now geohost
sudo systemctl restart geohost

# 6. Build Frontend & Deploy to /srv/geohost/frontend
echo "[6/7] Building frontend..."
cd /srv/geohost/geohost-frontend
npm install
npm run build
cp -r dist/* /srv/geohost/frontend/

# 7. Configure Nginx & Cloudflared
echo "[7/7] Configuring Nginx & Cloudflare Tunnel..."
sudo cp /srv/geohost/nginx-configs/geohost-limits.conf /etc/nginx/conf.d/geohost-limits.conf
sudo cp /srv/geohost/nginx-configs/geohost /etc/nginx/sites-available/geohost
sudo cp /srv/geohost/nginx-configs/geohost-frontend /etc/nginx/sites-available/geohost-frontend

sudo ln -sf /etc/nginx/sites-available/geohost /etc/nginx/sites-enabled/geohost
sudo ln -sf /etc/nginx/sites-available/geohost-frontend /etc/nginx/sites-enabled/geohost-frontend
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl restart nginx

# Install cloudflared as service if config exists
if [ -f /home/ubuntu/.cloudflared/config.yml ]; then
    echo "Installing / Starting cloudflared tunnel service..."
    sudo cloudflared --config /home/ubuntu/.cloudflared/config.yml service install 2>/dev/null || true
    sudo systemctl enable --now cloudflared
    sudo systemctl restart cloudflared
fi

echo "=========================================="
echo " Geohost Setup Completed Successfully! "
echo "=========================================="
sudo systemctl status geohost --no-pager -l
sudo systemctl status nginx --no-pager -l
sudo systemctl status cloudflared --no-pager -l || true
