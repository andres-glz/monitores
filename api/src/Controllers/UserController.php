<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Services\AuthService;
use App\Support\HttpError;
use App\Support\Json;
use App\Support\Validator;
use Illuminate\Validation\Rule;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Administración de usuarios. Todos los usuarios tienen el mismo nivel de acceso.
 */
final class UserController
{
    public function __construct(
        private readonly Validator $validator,
        private readonly AuthService $auth,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        $users = User::orderBy('name')->get()->map(fn (User $user) => $user->toApi())->all();

        return Json::send($response, $users);
    }

    public function store(Request $request, Response $response): Response
    {
        $data = $this->validator->validate($this->input($request), [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ]);

        $user = new User(['name' => $data['name'], 'email' => $data['email'], 'is_active' => true]);
        $user->setPassword($data['password']);
        $user->save();

        return Json::send($response, $user->toApi(), 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $user = User::findOrFail((int) $args['id']);
        /** @var User $currentUser */
        $currentUser = $request->getAttribute('user');
        $isSelf = $currentUser->id === $user->id;

        $data = $this->validator->validate($this->input($request), [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'is_active' => ['required', 'boolean'],
            'password' => ['nullable', 'string', 'min:8', 'max:200'],
        ]);

        if ($isSelf && ! $data['is_active']) {
            throw HttpError::unprocessable('No puedes desactivar tu propio usuario.');
        }

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
            'is_active' => (bool) $data['is_active'],
        ]);
        if (! empty($data['password'])) {
            $user->setPassword($data['password']);
        }
        $user->save();

        // Si a otro usuario se le cambia la contraseña o se desactiva, se cierran sus sesiones
        if (! $isSelf && (! empty($data['password']) || ! $user->is_active)) {
            $this->auth->revokeAllFor($user);
        }

        return Json::send($response, $user->toApi());
    }

    public function destroy(Request $request, Response $response, array $args): Response
    {
        $user = User::findOrFail((int) $args['id']);
        /** @var User $currentUser */
        $currentUser = $request->getAttribute('user');

        if ($currentUser->id === $user->id) {
            throw HttpError::unprocessable('No puedes eliminar tu propio usuario.');
        }

        $user->delete();

        return Json::noContent($response);
    }

    private function input(Request $request): array
    {
        $input = Validator::input($request);
        if (isset($input['email']) && is_string($input['email'])) {
            $input['email'] = mb_strtolower($input['email']);
        }

        return $input;
    }
}
