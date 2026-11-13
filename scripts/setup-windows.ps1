# Pulse on Windows with Docker Desktop, behind an existing Caddy container and a DuckDNS name.
#
# Run in PowerShell from the pulse folder:   powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
#
# What it does (each step says what it found or changed):
#   1. finds the running Caddy container, its Caddyfile on disk and your DuckDNS name
#   2. picks the address pulse.<your-name>.duckdns.org (DuckDNS answers every sub-name of yours with the same IP)
#   3. writes .env (fresh secrets) and compose.override.yaml (Pulse on a Docker network Caddy can reach)
#   4. adds one site block to the Caddyfile (a backup is kept) and reloads Caddy
#   5. builds and starts Pulse
# It asks for the Google OAuth client ID and secret; it never prints the secret.
param(
  [string]$Domain = "",
  [string]$AdminEmail = "",
  [string]$Network = "pulse-proxy"
)
# "Continue": Windows PowerShell 5 turns any stderr line of a native command (docker) into a terminating error under
# "Stop", even for an expected "not found". Failures are checked through $LASTEXITCODE and thrown explicitly.
$ErrorActionPreference = "Continue"
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "   $t" -ForegroundColor Green }
function Warn($t) { Write-Host "   $t" -ForegroundColor Yellow }

if (-not (Test-Path ".\compose.yaml")) { throw "Run this from the pulse folder (where compose.yaml is)." }
docker version --format "{{.Server.Version}}" *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is not running. Start Docker Desktop and run this again." }

# 1. Caddy
Step "Looking for Caddy"
$caddy = docker ps --format "{{.Names}}|{{.Image}}" | Where-Object { $_ -match "caddy" } | Select-Object -First 1
if (-not $caddy) { throw "No running container with 'caddy' in its name or image. Start Caddy first." }
$caddyName = $caddy.Split("|")[0]
Ok "Container: $caddyName"

$mounts = docker inspect $caddyName --format "{{range .Mounts}}{{.Source}}|{{.Destination}};{{end}}"
$caddyfile = $null
foreach ($m in $mounts.Split(";")) {
  if (-not $m) { continue }
  $src, $dst = $m.Split("|")
  if ($dst -eq "/etc/caddy/Caddyfile") { $caddyfile = $src }
  elseif ($dst -eq "/etc/caddy" -and -not $caddyfile) { $caddyfile = Join-Path $src "Caddyfile" }
}
# Docker Desktop reports Windows paths as /run/desktop/mnt/host/c/... ; map them back.
if ($caddyfile -match "^/run/desktop/mnt/host/([a-z])/(.*)$") { $caddyfile = "$($Matches[1].ToUpper()):\" + ($Matches[2] -replace "/", "\") }
if (-not $caddyfile -or -not (Test-Path $caddyfile)) {
  $caddyfile = Read-Host "Couldn't find the Caddyfile on disk. Full path to it"
  if (-not (Test-Path $caddyfile)) { throw "Not found: $caddyfile" }
}
Ok "Caddyfile: $caddyfile"
$cf = Get-Content $caddyfile -Raw

# 2. Address
Step "Choosing the address"
if (-not $Domain) {
  $duck = [regex]::Matches($cf, "([a-z0-9-]+)\.duckdns\.org", "IgnoreCase") | ForEach-Object { $_.Groups[1].Value.ToLower() } | Where-Object { $_ -ne "pulse" } | Select-Object -Unique
  if (@($duck).Count -ge 1) { $Domain = "pulse.$(@($duck)[0]).duckdns.org" }
  else { $Domain = Read-Host "No DuckDNS name in the Caddyfile. Address for Pulse (e.g. pulse.example.duckdns.org)" }
}
$Domain = $Domain.Trim().ToLower() -replace "^https?://", "" -replace "/.*$", ""
Ok "Pulse will live at https://$Domain"

# 3. .env and compose.override.yaml
Step "Writing .env"
if (-not $AdminEmail) { $AdminEmail = Read-Host "Email you will sign up to Pulse with (the admin)" }
Write-Host "   Google OAuth client (Cloud Console > Google Auth Platform > Clients > your Web client):"
$clientId = (Read-Host "   Client ID").Trim()
$secure = Read-Host "   Client secret (hidden)" -AsSecureString
$clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $clientId.EndsWith(".apps.googleusercontent.com")) { Warn "That client ID doesn't end in .apps.googleusercontent.com; check it if sign-in fails." }

function Secret($n) { $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) -replace "[+/=]", "" }
$envKeep = @{}
if (Test-Path ".\.env") {
  Copy-Item .\.env ".\.env.bak-$(Get-Date -Format yyyyMMddHHmmss)"
  Get-Content .\.env | ForEach-Object { if ($_ -match "^(POSTGRES_PASSWORD|BETTER_AUTH_SECRET)=(.+)$") { $envKeep[$Matches[1]] = $Matches[2] } }
  Warn "Existing .env backed up; its database password and session key are kept."
}
$pg = if ($envKeep["POSTGRES_PASSWORD"]) { $envKeep["POSTGRES_PASSWORD"] } else { Secret 24 }
$auth = if ($envKeep["BETTER_AUTH_SECRET"]) { $envKeep["BETTER_AUTH_SECRET"] } else { Secret 32 }
@"
DATA_SOURCE=google
POSTGRES_PASSWORD=$pg
BETTER_AUTH_SECRET=$auth
ADMIN_EMAILS=$AdminEmail
GOOGLE_CLIENT_ID=$clientId
GOOGLE_CLIENT_SECRET=$clientSecret
APP_URL=https://$Domain
PULSE_LOCALE=de
"@ | Set-Content -Encoding ascii .\.env
Ok ".env written"

$existing = docker network ls --filter "name=^$Network$" --format "{{.Name}}"
if (-not $existing) {
  docker network create $Network | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create the Docker network $Network." }
  Ok "Docker network $Network created"
}
$connected = docker inspect $caddyName --format "{{range `$k, `$v := .NetworkSettings.Networks}}{{`$k}} {{end}}"
if ($connected -notmatch "\b$Network\b") {
  docker network connect $Network $caddyName
  if ($LASTEXITCODE -ne 0) { throw "Could not connect $caddyName to $Network." }
  Ok "Caddy joined $Network"
} else { Ok "Caddy already on $Network" }
@"
# Pulse joins the network Caddy is on; Caddy reaches it at http://pulse:3000. No host port is published.
services:
  pulse:
    networks: [default, proxy]
networks:
  proxy:
    name: $Network
    external: true
"@ | Set-Content -Encoding ascii .\compose.override.yaml
Ok "compose.override.yaml written"

# 4. Caddy
Step "Adding Pulse to Caddy"
if ($cf -match [regex]::Escape($Domain)) { Warn "The Caddyfile already has $Domain; left as is." }
else {
  Copy-Item $caddyfile "$caddyfile.bak-$(Get-Date -Format yyyyMMddHHmmss)"
  Add-Content -Path $caddyfile -Value "`n$Domain {`n`treverse_proxy pulse:3000`n}`n"
  Ok "Site block added (backup next to the Caddyfile)"
}

# 5. Start
Step "Building and starting Pulse (the first build takes a few minutes)"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose failed; see the output above." }
docker exec $caddyName caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
if ($LASTEXITCODE -ne 0) { Warn "Caddy reload failed; restart it with: docker restart $caddyName" } else { Ok "Caddy reloaded" }

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  Open:          https://$Domain   (sign up with $AdminEmail right away)"
Write-Host "  Redirect URI:  https://$Domain/oauth/callback   <- must be in the Google Web client"
Write-Host "  Logs:          docker compose logs -f pulse"
Write-Host "  Router:        ports 80 and 443 must reach this PC (as for Jellyfin)."
