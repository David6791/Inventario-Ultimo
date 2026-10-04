<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\ActivoCosto;
use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Movimiento;
use App\Modules\Activos\Models\Parametro;
use App\Modules\Activos\Models\Subclase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Alta de activos fijos.
 *
 * Todo ocurre dentro de UNA transacción, y el código correlativo se reserva
 * adentro. SecuenciaService bloquea la fila con FOR UPDATE: si se llamara
 * fuera de la transacción, el bloqueo se liberaría antes de insertar y dos
 * altas simultáneas podrían pelear por el mismo número.
 */
class AltaService
{
    public function __construct(
        private readonly SecuenciaService $secuencias,
        private readonly ParametroService $parametros,
    ) {
    }

    /**
     * Da de alta un activo.
     *
     * @param  array  $datos     campos del activo
     * @param  array  $costos    [['concepto' => 'FLETE', 'monto' => 120, ...], ...]
     * @param  int    $usuarioId quién registra
     */
    public function registrar(array $datos, array $costos, int $usuarioId): Activo
    {
        return DB::transaction(function () use ($datos, $costos, $usuarioId) {

            $clase    = Clase::findOrFail($datos['clase_id']);
            $subclase = Subclase::findOrFail($datos['subclase_id']);

            $this->validarCoherencia($clase, $subclase, $datos);

            $valorOrigen = $this->totalizarCosto($costos);
            $esBienControl = $this->esBienDeControl($valorOrigen, $datos);

            // El código se reserva acá dentro, con la transacción abierta.
            $codigo = $this->secuencias->generarCodigoActivo($clase, $subclase);

            $activo = Activo::create(array_merge($datos, [
                'codigo'          => $codigo,
                'correlativo'     => (int) substr($codigo, -6),
                'valor_origen'    => $valorOrigen,
                'es_bien_control' => $esBienControl,
                'estado'          => 'REGISTRADO',
                'created_by'      => $usuarioId,

                'vida_util_fiscal_meses'    => $this->vidaUtilFiscal($clase, $datos),
                'vida_util_economica_meses' => $this->vidaUtilEconomica($clase, $subclase, $datos),
                'regimen_fiscal'            => $this->regimenFiscal($clase, $datos),
            ]));

            $this->guardarCostos($activo, $costos);

            Movimiento::create([
                'activo_id'      => $activo->id,
                'tipo'           => 'ALTA',
                'fecha'          => now(),
                'estado_nuevo'   => 'REGISTRADO',
                'ubicacion_nueva_id' => $activo->ubicacion_id,
                'usuario_id'     => $usuarioId,
                'detalle'        => [
                    'codigo'       => $codigo,
                    'valor_origen' => (float) $valorOrigen,
                    'origen'       => $activo->tipo_origen,
                ],
            ]);

            return $activo->load(['clase', 'subclase', 'ubicacion', 'costos']);
        });
    }

    /**
     * Reglas que las constraints de la base no pueden expresar solas.
     */
    private function validarCoherencia(Clase $clase, Subclase $subclase, array $datos): void
    {
        if ($subclase->clase_id !== $clase->id) {
            throw new RuntimeException(
                "La subclase «{$subclase->nombre}» no pertenece a la clase «{$clase->nombre}»."
            );
        }

        if (! $clase->activo || ! $subclase->activo) {
            throw new RuntimeException('No se puede dar de alta con una clase o subclase desactivada.');
        }

        // La fecha de inicio de uso es la base de la depreciación impositiva.
        // Puede ser posterior a la incorporación (un equipo recibido en
        // diciembre que se pone en servicio en enero), nunca anterior.
        if (! empty($datos['fecha_inicio_uso'])) {
            $incorporacion = Carbon::parse($datos['fecha_incorporacion']);
            $inicioUso     = Carbon::parse($datos['fecha_inicio_uso']);

            if ($inicioUso->lt($incorporacion)) {
                throw new RuntimeException(
                    'La fecha de inicio de uso no puede ser anterior a la de incorporación.'
                );
            }
        }

        // Terrenos y edificaciones van en fichas separadas: el terreno no
        // deprecia y mezclarlos impide calcular bien cualquiera de los dos.
        if ($clase->codigo === '01' && ! empty($datos['vida_util_fiscal_meses'])) {
            throw new RuntimeException('Un terreno no lleva vida útil: no se deprecia.');
        }
    }

    /** @param array $costos */
    private function totalizarCosto(array $costos): string
    {
        if (empty($costos)) {
            throw new RuntimeException('El alta requiere al menos el concepto PRECIO.');
        }

        $conceptos = array_column($costos, 'concepto');

        if (! in_array('PRECIO', $conceptos, true)) {
            throw new RuntimeException('Falta el concepto PRECIO en el desglose del costo.');
        }

        $total = array_sum(array_map(fn ($c) => (float) $c['monto'], $costos));

        if ($total <= 0) {
            throw new RuntimeException('El valor de origen debe ser mayor a cero.');
        }

        return number_format($total, 2, '.', '');
    }

    private function guardarCostos(Activo $activo, array $costos): void
    {
        foreach ($costos as $costo) {
            ActivoCosto::create([
                'activo_id'   => $activo->id,
                'concepto'    => $costo['concepto'],
                'monto'       => $costo['monto'],
                'documento'   => $costo['documento']   ?? null,
                'observacion' => $costo['observacion'] ?? null,
            ]);
        }
    }

    /**
     * Bajo el umbral y con vida útil mayor a un año, el bien se registra como
     * bien de control: se imputa a gasto pero se le sigue el rastro, porque es
     * de los que se extravían.
     *
     * El umbral está en UFV. La conversión a bolivianos exige la UFV del día,
     * que llega con el servicio de cotizaciones del sprint 5. Hasta entonces,
     * el valor se compara contra el umbral ya convertido que envía el cliente,
     * o se marca a mano.
     */
    private function esBienDeControl(string $valorOrigen, array $datos): bool
    {
        if (array_key_exists('es_bien_control', $datos)) {
            return (bool) $datos['es_bien_control'];
        }

        if (! empty($datos['umbral_bs'])) {
            return (float) $valorOrigen < (float) $datos['umbral_bs'];
        }

        return false;
    }

    /** Se hereda de la clase salvo que se indique otra explícitamente. */
    private function vidaUtilFiscal(Clase $clase, array $datos): ?int
    {
        if (! $clase->deprecia) {
            return null;
        }

        if (! empty($datos['vida_util_fiscal_meses'])) {
            return (int) $datos['vida_util_fiscal_meses'];
        }

        return $clase->vidaUtilFiscalMeses($this->aplicaRegimenAcelerado($clase, $datos));
    }

    /**
     * La vida útil económica es la estimación real de uso y puede diferir de
     * la fiscal. Es justamente lo que hace divergir las dos series de
     * valuación, y por eso se guarda aparte desde el principio.
     */
    private function vidaUtilEconomica(Clase $clase, Subclase $subclase, array $datos): ?int
    {
        if (! $clase->deprecia) {
            return null;
        }

        return (int) ($datos['vida_util_economica_meses']
            ?? $subclase->vida_util_economica_meses
            ?? $clase->vida_util_fiscal_meses);
    }

    private function regimenFiscal(Clase $clase, array $datos): string
    {
        if (! $clase->deprecia) {
            return 'NO_DEPRECIA';
        }

        if (! empty($datos['regimen_fiscal'])) {
            return $datos['regimen_fiscal'];
        }

        return $this->aplicaRegimenAcelerado($clase, $datos) ? 'ACELERADO_DS5563' : 'REGULAR';
    }

    /**
     * DS 5563: mitad de vida útil para activos adquiridos durante 2026.
     * Voluntario, por contribuyente, y excluye a extractivas mineras e
     * hidrocarburíferas. La decisión es de la empresa y vive en un parámetro;
     * acá solo se verifica que el activo caiga dentro del alcance.
     */
    private function aplicaRegimenAcelerado(Clase $clase, array $datos): bool
    {
        if (! $this->parametros->regimenAceleradoAdoptado()) {
            return false;
        }

        $fecha = Carbon::parse($datos['fecha_incorporacion'] ?? now());

        return $fecha->year === 2026 && $clase->deprecia;
    }
}
