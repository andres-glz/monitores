<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Monitor;
use App\Models\MonitorPhoto;
use App\Models\User;
use App\Services\MonitorService;
use App\Services\PhotoStorage;
use App\Support\HttpError;
use App\Support\Json;
use App\Support\Validator;
use finfo;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;
use Slim\Psr7\Factory\StreamFactory;

/**
 * Fotos de evidencia de los monitores.
 */
final class PhotoController
{
    private const MAX_BYTES = 10 * 1024 * 1024;

    public function __construct(
        private readonly Validator $validator,
        private readonly PhotoStorage $storage,
        private readonly MonitorService $monitors,
    ) {
    }

    /**
     * POST /api/monitors/{uuid}/photos (multipart: uuid + file). Idempotente por uuid de la foto.
     */
    public function store(Request $request, Response $response, array $args): Response
    {
        $monitor = Monitor::where('uuid', strtolower($args['uuid']))->first()
            ?? throw HttpError::notFound('El monitor de la foto no existe.');

        $data = $this->validator->validate(Validator::input($request), [
            'uuid' => ['required', 'uuid'],
        ]);
        $photoUuid = strtolower($data['uuid']);

        $existing = MonitorPhoto::where('uuid', $photoUuid)->first();
        if ($existing !== null) {
            return Json::send($response, $this->present($existing));
        }

        $file = $request->getUploadedFiles()['file'] ?? null;
        if (! $file instanceof UploadedFileInterface || $file->getError() !== UPLOAD_ERR_OK) {
            throw HttpError::unprocessable('No se recibió la foto o se interrumpió la carga.');
        }
        if ($file->getSize() > self::MAX_BYTES) {
            throw HttpError::unprocessable('La foto pesa más de 10 MB.');
        }

        $temporaryPath = $file->getStream()->getMetadata('uri');
        $mimeType = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
        $extension = PhotoStorage::EXTENSIONS[$mimeType] ?? throw HttpError::unprocessable('Formato no soportado. Usa JPG, PNG o WEBP.');

        $directory = $this->storage->directoryFor($monitor->uuid);
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }
        $fileName = $photoUuid . '.' . $extension;
        $file->moveTo($directory . '/' . $fileName);

        /** @var User $user */
        $user = $request->getAttribute('user');
        $photo = MonitorPhoto::create([
            'uuid' => $photoUuid,
            'monitor_id' => $monitor->id,
            'file_name' => $fileName,
            'mime_type' => $mimeType,
            'size_bytes' => (int) $file->getSize(),
            'created_by' => $user->id,
        ]);
        $this->monitors->touch($monitor, $user);

        return Json::send($response, $this->present($photo), 201);
    }

    /**
     * GET /api/photos/{uuid}: devuelve el archivo de imagen.
     */
    public function show(Request $request, Response $response, array $args): Response
    {
        $photo = MonitorPhoto::with('monitor:id,uuid')->where('uuid', strtolower($args['uuid']))->first()
            ?? throw HttpError::notFound('Foto no encontrada.');

        $path = $this->storage->pathFor($photo->monitor->uuid, $photo);
        if (! is_file($path)) {
            throw HttpError::notFound('El archivo de la foto no existe.');
        }

        return $response
            ->withBody((new StreamFactory())->createStreamFromFile($path))
            ->withHeader('Content-Type', $photo->mime_type)
            ->withHeader('Content-Length', (string) filesize($path))
            ->withHeader('Cache-Control', 'private, max-age=31536000, immutable');
    }

    /**
     * DELETE /api/photos/{uuid}: idempotente.
     */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $photo = MonitorPhoto::with('monitor')->where('uuid', strtolower($args['uuid']))->first();
        if ($photo !== null) {
            $this->storage->deleteFile($photo->monitor->uuid, $photo);
            $photo->delete();

            /** @var User $user */
            $user = $request->getAttribute('user');
            $this->monitors->touch($photo->monitor, $user);
        }

        return Json::noContent($response);
    }

    private function present(MonitorPhoto $photo): array
    {
        return [
            'uuid' => $photo->uuid,
            'created_at' => $photo->created_at?->toIso8601ZuluString(),
        ];
    }
}
