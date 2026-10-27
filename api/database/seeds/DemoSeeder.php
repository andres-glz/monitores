<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * Datos de demostración SOLO para desarrollo local: un usuario demo y un hospital con monitores.
 * No ejecutar en producción.
 */
final class DemoSeeder extends AbstractSeed
{
    // Credenciales del usuario de pruebas local
    public const DEMO_EMAIL = 'demo@monitores.test';
    public const DEMO_PASSWORD = 'demo12345';

    private const HOSPITAL_NAME = 'Hospital General de Demostración';

    public function getDependencies(): array
    {
        return ['ExampleModelsSeeder'];
    }

    public function run(): void
    {
        $pdo = $this->getAdapter()->getConnection();
        $now = gmdate('Y-m-d H:i:s');

        $userId = $this->scalar('SELECT id FROM users WHERE email = ?', [self::DEMO_EMAIL]);
        if ($userId === null) {
            $this->table('users')->insert([
                'name' => 'Usuario Demo',
                'email' => self::DEMO_EMAIL,
                'password_hash' => password_hash(self::DEMO_PASSWORD, PASSWORD_DEFAULT),
                'is_active' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ])->saveData();
            $userId = (int) $pdo->lastInsertId();
        }

        if ($this->scalar('SELECT id FROM hospitals WHERE name = ?', [self::HOSPITAL_NAME]) !== null) {
            return;
        }

        $this->table('hospitals')->insert([
            'name' => self::HOSPITAL_NAME,
            'description' => 'Hospital ficticio para probar la captura y los reportes',
            'created_at' => $now,
            'updated_at' => $now,
        ])->saveData();
        $hospitalId = (int) $pdo->lastInsertId();

        $serviceIds = array_map('intval', $pdo->query('SELECT id FROM services ORDER BY id LIMIT 6')->fetchAll(PDO::FETCH_COLUMN));
        $models = $pdo->query('SELECT id, name FROM monitor_models ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
        $faultNotes = ['Falso contacto', 'Cable pelado', 'Conector dañado', 'No da lectura', 'Desgastado'];
        $wearNotes = ['Cable con grietas', 'Clip flojo', 'Recubrimiento gastado', 'Conector con juego'];

        // Semilla fija para que los datos demo sean siempre los mismos
        mt_srand(42);

        for ($i = 1; $i <= 36; $i++) {
            $model = $models[mt_rand(0, count($models) - 1)];
            $consumableIds = $pdo->query('SELECT consumable_id FROM monitor_model_consumables WHERE monitor_model_id = ' . (int) $model['id'])
                ->fetchAll(PDO::FETCH_COLUMN);

            $isOperational = mt_rand(1, 100) > 12;
            $allOk = true;
            $consumableRows = [];
            foreach ($consumableIds as $consumableId) {
                $roll = mt_rand(1, 100);
                $isPresent = $roll > 14;
                $isWorking = $isPresent && $roll > 24;
                $allOk = $allOk && $isPresent && $isWorking;
                $wear = $isWorking ? $this->wear(mt_rand(1, 100)) : null;
                $notes = match (true) {
                    $isPresent && ! $isWorking => $faultNotes[mt_rand(0, count($faultNotes) - 1)],
                    in_array($wear, ['moderate', 'advanced'], true) => $wearNotes[mt_rand(0, count($wearNotes) - 1)],
                    default => null,
                };
                $consumableRows[] = [
                    'consumable_id' => (int) $consumableId,
                    'is_present' => (int) $isPresent,
                    'is_working' => (int) $isWorking,
                    'wear' => $wear,
                    'notes' => $notes,
                ];
            }

            $status = ! $isOperational ? 'non_functional' : ($allOk ? 'complete' : 'functional_incomplete');

            $this->table('monitors')->insert([
                'uuid' => $this->uuid(),
                'hospital_id' => $hospitalId,
                'service_id' => $serviceIds[intdiv($i - 1, 6) % count($serviceIds)],
                'monitor_model_id' => (int) $model['id'],
                'serial_number' => sprintf('SN%s%05d', strtoupper(substr(preg_replace('/\W/', '', $model['name']), 0, 3)), 1000 + $i * 37),
                'inventory_number' => sprintf('5310%06d', 200000 + $i * 113),
                'location' => 'Cama ' . (($i - 1) % 6 + 1),
                'is_operational' => (int) $isOperational,
                'status' => $status,
                'notes' => $isOperational ? null : 'No enciende',
                'created_by' => $userId,
                'updated_by' => $userId,
                'created_at' => $now,
                'updated_at' => $now,
            ])->saveData();
            $monitorId = (int) $pdo->lastInsertId();

            foreach ($consumableRows as &$row) {
                $row['monitor_id'] = $monitorId;
            }
            unset($row);
            if ($consumableRows !== []) {
                $this->table('monitor_consumables')->insert($consumableRows)->saveData();
            }
        }
    }

    private function scalar(string $sql, array $params): ?int
    {
        $statement = $this->getAdapter()->getConnection()->prepare($sql);
        $statement->execute($params);
        $value = $statement->fetchColumn();

        return $value === false ? null : (int) $value;
    }

    /**
     * Reparte el desgaste: la mayoría óptimos y pocos avanzados.
     */
    private function wear(int $roll): string
    {
        return match (true) {
            $roll <= 60 => 'optimal',
            $roll <= 80 => 'light',
            $roll <= 93 => 'moderate',
            default => 'advanced',
        };
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
