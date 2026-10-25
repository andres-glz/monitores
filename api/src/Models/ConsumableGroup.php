<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Agrupador de consumibles de un mismo parámetro (SpO2, PANI, ECG...).
 */
final class ConsumableGroup extends Model
{
    protected $fillable = ['name', 'description', 'sort_order'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    public function consumables(): HasMany
    {
        return $this->hasMany(Consumable::class);
    }
}
