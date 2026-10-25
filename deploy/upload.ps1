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

# Script que corre en el servidor (bash). Va entre comillas simples para que PowerShell no interprete
# las variables de bash; el dominio se inserta reemplazando __DOMAIN__.
# Solo lleva texto ASCII para que no se dañen los acentos al pasar por SSH.
# En Hostinger el "php" de la terminal puede ser más viejo que el del sitio (p. ej. 8.1),
# por eso se busca un PHP 8.3+ entre las versiones instaladas en /opt/alt.
$remote = @'
set -e
cd ~/domains/__DOMAIN__

PHP_BIN=""
for candidate in php /opt/alt/php85/usr/bin/php /opt/alt/php84/usr/bin/php /opt/alt/php83/usr/bin/php; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -r 'exit(PHP_VERSION_ID >= 80300 ? 0 : 1);' >/dev/null 2>&1; then
    PHP_BIN="$candidate"
    break
  fi
done
if [ -z "$PHP_BIN" ]; then
  echo 'ERROR: no se encontro PHP 8.3 o mayor en la terminal del servidor.'
  echo 'Revisa las versiones disponibles con: ls /opt/alt | grep php'
  exit 3
fi
echo "PHP para la terminal: $PHP_BIN ($("$PHP_BIN" -r 'echo PHP_VERSION;'))"

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
  echo 'IMPORTANTE: se creo monitores-api/.env a partir de .env.example.'
  echo 'Editalo con los datos de la base de datos y vuelve a ejecutar upload.ps1.'
  exit 2
fi
"$PHP_BIN" vendor/bin/phinx migrate

# Revisa que el sitio responda (si el sitio usa PHP menor a 8.3 la API falla)
code=$(curl -s -o /dev/null -w '%{http_code}' "https://__DOMAIN__/api/health" || true)
if [ "$code" != "200" ]; then
  echo ''
  echo "AVISO: https://__DOMAIN__/api/health respondio $code."
  echo 'Revisa en hPanel que el sitio use PHP 8.3 o mayor y que el SSL este activo.'
fi

echo ''
echo "Para comandos manuales (seeders, crear usuarios) usa: $PHP_BIN"
echo 'Despliegue terminado.'
'@
$remote = $remote.Replace('__DOMAIN__', $Domain) -replace "`r", ''

Write-Host 'Instalando y migrando en el servidor...' -ForegroundColor Cyan
ssh -p $Port $target $remote
switch ($LASTEXITCODE) {
    0 { Write-Host "Listo: https://$Domain" -ForegroundColor Green }
    2 { Write-Host 'Falta configurar .env en el servidor (ver mensaje arriba).' -ForegroundColor Yellow; exit 2 }
    3 { Write-Host 'El servidor no tiene PHP 8.3 o mayor para la terminal (ver mensaje arriba).' -ForegroundColor Yellow; exit 3 }
    default { throw 'Falló la instalación en el servidor' }
}
