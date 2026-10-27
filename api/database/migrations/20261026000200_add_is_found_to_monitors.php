<?php

declare(strict_types=1);

use App\Models\Service;
use Phinx\Migration\AbstractMigration;

/**
 * Monitores registrados que no se encontraron físicamente, y el servicio que se les sugiere.
 */
final class AddIsFoundToMonitors extends AbstractMigration
{
    public function up(): void
    {
        // is_found = false: hay registro del monitor, pero no se localizó en el hospital
        $this->table('monitors')
            ->addColumn('is_found', 'boolean', ['default' => true, 'after' => 'location'])
            ->update();

        // Servicio que se preselecciona al marcar un monitor como no encontrado
        $exists = $this->fetchRow(sprintf("SELECT id FROM services WHERE name = '%s'", Service::NOT_SPECIFIED));
        if (! $exists) {
            $now = gmdate('Y-m-d H:i:s');
            $this->table('services')->insert([
                'name' => Service::NOT_SPECIFIED,
                'description' => Service::NOT_SPECIFIED_DESCRIPTION,
                'created_at' => $now,
                'updated_at' => $now,
            ])->saveData();
        }
    }

    public function down(): void
    {
        $this->table('monitors')
            ->removeColumn('is_found')
            ->update();
    }
}
