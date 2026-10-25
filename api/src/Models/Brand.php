<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Brand extends Model
{
    protected $fillable = ['name'];

    public function monitorModels(): HasMany
    {
        return $this->hasMany(MonitorModel::class);
    }
}
