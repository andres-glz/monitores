<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuthToken;
use App\Models\LoginAttempt;
use App\Models\User;
use App\Support\Config;
use App\Support\HttpError;
use Illuminate\Support\Carbon;

/**
 * Inicio de sesión con token en cookie HttpOnly.
 * La sesión dura varios días y se renueva con el uso para permitir trabajo sin conexión.
 */
final class AuthService
{
    public const COOKIE_NAME = 'monitores_token';

    private const MAX_ATTEMPTS_PER_EMAIL = 8;
    private const MAX_ATTEMPTS_PER_IP = 30;
    private const ATTEMPT_WINDOW_MINUTES = 15;

    public function __construct(private readonly Config $config)
    {
    }

    /**
     * Valida credenciales y devuelve el usuario y un token nuevo.
     *
     * @return array{User, string}
     */
    public function attempt(string $email, string $password, string $ip, ?string $userAgent): array
    {
        $email = mb_strtolower(trim($email));
        $this->ensureNotThrottled($email, $ip);

        $user = User::where('email', $email)->first();
        if ($user === null || ! password_verify($password, $user->password_hash)) {
            LoginAttempt::create(['email' => $email, 'ip_address' => $ip, 'attempted_at' => Carbon::now()]);
            throw HttpError::unprocessable('Correo o contraseña incorrectos.');
        }

        if (! $user->is_active) {
            throw HttpError::forbidden('Tu usuario está desactivado. Contacta a un administrador.');
        }

        LoginAttempt::where('email', $email)->delete();
        LoginAttempt::where('attempted_at', '<', Carbon::now()->subDay())->delete();

        if (password_needs_rehash($user->password_hash, PASSWORD_DEFAULT)) {
            $user->setPassword($password);
        }
        $user->last_login_at = Carbon::now();
        $user->save();

        return [$user, $this->issueToken($user, $userAgent)];
    }

    public function issueToken(User $user, ?string $userAgent): string
    {
        $token = bin2hex(random_bytes(32));

        AuthToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'user_agent' => $userAgent !== null ? mb_substr($userAgent, 0, 255) : null,
            'expires_at' => Carbon::now()->addDays($this->config->tokenDays),
            'last_used_at' => Carbon::now(),
        ]);

        return $token;
    }

    /**
     * Busca el usuario dueño del token. Devuelve también si se renovó la vigencia
     * (en ese caso hay que reenviar la cookie).
     *
     * @return array{?User, bool}
     */
    public function resolve(?string $token): array
    {
        if ($token === null || $token === '') {
            return [null, false];
        }

        $authToken = AuthToken::with('user')->where('token_hash', hash('sha256', $token))->first();
        if ($authToken === null || $authToken->expires_at->isPast() || ! $authToken->user?->is_active) {
            return [null, false];
        }

        // Renovación deslizante: como máximo una escritura por hora por token
        $refreshed = false;
        if ($authToken->last_used_at === null || $authToken->last_used_at->lt(Carbon::now()->subHour())) {
            $authToken->last_used_at = Carbon::now();
            $authToken->expires_at = Carbon::now()->addDays($this->config->tokenDays);
            $authToken->save();
            $refreshed = true;
        }

        return [$authToken->user, $refreshed];
    }

    public function revoke(?string $token): void
    {
        if ($token !== null && $token !== '') {
            AuthToken::where('token_hash', hash('sha256', $token))->delete();
        }
    }

    public function revokeAllFor(User $user): void
    {
        AuthToken::where('user_id', $user->id)->delete();
    }

    public function cookie(string $token): string
    {
        return $this->buildCookie($token, $this->config->tokenDays * 86400);
    }

    public function expiredCookie(): string
    {
        return $this->buildCookie('', 0);
    }

    private function buildCookie(string $value, int $maxAge): string
    {
        $parts = [
            self::COOKIE_NAME . '=' . $value,
            'Path=/api',
            'Max-Age=' . $maxAge,
            'HttpOnly',
            'SameSite=Lax',
        ];
        if ($this->config->isProduction()) {
            $parts[] = 'Secure';
        }

        return implode('; ', $parts);
    }

    private function ensureNotThrottled(string $email, string $ip): void
    {
        $since = Carbon::now()->subMinutes(self::ATTEMPT_WINDOW_MINUTES);
        $byEmail = LoginAttempt::where('email', $email)->where('attempted_at', '>=', $since)->count();
        $byIp = LoginAttempt::where('ip_address', $ip)->where('attempted_at', '>=', $since)->count();

        if ($byEmail >= self::MAX_ATTEMPTS_PER_EMAIL || $byIp >= self::MAX_ATTEMPTS_PER_IP) {
            throw new HttpError(429, 'Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.');
        }
    }
}
