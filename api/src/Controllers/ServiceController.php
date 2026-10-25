<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Service;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

final class ServiceController extends CatalogController
{
    protected function modelClass(): string
    {
        return Service::class;
    }

    protected function rules(?int $id, array $input): array
    {
        return [
            'name' => ['required', 'string', 'max:150', Rule::unique('services', 'name')->ignore($id)],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    protected function deletionBlocker(Model $model): ?string
    {
        /** @var Service $model */
        $count = $model->monitors()->count();

        return $count > 0 ? "No se puede eliminar: hay {$count} monitor(es) registrados en este servicio." : null;
    }
}
