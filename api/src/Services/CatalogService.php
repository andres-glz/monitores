<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Brand;
use App\Models\Consumable;
use App\Models\ConsumableGroup;
use App\Models\Hospital;
use App\Models\MonitorModel;
use App\Models\Service;

/**
 * Todos los catálogos en una sola respuesta para guardarlos en el dispositivo (modo sin conexión).
 */
final class CatalogService
{
    public function build(): array
    {
        return [
            'hospitals' => Hospital::orderBy('name')->get(['id', 'name', 'description', 'updated_at'])
                ->map(fn (Hospital $hospital) => [
                    'id' => $hospital->id,
                    'name' => $hospital->name,
                    'description' => $hospital->description,
                ])->all(),
            'services' => Service::orderBy('name')->get(['id', 'name', 'description'])->toArray(),
            'brands' => Brand::orderBy('name')->get(['id', 'name'])->toArray(),
            'consumable_groups' => ConsumableGroup::orderBy('sort_order')->orderBy('name')
                ->get(['id', 'name', 'description', 'sort_order'])->toArray(),
            'consumables' => Consumable::orderBy('sort_order')->orderBy('name')
                ->get(['id', 'consumable_group_id', 'name', 'description', 'sort_order'])->toArray(),
            'monitor_models' => MonitorModel::with('consumables:id')->orderBy('name')->get()
                ->map(fn (MonitorModel $model) => $model->toApi())->all(),
        ];
    }
}
