<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DeletedMonitor;
use App\Models\Monitor;
use App\Models\MonitorConsumable;
use App\Models\User;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Support\Carbon;

/**
 * Alta, edición y baja de monitores. Las operaciones son idempotentes (por uuid)
 * para que la cola de sincronización sin conexión pueda reintentarlas sin duplicar.
 */
final class MonitorService
{
    public function __construct(private readonly PhotoStorage $photos)
    {
    }

    /**
     * Crea o actualiza el monitor con el uuid dado.
     */
    public function save(string $uuid, array $data, User $user): Monitor
    {
        return Capsule::connection()->transaction(function () use ($uuid, $data, $user) {
            $consumables = array_map(fn (array $item) => [
                'consumable_id' => (int) $item['consumable_id'],
                'is_present' => (bool) $item['is_present'],
                // Si no lo tiene, no puede funcionar
                'is_working' => (bool) $item['is_present'] && (bool) $item['is_working'],
                'notes' => $item['notes'] ?? null,
            ], $data['consumables'] ?? []);

            $isOperational = (bool) $data['is_operational'];

            $monitor = Monitor::firstOrNew(['uuid' => $uuid]);
            $monitor->fill([
                'hospital_id' => (int) $data['hospital_id'],
                'service_id' => (int) $data['service_id'],
                'monitor_model_id' => (int) $data['monitor_model_id'],
                'serial_number' => $this->normalizeCode($data['serial_number'] ?? null),
                'inventory_number' => $this->normalizeCode($data['inventory_number'] ?? null),
                'location' => $data['location'] ?? null,
                'is_operational' => $isOperational,
                'status' => MonitorStatus::evaluate($isOperational, $consumables),
                'notes' => $data['notes'] ?? null,
            ]);

            if (! $monitor->exists) {
                $monitor->created_by = $user->id;
            }
            $monitor->updated_by = $user->id;
            // Siempre se actualiza la fecha para que la sincronización detecte cambios en consumibles
            $monitor->updated_at = Carbon::now();
            $monitor->save();

            $consumableIds = array_column($consumables, 'consumable_id');
            $monitor->consumables()->whereNotIn('consumable_id', $consumableIds ?: [0])->delete();
            foreach ($consumables as $consumable) {
                MonitorConsumable::updateOrCreate(
                    ['monitor_id' => $monitor->id, 'consumable_id' => $consumable['consumable_id']],
                    $consumable,
                );
            }

            return $monitor->load(Monitor::API_RELATIONS);
        });
    }

    /**
     * Elimina el monitor (si existe), sus fotos y deja constancia para la sincronización.
     */
    public function delete(string $uuid, User $user): void
    {
        $monitor = Monitor::where('uuid', $uuid)->first();
        if ($monitor === null) {
            return;
        }

        Capsule::connection()->transaction(function () use ($monitor, $user) {
            DeletedMonitor::create([
                'uuid' => $monitor->uuid,
                'hospital_id' => $monitor->hospital_id,
                'deleted_by' => $user->id,
                'deleted_at' => Carbon::now(),
            ]);
            $monitor->delete();
        });

        $this->photos->deleteDirectory($uuid);
    }

    /**
     * Marca el monitor como modificado (p. ej. al agregar o quitar fotos).
     */
    public function touch(Monitor $monitor, User $user): void
    {
        $monitor->updated_by = $user->id;
        $monitor->updated_at = Carbon::now();
        $monitor->save();
    }

    /**
     * Números de serie e inventario en mayúsculas y sin espacios repetidos para evitar duplicados.
     */
    private function normalizeCode(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = mb_strtoupper(preg_replace('/\s+/', ' ', trim($value)));

        return $value === '' ? null : $value;
    }
}
