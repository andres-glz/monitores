<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Services\AuthService;
use App\Support\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ResponseFactory;

/**
 * Exige una sesión válida y deja el usuario en el atributo 'user' de la petición.
 */
final class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly ResponseFactory $responseFactory,
    ) {
    }

    public function process(Request $request, RequestHandlerInterface $handler): Response
    {
        $token = $request->getCookieParams()[AuthService::COOKIE_NAME] ?? null;
        [$user, $refreshed] = $this->auth->resolve($token);

        if ($user === null) {
            return Json::send(
                $this->responseFactory->createResponse(),
                ['message' => 'Tu sesión expiró. Inicia sesión de nuevo.'],
                401,
            );
        }

        $response = $handler->handle($request->withAttribute('user', $user));

        // Se reenvía la cookie para extender su vigencia en el navegador
        return $refreshed ? $response->withAddedHeader('Set-Cookie', $this->auth->cookie($token)) : $response;
    }
}
