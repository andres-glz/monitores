<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Catálogos de configuración: hospitales, servicios, marcas, modelos y consumibles.
 */
final class CreateCatalogTables extends AbstractMigration
{
    public function change(): void
    {
        $this->table('hospitals')
            ->addColumn('name', 'string', ['limit' => 150])
            ->addColumn('description', 'text', ['null' => true])
            ->addTimestamps()
            ->addIndex(['name'], ['unique' => true])
            ->create();

        // Catálogo global de servicios (Urgencias, Pediatría, etc.) compartido por todos los hospitales
        $this->table('services')
            ->addColumn('name', 'string', ['limit' => 150])
            ->addColumn('description', 'text', ['null' => true])
            ->addTimestamps()
            ->addIndex(['name'], ['unique' => true])
            ->create();

        $this->table('brands')
            ->addColumn('name', 'string', ['limit' => 100])
            ->addTimestamps()
            ->addIndex(['name'], ['unique' => true])
            ->create();

        // Agrupa consumibles de un mismo parámetro, p. ej. SpO2 = cable troncal + sensor
        $this->table('consumable_groups')
            ->addColumn('name', 'string', ['limit' => 100])
            ->addColumn('description', 'text', ['null' => true])
            ->addColumn('sort_order', 'integer', ['default' => 0])
            ->addTimestamps()
            ->addIndex(['name'], ['unique' => true])
            ->create();

        // Si se elimina el grupo, el consumible queda sin grupo ("General")
        $this->table('consumables')
            ->addColumn('consumable_group_id', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('name', 'string', ['limit' => 150])
            ->addColumn('description', 'text', ['null' => true])
            ->addColumn('sort_order', 'integer', ['default' => 0])
            ->addTimestamps()
            ->addIndex(['name'])
            ->addForeignKey('consumable_group_id', 'consumable_groups', 'id', ['delete' => 'SET_NULL', 'update' => 'NO_ACTION'])
            ->create();

        // mount_type: 'portable' (portátil) | 'mounted' (empotrable)
        $this->table('monitor_models')
            ->addColumn('brand_id', 'integer', ['signed' => false])
            ->addColumn('name', 'string', ['limit' => 120])
            ->addColumn('description', 'text', ['null' => true])
            ->addColumn('mount_type', 'string', ['limit' => 20, 'default' => 'portable'])
            ->addTimestamps()
            ->addIndex(['brand_id', 'name'], ['unique' => true])
            ->addForeignKey('brand_id', 'brands', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
            ->create();

        // Configuración de consumibles que lleva cada modelo
        $this->table('monitor_model_consumables', ['id' => false, 'primary_key' => ['monitor_model_id', 'consumable_id']])
            ->addColumn('monitor_model_id', 'integer', ['signed' => false])
            ->addColumn('consumable_id', 'integer', ['signed' => false])
            ->addForeignKey('monitor_model_id', 'monitor_models', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
            ->addForeignKey('consumable_id', 'consumables', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
            ->create();
    }
}
