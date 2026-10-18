<?php

namespace App\Modules\Cargas\Services;

use App\Modules\Cargas\Models\SerieLote;
use App\Modules\Comun\Exceptions\ErrorBaseDatos;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Series de lote: vista previa del formato, alta, edición y continuación de
 * la numeración. Las reglas de fondo (formato válido, contador que no
 * retrocede, candados con lotes) viven en la base; aquí se arman las llamadas
 * y se traducen los errores.
 */
class SerieLoteService
{
    /**
     * Cómo saldría el próximo código con estos datos, sin guardar ni consumir
     * números.
     *
     * @param  array{prefijo?: ?string, linea_producto_id?: ?int, origen?: ?string, formato?: ?string, reinicio?: ?string}  $datos
     * @return array{codigo: ?string, repetido: bool, error: ?string}
     */
    public function vistaPrevia(array $datos, ?SerieLote $serie = null, ?string $fecha = null): array
    {
        if (blank($datos['formato'] ?? null)) {
            return ['codigo' => null, 'repetido' => false, 'error' => 'Escriba el formato del código.'];
        }

        try {
            // Dentro de un savepoint: un formato inválido levanta un error en
            // PostgreSQL, y sin savepoint dejaría abortada la transacción que
            // esté abierta (por ejemplo, la de una prueba).
            $codigo = DB::transaction(fn () => DB::selectOne(
                'select cargas.vista_previa_formato_lote(?, ?, ?, ?, ?, ?::date, ?) as codigo',
                [
                    $datos['formato'],
                    $datos['reinicio'] ?? 'NUNCA',
                    $datos['prefijo'] ?? null,
                    $datos['linea_producto_id'] ?? null,
                    $datos['origen'] ?? null,
                    $fecha ?? now()->toDateString(),
                    $serie?->id,
                ]
            )->codigo);
        } catch (QueryException $e) {
            $error = ErrorBaseDatos::desde($e);
            if ($error === null) {
                throw $e;
            }

            return ['codigo' => null, 'repetido' => false, 'error' => $error->mensaje];
        }

        return [
            'codigo'   => $codigo,
            'repetido' => DB::table('cargas.lote')->where('codigo', $codigo)->exists(),
            'error'    => null,
        ];
    }

    public function crear(array $datos): SerieLote
    {
        return Transaccion::delUsuarioActual(fn () => SerieLote::create($datos)->refresh());
    }

    public function actualizar(SerieLote $serie, array $datos): SerieLote
    {
        return Transaccion::delUsuarioActual(function () use ($serie, $datos) {
            $serie->update($datos);

            return $serie->refresh();
        });
    }

    /** Continúa la numeración de otro sistema. Devuelve el próximo código. */
    public function fijarUltimoNumero(SerieLote $serie, int $ultimo): string
    {
        return Transaccion::delUsuarioActual(fn () => DB::selectOne(
            'select cargas.fijar_ultimo_numero_serie(?, ?) as codigo',
            [$serie->id, $ultimo]
        )->codigo);
    }

    /** Último número usado en el período actual (0 si todavía no hay lotes). */
    public function ultimoNumero(SerieLote $serie, ?string $fecha = null): int
    {
        $fila = DB::selectOne(
            "select ultimo_numero from comun.contador
              where clave = ? and periodo = comun.periodo_de(?, ?::date)",
            ['cargas.serie_lote:' . $serie->id, $serie->reinicio, $fecha ?? now()->toDateString()]
        );

        return (int) ($fila->ultimo_numero ?? 0);
    }
}
