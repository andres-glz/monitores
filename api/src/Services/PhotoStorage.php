<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\MonitorPhoto;
use App\Support\Config;

/**
 * Manejo de archivos de fotos en storage/photos/{uuid del monitor}/{uuid de la foto}.{ext}
 * (fuera de public_html, se sirven a través de la API con sesión).
 */
final class PhotoStorage
{
    public const EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function __construct(private readonly Config $config)
    {
    }

    public function directoryFor(string $monitorUuid): string
    {
        return $this->config->storagePath . '/photos/' . $monitorUuid;
    }

    public function pathFor(string $monitorUuid, MonitorPhoto $photo): string
    {
        return $this->directoryFor($monitorUuid) . '/' . $photo->file_name;
    }

    public function deleteFile(string $monitorUuid, MonitorPhoto $photo): void
    {
        $path = $this->pathFor($monitorUuid, $photo);
        if (is_file($path)) {
            @unlink($path);
        }

        // Si ya no quedan fotos se quita la carpeta del monitor
        $directory = $this->directoryFor($monitorUuid);
        if (is_dir($directory) && (glob($directory . '/*') ?: []) === []) {
            @rmdir($directory);
        }
    }

    public function deleteDirectory(string $monitorUuid): void
    {
        $directory = $this->directoryFor($monitorUuid);
        if (! is_dir($directory)) {
            return;
        }

        foreach (glob($directory . '/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($directory);
    }
}
