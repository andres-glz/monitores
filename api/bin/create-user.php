<?php

declare(strict_types=1);

/**
 * Crea un usuario desde la terminal (útil para el primer acceso en producción).
 * Uso: php bin/create-user.php "Nombre Apellido" correo@dominio.com
 * La contraseña se pide de forma interactiva.
 */

use App\Models\User;

if (PHP_SAPI !== 'cli') {
    exit(1);
}

require dirname(__DIR__) . '/bootstrap.php';

[, $name, $email] = $argv + [null, null, null];
if ($name === null || $email === null) {
    fwrite(STDERR, "Uso: php bin/create-user.php \"Nombre\" correo@dominio.com\n");
    exit(1);
}

$email = mb_strtolower(trim($email));
if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "El correo no es válido.\n");
    exit(1);
}
if (User::where('email', $email)->exists()) {
    fwrite(STDERR, "Ya existe un usuario con ese correo.\n");
    exit(1);
}

fwrite(STDOUT, 'Contraseña (mínimo 8 caracteres): ');
$password = trim((string) fgets(STDIN));
if (mb_strlen($password) < 8) {
    fwrite(STDERR, "La contraseña debe tener al menos 8 caracteres.\n");
    exit(1);
}

$user = new User(['name' => trim($name), 'email' => $email, 'is_active' => true]);
$user->setPassword($password);
$user->save();

fwrite(STDOUT, "Usuario creado: {$user->name} <{$user->email}>\n");
