# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Aplicación para hacer inventario y diagnóstico de monitores de signos vitales en hospitales, pensada para usarse desde el celular y **sin conexión**. Tiene dos partes: una API PHP en `api/` y una PWA React en `web/`. El [README](README.md) tiene la documentación para personas: características, instalación local, despliegue en Hostinger y la tabla de rutas de la API. Este archivo no la repite; resume lo que hace falta para trabajar en el código.

## Mantener este archivo al día

Cuando un cambio altere algo descrito aquí (arquitectura, flujo de sincronización, comandos, convenciones, variables de entorno, despliegue), actualiza CLAUDE.md **en el mismo commit**. Si el cambio también se nota para quien usa o instala la app (una característica nueva, un paso de instalación, una ruta de la API), actualiza también el README. Describe el panorama general y las reglas que no son obvias leyendo un solo archivo, no listas de archivos.

## Convenciones

- Interfaz, mensajes de la API y comentarios del código en **español**; identificadores (variables, funciones, tablas, columnas) en inglés.
- Mensajes de commit en español con el formato `Área: descripción` (por ejemplo `Despliegue: …`, `Interfaz: …`).
- Saltos de línea LF en todo el proyecto (`.gitattributes`).
- Desarrollo en Windows: `php`, `composer` y `vendor/bin/phinx` están solo en el PATH de PowerShell (Laravel Herd), no en Git Bash. MySQL corre en DBngin (`127.0.0.1:3306`, usuario `root` sin contraseña).
- No hay pruebas automatizadas ni linter. Para validar un cambio: `npm run build` en `web/` (que también valida tipos) y probar en la app.

## Comandos

Frontend (`web/`):

```bash
npm run dev        # http://localhost:5173; Vite redirige /api a 127.0.0.1:8000
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + build de producción con service worker (web/dist)
npm run preview    # sirve web/dist en el puerto 4173
```

API (`api/`, desde PowerShell):

```powershell
composer serve                                                    # php -S 127.0.0.1:8000
vendor/bin/phinx migrate
vendor/bin/phinx create NombreDelCambio                           # nueva migración en database/migrations/
vendor/bin/phinx seed:run -s CatalogSeeder -s ExampleModelsSeeder # catálogo base
vendor/bin/phinx seed:run -s DemoSeeder                           # SOLO local: hospital con 36 monitores y usuario demo (credenciales en DemoSeeder.php)
php bin/create-user.php "Nombre" correo@ejemplo.com
```

`.claude/launch.json` define los servidores `api`, `web` y `web-preview` para el navegador integrado.

Despliegue (PowerShell, desde la raíz): `.\deploy\build.ps1` y luego `.\deploy\upload.ps1 -SshHost … -SshUser … -Domain …` (el puerto por defecto es `65002`).

## Arquitectura

### Producción y desarrollo

En Hostinger, la app React vive en `public_html/` y la entrada de la API es `public_html/api/index.php`, que carga `../../monitores-api/bootstrap.php`. El código PHP, el `.env`, `vendor/` y `storage/` (fotos y logs) quedan fuera de la carpeta pública. En desarrollo, `api/public/index.php` carga el mismo `bootstrap.php` y Vite hace de proxy de `/api`. Siempre es el mismo origen, así que no hay CORS.

### Funcionamiento sin conexión (el núcleo)

- **El frontend nunca lee monitores ni catálogos directamente de la API.** Todo sale de IndexedDB (Dexie, `web/src/offline/db.ts`) mediante `useLiveQuery` en `hooks/useCatalog.ts` y `hooks/useMonitors.ts`. `CatalogGate` no muestra nada hasta que el catálogo está en el dispositivo.
- **Escritura de monitores** (`offline/monitors.ts`): en una sola transacción de Dexie se guarda el monitor local con `pending: true`, se calcula su dictamen y se agrega una operación a la cola `outbox` (`upsert_monitor`, `delete_monitor`, `upload_photo`, `delete_photo`).
- **Motor de sincronización** (`offline/sync.ts`):
  1. Envía la cola en orden.
  2. Si una operación falla con un 4xx permanente, guarda el error en `item.error` y bloquea las operaciones siguientes del mismo monitor. El usuario las corrige o descarta en *Configuración → Sincronización*.
  3. Después hace `GET /api/sync?since=<last_sync>`, que devuelve el catálogo completo, los monitores modificados desde esa fecha y los uuid eliminados.
  4. Los monitores con operaciones pendientes en la cola no se sobrescriben al descargar.

  Se ejecuta al abrir la app, con el evento `online`, cada minuto y con `requestSync()`.
- **Identificación por uuid**: el uuid del monitor se genera en el dispositivo. `PUT /api/monitors/{uuid}` es un *upsert* idempotente (`MonitorService::save`), así que la cola puede reintentar sin duplicar. Cada guardado o cambio de fotos actualiza `updated_at`, y las eliminaciones se registran en `deleted_monitors` para que los demás dispositivos se enteren. `SyncController` toma `server_time` antes de consultar para no perder cambios concurrentes.
- **Fotos**:
  - Se reducen en el navegador (`lib/image.ts`, lado mayor de 1600 px) y quedan como blob en `photoBlobs` hasta subirse.
  - En el servidor se guardan en `storage/photos/{uuid del monitor}/{uuid de la foto}.{ext}` y se sirven con sesión desde `GET /api/photos/{uuid}`.
  - El service worker las guarda en caché (`CacheFirst`) para verlas sin conexión.
- **Catálogos y usuarios requieren conexión**: `hooks/useCatalogMutation.ts` llama a la API, luego ejecuta `requestSync()` y convierte los errores 422 en errores por campo del formulario.
- **Cerrar sesión borra todos los datos locales** (`clearLocalData`). La app advierte si hay pendientes.

### Dictamen del monitor

La regla (No funcional / Completo / Funcional incompleto) está **duplicada a propósito**:

- `api/src/Services/MonitorStatus.php` es la que vale; el servidor recalcula el dictamen al guardar.
- `web/src/lib/status.ts` sirve para la vista previa y para el modo sin conexión.

Cualquier cambio a la regla va en los dos. En `lib/status.ts` también están los colores por dictamen: `STATUS_STYLES` (clases de Tailwind, con sus variantes `dark:`) y `STATUS_HEX` (para el PDF y el Excel).

### API (PHP 8.3, Slim 4)

- `bootstrap.php` arma la app:
  - Eloquent mediante `Capsule`, sin el resto de Laravel.
  - PHP-DI con *autowiring*.
  - Todo en UTC: PHP y la conexión de MySQL (`+00:00`). El frontend formatea las fechas en la zona local con `lib/format.ts`.
- `routes.php`: todo `/api` pasa por `CsrfHeaderMiddleware`, que exige `X-Requested-With: XMLHttpRequest` en métodos que no sean GET (`web/src/lib/api.ts` lo envía siempre). Las rutas privadas pasan además por `AuthMiddleware`:
  - La sesión viaja en la cookie HttpOnly `monitores_token` (`SameSite=Lax`, y `Secure` en producción).
  - En `auth_tokens` solo se guarda el hash del token.
  - La sesión se renueva con el uso (`AUTH_TOKEN_DAYS`).
  - El usuario queda en el atributo `user` de la petición.
- **Catálogos**: cada controlador extiende `CatalogController` e implementa `modelClass()` y `rules()`, y opcionalmente `deletionBlocker()`, `present()` y `persist()`. No hay rutas de listado: los catálogos se leen solo por `/sync` (`CatalogService::build`). Un campo nuevo de catálogo implica tocar ese servicio, `web/src/lib/types.ts` y, si aplica, `buildCatalogView` en `hooks/useCatalog.ts`.
- **Validación y errores**:
  - `App\Support\Validator` envuelve `illuminate/validation` con mensajes en español (`api/lang/es/validation.php`). `Validator::input()` recorta los textos y convierte `''` en `null`.
  - `ValidationException` responde 422 con `{message, errors}`. `HttpError` sirve para errores controlados (404, 409, 403, 422).
  - `ErrorHandler` convierte las violaciones de llave foránea en un 409 y registra los errores en `storage/logs/app.log`.
- **Migraciones**: Phinx con `column_null_default = false`, así que las columnas son NOT NULL salvo que se indique `'null' => true`. Usa el mismo `.env` que la API.

### Frontend (React 19, Vite, Tailwind 4)

- `router.tsx` define dos layouts:
  - `AppLayout`: barra lateral en escritorio y navegación inferior en celular.
  - `FocusLayout`: sin navegación, para el formulario de captura y edición (`MonitorFormPage`).
- Componentes base en `components/ui/`: `Modal` (Headless UI; hoja inferior en celular), `useConfirm()` (confirmación que se usa como promesa), `Field`, `Button` y `Switch`. Las notificaciones usan sonner mediante `AppToaster`.
- **Reportes**: se generan en el navegador y se cargan con `import()` dinámico. Las estadísticas se calculan en `reports/buildReport.ts` y las usan tanto el PDF (`@react-pdf/renderer`) como el Excel (ExcelJS).
- **Lector de códigos**: `barcode-detector` con ZXing en WebAssembly (`lib/barcode.ts`). Solo funciona con HTTPS o en `localhost`.
- **PWA** (`vite.config.ts`):
  - `registerType: 'prompt'`: la app avisa con `ReloadPrompt` en lugar de recargarse a media captura.
  - El precache incluye `.wasm` y permite archivos de hasta 10 MB, porque los chunks de PDF, Excel y del lector son grandes.
  - `/api` está excluido de `navigateFallback`.
- Las preferencias locales van en `localStorage` con el prefijo `monitores:` (`lib/storage.ts`, que usan `lib/capturePrefs.ts` y `lib/listPrefs.ts`; `lib/theme.ts` tiene su propia lectura porque `index.html` lee la misma clave).
- **Lista del hospital** (`HospitalPage`): los filtros y el orden viven en la URL (`?q=&status=&brand=&model=&service=&sort=`, con `-` al inicio de `sort` para descendente). Para regresar con ellos, las tarjetas, la tabla y los enlaces de captura mandan `state.backTo` con la URL actual, y `MonitorFormPage` navega a ese `backTo` al salir, guardar o eliminar. La vista (tarjetas o tabla) y las columnas visibles son preferencias del dispositivo (`lib/listPrefs.ts`). Las columnas de la tabla se definen en `MONITOR_COLUMNS` (`components/MonitorTable.tsx`); una columna nueva va ahí con su `sortValue` y su `render`.

### Estilos y modo oscuro

- Tailwind 4 se configura en CSS (`web/src/index.css`); no hay `tailwind.config`. Paleta: slate para neutros, teal como color principal, y emerald, amber y rose para los dictámenes.
- El modo oscuro funciona por la clase `.dark` en `<html>` (`@custom-variant dark` en `index.css`). La administra `lib/theme.ts`, con las opciones Sistema, Claro y Oscuro guardadas en `monitores:theme`. Un script en línea en `web/index.html` aplica el tema antes de pintar; si cambia la clave, cambia en los dos lugares.
- **Toda clase de color lleva su par `dark:`**, con esta equivalencia:

  | Claro | Oscuro |
  | --- | --- |
  | `bg-white` (superficies) | `dark:bg-slate-900` |
  | `bg-slate-50` (hover o paneles suaves) | `dark:bg-slate-800/50` |
  | `bg-slate-100` | `dark:bg-slate-800` |
  | `ring-` / `border-` / `divide-slate-200` | `dark:…-slate-800` |
  | `ring-` / `border-slate-300` | `dark:…-slate-700` |
  | `text-slate-900` | `dark:text-slate-100` |
  | `text-slate-700` | `dark:text-slate-300` |
  | `text-slate-500` / `text-slate-600` | `dark:text-slate-400` |
  | `text-slate-400` | `dark:text-slate-500` |
  | Tintes `bg-{color}-50` | `dark:bg-{color}-500/10` |
  | `text-{color}-700` | `dark:text-{color}-400` |
  | `ring-{color}-200` | `dark:ring-{color}-500/30` |

  Los botones sólidos (`bg-teal-700`, `bg-rose-600`) no cambian, y el fondo de la página en oscuro es `slate-950`. El PDF y el Excel no usan este tema.
- En celular los campos usan 16 px de letra para evitar el zoom de iOS (`index.css`). Las utilidades `safe-top` y `safe-bottom` respetan el notch.

### Despliegue

- `deploy/build.ps1`:
  - Compila `web/`.
  - Arma `deploy/out/public_html` con `web/dist` más `deploy/hostinger/public_html` (que trae el `.htaccess` y la entrada de la API).
  - Copia `api/` sin `vendor`, `storage` ni `.env` a `deploy/out/monitores-api`.
  - Empaqueta todo en `release.tar.gz`.
- `deploy/upload.ps1` sube el paquete junto con `deploy/remote-deploy.sh` y ejecuta ese script por SSH. En el servidor, el script:
  - Extrae el paquete y ejecuta `composer install --no-dev`.
  - Busca un PHP 8.3 o mayor en `/opt/alt`, porque el `php` de la terminal de Hostinger puede ser más viejo.
  - Ejecuta las migraciones.
  - Sale con código 10 si falta `.env` y con 11 si no encuentra PHP 8.3.
- En el servidor no hay Node: el frontend siempre se compila localmente.
- Si cambia la estructura de carpetas en Hostinger, ajusta `deploy/upload.ps1`, `deploy/remote-deploy.sh` y `deploy/hostinger/public_html/api/index.php`.
