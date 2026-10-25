# Compila el frontend y arma el paquete para subir a Hostinger:
#   deploy/out/public_html   -> contenido de public_html (app React + entrada de la API)
#   deploy/out/monitores-api -> código de la API (fuera de public_html)
#   deploy/out/release.tar.gz
#
# Uso:  .\deploy\build.ps1            (instala dependencias y compila)
#       .\deploy\build.ps1 -SkipInstall
param([switch]$SkipInstall)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $PSScriptRoot 'out'

Write-Host '1/4 Compilando el frontend...' -ForegroundColor Cyan
Push-Location (Join-Path $root 'web')
try {
    if (-not $SkipInstall) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci falló' } }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'La compilación del frontend falló' }
} finally {
    Pop-Location
}

Write-Host '2/4 Preparando public_html...' -ForegroundColor Cyan
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
$publicHtml = Join-Path $out 'public_html'
New-Item -ItemType Directory -Force $publicHtml | Out-Null
Copy-Item (Join-Path $root 'web/dist/*') $publicHtml -Recurse -Force
Copy-Item (Join-Path $PSScriptRoot 'hostinger/public_html/*') $publicHtml -Recurse -Force
Copy-Item (Join-Path $PSScriptRoot 'hostinger/public_html/.htaccess') $publicHtml -Force

Write-Host '3/4 Copiando la API (sin vendor, .env ni archivos de storage)...' -ForegroundColor Cyan
$api = Join-Path $out 'monitores-api'
robocopy (Join-Path $root 'api') $api /E /XD vendor storage /XF .env *.log /NFL /NDL /NJH /NJS /NP | Out-Null
# robocopy devuelve 0-7 cuando todo salió bien
if ($LASTEXITCODE -ge 8) { throw 'No se pudo copiar la API' }
$global:LASTEXITCODE = 0

Write-Host '4/4 Empaquetando...' -ForegroundColor Cyan
tar -czf (Join-Path $out 'release.tar.gz') -C $out public_html monitores-api
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear release.tar.gz' }

Write-Host "Listo: $out\release.tar.gz" -ForegroundColor Green
