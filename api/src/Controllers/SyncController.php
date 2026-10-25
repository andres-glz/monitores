<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\DeletedMonitor;
use App\Models\Monitor;
use App\Services\CatalogService;
use App\Support\Json;
use Illuminate\Support\Carbon;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

/**
 * GET /api/sync?since=ISO8601
 * Devuelve los catálogos completos y los monitores modificados o eliminados desde "since".
 * Sin "since" devuelve todos los monitores (primera sincronización del dispositivo).
 */
final class SyncController
{
    public function __construct(private readonly CatalogService $catalog)
    {
    }

    public function __invoke(Request $request, Response $response): Response
    {
        // Se toma la hora antes de consultar para no perder cambios hechos durante la consulta
        $serverTime = Carbon::now();
        $since = $this->parseSince($request->getQueryParams()['since'] ?? null);

        $monitors = Monitor::with(Monitor::API_RELATIONS)
            ->when($since !== null, fn ($query) => $query->where('updated_at', '>=', $since))
            ->orderBy('id')
            ->get()
            ->map(fn (Monitor $monitor) => $monitor->toApi())
            ->all();

        $deletedUuids = $since === null
            ? []
            : DeletedMonitor::where('deleted_at', '>=', $since)->pluck('uuid')->all();

        return Json::send($response, [
            'server_time' => $serverTime->toIso8601ZuluString(),
            'full' => $since === null,
            'catalog' => $this->catalog->build(),
            'monitors' => $monitors,
            'deleted_monitor_uuids' => $deletedUuids,
        ]);
    }

    private function parseSince(?string $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->utc();
        } catch (Throwable) {
            return null;
        }
    }
}
