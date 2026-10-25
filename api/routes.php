<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\BrandController;
use App\Controllers\ConsumableController;
use App\Controllers\ConsumableGroupController;
use App\Controllers\HospitalController;
use App\Controllers\MonitorController;
use App\Controllers\MonitorModelController;
use App\Controllers\PhotoController;
use App\Controllers\ServiceController;
use App\Controllers\SyncController;
use App\Controllers\UserController;
use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfHeaderMiddleware;
use App\Support\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app): void {
    $app->group('/api', function (RouteCollectorProxy $api) {
        // Rutas públicas
        $api->get('/health', fn (Request $request, Response $response) => Json::send($response, ['ok' => true]));
        $api->post('/auth/login', [AuthController::class, 'login']);
        $api->post('/auth/logout', [AuthController::class, 'logout']);

        // Rutas que requieren sesión
        $api->group('', function (RouteCollectorProxy $private) {
            $private->get('/auth/me', [AuthController::class, 'me']);
            $private->get('/sync', SyncController::class);

            // Catálogos: alta, edición y baja (el listado viene en /sync)
            $catalogs = [
                'hospitals' => HospitalController::class,
                'services' => ServiceController::class,
                'brands' => BrandController::class,
                'consumable-groups' => ConsumableGroupController::class,
                'consumables' => ConsumableController::class,
                'monitor-models' => MonitorModelController::class,
            ];
            foreach ($catalogs as $path => $controller) {
                $private->post("/{$path}", [$controller, 'store']);
                $private->put("/{$path}/{id:[0-9]+}", [$controller, 'update']);
                $private->delete("/{$path}/{id:[0-9]+}", [$controller, 'destroy']);
            }

            $private->put('/monitors/{uuid}', [MonitorController::class, 'upsert']);
            $private->delete('/monitors/{uuid}', [MonitorController::class, 'destroy']);
            $private->post('/monitors/{uuid}/photos', [PhotoController::class, 'store']);
            $private->get('/photos/{uuid}', [PhotoController::class, 'show']);
            $private->delete('/photos/{uuid}', [PhotoController::class, 'destroy']);

            $private->get('/users', [UserController::class, 'index']);
            $private->post('/users', [UserController::class, 'store']);
            $private->put('/users/{id:[0-9]+}', [UserController::class, 'update']);
            $private->delete('/users/{id:[0-9]+}', [UserController::class, 'destroy']);
        })->add(AuthMiddleware::class);
    })->add(CsrfHeaderMiddleware::class);
};
