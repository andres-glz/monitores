<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * Modelos de monitores de ejemplo con su configuración de consumibles.
 * Revisa y ajusta la configuración desde la aplicación según los equipos reales.
 */
final class ExampleModelsSeeder extends AbstractSeed
{
    private const STANDARD_KIT = [
        'Cable troncal ECG',
        'Latiguillos ECG 5 derivaciones',
        'Cable troncal SpO2',
        'Sensor SpO2 adulto',
        'Manguera PANI',
        'Brazalete PANI adulto',
        'Sensor de temperatura superficial',
        'Cable de corriente',
        'Batería',
    ];

    public function getDependencies(): array
    {
        return ['CatalogSeeder'];
    }

    public function run(): void
    {
        $models = [
            ['Mindray', 'iMEC 10', 'portable', 'Monitor de transporte y cabecera de 10"', self::STANDARD_KIT],
            ['Mindray', 'uMEC 12', 'portable', 'Monitor de cabecera de 12"', self::STANDARD_KIT],
            ['Mindray', 'BeneView T5', 'mounted', 'Monitor modular de cuidados críticos', [...self::STANDARD_KIT, 'Cable de presión invasiva']],
            ['Philips', 'IntelliVue MX450', 'portable', 'Monitor de cabecera de 12"', self::STANDARD_KIT],
            ['GE Healthcare', 'Carescape B450', 'mounted', 'Monitor de cuidados intermedios', [...self::STANDARD_KIT, 'Línea de muestreo CO2', 'Trampa de agua']],
            ['Edan', 'iM50', 'portable', 'Monitor de cabecera básico', [
                'Cable troncal ECG',
                'Latiguillos ECG 3 derivaciones',
                'Sensor SpO2 con cable integrado (1 pieza)',
                'Manguera PANI',
                'Brazalete PANI adulto',
                'Sensor de temperatura superficial',
                'Cable de corriente',
                'Batería',
            ]],
            ['Contec', 'CMS8000', 'portable', 'Monitor de signos vitales básico', [
                'Cable ECG 5 derivaciones (1 pieza)',
                'Sensor SpO2 con cable integrado (1 pieza)',
                'Manguera y brazalete PANI (1 pieza)',
                'Sensor de temperatura superficial',
                'Cable de corriente',
            ]],
        ];

        $pdo = $this->getAdapter()->getConnection();
        $now = gmdate('Y-m-d H:i:s');

        foreach ($models as [$brandName, $modelName, $mountType, $description, $consumableNames]) {
            $brandId = $this->idByName('brands', $brandName);
            if ($brandId === null) {
                continue;
            }

            $exists = $pdo->prepare('SELECT id FROM monitor_models WHERE brand_id = ? AND name = ?');
            $exists->execute([$brandId, $modelName]);
            if ($exists->fetchColumn() !== false) {
                continue;
            }

            $this->table('monitor_models')->insert([
                'brand_id' => $brandId,
                'name' => $modelName,
                'description' => $description,
                'mount_type' => $mountType,
                'created_at' => $now,
                'updated_at' => $now,
            ])->saveData();
            $modelId = (int) $pdo->lastInsertId();

            $pivot = [];
            foreach ($consumableNames as $consumableName) {
                $consumableId = $this->idByName('consumables', $consumableName);
                if ($consumableId !== null) {
                    $pivot[] = ['monitor_model_id' => $modelId, 'consumable_id' => $consumableId];
                }
            }
            $this->table('monitor_model_consumables')->insert($pivot)->saveData();
        }
    }

    private function idByName(string $table, string $name): ?int
    {
        $statement = $this->getAdapter()->getConnection()->prepare("SELECT id FROM `{$table}` WHERE name = ? LIMIT 1");
        $statement->execute([$name]);
        $id = $statement->fetchColumn();

        return $id === false ? null : (int) $id;
    }
}
