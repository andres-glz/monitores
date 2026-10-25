<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * Error controlado que se devuelve al cliente con su código HTTP y mensaje en español.
 */
final class HttpError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message, $status);
    }

    public static function notFound(string $message = 'Registro no encontrado.'): self
    {
        return new self(404, $message);
    }

    public static function conflict(string $message): self
    {
        return new self(409, $message);
    }

    public static function forbidden(string $message): self
    {
        return new self(403, $message);
    }

    public static function unprocessable(string $message): self
    {
        return new self(422, $message);
    }
}
