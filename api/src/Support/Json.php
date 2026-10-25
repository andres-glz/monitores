<?php

declare(strict_types=1);

namespace App\Support;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * Utilidades para responder JSON de forma consistente.
 */
final class Json
{
    public static function send(Response $response, mixed $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        ));

        return $response
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withHeader('Cache-Control', 'no-store')
            ->withStatus($status);
    }

    public static function noContent(Response $response): Response
    {
        return $response->withStatus(204);
    }
}
