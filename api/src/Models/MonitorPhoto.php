<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Foto de evidencia de un monitor; el archivo vive en storage/photos/{uuid del monitor}/.
 */
final class MonitorPhoto extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['uuid', 'monitor_id', 'file_name', 'mime_type', 'size_bytes', 'created_by'];

    public function monitor(): BelongsTo
    {
        return $this->belongsTo(Monitor::class);
    }
}
