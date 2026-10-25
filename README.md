# Diagnóstico de Monitores de Signos Vitales

Aplicación web para hacer **inventario y diagnóstico** de los monitores de signos vitales de un hospital de forma rápida, desde el celular y **aun sin señal**. Genera un reporte PDF con dictamen por equipo y estadísticas, y un Excel con todo el detalle.

## Características

- **Catálogos configurables**: hospitales, servicios (catálogo global), marcas, modelos (portátil / empotrable) y consumibles agrupados por parámetro (SpO2, PANI, ECG…). Cada modelo define qué consumibles lleva; por ejemplo, PANI puede ser “Manguera + Brazalete” o “Manguera y brazalete (1 pieza)”.
- **Captura ágil** de monitores por hospital:
  - El servicio y el modelo del registro anterior se conservan para el siguiente (“Guardar y siguiente”).
  - Los consumibles inician como *presentes y funcionando*: solo se marcan las excepciones. Hay botones rápidos por grupo (“Falta todo” / “Todo OK”) y frases rápidas para observaciones (“Falso contacto”, “Cable dañado”…).
  - Lectura de número de serie / inventario con la **cámara** (código de barras o QR).
  - **Fotos** de evidencia (se reducen automáticamente).
  - Ubicación (cama/cubículo) con sugerencias, aviso de **duplicados** por serie o NNI y atajo `Ctrl + Enter` para guardar.
- **Dictamen automático**: Completo, Funcional incompleto o No funcional.
- **Funciona sin conexión** (PWA): todo se guarda en el dispositivo y se sincroniza solo al volver la señal.
- **Búsqueda por coincidencia** (serie, NNI, servicio, modelo, ubicación) en un hospital o en todos.
- **Lista del hospital en tarjetas o en tabla**:
  - Filtros por dictamen, marca, modelo (en cascada: solo los modelos de la marca elegida) y servicio, más la búsqueda, que también acepta la serie o el NNI leídos con la **cámara**.
  - En la tabla se eligen las columnas que se muestran (si son muchas, la tabla se desliza hacia los lados), se ordena tocando el encabezado y cada renglón abre el detalle del monitor.
  - Los filtros quedan en la dirección de la página, así que se conservan al abrir un monitor y regresar. La vista y las columnas elegidas se recuerdan en cada dispositivo.
- **Reporte PDF** “Diagnóstico de monitores de signos vitales. *Hospital*”: indicadores y gráfica en la primera página, detalle por equipo con consumibles funcionales / no funcionales / faltantes, y al final estadísticas (faltantes y fallas por tipo, estado por grupo, necesidades de reposición, fallas más frecuentes, equipos por modelo y equipos no funcionales).
- **Excel** con hojas: Resumen, Monitores, Consumibles, Reposición y Por modelo.
- **Usuarios con inicio de sesión** (todos con el mismo nivel de acceso); se registra quién capturó cada equipo.
- **Modo oscuro**: claro, oscuro o igual que el dispositivo (*Configuración → Apariencia*, o el botón de sol / luna en la barra superior). Se recuerda en cada dispositivo.

### Regla del dictamen

| Dictamen | Condición |
| --- | --- |
| **No funcional** | El equipo no enciende u opera mal (switch “El equipo funciona” apagado). |
| **Completo** | El equipo funciona y **todos** sus consumibles están presentes y funcionando. |
| **Funcional incompleto** | El equipo funciona pero falta o falla al menos un consumible. |

La regla está en `api/src/Services/MonitorStatus.php` (la que vale) y en `web/src/lib/status.ts` (vista previa en pantalla y modo sin conexión).

## Tecnologías

| Parte | Librerías |
| --- | --- |
| API (PHP 8.3+) | Slim 4, Eloquent (`illuminate/database`), `illuminate/validation`, Phinx (migraciones), PHP-DI, phpdotenv |
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS 4, React Router 8, Headless UI, lucide-react, sonner |
| Sin conexión | Dexie (IndexedDB), vite-plugin-pwa (service worker) |
| Reportes | @react-pdf/renderer (PDF), ExcelJS (Excel) — se generan en el navegador |
| Lector de códigos | barcode-detector (ZXing en WebAssembly, incluido en la app) |

## Estructura

```
monitores/
├── api/                      API PHP
│   ├── bootstrap.php         Arranque (Eloquent, contenedor, middlewares)
│   ├── routes.php            Rutas /api/*
│   ├── src/
│   │   ├── Controllers/      Auth, catálogos, monitores, fotos, sincronización, usuarios
│   │   ├── Models/           Modelos Eloquent
│   │   ├── Services/         Sesión, dictamen, guardado de monitores, fotos, catálogo
│   │   ├── Middleware/       Sesión y protección CSRF
│   │   └── Support/          Validación, errores, JSON, configuración
│   ├── database/migrations/  Migraciones Phinx
│   ├── database/seeds/       Catálogo base, modelos de ejemplo y datos demo
│   ├── bin/create-user.php   Crear usuarios desde la terminal
│   └── storage/              Fotos y logs (no se publica)
├── web/                      Frontend React
│   └── src/
│       ├── pages/            Pantallas (hospitales, captura, búsqueda, configuración)
│       ├── components/       Componentes de interfaz
│       ├── offline/          Base local (Dexie), cola y motor de sincronización
│       ├── reports/          Cálculo de estadísticas, PDF y Excel
│       └── lib/              Tipos, cliente de la API, utilidades
└── deploy/                   Scripts y archivos para Hostinger
```

## Base de datos

| Tabla | Contenido |
| --- | --- |
| `users`, `auth_tokens`, `login_attempts` | Usuarios, sesiones (solo el hash del token) y control de intentos fallidos |
| `hospitals` | Nombre y descripción |
| `services` | Catálogo global de servicios |
| `brands`, `monitor_models` | Marcas y modelos (`mount_type`: `portable` / `mounted`) |
| `consumable_groups`, `consumables` | Grupos (SpO2, PANI…) y sus consumibles |
| `monitor_model_consumables` | Consumibles que lleva cada modelo |
| `monitors` | Equipo registrado: hospital, servicio, modelo, serie, NNI, ubicación, si funciona, dictamen, observaciones |
| `monitor_consumables` | Por equipo y consumible: lo tiene, funciona, observaciones |
| `monitor_photos` | Fotos de evidencia (archivo en `storage/photos/`) |
| `deleted_monitors` | Registro de eliminaciones para sincronizar dispositivos |

Los monitores se identifican con un `uuid` generado en el dispositivo; así se pueden capturar sin conexión y enviar después sin duplicarse.

## Desarrollo local (Windows con Herd + DBngin)

Requisitos: PHP 8.3+ y Composer (Herd), Node.js 22+, MySQL (DBngin).

1. Crea la base de datos `monitores` (utf8mb4) en MySQL.
2. API:

   ```bash
   cd api
   composer install
   copy .env.example .env
   vendor/bin/phinx migrate
   vendor/bin/phinx seed:run -s CatalogSeeder -s ExampleModelsSeeder
   php bin/create-user.php "Tu nombre" tu@correo.com
   composer serve
   ```

   Opcional, **solo en local**: `vendor/bin/phinx seed:run -s DemoSeeder` crea un hospital con 36 monitores y el usuario de pruebas definido en `api/database/seeds/DemoSeeder.php`.

3. Frontend (otra terminal):

   ```bash
   cd web
   npm install
   npm run dev
   ```

   Abre <http://localhost:5173>. Vite redirige `/api` a la API en el puerto 8000.

> La cámara solo funciona con HTTPS (o en `localhost`). Para probar el lector desde el celular, hazlo en el sitio publicado en Hostinger.

Comandos útiles: `npm run build` (compila y valida tipos), `npm run typecheck`.

## Despliegue en Hostinger

En el servidor quedará así:

```
~/domains/monitores.tudominio.com/
├── public_html/       App React + api/index.php (entrada de la API)
└── monitores-api/     Código PHP, .env, vendor y storage/ (fotos) — fuera de la web pública
```

### Primera vez

1. **hPanel**
   - Crea el sitio web del subdominio (por ejemplo `monitores.tudominio.com`) y activa el **SSL**.
   - En *Configuración de PHP* selecciona **PHP 8.3 o mayor**.
   - En *Bases de datos MySQL* crea la base y su usuario (anota nombre, usuario y contraseña).
   - En *Acceso SSH* actívalo y anota IP, usuario y puerto (normalmente `65002`).
2. **En tu computadora**, desde la carpeta del proyecto:

   ```powershell
   .\deploy\build.ps1
   .\deploy\upload.ps1 -SshHost 123.45.67.89 -SshUser u123456789 -Domain monitores.tudominio.com
   ```

   La primera vez se detiene después de crear `monitores-api/.env`.
3. **Edita `.env` en el servidor** (por SSH con `nano ~/domains/monitores.tudominio.com/monitores-api/.env` o desde el Administrador de archivos):

   ```ini
   APP_ENV=production
   APP_DEBUG=false
   DB_HOST=localhost
   DB_NAME=u123456789_monitores
   DB_USER=u123456789_monitores
   DB_PASS=tu-contraseña
   ```

4. Vuelve a ejecutar `.\deploy\upload.ps1 ...` (ahora corre las migraciones).
5. Por SSH, carga el catálogo base y crea tu usuario. En Hostinger el `php` de la terminal puede ser más viejo que el del sitio, así que usa la ruta que `upload.ps1` mostró en la línea **“PHP para la terminal”** (por ejemplo `/opt/alt/php83/usr/bin/php`):

   ```bash
   cd ~/domains/monitores.tudominio.com/monitores-api
   PHP=/opt/alt/php83/usr/bin/php
   $PHP vendor/bin/phinx seed:run -s CatalogSeeder -s ExampleModelsSeeder
   $PHP bin/create-user.php "Tu nombre" tu@correo.com
   ```

   No ejecutes `DemoSeeder` en producción.

### Actualizaciones

```powershell
.\deploy\build.ps1
.\deploy\upload.ps1 -SshHost 123.45.67.89 -SshUser u123456789 -Domain monitores.tudominio.com
```

Se conservan `.env` y las fotos. Los usuarios verán el aviso “Hay una nueva versión” para actualizar sin perder lo que estén capturando.

### Si algo falla

- **PHP de la terminal más viejo que el del sitio** (por ejemplo `You are running 8.1`): `upload.ps1` busca solo un PHP 8.3+ en `/opt/alt` y muestra cuál usó; usa esa ruta en los comandos manuales. Si dice que no encontró ninguno, revisa las versiones con `ls /opt/alt | grep php`.
- **Aviso de `/api/health` al terminar el despliegue**: en hPanel, revisa que el sitio use PHP 8.3 o mayor y que el SSL esté activo.
- **Composer**: si `composer` no existe prueba `composer2`.
- **Error 500**: revisa `monitores-api/storage/logs/app.log` (o pon temporalmente `APP_DEBUG=true`).
- **La ruta del sitio es distinta** (por ejemplo, el subdominio está dentro de otro sitio): ajusta la ruta en `deploy/upload.ps1` y en `public_html/api/index.php`.

## Mantenimiento

- **Nuevo cambio en la base de datos**: `vendor/bin/phinx create NombreDelCambio`, edita el archivo en `database/migrations/` y ejecuta `vendor/bin/phinx migrate`.
- **Respaldos**: base de datos desde hPanel y la carpeta `monitores-api/storage/photos`.
- **Usuarios**: desde *Configuración → Usuarios* en la app, o con `php bin/create-user.php`.

## Funcionamiento sin conexión

1. La primera vez se necesita conexión para iniciar sesión y descargar los catálogos.
2. Cada alta, edición, eliminación o foto se guarda al instante en el dispositivo (IndexedDB) y entra a una cola.
3. Con conexión, la cola se envía en orden (al abrir la app, al recuperar la señal y cada minuto) y después se descargan los cambios de otros usuarios.
4. El indicador superior muestra el estado: *Sincronizado*, *Sin conexión · N pendientes*, etc. En *Configuración → Sincronización* se ven los cambios que el servidor rechazó, para corregirlos o descartarlos.
5. La sesión dura 30 días y se renueva con el uso. Si expira, las capturas pendientes se conservan hasta volver a iniciar sesión.

> Al **cerrar sesión** se borran los datos del dispositivo; si hay cambios pendientes, la app lo advierte antes.

## API (referencia)

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/login` · `/api/auth/logout` | Iniciar / cerrar sesión (cookie HttpOnly) |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/sync?since=` | Catálogos + monitores modificados/eliminados desde la fecha |
| POST · PUT · DELETE | `/api/{hospitals, services, brands, consumable-groups, consumables, monitor-models}[/{id}]` | Catálogos |
| PUT · DELETE | `/api/monitors/{uuid}` | Crear/actualizar (idempotente) y eliminar monitor |
| POST | `/api/monitors/{uuid}/photos` | Subir foto (multipart: `uuid`, `file`) |
| GET · DELETE | `/api/photos/{uuid}` | Ver / eliminar foto |
| GET · POST · PUT · DELETE | `/api/users[/{id}]` | Usuarios |

Las peticiones que modifican datos requieren el encabezado `X-Requested-With: XMLHttpRequest` (protección CSRF).
