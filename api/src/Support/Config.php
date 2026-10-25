<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Configuración de la aplicación leída del archivo .env.
 */
final class Config
{
    public function __construct(
        public readonly string $env,
        public readonly bool $debug,
        public readonly int $tokenDays,
        public readonly string $storagePath,
    ) {
    }

    public static function fromEnv(string $basePath): self
    {
        return new self(
            env: $_ENV['APP_ENV'] ?? 'production',
            debug: filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOL),
            tokenDays: max(1, (int) ($_ENV['AUTH_TOKEN_DAYS'] ?? 30)),
            storagePath: $basePath . '/storage',
        );
    }

    public function isProduction(): bool
    {
        return $this->env === 'production';
    }
}
