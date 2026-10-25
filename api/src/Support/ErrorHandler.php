<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpException;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Slim\Interfaces\ErrorHandlerInterface;
use Throwable;

/**
 * Convierte cualquier excepción en una respuesta JSON con mensaje en español.
 */
final class ErrorHandler implements ErrorHandlerInterface
{
    public function __construct(
        private readonly ResponseFactoryInterface $responseFactory,
        private readonly Config $config,
    ) {
    }

    public function __invoke(
        ServerRequestInterface $request,
        Throwable $exception,
        bool $displayErrorDetails,
        bool $logErrors,
        bool $logErrorDetails,
    ): ResponseInterface {
        [$status, $payload] = $this->describe($exception);

        if ($status >= 500) {
            $this->log($request, $exception);
            if ($displayErrorDetails) {
                $payload['detail'] = $exception->getMessage();
                $payload['trace'] = explode("\n", $exception->getTraceAsString());
            }
        }

        return Json::send($this->responseFactory->createResponse(), $payload, $status);
    }

    /**
     * @return array{int, array<string, mixed>}
     */
    private function describe(Throwable $exception): array
    {
        return match (true) {
            $exception instanceof ValidationException => [422, [
                'message' => collect($exception->errors())->flatten()->first() ?? 'Revisa los datos capturados.',
                'errors' => $exception->errors(),
            ]],
            $exception instanceof HttpError => [$exception->status, ['message' => $exception->getMessage()]],
            $exception instanceof ModelNotFoundException,
            $exception instanceof HttpNotFoundException => [404, ['message' => 'Registro no encontrado.']],
            $exception instanceof HttpMethodNotAllowedException => [405, ['message' => 'Método no permitido.']],
            $exception instanceof HttpException => [$exception->getCode() ?: 400, ['message' => $exception->getMessage()]],
            $this->isForeignKeyViolation($exception) => [409, [
                'message' => 'No se puede eliminar porque otros registros dependen de él.',
            ]],
            default => [500, ['message' => 'Ocurrió un error interno. Intenta de nuevo.']],
        };
    }

    private function isForeignKeyViolation(Throwable $exception): bool
    {
        // 1451: no se puede borrar/actualizar una fila padre (llave foránea)
        return $exception instanceof QueryException && ($exception->errorInfo[1] ?? null) === 1451;
    }

    private function log(ServerRequestInterface $request, Throwable $exception): void
    {
        $directory = $this->config->storagePath . '/logs';
        if (! is_dir($directory)) {
            @mkdir($directory, 0775, true);
        }

        $line = sprintf(
            "[%s] %s %s → %s: %s en %s:%d\n%s\n\n",
            gmdate('Y-m-d H:i:s'),
            $request->getMethod(),
            (string) $request->getUri()->getPath(),
            $exception::class,
            $exception->getMessage(),
            $exception->getFile(),
            $exception->getLine(),
            $exception->getTraceAsString(),
        );
        @file_put_contents($directory . '/app.log', $line, FILE_APPEND);
    }
}
