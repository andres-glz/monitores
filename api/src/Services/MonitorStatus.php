<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Monitor;

/**
 * Regla del dictamen de un monitor (la misma regla existe en el frontend en src/lib/status.ts):
 * - No funcional: el equipo no funciona.
 * - Completo: el equipo funciona y todos sus consumibles están presentes y funcionando.
 * - Funcional incompleto: el equipo funciona pero falta o falla al menos un consumible.
 */
final class MonitorStatus
{
    /**
     * @param iterable<array{is_present: bool, is_working: bool}> $consumables
     */
    public static function evaluate(bool $isOperational, iterable $consumables): string
    {
        if (! $isOperational) {
            return Monitor::STATUS_NON_FUNCTIONAL;
        }

        foreach ($consumables as $consumable) {
            if (! $consumable['is_present'] || ! $consumable['is_working']) {
                return Monitor::STATUS_FUNCTIONAL_INCOMPLETE;
            }
        }

        return Monitor::STATUS_COMPLETE;
    }
}
