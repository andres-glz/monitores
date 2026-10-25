<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Monitor físico registrado en un hospital, con su diagnóstico.
 */
final class Monitor extends Model
{
    public const STATUS_COMPLETE = 'complete';
    public const STATUS_FUNCTIONAL_INCOMPLETE = 'functional_incomplete';
    public const STATUS_NON_FUNCTIONAL = 'non_functional';

    // Relaciones necesarias para toApi()
    public const API_RELATIONS = ['consumables', 'photos', 'creator:id,name', 'updater:id,name'];

    protected $fillable = [
        'uuid',
        'hospital_id',
        'service_id',
        'monitor_model_id',
        'serial_number',
        'inventory_number',
        'location',
        'is_operational',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'hospital_id' => 'integer',
            'service_id' => 'integer',
            'monitor_model_id' => 'integer',
            'is_operational' => 'boolean',
        ];
    }

    public function hospital(): BelongsTo
    {
        return $this->belongsTo(Hospital::class);
    }

    public function consumables(): HasMany
    {
        return $this->hasMany(MonitorConsumable::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(MonitorPhoto::class)->orderBy('created_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Representación que consume el frontend.
     */
    public function toApi(): array
    {
        return [
            'uuid' => $this->uuid,
            'hospital_id' => $this->hospital_id,
            'service_id' => $this->service_id,
            'monitor_model_id' => $this->monitor_model_id,
            'serial_number' => $this->serial_number,
            'inventory_number' => $this->inventory_number,
            'location' => $this->location,
            'is_operational' => $this->is_operational,
            'status' => $this->status,
            'notes' => $this->notes,
            'consumables' => $this->consumables->map(fn (MonitorConsumable $item) => [
                'consumable_id' => $item->consumable_id,
                'is_present' => $item->is_present,
                'is_working' => $item->is_working,
                'notes' => $item->notes,
            ])->values()->all(),
            'photos' => $this->photos->map(fn (MonitorPhoto $photo) => [
                'uuid' => $photo->uuid,
                'created_at' => $photo->created_at?->toIso8601ZuluString(),
            ])->values()->all(),
            'created_by_name' => $this->creator?->name,
            'updated_by_name' => $this->updater?->name,
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
