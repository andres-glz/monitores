<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Brand;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

final class BrandController extends CatalogController
{
    protected function modelClass(): string
    {
        return Brand::class;
    }

    protected function rules(?int $id, array $input): array
    {
        return [
            'name' => ['required', 'string', 'max:100', Rule::unique('brands', 'name')->ignore($id)],
        ];
    }

    protected function deletionBlocker(Model $model): ?string
    {
        /** @var Brand $model */
        $count = $model->monitorModels()->count();

        return $count > 0 ? "No se puede eliminar: la marca tiene {$count} modelo(s) registrados." : null;
    }
}
