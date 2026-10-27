<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Servicio hospitalario (catálogo global): Urgencias, Pediatría, etc.
 */
final class Service extends Model
{
    // Se preselecciona al marcar un monitor como no encontrado; el frontend lo identifica por este nombre
    public const NOT_SPECIFIED = 'No especificado';
    public const NOT_SPECIFIED_DESCRIPTION = 'Monitores sin área asignada, como los registrados que aún no se encuentran.';

    protected $fillable = ['name', 'description'];

    public function monitors(): HasMany
    {
        return $this->hasMany(Monitor::class);
    }
}
