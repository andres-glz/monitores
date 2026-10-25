<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Intento fallido de inicio de sesión, usado para frenar ataques de fuerza bruta.
 */
final class LoginAttempt extends Model
{
    public $timestamps = false;

    protected $fillable = ['email', 'ip_address', 'attempted_at'];

    protected function casts(): array
    {
        return ['attempted_at' => 'datetime'];
    }
}
