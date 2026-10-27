<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Nivel de desgaste de cada consumible en un monitor.
 */
final class AddWearToMonitorConsumables extends AbstractMigration
{
    public function up(): void
    {
        // wear: 'optimal' | 'light' | 'moderate' | 'advanced'; solo aplica si el consumible está presente y funciona
        $this->table('monitor_consumables')
            ->addColumn('wear', 'string', ['limit' => 20, 'null' => true, 'after' => 'is_working'])
            ->update();

        // Los consumibles ya capturados que funcionan quedan como óptimos (sin tocar monitors.updated_at ni el dictamen)
        $this->execute("UPDATE monitor_consumables SET wear = 'optimal' WHERE is_present = 1 AND is_working = 1");
    }

    public function down(): void
    {
        $this->table('monitor_consumables')
            ->removeColumn('wear')
            ->update();
    }
}
