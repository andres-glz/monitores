<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Services\AuthService;
use App\Support\Json;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AuthController
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly Validator $validator,
    ) {
    }

    public function login(Request $request, Response $response): Response
    {
        $data = $this->validator->validate(Validator::input($request), [
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        [$user, $token] = $this->auth->attempt(
            $data['email'],
            $data['password'],
            $request->getServerParams()['REMOTE_ADDR'] ?? '0.0.0.0',
            $request->getHeaderLine('User-Agent') ?: null,
        );

        return Json::send($response, $user->toApi())
            ->withAddedHeader('Set-Cookie', $this->auth->cookie($token));
    }

    public function logout(Request $request, Response $response): Response
    {
        $this->auth->revoke($request->getCookieParams()[AuthService::COOKIE_NAME] ?? null);

        return Json::noContent($response)->withAddedHeader('Set-Cookie', $this->auth->expiredCookie());
    }

    public function me(Request $request, Response $response): Response
    {
        /** @var User $user */
        $user = $request->getAttribute('user');

        return Json::send($response, $user->toApi());
    }
}
