<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Hospital extends Model
{
    protected $fillable = ['name', 'description'];

    public function monitors(): HasMany
    {
        return $this->hasMany(Monitor::class);
    }
}
