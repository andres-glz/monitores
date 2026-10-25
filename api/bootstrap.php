<?php

declare(strict_types=1);

use App\Support\Config;
use App\Support\ErrorHandler;
use App\Support\Validator;
use App\Support\ValidatorFactory;
use DI\ContainerBuilder;
use Dotenv\Dotenv;
use Illuminate\Database\Capsule\Manager as Capsule;
use Slim\Factory\AppFactory;

require __DIR__ . '/vendor/autoload.php';

// Todas las fechas se manejan en UTC; el frontend las muestra en la zona horaria local
date_default_timezone_set('UTC');

Dotenv::createImmutable(__DIR__)->safeLoad();
$config = Config::fromEnv(__DIR__);

// Conexión a MySQL con Eloquent (sin el resto de Laravel)
$capsule = new Capsule();
$capsule->addConnection([
    'driver' => 'mysql',
    'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
    'port' => $_ENV['DB_PORT'] ?? '3306',
    'database' => $_ENV['DB_NAME'] ?? 'monitores',
    'username' => $_ENV['DB_USER'] ?? 'root',
    'password' => $_ENV['DB_PASS'] ?? '',
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'timezone' => '+00:00',
    'strict' => true,
]);
$capsule->setAsGlobal();
$capsule->bootEloquent();

$container = (new ContainerBuilder())
    ->addDefinitions([
        Config::class => $config,
        Capsule::class => $capsule,
        Validator::class => fn () => new Validator(ValidatorFactory::make($capsule)),
    ])
    ->build();

AppFactory::setContainer($container);

$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

(require __DIR__ . '/routes.php')($app);

// El middleware de errores se agrega al final para que envuelva a todos los demás
$errorMiddleware = $app->addErrorMiddleware($config->debug, true, true);
$errorMiddleware->setDefaultErrorHandler(new ErrorHandler($app->getResponseFactory(), $config));

return $app;
