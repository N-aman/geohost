[CmdletBinding()]
param(
    [string]$ServerIP = "140.245.15.139",
    [string]$User = "ubuntu",
    [string]$KeyPath = "C:\Users\varsh\.ssh\oracle_geohost.key",
    [switch]$InitialSync
)

$LocalRoot = $PSScriptRoot
$SSHCmd = "ssh -i `"$KeyPath`" -o StrictHostKeyChecking=no $User@$ServerIP"
$SCPCmd = "scp -i `"$KeyPath`" -o StrictHostKeyChecking=no"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " Geohost PC <-> Oracle Cloud Real-Time Auto-Sync " -ForegroundColor Cyan
Write-Host " Target: $User@$ServerIP" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

function Invoke-Remote($command) {
    & ssh -i $KeyPath -o StrictHostKeyChecking=no "$User@$ServerIP" $command
}

function Sync-Frontend() {
    Write-Host "`n[Auto-Sync] Frontend file change detected. Building latest dist..." -ForegroundColor Yellow
    Push-Location "$LocalRoot\geohost-frontend"
    try {
        & npm run build
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[Auto-Sync] Build successful. Uploading dist to /srv/geohost/frontend/..." -ForegroundColor Green
            & scp -i $KeyPath -o StrictHostKeyChecking=no -r dist/* "$User@$ServerIP`:/srv/geohost/frontend/"
            Invoke-Remote "sudo chmod -R 755 /srv/geohost/frontend"
            Write-Host "[Auto-Sync] Frontend successfully updated live on Oracle Cloud!" -ForegroundColor Green
        } else {
            Write-Host "[Auto-Sync] Build failed! Check frontend errors." -ForegroundColor Red
        }
    } finally {
        Pop-Location
    }
}

function Sync-Backend() {
    Write-Host "`n[Auto-Sync] Go backend file change detected. Syncing to Oracle Cloud..." -ForegroundColor Yellow
    & scp -i $KeyPath -o StrictHostKeyChecking=no -r "$LocalRoot\geohost-app\cmd" "$LocalRoot\geohost-app\internal" "$LocalRoot\geohost-app\go.mod" "$LocalRoot\geohost-app\go.sum" "$User@$ServerIP`:/srv/geohost/app/"
    Write-Host "[Auto-Sync] Compiling Go backend and restarting geohost service..." -ForegroundColor Yellow
    Invoke-Remote "cd /srv/geohost/app && go build -o /srv/geohost/bin/geohost ./cmd/server && sudo systemctl restart geohost"
    Write-Host "[Auto-Sync] Backend successfully updated and restarted!" -ForegroundColor Green
}

function Sync-Nginx() {
    Write-Host "`n[Auto-Sync] Nginx config change detected. Uploading and reloading..." -ForegroundColor Yellow
    & scp -i $KeyPath -o StrictHostKeyChecking=no -r "$LocalRoot\nginx-configs\*" "$User@$ServerIP`:/srv/geohost/nginx-configs/"
    Invoke-Remote "sudo cp /srv/geohost/nginx-configs/geohost /etc/nginx/sites-available/ && sudo cp /srv/geohost/nginx-configs/geohost-frontend /etc/nginx/sites-available/ && sudo cp /srv/geohost/nginx-configs/geohost-limits.conf /etc/nginx/conf.d/ && sudo nginx -t && sudo systemctl reload nginx"
    Write-Host "[Auto-Sync] Nginx reloaded successfully!" -ForegroundColor Green
}

if ($InitialSync) {
    Write-Host "Running initial full build and sync..." -ForegroundColor Cyan
    Sync-Frontend
    Sync-Backend
    Sync-Nginx
    Write-Host "Initial sync complete!" -ForegroundColor Green
    return
}

# Set up FileSystemWatcher
$Watcher = New-Object System.IO.FileSystemWatcher
$Watcher.Path = $LocalRoot
$Watcher.IncludeSubdirectories = $true
$Watcher.EnableRaisingEvents = $true
$Watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::LastWrite

$Global:LastSyncTime = [DateTime]::MinValue
$DebounceMs = 1000

$Action = {
    param($source, $event)
    $path = $event.FullPath

    # Exclude ignore paths
    if ($path -match "node_modules|geohost\.db|\.git|dist\\|\.tmp|scripts\\\.verify") {
        return
    }

    $now = [DateTime]::Now
    if (($now - $Global:LastSyncTime).TotalMilliseconds -lt $DebounceMs) {
        return
    }
    $Global:LastSyncTime = $now

    Write-Host "`n[Event] Changed: $path" -ForegroundColor Gray

    if ($path -match "geohost-frontend\\(src|public|index\.html|vite\.config)") {
        Sync-Frontend
    }
    elseif ($path -match "geohost-app\\(cmd|internal|go\.mod)") {
        Sync-Backend
    }
    elseif ($path -match "nginx-configs\\") {
        Sync-Nginx
    }
}

Register-ObjectEvent $Watcher 'Changed' -Action $Action | Out-Null
Register-ObjectEvent $Watcher 'Created' -Action $Action | Out-Null

Write-Host "`n[Active] File watcher is running..." -ForegroundColor Cyan
Write-Host "Any changes in geohost-frontend or geohost-app will automatically compile and sync to Oracle Cloud." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop.`n" -ForegroundColor DarkGray

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Unregister-Event -SourceIdentifier $Watcher.EventName -ErrorAction SilentlyContinue
    $Watcher.Dispose()
    Write-Host "`nWatcher stopped." -ForegroundColor DarkGray
}
