<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Hospital;
use App\Services\PhotoStorage;
use App\Support\Validator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

final class HospitalController extends CatalogController
{
    public function __construct(Validator $validator, private readonly PhotoStorage $photos)
    {
        parent::__construct($validator);
    }

    protected function modelClass(): string
    {
        return Hospital::class;
    }

    protected function rules(?int $id, array $input): array
    {
        return [
            'name' => ['required', 'string', 'max:150', Rule::unique('hospitals', 'name')->ignore($id)],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Al eliminar un hospital se eliminan en cascada sus monitores; aquí se borran también sus fotos.
     */
    protected function remove(Model $model): void
    {
        /** @var Hospital $model */
        $monitorUuids = $model->monitors()->pluck('uuid')->all();
        $model->delete();

        foreach ($monitorUuids as $uuid) {
            $this->photos->deleteDirectory($uuid);
        }
    }
}
