<?php

// Configuración de Phinx: toma las credenciales del mismo .env que usa la API
require __DIR__ . '/vendor/autoload.php';

Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();

return [
    'paths' => [
        'migrations' => '%%PHINX_CONFIG_DIR%%/database/migrations',
        'seeds' => '%%PHINX_CONFIG_DIR%%/database/seeds',
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment' => 'app',
        'app' => [
            'adapter' => 'mysql',
            'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
            'name' => $_ENV['DB_NAME'] ?? 'monitores',
            'user' => $_ENV['DB_USER'] ?? 'root',
            'pass' => $_ENV['DB_PASS'] ?? '',
            'port' => (int) ($_ENV['DB_PORT'] ?? 3306),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
        ],
    ],
    'feature_flags' => [
        // Las columnas son NOT NULL salvo que se indique 'null' => true
        'column_null_default' => false,
        'add_timestamps_use_datetime' => true,
    ],
    'version_order' => 'creation',
];
