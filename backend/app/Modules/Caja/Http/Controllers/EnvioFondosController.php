<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\EnvioFondos;
use App\Modules\Caja\Services\EnvioFondosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Envíos de dinero de la sede central a las cajas: enviar, recibir y anular. */
class EnvioFondosController extends Controller
{
    use AmbitoDeCaja;

    private const RELACIONES = [
        'origen:id,codigo,nombre', 'destino:id,codigo,nombre', 'enviadoPor:id,name', 'recibidoPor:id,name', 'anuladoPor:id,name',
        'movimientoEnvio:id,numero', 'movimientoRecepcion:id,numero', 'movimientoReintegro:id,numero',
    ];

    public function __construct(private readonly EnvioFondosService $envios)
    {
    }

    /** Envíos de una caja (enviados y recibidos): los en tránsito primero. */
    public function deCaja(Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);
        $envios = EnvioFondos::query()
            ->where(fn ($q) => $q->where('caja_origen_id', $caja->id)->orWhere('caja_destino_id', $caja->id))
            ->with(self::RELACIONES)
            ->orderByRaw("estado <> 'EN_TRANSITO'")->orderByDesc('enviado_en')
            ->limit(60)->get();

        return response()->json(['data' => $envios, 'destinos' => $this->destinos($caja)]);
    }

    public function store(Request $request, Caja $caja): JsonResponse
    {
        $this->asegurarCajero($caja);
        $d = $request->validate([
            'caja_destino_id' => ['required', 'integer', Rule::exists(Caja::class, 'id')->where('activa', true), Rule::notIn([$caja->id])],
            'monto'           => ['required', 'numeric', 'gt:0', 'max:99999999', 'decimal:0,2'],
            'moneda'          => ['required', Rule::in(['BOB', 'USD'])],
            'motivo'          => ['required', 'string', 'min:5', 'max:200'],
            'entregado_a'     => ['nullable', 'string', 'max:150'],
        ], [
            'caja_destino_id.not_in' => 'Elija otra caja: no se envía dinero a la misma caja.',
            'motivo.min'             => 'Explique para qué es el envío (apertura, reposición…).',
        ]);
        $envio = $this->envios->enviar($caja, Caja::findOrFail($d['caja_destino_id']), (float) $d['monto'], $d['moneda'],
            trim($d['motivo']), isset($d['entregado_a']) ? mb_strtoupper(trim($d['entregado_a'])) : null, $request->user());

        return response()->json(['data' => $envio->load(self::RELACIONES),
            'mensaje' => "Envío {$envio->numero} registrado: queda en tránsito hasta que la caja {$envio->destino->codigo} lo reciba."], 201);
    }

    public function recibir(Request $request, EnvioFondos $envio): JsonResponse
    {
        $this->asegurarCajero($envio->destino);
        $envio = $this->envios->recibir($envio, $request->user());

        return response()->json(['data' => $envio->load(self::RELACIONES),
            'mensaje' => "Envío {$envio->numero} recibido: ingresó a la caja con el comprobante {$envio->movimientoRecepcion->numero}."]);
    }

    public function anular(Request $request, EnvioFondos $envio): JsonResponse
    {
        $this->asegurarCajero($envio->origen);
        $motivo = $request->validate(['motivo' => ['required', 'string', 'min:5', 'max:250']])['motivo'];
        $envio = $this->envios->anular($envio, $request->user(), trim($motivo));

        return response()->json(['data' => $envio->load(self::RELACIONES),
            'mensaje' => "Envío {$envio->numero} anulado: el dinero volvió a la caja con el comprobante {$envio->movimientoReintegro->numero}."]);
    }

    /** A qué cajas puede enviar (solo la caja de la sede central envía). */
    private function destinos(Caja $caja): array
    {
        if (! $caja->esCentral()) {
            return [];
        }

        return Caja::query()->where('activa', true)->whereKeyNot($caja->id)
            ->with('almacen.centroCosto:id,almacen_id,codigo,nombre')
            ->orderBy('codigo')->get(['id', 'codigo', 'nombre', 'almacen_id'])
            ->map(fn ($c) => ['id' => $c->id, 'codigo' => $c->codigo, 'nombre' => $c->nombre,
                              'centro_costo' => $c->almacen?->centroCosto?->nombre])
            ->all();
    }
}
