<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\MonitorModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

final class MonitorModelController extends CatalogController
{
    protected function modelClass(): string
    {
        return MonitorModel::class;
    }

    protected function rules(?int $id, array $input): array
    {
        $brandId = (int) ($input['brand_id'] ?? 0);

        return [
            'brand_id' => ['required', 'integer', 'exists:brands,id'],
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('monitor_models', 'name')->where('brand_id', $brandId)->ignore($id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'mount_type' => ['required', Rule::in(MonitorModel::MOUNT_TYPES)],
            'consumable_ids' => ['present', 'array'],
            'consumable_ids.*' => ['integer', 'distinct', 'exists:consumables,id'],
        ];
    }

    protected function persist(Model $model, array $data): Model
    {
        /** @var MonitorModel $model */
        $consumableIds = $data['consumable_ids'] ?? [];
        unset($data['consumable_ids']);

        $model->fill($data)->save();
        $model->consumables()->sync($consumableIds);

        return $model;
    }

    protected function present(Model $model): array
    {
        /** @var MonitorModel $model */
        return $model->load('consumables:id')->toApi();
    }

    protected function deletionBlocker(Model $model): ?string
    {
        /** @var MonitorModel $model */
        $count = $model->monitors()->count();

        return $count > 0 ? "No se puede eliminar: hay {$count} monitor(es) registrados con este modelo." : null;
    }
}
