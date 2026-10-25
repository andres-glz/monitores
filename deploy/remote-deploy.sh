#!/usr/bin/env bash
# Instalacion en el servidor de Hostinger. Lo sube y ejecuta deploy/upload.ps1:
#   bash ~/remote-deploy.sh monitores.midominio.com
# Espera ~/release.tar.gz (generado por deploy/build.ps1).
# Codigos de salida: 10 = falta .env, 11 = no hay PHP 8.3 o mayor.
# (Solo texto ASCII para evitar problemas de codificacion al pasar por Windows.)
set -euo pipefail

DOMAIN="${1:?Indica el dominio, por ejemplo: bash remote-deploy.sh monitores.midominio.com}"
SITE_DIR="$HOME/domains/$DOMAIN"
ARCHIVE="$HOME/release.tar.gz"

# El paquete y este script se borran al terminar, salga bien o mal
trap 'rm -f "$ARCHIVE" "$HOME/remote-deploy.sh"' EXIT

if [ ! -d "$SITE_DIR/public_html" ]; then
  echo "ERROR: no existe $SITE_DIR/public_html. Revisa el dominio con: ls ~/domains"
  exit 1
fi
cd "$SITE_DIR"

# En Hostinger el php de la terminal puede ser mas viejo que el del sitio (p. ej. 8.1):
# se busca un PHP 8.3 o mayor entre las versiones instaladas en /opt/alt
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
  exit 11
fi
echo "PHP para la terminal: $PHP_BIN ($("$PHP_BIN" -r 'echo PHP_VERSION;'))"

# Copia los archivos nuevos (.env y storage del servidor se conservan)
rm -rf release && mkdir release
tar -xzf "$ARCHIVE" -C release
mkdir -p monitores-api/storage/photos monitores-api/storage/logs
cp -R release/monitores-api/. monitores-api/
rm -rf public_html/assets
cp -R release/public_html/. public_html/
rm -rf release

cd monitores-api
composer install --no-dev --optimize-autoloader --no-interaction
if [ ! -f .env ]; then
  cp .env.example .env
  echo ''
  echo 'IMPORTANTE: se creo monitores-api/.env a partir de .env.example.'
  echo 'Editalo con los datos de la base de datos y vuelve a ejecutar upload.ps1.'
  exit 10
fi
"$PHP_BIN" vendor/bin/phinx migrate

# Revisa que el sitio responda (si el sitio usa PHP menor a 8.3 la API falla)
code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/health" || true)
if [ "$code" != "200" ]; then
  echo ''
  echo "AVISO: https://$DOMAIN/api/health respondio $code."
  echo 'Revisa en hPanel que el sitio use PHP 8.3 o mayor y que el SSL este activo.'
fi

echo ''
echo "Para comandos manuales (seeders, crear usuarios) usa: $PHP_BIN"
echo 'Despliegue terminado.'
