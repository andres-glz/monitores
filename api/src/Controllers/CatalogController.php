<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Support\HttpError;
use App\Support\Json;
use App\Support\Validator;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Base para el alta, edición y baja de catálogos.
 * El listado de catálogos se obtiene completo desde /api/sync.
 */
abstract class CatalogController
{
    public function __construct(protected readonly Validator $validator)
    {
    }

    /**
     * @return class-string<Model>
     */
    abstract protected function modelClass(): string;

    /**
     * Reglas de validación; $id es null al crear.
     */
    abstract protected function rules(?int $id, array $input): array;

    public function store(Request $request, Response $response): Response
    {
        $input = Validator::input($request);
        $data = $this->validator->validate($input, $this->rules(null, $input));
        $class = $this->modelClass();

        $model = Capsule::connection()->transaction(fn () => $this->persist(new $class(), $data));

        return Json::send($response, $this->present($model), 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $model = $this->find($args['id']);
        $input = Validator::input($request);
        $data = $this->validator->validate($input, $this->rules($model->getKey(), $input));

        $model = Capsule::connection()->transaction(fn () => $this->persist($model, $data));

        return Json::send($response, $this->present($model));
    }

    public function destroy(Request $request, Response $response, array $args): Response
    {
        $model = $this->find($args['id']);

        $blocker = $this->deletionBlocker($model);
        if ($blocker !== null) {
            throw HttpError::conflict($blocker);
        }

        $this->remove($model);

        return Json::noContent($response);
    }

    protected function persist(Model $model, array $data): Model
    {
        $model->fill($data)->save();

        return $model;
    }

    protected function present(Model $model): array
    {
        return $model->toArray();
    }

    /**
     * Devuelve un mensaje si el registro no se puede eliminar.
     */
    protected function deletionBlocker(Model $model): ?string
    {
        return null;
    }

    protected function remove(Model $model): void
    {
        $model->delete();
    }

    private function find(string $id): Model
    {
        $class = $this->modelClass();

        return $class::findOrFail((int) $id);
    }
}
