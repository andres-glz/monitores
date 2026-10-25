<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Consumible o accesorio de un monitor (cable, sensor, brazalete...).
 */
final class Consumable extends Model
{
    protected $fillable = ['consumable_group_id', 'name', 'description', 'sort_order'];

    protected function casts(): array
    {
        return [
            'consumable_group_id' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ConsumableGroup::class, 'consumable_group_id');
    }
}
