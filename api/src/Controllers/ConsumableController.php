<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Consumable;
use App\Models\MonitorConsumable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

final class ConsumableController extends CatalogController
{
    protected function modelClass(): string
    {
        return Consumable::class;
    }

    protected function rules(?int $id, array $input): array
    {
        $groupId = isset($input['consumable_group_id']) ? (int) $input['consumable_group_id'] : null;

        return [
            'consumable_group_id' => ['nullable', 'integer', 'exists:consumable_groups,id'],
            // El nombre no se repite dentro del mismo grupo
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('consumables', 'name')
                    ->where(fn ($query) => $groupId === null
                        ? $query->whereNull('consumable_group_id')
                        : $query->where('consumable_group_id', $groupId))
                    ->ignore($id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }

    protected function persist(Model $model, array $data): Model
    {
        if (! isset($data['sort_order'])) {
            $data['sort_order'] = (int) Consumable::where('consumable_group_id', $data['consumable_group_id'] ?? null)->max('sort_order') + 10;
        }

        return parent::persist($model, $data);
    }

    protected function deletionBlocker(Model $model): ?string
    {
        $count = MonitorConsumable::where('consumable_id', $model->getKey())->count();

        return $count > 0
            ? "No se puede eliminar: está registrado en {$count} monitor(es). Quítalo de la configuración de los modelos en su lugar."
            : null;
    }
}
