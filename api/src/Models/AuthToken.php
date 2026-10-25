<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Token de sesión (se guarda solo su hash).
 */
final class AuthToken extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'token_hash', 'user_agent', 'expires_at', 'last_used_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'last_used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
