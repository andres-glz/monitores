# Sube el paquete generado por build.ps1 a Hostinger por SSH, instala dependencias y corre las migraciones.
# El archivo .env y la carpeta storage (fotos) del servidor no se tocan.
#
# Uso:
#   .\deploy\upload.ps1 -SshHost 123.45.67.89 -SshUser u123456789 -Domain monitores.midominio.com
#
# Los datos de SSH están en hPanel > Avanzado > Acceso SSH (el puerto de Hostinger suele ser 65002).
param(
    [Parameter(Mandatory)] [string]$SshHost,
    [Parameter(Mandatory)] [string]$SshUser,
    [Parameter(Mandatory)] [string]$Domain,
    [int]$Port = 65002
)

$ErrorActionPreference = 'Stop'
$archive = Join-Path $PSScriptRoot 'out/release.tar.gz'
if (-not (Test-Path $archive)) { throw 'No existe deploy/out/release.tar.gz. Ejecuta primero .\deploy\build.ps1' }

$target = "$SshUser@$SshHost"

Write-Host 'Subiendo paquete...' -ForegroundColor Cyan
scp -P $Port $archive "${target}:release.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir el paquete' }

# Script que corre en el servidor (bash)
$remote = @"
set -e
cd ~/domains/$Domain
rm -rf release && mkdir release
tar -xzf ~/release.tar.gz -C release
mkdir -p monitores-api/storage/photos monitores-api/storage/logs
cp -R release/monitores-api/. monitores-api/
rm -rf public_html/assets
cp -R release/public_html/. public_html/
rm -rf release ~/release.tar.gz
cd monitores-api
composer install --no-dev --optimize-autoloader --no-interaction
if [ ! -f .env ]; then
  cp .env.example .env
  echo ''
  echo 'IMPORTANTE: se creó monitores-api/.env a partir de .env.example.'
  echo 'Edítalo con los datos de la base de datos y vuelve a ejecutar upload.ps1.'
  exit 2
fi
vendor/bin/phinx migrate
echo 'Despliegue terminado.'
"@ -replace "`r", ''

Write-Host 'Instalando y migrando en el servidor...' -ForegroundColor Cyan
ssh -p $Port $target $remote
if ($LASTEXITCODE -eq 2) {
    Write-Host 'Falta configurar .env en el servidor (ver mensaje arriba).' -ForegroundColor Yellow
    exit 2
}
if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación en el servidor' }

Write-Host "Listo: https://$Domain" -ForegroundColor Green
