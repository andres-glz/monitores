<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ConsumableGroup;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/**
 * Al eliminar un grupo, sus consumibles quedan sin grupo (se muestran como "General").
 */
final class ConsumableGroupController extends CatalogController
{
    protected function modelClass(): string
    {
        return ConsumableGroup::class;
    }

    protected function rules(?int $id, array $input): array
    {
        return [
            'name' => ['required', 'string', 'max:100', Rule::unique('consumable_groups', 'name')->ignore($id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }

    protected function persist(Model $model, array $data): Model
    {
        $data['sort_order'] = $data['sort_order'] ?? ((int) ConsumableGroup::max('sort_order') + 10);

        return parent::persist($model, $data);
    }
}
