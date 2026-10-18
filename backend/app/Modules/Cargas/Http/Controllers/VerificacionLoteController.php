<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Models\Lote;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Lo que se ve al escanear el QR del rótulo del lote, sin iniciar sesión.
 *
 * Sirve para comprobar en el patio que la carga que se tiene delante es la
 * registrada: mismo código, mismo productor, mismos sacos y peso, y que el
 * lote no esté anulado.
 *
 * Se llega solo con el código aleatorio impreso en el rótulo (no con el
 * código del lote, que es correlativo). NO se muestra dinero (bonos,
 * anticipos, valor), ni CI o NIT, ni leyes de laboratorio.
 */
class VerificacionLoteController extends Controller
{
    public function __invoke(string $codigo): JsonResponse
    {
        $lote = Lote::query()
            ->where('codigo_verificacion', strtolower($codigo))
            ->with(['productor:id,nombre', 'cooperativa:id,nombre', 'linea:id,nombre', 'mina:id,nombre',
                    'bocamina:id,codigo', 'almacen:id,nombre', 'pesajes'])
            ->first();

        if (! $lote) {
            return response()->json([
                'mensaje' => 'Este código no corresponde a ningún lote registrado. El rótulo puede ser falso o de otro sistema.',
            ], 404);
        }

        $peso = DB::table('cargas.v_lote_resumen')->where('lote_id', $lote->id)->first(['num_pesajes', 'num_sacos', 'peso_neto_humedo_kg']);

        return response()->json(['data' => [
            'codigo'          => $lote->codigo,
            'estado'          => $lote->estado,
            'anulado_en'      => $lote->anulado_en?->toIso8601String(),
            'motivo_anulacion'=> $lote->estado === 'ANULADO' ? $lote->motivo_anulacion : null,
            'fecha_recepcion' => $lote->fecha_recepcion->toIso8601String(),
            'linea'           => $lote->linea?->nombre,
            'origen'          => $lote->origen,
            'sede'            => $lote->almacen?->nombre,
            'productor'       => $lote->productor?->nombre,
            'cooperativa'     => $lote->cooperativa?->nombre,
            'mina'            => $lote->mina?->nombre,
            'bocamina'        => $lote->bocamina?->codigo,
            'material'        => $lote->material,
            'num_pesajes'     => (int) ($peso->num_pesajes ?? 0),
            'num_sacos'       => $peso->num_sacos ?? null,
            'peso_neto_kg'    => $peso->peso_neto_humedo_kg ?? '0',
            'pesajes'         => $lote->pesajes->where('tipo', 'INGRESO')->values()->map(fn ($p) => [
                'ticket'       => $p->ticket,
                'fecha'        => $p->fecha?->toIso8601String(),
                'placa'        => $p->placa,
                'num_sacos'    => $p->num_sacos,
                'peso_neto_kg' => $p->peso_neto_kg,
                'anulado'      => $p->anulado,
            ]),
            'empresa'         => config('app.empresa'),
            'consultado_en'   => now()->toIso8601String(),
        ]]);
    }
}
