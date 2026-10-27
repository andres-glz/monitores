<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Estado de un consumible en un monitor: si lo tiene, si funciona, su desgaste y observaciones.
 */
final class MonitorConsumable extends Model
{
    // Niveles de desgaste (la misma lista existe en el frontend en src/lib/status.ts)
    public const WEAR_LEVELS = ['optimal', 'light', 'moderate', 'advanced'];

    public $timestamps = false;

    protected $fillable = ['monitor_id', 'consumable_id', 'is_present', 'is_working', 'wear', 'notes'];

    protected function casts(): array
    {
        return [
            'consumable_id' => 'integer',
            'is_present' => 'boolean',
            'is_working' => 'boolean',
        ];
    }

    public function consumable(): BelongsTo
    {
        return $this->belongsTo(Consumable::class);
    }
}
