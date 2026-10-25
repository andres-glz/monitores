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

# El dominio va dentro del comando remoto: solo se aceptan caracteres de un nombre de dominio
if ($Domain -notmatch '^[A-Za-z0-9.-]+$') { throw "Dominio no válido: $Domain" }

$archive = Join-Path $PSScriptRoot 'out/release.tar.gz'
$remoteScript = Join-Path $PSScriptRoot 'remote-deploy.sh'
if (-not (Test-Path $archive)) { throw 'No existe deploy/out/release.tar.gz. Ejecuta primero .\deploy\build.ps1' }

$target = "$SshUser@$SshHost"

# El script de instalación se sube como archivo: pasarlo como argumento de ssh desde
# Windows PowerShell rompe las comillas dobles
Write-Host 'Subiendo paquete...' -ForegroundColor Cyan
scp -P $Port $archive $remoteScript "${target}:"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir el paquete' }

Write-Host 'Instalando y migrando en el servidor...' -ForegroundColor Cyan
ssh -p $Port $target "bash ~/remote-deploy.sh $Domain"
switch ($LASTEXITCODE) {
    0 { Write-Host "Listo: https://$Domain" -ForegroundColor Green }
    10 { Write-Host 'Falta configurar .env en el servidor (ver mensaje arriba).' -ForegroundColor Yellow; exit 10 }
    11 { Write-Host 'El servidor no tiene PHP 8.3 o mayor para la terminal (ver mensaje arriba).' -ForegroundColor Yellow; exit 11 }
    default { throw "Falló la instalación en el servidor (código $LASTEXITCODE, ver mensaje arriba)" }
}
