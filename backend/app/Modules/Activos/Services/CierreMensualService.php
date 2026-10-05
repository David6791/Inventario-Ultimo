<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Cierre;
use App\Modules\Activos\Models\Documento;
use App\Modules\Activos\Models\Mejora;
use App\Modules\Activos\Models\PruebaValorRecuperable;
use App\Modules\Activos\Models\Valuacion;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Cierre mensual de valuación.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EL ORDEN NO ES NEGOCIABLE
 *
 * Primero se ACTUALIZA por UFV, luego se verifica el LÍMITE de valor
 * recuperable, y recién después se DEPRECIA sobre el valor ya actualizado.
 *
 * Invertirlo produce depreciación calculada sobre valor histórico, que es el
 * error más común en la práctica boliviana y el que después aparece como una
 * diferencia que nadie sabe explicar en la conciliación del IUE.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ DOS SERIES
 *
 * Las dos comparten la actualización por UFV: los estados financieros base
 * del IUE se expresan en moneda constante conforme a la NC 3. Difieren en:
 *
 *   · la vida útil — económica contra la del Anexo del Art. 22 del DS 24051
 *   · el régimen — regular o acelerado del DS 5563
 *   · la porción proveniente de revalúos, que NO es deducible
 *
 * Mantenerlas separadas desde el modelo de datos es lo que permite producir
 * la conciliación sin recalcular nada.
 */
class CierreMensualService
{
    public function __construct(private readonly ParametroService $parametros)
    {
    }

    // ═══════════════════════════════════════════════════════════ Apertura

    /**
     * Abre el período. No calcula nada: solo registra la UFV con la que se
     * va a trabajar.
     */
    public function abrir(string $periodo, float $ufvInicial, float $ufvFinal, int $usuarioId): Cierre
    {
        $mes = Carbon::parse($periodo)->startOfMonth();

        if ($mes->isFuture()) {
            throw new RuntimeException('No se puede abrir un período futuro.');
        }

        if (Cierre::where('periodo', $mes)->exists()) {
            throw new RuntimeException("El período {$mes->format('m/Y')} ya fue abierto.");
        }

        $this->verificarPeriodoAnteriorCerrado($mes);

        if ($ufvInicial <= 0 || $ufvFinal <= 0) {
            throw new RuntimeException('Las UFV deben ser mayores a cero.');
        }

        return Cierre::create([
            'periodo'     => $mes,
            'ufv_inicial' => $ufvInicial,
            'ufv_final'   => $ufvFinal,
            'estado'      => Cierre::ABIERTO,
        ]);
    }

    // ═══════════════════════════════════════════════════════════ Cálculo

    /**
     * El pipeline completo. Todo en una transacción: o sale entero o no sale.
     */
    public function calcular(Cierre $cierre, int $usuarioId): Cierre
    {
        if (! $cierre->puedeRecalcularse()) {
            throw new RuntimeException(
                "El período {$cierre->etiqueta} está cerrado. No se recalcula."
            );
        }

        return DB::transaction(function () use ($cierre, $usuarioId) {

            $this->verificarPeriodoAnteriorCerrado($cierre->periodo);
            $this->verificarSinDocumentosPendientes($cierre->periodo);

            // Recalcular borra lo anterior: no se acumulan resultados de
            // corridas distintas.
            $cierre->valuaciones()->delete();

            $factor  = $cierre->factor();
            $activos = $this->activosDelPeriodo($cierre->periodo);

            $totales = [
                'actualizacion'  => 0.0,
                'dep_financiera' => 0.0,
                'dep_fiscal'     => 0.0,
                'no_deducible'   => 0.0,
            ];

            foreach ($activos as $activo) {
                $mejora = $this->mejorasDelPeriodo($activo, $cierre->periodo);

                $financiera = $this->calcularSerie(
                    $cierre, $activo, Valuacion::FINANCIERA, $factor, $mejora
                );

                $impositiva = $this->calcularSerie(
                    $cierre, $activo, Valuacion::IMPOSITIVA, $factor, $mejora
                );

                $totales['actualizacion']  += (float) $financiera->actualizacion;
                $totales['dep_financiera'] += (float) $financiera->dep_periodo;
                $totales['dep_fiscal']     += (float) $impositiva->dep_periodo;
                $totales['no_deducible']   += (float) $impositiva->dep_periodo_no_deducible;
            }

            $cierre->update([
                'estado'               => Cierre::CALCULADO,
                'activos_procesados'   => $activos->count(),
                'total_actualizacion'  => round($totales['actualizacion'], 2),
                'total_dep_financiera' => round($totales['dep_financiera'], 2),
                'total_dep_fiscal'     => round($totales['dep_fiscal'], 2),
                'total_no_deducible'   => round($totales['no_deducible'], 2),
                'calculado_por'        => $usuarioId,
                'calculado_at'         => now(),
            ]);

            return $cierre->fresh();
        });
    }

    /**
     * Calcula una serie para un activo.
     *
     * Acá vive toda la aritmética del módulo.
     */
    private function calcularSerie(
        Cierre $cierre,
        Activo $activo,
        string $tipo,
        float $factor,
        float $mejora
    ): Valuacion {

        $anterior = $this->valuacionAnterior($activo, $cierre->periodo, $tipo);

        // ── 1. Punto de partida ──────────────────────────────────────────
        // El primer período parte del valor de origen; los siguientes, del
        // valor final del período anterior.
        $valorBaseInicial = $anterior
            ? (float) $anterior->valor_base_final
            : (float) $activo->valor_origen;

        $depAcumInicial = $anterior ? (float) $anterior->dep_acum_final : 0.0;

        // ── 2. Actualización por UFV (NC 3) ──────────────────────────────
        // Se aplica al valor Y a la depreciación acumulada: si solo se
        // actualizara el valor, el neto crecería artificialmente.
        $actualizacion    = round($valorBaseInicial * ($factor - 1), 2);
        $depActualizacion = round($depAcumInicial * ($factor - 1), 2);

        $valorActualizado = $valorBaseInicial + $actualizacion;

        // ── 3. Límite del valor recuperable (NC 3) ───────────────────────
        // La actualización no puede llevar el bien por encima de lo que
        // realmente vale. Si hay una prueba registrada que lo limite, se
        // recorta y queda constancia.
        $ajusteLimite = $this->ajustePorValorRecuperable(
            $activo, $cierre->periodo, $valorActualizado, $tipo
        );

        // ── 4. Mejoras capitalizadas del período ─────────────────────────
        $valorBaseFinal = $valorActualizado + $ajusteLimite + $mejora;

        // ── 5. Depreciación sobre el valor YA ACTUALIZADO ────────────────
        $vidaUtil = $this->vidaUtilDe($activo, $tipo);
        $mesesPrevios = $anterior ? (int) $anterior->meses_depreciados : 0;

        [$depPeriodo, $mesesDepreciados] = $this->depreciacionDelPeriodo(
            $activo, $cierre->periodo, $valorBaseFinal, $depAcumInicial + $depActualizacion,
            $vidaUtil, $mesesPrevios
        );

        $depAcumFinal = round($depAcumInicial + $depActualizacion + $depPeriodo, 2);

        // ── 6. Porción no deducible ──────────────────────────────────────
        // Solo en la serie impositiva, y solo lo que proviene de revalúos
        // técnicos: el DS 24051 Art. 22 la excluye de la deducción del IUE.
        $noDeducible = $tipo === Valuacion::IMPOSITIVA
            ? $this->porcionNoDeducible($activo, $depPeriodo, $valorBaseFinal)
            : 0.0;

        return Valuacion::create([
            'cierre_id'                => $cierre->id,
            'activo_id'                => $activo->id,
            'periodo'                  => $cierre->periodo,
            'tipo'                     => $tipo,
            'valor_base_inicial'       => $valorBaseInicial,
            'actualizacion'            => $actualizacion,
            'incremento_revaluo'       => 0,
            'incremento_mejora'        => $mejora,
            'ajuste_valor_recuperable' => $ajusteLimite,
            'valor_base_final'         => round($valorBaseFinal, 2),
            'dep_acum_inicial'         => $depAcumInicial,
            'dep_actualizacion'        => $depActualizacion,
            'dep_periodo'              => $depPeriodo,
            'dep_periodo_no_deducible' => $noDeducible,
            'dep_acum_final'           => $depAcumFinal,
            'meses_depreciados'        => $mesesDepreciados,
            'vida_util_meses'          => $vidaUtil,
        ]);
    }

    /**
     * Depreciación del mes, en línea recta sobre el valor actualizado.
     *
     * Reglas que respeta:
     *   · No deprecia antes de la fecha de inicio de utilización y uso.
     *   · El mes de inicio cuenta como mes completo (DS 24051 Art. 22).
     *   · La acumulada nunca supera el valor contabilizado.
     *   · Un bien sin vida útil (terreno) no deprecia.
     *
     * @return array{0: float, 1: int}
     */
    private function depreciacionDelPeriodo(
        Activo $activo,
        Carbon $periodo,
        float $valorBase,
        float $depAcum,
        ?int $vidaUtil,
        int $mesesPrevios
    ): array {

        if (! $vidaUtil || $vidaUtil <= 0) {
            return [0.0, $mesesPrevios];           // terrenos y similares
        }

        if (! $activo->fecha_inicio_uso) {
            return [0.0, $mesesPrevios];           // todavía no entró en servicio
        }

        $inicioUso = $activo->fecha_inicio_uso->copy()->startOfMonth();

        if ($inicioUso->gt($periodo)) {
            return [0.0, $mesesPrevios];           // el período es anterior al uso
        }

        if ($mesesPrevios >= $vidaUtil) {
            return [0.0, $mesesPrevios];           // vida útil agotada
        }

        $depreciable = $valorBase - (float) $activo->valor_residual;
        $cuota = round($depreciable / $vidaUtil, 2);

        // Tope duro: la acumulada no puede superar el valor contabilizado.
        // Es la misma regla que impone ck_valuacion_tope en la base.
        $margen = round($valorBase - $depAcum, 2);

        if ($cuota > $margen) {
            $cuota = max($margen, 0);
        }

        return [$cuota, $mesesPrevios + 1];
    }

    /**
     * Recorte por valor recuperable.
     *
     * Devuelve un número negativo si hay que bajar el valor, cero si no.
     * Solo actúa si existe una prueba registrada para ese activo y período:
     * sin respaldo documentado no se ajusta nada.
     */
    private function ajustePorValorRecuperable(
        Activo $activo, Carbon $periodo, float $valorActualizado, string $tipo
    ): float {

        if ($tipo !== Valuacion::FINANCIERA) {
            return 0.0;
        }

        $prueba = PruebaValorRecuperable::where('activo_id', $activo->id)
            ->whereDate('periodo', $periodo)
            ->first();

        if (! $prueba) {
            return 0.0;
        }

        $recuperable = (float) $prueba->valor_recuperable;

        return $valorActualizado > $recuperable
            ? round($recuperable - $valorActualizado, 2)
            : 0.0;
    }

    private function porcionNoDeducible(Activo $activo, float $depPeriodo, float $valorBase): float
    {
        // Sin revalúos registrados no hay porción no deducible.
        // El cálculo real llega con el módulo de revalorización.
        return 0.0;
    }

    // ═══════════════════════════════════════════════════════════ Cierre

    /**
     * Cierra el período. A partir de acá los valores son definitivos y el
     * período siguiente parte de ellos.
     */
    public function cerrar(Cierre $cierre, int $usuarioId, ?string $comprobante = null): Cierre
    {
        if (! $cierre->estaCalculado()) {
            throw new RuntimeException(
                $cierre->estaCerrado()
                    ? "El período {$cierre->etiqueta} ya está cerrado."
                    : 'Calcule el período antes de cerrarlo.'
            );
        }

        $cierre->update([
            'estado'               => Cierre::CERRADO,
            'comprobante_contable' => $comprobante,
            'cerrado_por'          => $usuarioId,
            'cerrado_at'           => now(),
        ]);

        return $cierre->fresh();
    }

    /**
     * Reabre un período calculado y borra sus valuaciones.
     * No reabre uno cerrado: eso requeriría revertir asientos contables.
     */
    public function reabrir(Cierre $cierre): Cierre
    {
        if ($cierre->estaCerrado()) {
            throw new RuntimeException(
                "El período {$cierre->etiqueta} está cerrado. Reabrirlo exigiría revertir "
                .'los asientos contables ya registrados.'
            );
        }

        DB::transaction(function () use ($cierre) {
            $cierre->valuaciones()->delete();
            $cierre->update([
                'estado' => Cierre::ABIERTO,
                'activos_procesados' => null,
                'total_actualizacion' => null,
                'total_dep_financiera' => null,
                'total_dep_fiscal' => null,
                'total_no_deducible' => null,
                'calculado_por' => null,
                'calculado_at' => null,
            ]);
        });

        return $cierre->fresh();
    }

    // ═══════════════════════════════════════════════════ Apoyos y controles

    /**
     * Un período no se calcula si el anterior quedó sin cerrar: arrastraría
     * valores provisionales y el resultado no sería reproducible.
     */
    private function verificarPeriodoAnteriorCerrado(Carbon $periodo): void
    {
        $anterior = $periodo->copy()->subMonth()->startOfMonth();

        $cierreAnterior = Cierre::where('periodo', $anterior)->first();

        // Si no existe, es el primer período del módulo: válido.
        if (! $cierreAnterior) {
            return;
        }

        if (! $cierreAnterior->estaCerrado()) {
            throw new RuntimeException(sprintf(
                'El período %s está en estado %s. Ciérrelo antes de trabajar en %s.',
                $cierreAnterior->etiqueta,
                $cierreAnterior->estado,
                $periodo->locale('es')->isoFormat('MMMM [de] YYYY')
            ));
        }
    }

    /**
     * Documentos de custodia en borrador dentro del período: su efecto no
     * está aplicado, así que el cierre tomaría una foto incompleta.
     */
    private function verificarSinDocumentosPendientes(Carbon $periodo): void
    {
        $pendientes = Documento::where('estado', Documento::BORRADOR)
            ->whereBetween('fecha', [$periodo->copy()->startOfMonth(), $periodo->copy()->endOfMonth()])
            ->count();

        if ($pendientes > 0) {
            throw new RuntimeException(
                "Hay {$pendientes} documento(s) de custodia en borrador dentro del período. "
                .'Confírmelos o anúlelos antes de calcular: su efecto todavía no está aplicado.'
            );
        }
    }

    /** Activos que corresponde valuar en el período. */
    private function activosDelPeriodo(Carbon $periodo)
    {
        $fin = $periodo->copy()->endOfMonth();

        return Activo::query()
            ->where('es_bien_control', false)          // los de control van a gasto
            ->whereDate('fecha_incorporacion', '<=', $fin)
            ->where(function ($q) use ($periodo) {
                // Los dados de baja se valúan hasta el mes de la baja inclusive.
                $q->where('estado', '<>', 'DADO_DE_BAJA')
                  ->orWhereDate('fecha_baja', '>=', $periodo->copy()->startOfMonth());
            })
            ->orderBy('id')
            ->get();
    }

    private function valuacionAnterior(Activo $activo, Carbon $periodo, string $tipo): ?Valuacion
    {
        return Valuacion::where('activo_id', $activo->id)
            ->where('tipo', $tipo)
            ->whereDate('periodo', '<', $periodo)
            ->orderByDesc('periodo')
            ->first();
    }

    private function mejorasDelPeriodo(Activo $activo, Carbon $periodo): float
    {
        return (float) Mejora::where('activo_id', $activo->id)
            ->whereBetween('fecha', [$periodo->copy()->startOfMonth(), $periodo->copy()->endOfMonth()])
            ->sum('monto');
    }

    /** La vida útil que corresponde a cada serie. */
    private function vidaUtilDe(Activo $activo, string $tipo): ?int
    {
        return $tipo === Valuacion::FINANCIERA
            ? $activo->vida_util_economica_meses
            : $activo->vida_util_fiscal_meses;
    }
}
