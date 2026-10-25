<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Inventario y diagnóstico de monitores por hospital.
 */
final class CreateMonitorTables extends AbstractMigration
{
    public function change(): void
    {
        // uuid lo genera el cliente para poder capturar sin conexión y sincronizar después
        // status: 'complete' | 'functional_incomplete' | 'non_functional' (se calcula en el servidor)
        $this->table('monitors')
            ->addColumn('uuid', 'char', ['limit' => 36])
            ->addColumn('hospital_id', 'integer', ['signed' => false])
            ->addColumn('service_id', 'integer', ['signed' => false])
            ->addColumn('monitor_model_id', 'integer', ['signed' => false])
            ->addColumn('serial_number', 'string', ['limit' => 100, 'null' => true])
            ->addColumn('inventory_number', 'string', ['limit' => 100, 'null' => true])
            ->addColumn('location', 'string', ['limit' => 150, 'null' => true])
            ->addColumn('is_operational', 'boolean', ['default' => true])
            ->addColumn('status', 'string', ['limit' => 30])
            ->addColumn('notes', 'text', ['null' => true])
            ->addColumn('created_by', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('updated_by', 'integer', ['signed' => false, 'null' => true])
            ->addTimestamps()
            ->addIndex(['uuid'], ['unique' => true])
            ->addIndex(['serial_number'])
            ->addIndex(['inventory_number'])
            ->addIndex(['hospital_id', 'service_id'])
            ->addIndex(['updated_at'])
            ->addForeignKey('hospital_id', 'hospitals', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
            ->addForeignKey('service_id', 'services', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
            ->addForeignKey('monitor_model_id', 'monitor_models', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
            ->addForeignKey('created_by', 'users', 'id', ['delete' => 'SET_NULL', 'update' => 'NO_ACTION'])
            ->addForeignKey('updated_by', 'users', 'id', ['delete' => 'SET_NULL', 'update' => 'NO_ACTION'])
            ->create();

        // Estado de cada consumible en un monitor concreto
        $this->table('monitor_consumables')
            ->addColumn('monitor_id', 'integer', ['signed' => false])
            ->addColumn('consumable_id', 'integer', ['signed' => false])
            ->addColumn('is_present', 'boolean', ['default' => true])
            ->addColumn('is_working', 'boolean', ['default' => true])
            ->addColumn('notes', 'string', ['limit' => 255, 'null' => true])
            ->addIndex(['monitor_id', 'consumable_id'], ['unique' => true])
            ->addForeignKey('monitor_id', 'monitors', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
            ->addForeignKey('consumable_id', 'consumables', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
            ->create();

        $this->table('monitor_photos')
            ->addColumn('uuid', 'char', ['limit' => 36])
            ->addColumn('monitor_id', 'integer', ['signed' => false])
            ->addColumn('file_name', 'string', ['limit' => 255])
            ->addColumn('mime_type', 'string', ['limit' => 50])
            ->addColumn('size_bytes', 'integer', ['signed' => false])
            ->addColumn('created_by', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('created_at', 'datetime', ['default' => 'CURRENT_TIMESTAMP'])
            ->addIndex(['uuid'], ['unique' => true])
            ->addForeignKey('monitor_id', 'monitors', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
            ->addForeignKey('created_by', 'users', 'id', ['delete' => 'SET_NULL', 'update' => 'NO_ACTION'])
            ->create();

        // Registro de monitores eliminados para que los dispositivos sin conexión se enteren al sincronizar
        $this->table('deleted_monitors')
            ->addColumn('uuid', 'char', ['limit' => 36])
            ->addColumn('hospital_id', 'integer', ['signed' => false])
            ->addColumn('deleted_by', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('deleted_at', 'datetime')
            ->addIndex(['uuid'])
            ->addIndex(['deleted_at'])
            ->create();
    }
}
