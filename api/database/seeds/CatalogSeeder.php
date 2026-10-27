<?php

declare(strict_types=1);

use App\Models\Service;
use Phinx\Seed\AbstractSeed;

/**
 * Catálogo base para producción: servicios, grupos de consumibles, consumibles y marcas.
 * Se puede ejecutar varias veces: solo inserta lo que no existe.
 */
final class CatalogSeeder extends AbstractSeed
{
    private const SERVICES = [
        'Urgencias adultos',
        'Urgencias pediátricas',
        'Medicina interna',
        'Cirugía general',
        'Pediatría',
        'Neonatología (UCIN)',
        'Terapia intensiva (UCI)',
        'Unidad coronaria',
        'Quirófano',
        'Recuperación',
        'Tococirugía',
        'Ginecobstetricia',
        'Traumatología',
        'Hemodiálisis',
    ];

    // Grupo => [descripción, consumibles]
    private const CONSUMABLES = [
        'ECG' => ['Electrocardiografía', [
            'Cable troncal ECG',
            'Latiguillos ECG 3 derivaciones',
            'Latiguillos ECG 5 derivaciones',
            'Cable ECG 3 derivaciones (1 pieza)',
            'Cable ECG 5 derivaciones (1 pieza)',
        ]],
        'SpO2' => ['Oximetría de pulso', [
            'Cable troncal SpO2',
            'Sensor SpO2 adulto',
            'Sensor SpO2 pediátrico',
            'Sensor SpO2 neonatal',
            'Sensor SpO2 con cable integrado (1 pieza)',
        ]],
        'PANI' => ['Presión arterial no invasiva', [
            'Manguera PANI',
            'Brazalete PANI adulto',
            'Brazalete PANI pediátrico',
            'Brazalete PANI neonatal',
            'Manguera y brazalete PANI (1 pieza)',
        ]],
        'Temperatura' => ['Sensores de temperatura', [
            'Sensor de temperatura superficial',
            'Sensor de temperatura rectal/esofágico',
        ]],
        'Presión invasiva' => ['Presión arterial invasiva (PI)', [
            'Cable de presión invasiva',
        ]],
        'Capnografía' => ['CO2 espirado', [
            'Línea de muestreo CO2',
            'Trampa de agua',
        ]],
        'Alimentación' => ['Energía del equipo', [
            'Cable de corriente',
            'Batería',
            'Eliminador / fuente externa',
        ]],
        'Accesorios' => ['Otros accesorios del equipo', [
            'Soporte o montaje',
            'Papel para registrador',
        ]],
    ];

    private const BRANDS = ['Mindray', 'Philips', 'GE Healthcare', 'Nihon Kohden', 'Edan', 'Comen', 'Contec', 'Dräger'];

    public function run(): void
    {
        foreach (self::SERVICES as $name) {
            $this->insertIfMissing('services', ['name' => $name]);
        }
        // También lo crea la migración AddIsFoundToMonitors
        $this->insertIfMissing('services', ['name' => Service::NOT_SPECIFIED], ['description' => Service::NOT_SPECIFIED_DESCRIPTION]);

        $groupOrder = 0;
        foreach (self::CONSUMABLES as $groupName => [$description, $items]) {
            $groupOrder += 10;
            $groupId = $this->insertIfMissing('consumable_groups', ['name' => $groupName], [
                'description' => $description,
                'sort_order' => $groupOrder,
            ]);

            foreach ($items as $index => $itemName) {
                $this->insertIfMissing('consumables', ['name' => $itemName, 'consumable_group_id' => $groupId], [
                    'sort_order' => ($index + 1) * 10,
                ]);
            }
        }

        foreach (self::BRANDS as $name) {
            $this->insertIfMissing('brands', ['name' => $name]);
        }
    }

    /**
     * Inserta el registro si no existe uno con los mismos valores en $match y devuelve su id.
     */
    private function insertIfMissing(string $table, array $match, array $extra = []): int
    {
        $pdo = $this->getAdapter()->getConnection();
        $where = implode(' AND ', array_map(fn ($column) => "`{$column}` = ?", array_keys($match)));
        $statement = $pdo->prepare("SELECT id FROM `{$table}` WHERE {$where} LIMIT 1");
        $statement->execute(array_values($match));
        $id = $statement->fetchColumn();

        if ($id !== false) {
            return (int) $id;
        }

        $now = gmdate('Y-m-d H:i:s');
        $row = $match + $extra + ['created_at' => $now, 'updated_at' => $now];
        $this->table($table)->insert($row)->saveData();

        return (int) $pdo->lastInsertId();
    }
}
