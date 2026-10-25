<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Validation\Factory;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Envoltura del validador para usarlo en los controladores.
 */
final class Validator
{
    public function __construct(private readonly Factory $factory)
    {
    }

    /**
     * Valida y devuelve solo los campos declarados en las reglas.
     * Lanza ValidationException (respuesta 422) si algo no es válido.
     */
    public function validate(array $data, array $rules): array
    {
        return $this->factory->make($data, $rules)->validate();
    }

    /**
     * Cuerpo de la petición como arreglo, con los textos recortados y los vacíos convertidos en null.
     */
    public static function input(Request $request): array
    {
        $body = $request->getParsedBody();

        return is_array($body) ? self::clean($body) : [];
    }

    private static function clean(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                $value = trim($value);
                $data[$key] = $value === '' ? null : $value;
            } elseif (is_array($value)) {
                $data[$key] = self::clean($value);
            }
        }

        return $data;
    }
}
