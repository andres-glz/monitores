<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Marca de un monitor eliminado para propagar el borrado a los dispositivos al sincronizar.
 */
final class DeletedMonitor extends Model
{
    public $timestamps = false;

    protected $fillable = ['uuid', 'hospital_id', 'deleted_by', 'deleted_at'];

    protected function casts(): array
    {
        return ['deleted_at' => 'datetime'];
    }
}
