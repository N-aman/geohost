$ErrorActionPreference = "Stop"

$ServerIP = "140.245.15.139"
$User = "ubuntu"
$KeyPath = "C:\Users\varsh\.ssh\oracle_geohost.key"
$LocalRoot = $PSScriptRoot

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Initial Geohost Migration to Oracle Cloud    " -ForegroundColor Cyan
Write-Host " Target: $User@$ServerIP                      " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

function Run-Remote($cmd) {
    & ssh -i $KeyPath -o StrictHostKeyChecking=no "$User@$ServerIP" $cmd
}

Write-Host "[1/5] Creating remote directories on Oracle Cloud..." -ForegroundColor Yellow
Run-Remote "sudo mkdir -p /srv/geohost/{app,frontend,bin,nginx-configs} /srv/geohost/data/{quarantine,approved,rejected} /home/ubuntu/.cloudflared && sudo chown -R ubuntu:ubuntu /srv/geohost /home/ubuntu/.cloudflared"

Write-Host "[2/5] Copying backend source, configs and deployment scripts..." -ForegroundColor Yellow
& scp -i $KeyPath -o StrictHostKeyChecking=no -r "$LocalRoot\geohost-app\*" "$User@$ServerIP`:/srv/geohost/app/"
& scp -i $KeyPath -o StrictHostKeyChecking=no -r "$LocalRoot\nginx-configs\*" "$User@$ServerIP`:/srv/geohost/nginx-configs/"
& scp -i $KeyPath -o StrictHostKeyChecking=no "$LocalRoot\geohost.service" "$User@$ServerIP`:/srv/geohost/"
& scp -i $KeyPath -o StrictHostKeyChecking=no "$LocalRoot\deploy-oracle.sh" "$User@$ServerIP`:/srv/geohost/"

Write-Host "[3/5] Streaming frontend source (excluding node_modules)..." -ForegroundColor Yellow
Push-Location $LocalRoot
try {
    tar --exclude="node_modules" --exclude=".git" -czf - geohost-frontend | & ssh -i $KeyPath -o StrictHostKeyChecking=no "$User@$ServerIP" "tar -xzf - -C /srv/geohost/"
} finally {
    Pop-Location
}

Write-Host "[4/5] Copying SQLite database & Cloudflare Tunnel credentials..." -ForegroundColor Yellow
& scp -i $KeyPath -o StrictHostKeyChecking=no "$LocalRoot\geohost.db" "$User@$ServerIP`:/srv/geohost/data/geohost.db"
& scp -i $KeyPath -o StrictHostKeyChecking=no "$LocalRoot\cloudflared\*" "$User@$ServerIP`:/home/ubuntu/.cloudflared/"

Write-Host "[5/5] Running remote deployment script on Oracle VM (this installs dependencies, builds Go & React, sets up services)..." -ForegroundColor Yellow
Run-Remote "chmod +x /srv/geohost/deploy-oracle.sh && /srv/geohost/deploy-oracle.sh"

Write-Host "`nMigration and deployment completed successfully!" -ForegroundColor Green
