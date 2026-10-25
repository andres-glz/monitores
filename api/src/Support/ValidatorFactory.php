<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\DatabasePresenceVerifier;
use Illuminate\Validation\Factory;

/**
 * Crea el validador de Laravel configurado con mensajes en español
 * y acceso a la base de datos para las reglas exists/unique.
 */
final class ValidatorFactory
{
    public static function make(Capsule $capsule): Factory
    {
        $loader = new ArrayLoader();
        $loader->addMessages('es', 'validation', require dirname(__DIR__, 2) . '/lang/es/validation.php');

        $factory = new Factory(new Translator($loader, 'es'), new Container());
        $factory->setPresenceVerifier(new DatabasePresenceVerifier($capsule->getDatabaseManager()));

        return $factory;
    }
}
