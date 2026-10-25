<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Modelo de monitor de signos vitales y los consumibles que lleva.
 */
final class MonitorModel extends Model
{
    // portable = portátil, mounted = empotrable
    public const MOUNT_TYPES = ['portable', 'mounted'];

    protected $fillable = ['brand_id', 'name', 'description', 'mount_type'];

    protected function casts(): array
    {
        return ['brand_id' => 'integer'];
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function consumables(): BelongsToMany
    {
        return $this->belongsToMany(Consumable::class, 'monitor_model_consumables');
    }

    public function monitors(): HasMany
    {
        return $this->hasMany(Monitor::class);
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'name' => $this->name,
            'description' => $this->description,
            'mount_type' => $this->mount_type,
            'consumable_ids' => $this->consumables->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
        ];
    }
}
