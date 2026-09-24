<?php

namespace App\Http\Requests;

use App\Enums\EstadoSolicitud;
use App\Models\SolicitudCompra;
use App\Models\SolicitudCompraDetalle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IngresoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Obligatoria: un ingreso siempre responde a una compra aprobada.
            'solicitud_compra_id' => [
                $this->isMethod('POST') ? 'required' : 'prohibited',
                'integer', Rule::exists('solicitudes_compra', 'id'),
            ],

            'fecha'            => ['required', 'date', 'before_or_equal:today'],
            'proveedor'        => ['required', 'string', 'max:200'],
            'tipo_documento'   => ['required', Rule::in(['factura', 'nota-entrega', 'acta', 'otro'])],
            'numero_documento' => ['nullable', 'string', 'max:40'],
            'fecha_documento'  => ['nullable', 'date', 'before_or_equal:today'],
            'observaciones'    => ['nullable', 'string', 'max:2000'],

            'detalles'                => ['required', 'array', 'min:1'],
            'detalles.*.solicitud_compra_detalle_id' => [
                'required', 'integer', Rule::exists('solicitud_compra_detalles', 'id'),
            ],
            'detalles.*.cantidad'       => ['required', 'numeric', 'gt:0'],
            'detalles.*.costo_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.lote'           => ['nullable', 'string', 'max:60'],
            'detalles.*.fecha_vencimiento' => ['nullable', 'date', 'after:today'],
            'detalles.*.observacion'    => ['nullable', 'string', 'max:300'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $lineas = collect($this->input('detalles', []));

            if ($lineas->isEmpty()) {
                return;
            }

            $this->verificarSolicitud($validator);
            $this->verificarSaldos($validator, $lineas);
        });
    }

    /** La solicitud tiene que estar aprobada y con saldo pendiente. */
    private function verificarSolicitud($validator): void
    {
        $id = $this->input('solicitud_compra_id')
            ?? $this->route('ingreso')?->solicitud_compra_id;

        $solicitud = SolicitudCompra::withoutGlobalScopes()->find($id);

        if (! $solicitud) {
            return;
        }

        if (! $solicitud->estado->admiteAtencion()) {
            $validator->errors()->add(
                'solicitud_compra_id',
                "La solicitud {$solicitud->numero} está en estado "
                .strtolower($solicitud->estado->etiqueta()).' y no admite ingresos.'
            );
        }
    }

    /**
     * No se puede recibir más de lo pedido.
     *
     * Si el proveedor entregó de más, hay que corregir la solicitud primero.
     * Aceptarlo en silencio dejaría un ingreso sin respaldo documental.
     */
    private function verificarSaldos($validator, $lineas): void
    {
        $ingresoActual = $this->route('ingreso');

        $ids = $lineas->pluck('solicitud_compra_detalle_id')->filter()->map(fn ($i) => (int) $i);

        $detalles = SolicitudCompraDetalle::with('producto:id,nombre')
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');

        foreach ($lineas as $indice => $linea) {
            $detalle = $detalles[(int) ($linea['solicitud_compra_detalle_id'] ?? 0)] ?? null;

            if (! $detalle) {
                continue;
            }

            $saldo = $detalle->saldo();

            // Al editar un borrador, lo que ya declaraba ese mismo borrador no
            // cuenta como consumido: sigue disponible para él.
            if ($ingresoActual) {
                $yaDeclarado = $ingresoActual->detalles()
                    ->where('solicitud_compra_detalle_id', $detalle->id)
                    ->sum('cantidad');
                $saldo += (float) $yaDeclarado;
            }

            $recibido = (float) ($linea['cantidad'] ?? 0);

            if ($recibido > $saldo + 0.0001) {
                $nombre = $detalle->producto?->nombre ?? 'el producto';

                $validator->errors()->add(
                    "detalles.{$indice}.cantidad",
                    $saldo > 0
                        ? "De {$nombre} quedan {$this->formato($saldo)} pendientes en la solicitud."
                        : "De {$nombre} ya se recibió todo lo solicitado."
                );
            }
        }
    }

    private function formato(float $cantidad): string
    {
        return rtrim(rtrim(number_format($cantidad, 4, ',', '.'), '0'), ',');
    }

    public function messages(): array
    {
        return [
            'solicitud_compra_id.required' => 'Elija la solicitud de compra que se está atendiendo.',
            'solicitud_compra_id.prohibited' => 'La solicitud no se puede cambiar una vez creado el ingreso.',
            'fecha.before_or_equal'  => 'La fecha no puede ser posterior a hoy.',
            'proveedor.required'     => 'Indique quién entregó el material.',
            'tipo_documento.required'=> 'Elija el tipo de documento de respaldo.',
            'detalles.required'      => 'Agregue al menos un producto recibido.',
            'detalles.*.cantidad.gt' => 'La cantidad debe ser mayor que cero.',
            'detalles.*.costo_unitario.required' => 'Indique el precio unitario: de acá sale el costo del inventario.',
            'detalles.*.fecha_vencimiento.after' => 'La fecha de vencimiento ya pasó.',
        ];
    }

    public function attributes(): array
    {
        return [
            'solicitud_compra_id' => 'solicitud de compra',
            'tipo_documento'      => 'tipo de documento',
            'numero_documento'    => 'número de documento',
        ];
    }
}
