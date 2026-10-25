<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Services\MonitorService;
use App\Support\HttpError;
use App\Support\Json;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Registro de monitores. El listado y la búsqueda se hacen en el dispositivo con los datos de /api/sync.
 */
final class MonitorController
{
    private const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    public function __construct(
        private readonly Validator $validator,
        private readonly MonitorService $monitors,
    ) {
    }

    /**
     * PUT /api/monitors/{uuid}: crea o actualiza (idempotente).
     */
    public function upsert(Request $request, Response $response, array $args): Response
    {
        $uuid = $this->uuid($args['uuid']);

        $data = $this->validator->validate(Validator::input($request), [
            'hospital_id' => ['required', 'integer', 'exists:hospitals,id'],
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'monitor_model_id' => ['required', 'integer', 'exists:monitor_models,id'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'inventory_number' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:150'],
            'is_operational' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'consumables' => ['present', 'array'],
            'consumables.*.consumable_id' => ['required', 'integer', 'distinct', 'exists:consumables,id'],
            'consumables.*.is_present' => ['required', 'boolean'],
            'consumables.*.is_working' => ['required', 'boolean'],
            'consumables.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var User $user */
        $user = $request->getAttribute('user');
        $monitor = $this->monitors->save($uuid, $data, $user);

        return Json::send($response, $monitor->toApi());
    }

    /**
     * DELETE /api/monitors/{uuid}: idempotente, responde 204 aunque ya no exista.
     */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        /** @var User $user */
        $user = $request->getAttribute('user');
        $this->monitors->delete($this->uuid($args['uuid']), $user);

        return Json::noContent($response);
    }

    private function uuid(string $value): string
    {
        if (! preg_match(self::UUID_PATTERN, $value)) {
            throw HttpError::unprocessable('Identificador de monitor no válido.');
        }

        return strtolower($value);
    }
}
