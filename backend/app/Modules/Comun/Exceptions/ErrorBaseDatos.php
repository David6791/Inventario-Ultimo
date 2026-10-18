<?php

namespace App\Modules\Comun\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PDOException;
use Throwable;

/**
 * Convierte un error de PostgreSQL causado por una regla de negocio en una
 * respuesta 422 con el mensaje en español.
 *
 * - P0001 (RAISE EXCEPTION de los triggers): el mensaje ya viene en español.
 * - 23514 CHECK, 23505 UNIQUE, 23P01 EXCLUDE, 23502 NOT NULL, 23503 FK: se
 *   traducen con MensajesRestricciones por el nombre de la restricción.
 * - Cualquier otro error (conexión, sintaxis, permisos) NO se traduce: sigue
 *   siendo un 500, porque no es culpa de quien usa la pantalla.
 *
 * Funciona con QueryException (extiende PDOException) y con PDOException
 * pura, que es la que sale al confirmar una transacción cuando falla una
 * regla diferida.
 *
 * Registro en bootstrap/app.php, dentro de withExceptions:
 *   $exceptions->render(fn (\Illuminate\Database\QueryException $e, Request $r) => ErrorBaseDatos::responder($e, $r));
 *   $exceptions->render(fn (\PDOException $e, Request $r) => ErrorBaseDatos::responder($e, $r));
 */
final class ErrorBaseDatos
{
    private const REGLAS = ['P0001', '23514', '23505', '23P01', '23502', '23503'];

    private function __construct(
        public readonly string $sqlstate,
        public readonly string $mensaje,
        public readonly ?string $restriccion,
    ) {
    }

    public static function desde(Throwable $e): ?self
    {
        $pdo = match (true) {
            $e instanceof PDOException => $e,
            $e->getPrevious() instanceof PDOException => $e->getPrevious(),
            default => null,
        };
        if ($pdo === null) {
            return null;
        }

        $info = $pdo->errorInfo ?? null;
        $sqlstate = (string) ($info[0] ?? $pdo->getCode());
        if (! in_array($sqlstate, self::REGLAS, true)) {
            return null;
        }

        $texto = (string) ($info[2] ?? $pdo->getMessage());
        $restriccion = self::restriccion($sqlstate, $texto);

        $mensaje = $sqlstate === 'P0001'
            ? self::primeraLinea($texto)
            : MensajesRestricciones::para($sqlstate, $restriccion, $texto);

        return new self($sqlstate, $mensaje, $restriccion);
    }

    public static function responder(Throwable $e, Request $request): ?JsonResponse
    {
        if (! ($request->is('api/*') || $request->expectsJson())) {
            return null;
        }

        return self::desde($e)?->respuesta();
    }

    /** @return array{message: string, codigo: string, tipo: string} */
    public function aArreglo(): array
    {
        return [
            'message' => $this->mensaje,
            'codigo'  => $this->restriccion ?? $this->sqlstate,
            'tipo'    => 'regla_de_negocio',
        ];
    }

    public function respuesta(): JsonResponse
    {
        return new JsonResponse($this->aArreglo(), 422);
    }

    /** "ERROR:  mensaje\nCONTEXT: …" → "mensaje" */
    private static function primeraLinea(string $texto): string
    {
        if (preg_match('/ERROR:\s+(.+?)\s*(?:\n|$)/u', $texto, $m)) {
            return $m[1];
        }

        return trim(strtok($texto, "\n"));
    }

    private static function restriccion(string $sqlstate, string $texto): ?string
    {
        if ($sqlstate === '23502') {
            return null;   // NOT NULL no tiene restricción con nombre
        }

        $linea = strtok($texto, "\n");

        // Inglés: ... constraint "nombre"
        if (preg_match('/constraint\s+"([^"]+)"/', $linea, $m)) {
            return $m[1];
        }

        // Español (lc_messages es_*): ... restricción «check» «nombre» · restricción de unicidad «nombre»
        // · llave foránea «nombre». El nombre es siempre el último «…» de la línea.
        if (preg_match('/restricción|llave foránea/u', $linea) && preg_match_all('/«([^»]+)»/u', $linea, $m)) {
            return end($m[1]);
        }

        return null;
    }
}
