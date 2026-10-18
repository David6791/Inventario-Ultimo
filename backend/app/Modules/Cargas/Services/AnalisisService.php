<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Cargas\Models\Analisis;
use App\Modules\Cargas\Models\LecturaEstimada;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Models\LoteLey;
use App\Modules\Cargas\Models\Muestra;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Laboratorio del lote: muestra con sus porciones, análisis de la empresa,
 * del productor y del dirimente, ley final por elemento y cierre.
 *
 * Las reglas (qué muestra está vigente, quién puede dirimir, cuánto vale la
 * ley según el criterio, cuándo un lote queda ANALIZADO) están en la base
 * (14_laboratorio.sql). Aquí se arman las filas y se guardan los
 * certificados en el disco privado.
 */
class AnalisisService
{
    public const DISCO = 'local';

    /**
     * Registra la muestra y sus porciones. La primera pasa el lote a MUESTREADO.
     *
     * @param array{metodo?: ?string, peso_g?: ?float, observaciones?: ?string,
     *              porciones: array<int, array{destino: string, precinto: ?string, entregada_a?: ?string}>} $datos
     */
    public function registrarMuestra(Lote $lote, array $datos, User $usuario): Muestra
    {
        return Transaccion::como($usuario->id, function () use ($lote, $datos, $usuario) {
            $muestra = Muestra::create([
                'lote_id'        => $lote->id,
                'metodo'         => $datos['metodo'] ?? null,
                'peso_g'         => $datos['peso_g'] ?? null,
                'observaciones'  => $datos['observaciones'] ?? null,
                'registrado_por' => $usuario->id,
            ])->refresh();

            foreach ($datos['porciones'] as $p) {
                $muestra->porciones()->create([
                    'destino'      => $p['destino'],
                    'precinto'     => $p['precinto'] ?? null,
                    'entregada_a'  => $p['entregada_a'] ?? null,
                    'entregada_en' => ! empty($p['entregada_a']) ? now() : null,
                ]);
            }

            if ($lote->estado === 'RECIBIDO') {
                $this->cambiarEstado($lote, 'MUESTREADO', "Muestra {$muestra->codigo}");
            }

            return $muestra->load('porciones');
        });
    }

    /**
     * @param array{tipo: string, laboratorio_id: int, numero_certificado: ?string, fecha_emision: ?string,
     *              resultados: array<int, array{elemento_id: int, valor: float}>} $datos
     */
    public function registrarAnalisis(Muestra $muestra, array $datos, ?UploadedFile $certificado, User $usuario): Analisis
    {
        $ruta = null;
        try {
            return Transaccion::como($usuario->id, function () use ($muestra, $datos, $certificado, $usuario, &$ruta) {
                $analisis = Analisis::create([
                    'muestra_id'         => $muestra->id,
                    'laboratorio_id'     => $datos['laboratorio_id'],
                    'tipo'               => $datos['tipo'],
                    'numero_certificado' => $datos['numero_certificado'] ?? null,
                    'fecha_emision'      => $datos['fecha_emision'] ?? null,
                    'registrado_por'     => $usuario->id,
                ]);
                foreach ($datos['resultados'] as $r) {
                    $analisis->resultados()->create(['elemento_id' => $r['elemento_id'], 'valor' => $r['valor']]);
                }
                if ($certificado) {
                    $ruta = $this->guardarCertificado($analisis, $certificado);
                    $analisis->forceFill(['archivo_path' => $ruta])->save();
                }

                return $analisis->refresh()->load(['resultados.elemento:id,codigo,unidad_ley', 'laboratorio:id,nombre']);
            });
        } catch (\Throwable $e) {
            if ($ruta) {
                Storage::disk(self::DISCO)->delete($ruta);   // la fila no quedó: tampoco el archivo
            }
            throw $e;
        }
    }

    /** Adjunta (o reemplaza) el certificado escaneado de un análisis vigente. */
    public function adjuntarCertificado(Analisis $analisis, UploadedFile $archivo, User $usuario): Analisis
    {
        $anterior = $analisis->archivo_path;
        $ruta = $this->guardarCertificado($analisis, $archivo);
        try {
            Transaccion::como($usuario->id, fn () => $analisis->forceFill(['archivo_path' => $ruta])->save());
        } catch (\Throwable $e) {
            Storage::disk(self::DISCO)->delete($ruta);
            throw $e;
        }
        if ($anterior && $anterior !== $ruta) {
            Storage::disk(self::DISCO)->delete($anterior);
        }

        return $analisis->refresh();
    }

    public function anularAnalisis(Analisis $analisis, string $motivo, User $usuario): Analisis
    {
        return Transaccion::como($usuario->id, function () use ($analisis, $motivo) {
            $analisis->forceFill(['anulado' => true, 'motivo_anulacion' => $motivo])->save();

            return $analisis->refresh();
        });
    }

    /** Fija (o cambia) la ley final de un elemento. La base calcula el valor salvo en ACUERDO. */
    public function fijarLey(Lote $lote, int $elementoId, string $criterio, ?float $valor, ?string $observacion, User $usuario): LoteLey
    {
        return Transaccion::como($usuario->id, function () use ($lote, $elementoId, $criterio, $valor, $observacion, $usuario) {
            $ley = LoteLey::firstOrNew(['lote_id' => $lote->id, 'elemento_id' => $elementoId]);
            $ley->fill([
                'criterio'        => $criterio,
                'valor'           => $criterio === 'ACUERDO' ? $valor : ($ley->valor ?? 0),
                'observacion'     => $observacion,
                'determinado_por' => $usuario->id,
            ])->save();

            return $ley->refresh()->load('elemento:id,codigo,nombre,unidad_ley');
        });
    }

    public function quitarLey(Lote $lote, int $elementoId, User $usuario): void
    {
        Transaccion::como($usuario->id, fn () => LoteLey::where('lote_id', $lote->id)->where('elemento_id', $elementoId)->delete());
    }

    /** MUESTREADO → ANALIZADO. La base verifica que estén la humedad y todas las leyes pagables. */
    public function cerrarAnalisis(Lote $lote, User $usuario): Lote
    {
        return Transaccion::como($usuario->id, fn () => $this->cambiarEstado($lote, 'ANALIZADO', 'Leyes finales fijadas'));
    }

    /** ANALIZADO → MUESTREADO para corregir una ley o tomar una muestra nueva. */
    public function reabrir(Lote $lote, string $motivo, User $usuario): Lote
    {
        return Transaccion::como($usuario->id, fn () => $this->cambiarEstado($lote, 'MUESTREADO', "Reabierto: {$motivo}"));
    }

    /** @param array<int, array{elemento_id: int, valor: ?float}> $lecturas  valor null = quitar */
    public function lecturaEstimada(Lote $lote, array $lecturas, ?string $metodo, User $usuario): void
    {
        Transaccion::como($usuario->id, function () use ($lote, $lecturas, $metodo, $usuario) {
            foreach ($lecturas as $l) {
                if ($l['valor'] === null) {
                    LecturaEstimada::where('lote_id', $lote->id)->where('elemento_id', $l['elemento_id'])->delete();
                    continue;
                }
                LecturaEstimada::updateOrCreate(
                    ['lote_id' => $lote->id, 'elemento_id' => $l['elemento_id']],
                    ['valor' => $l['valor'], 'metodo' => $metodo, 'registrado_por' => $usuario->id, 'registrado_en' => now()],
                );
            }
        });
    }

    /** Elementos de los que hace falta ley final (humedad + pagables) y los demás de la línea. */
    public function elementosDe(Lote $lote): array
    {
        return array_map(fn ($r) => (array) $r, DB::select(
            "select e.id, e.codigo, e.nombre, e.unidad_ley,
                    coalesce(lpe.rol, 'HUMEDAD') as rol, lpe.split_limit,
                    (e.codigo = 'H2O' or lpe.rol = 'PAGABLE') as requerido
               from cargas.elemento e
               left join cargas.linea_producto_elemento lpe
                      on lpe.elemento_id = e.id and lpe.linea_producto_id = ?
              where e.codigo = 'H2O' or lpe.id is not null
              order by (e.codigo = 'H2O') desc,
                       array_position(array['PAGABLE','PENALIZABLE','INFORMATIVO']::varchar[], lpe.rol), e.codigo",
            [$lote->linea_producto_id]
        ));
    }

    private function cambiarEstado(Lote $lote, string $estado, string $detalle): Lote
    {
        DB::select("select set_config('cargas.detalle_evento', ?, true)", [$detalle]);
        $lote->forceFill(['estado' => $estado])->save();
        DB::select("select set_config('cargas.detalle_evento', '', true)");

        return $lote->refresh();
    }

    private function guardarCertificado(Analisis $analisis, UploadedFile $archivo): string
    {
        $codigo = DB::table('cargas.muestra')->where('id', $analisis->muestra_id)->value('codigo');
        $nombre = Str::slug("{$codigo}-{$analisis->tipo}-" . ($analisis->numero_certificado ?? $analisis->id))
            . '-' . Str::lower(Str::random(6)) . '.' . strtolower($archivo->getClientOriginalExtension() ?: $archivo->extension());

        return $archivo->storeAs('cargas/certificados/' . now()->format('Y/m'), $nombre, self::DISCO);
    }
}
