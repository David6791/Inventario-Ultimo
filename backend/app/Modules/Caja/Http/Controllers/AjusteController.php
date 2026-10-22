<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\AjustarMovimientoRequest;
use App\Modules\Caja\Http\Requests\ResolverSolicitudRequest;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\MovimientoAjuste;
use App\Modules\Caja\Services\AjusteService;
use App\Modules\Caja\Services\CajaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Comprobantes provisionales: la cajera ajusta el monto en el día y lo
 * valida; un aumento en caja con aprobación lo aprueba un aprobador.
 */
class AjusteController extends Controller
{
    use AmbitoDeCaja;

    public function __construct(
        private readonly AjusteService $ajustes,
        private readonly CajaService $cajas,
    ) {
    }

    public function ajustar(AjustarMovimientoRequest $request, Movimiento $movimiento): JsonResponse
    {
        $this->asegurarCajero($movimiento->caja);

        $ajuste = $this->ajustes->ajustar($movimiento, $request->user(), $request->input('monto'),
            $request->input('motivo'), $request->input('documento'));

        $diferencia = (float) $ajuste->monto_nuevo - (float) $ajuste->monto_anterior;
        $mensaje = match (true) {
            $ajuste->estado === MovimientoAjuste::PENDIENTE
                => "Ajuste del comprobante {$movimiento->numero} enviado a aprobación: entregue la diferencia cuando lo aprueben.",
            $diferencia > 0 => "Comprobante {$movimiento->numero} ajustado: entregue " . $this->dinero($diferencia) . ' más.',
            default         => "Comprobante {$movimiento->numero} ajustado: reciba " . $this->dinero(-$diferencia) . ' de devolución.',
        };

        return $this->respuesta($movimiento, $mensaje, $ajuste);
    }

    public function aprobar(ResolverSolicitudRequest $request, MovimientoAjuste $ajuste): JsonResponse
    {
        $ajuste = $this->ajustes->resolver($ajuste, $request->user(), true, $request->input('observacion'));

        return response()->json(['data' => $ajuste,
            'mensaje' => "Ajuste del comprobante {$ajuste->movimiento->numero} aprobado: la cajera ya puede entregar la diferencia."]);
    }

    public function rechazar(ResolverSolicitudRequest $request, MovimientoAjuste $ajuste): JsonResponse
    {
        $ajuste = $this->ajustes->resolver($ajuste, $request->user(), false, $request->input('observacion'));

        return response()->json(['data' => $ajuste, 'mensaje' => "Ajuste del comprobante {$ajuste->movimiento->numero} rechazado."]);
    }

    public function aplicar(Request $request, MovimientoAjuste $ajuste): JsonResponse
    {
        abort_unless($request->user()->can('caja.registrar'), 403);
        $movimiento = $ajuste->movimiento;
        $this->asegurarCajero($movimiento->caja);

        $ajuste = $this->ajustes->aplicar($ajuste, $request->user());

        return $this->respuesta($movimiento,
            "Comprobante {$movimiento->numero} ajustado: entregue " . $this->dinero((float) $ajuste->monto_nuevo - (float) $ajuste->monto_anterior) . ' más.', $ajuste);
    }

    public function validar(Request $request, Movimiento $movimiento): JsonResponse
    {
        abort_unless($request->user()->can('caja.registrar'), 403);
        $this->asegurarCajero($movimiento->caja);

        $movimiento = $this->ajustes->validar($movimiento, $request->user());

        return $this->respuesta($movimiento, "Comprobante {$movimiento->numero} validado por " . $this->dinero((float) $movimiento->monto) . ': imprímalo para firmar.');
    }

    private function respuesta(Movimiento $movimiento, string $mensaje, ?MovimientoAjuste $ajuste = null): JsonResponse
    {
        $movimiento->refresh()->load(['concepto:id,codigo,nombre,tipo,origen', 'persona:id,nombre,ci', 'validadoPor:id,name',
            'ajustes.registradoPor:id,name', 'ajustes.resueltoPor:id,name', 'ajustes.aplicadoPor:id,name']);

        return response()->json([
            'data'    => $movimiento,
            'ajuste'  => $ajuste,
            'saldos'  => $this->cajas->resumen($movimiento->sesion),
            'mensaje' => $mensaje,
        ]);
    }

    private function dinero(float $monto): string
    {
        return 'Bs ' . number_format($monto, 2, ',', '.');
    }
}
