<?php

declare(strict_types=1);

// Entrada de la API en Hostinger: el código vive fuera de public_html (carpeta monitores-api)
$app = require __DIR__ . '/../../monitores-api/bootstrap.php';
$app->run();
