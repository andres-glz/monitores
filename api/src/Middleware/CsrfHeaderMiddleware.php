<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Support\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ResponseFactory;

/**
 * Protección CSRF: las peticiones que modifican datos deben traer el encabezado
 * X-Requested-With, que un formulario de otro sitio no puede enviar.
 */
final class CsrfHeaderMiddleware implements MiddlewareInterface
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function __construct(private readonly ResponseFactory $responseFactory)
    {
    }

    public function process(Request $request, RequestHandlerInterface $handler): Response
    {
        if (! in_array($request->getMethod(), self::SAFE_METHODS, true)
            && $request->getHeaderLine('X-Requested-With') !== 'XMLHttpRequest') {
            return Json::send($this->responseFactory->createResponse(), ['message' => 'Petición no permitida.'], 403);
        }

        return $handler->handle($request);
    }
}
