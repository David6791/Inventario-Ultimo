<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\Persona;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Nueva solicitud de dinero. Quien tiene caja.solicitar pide a su nombre; el
 * cajero de la caja (caja.registrar) puede registrarla a nombre de una persona
 * del registro.
 */
class SolicitudRequest extends FormularioCaja
{
    public function authorize(): bool
    {
        $usuario = $this->user();

        return $usuario !== null && ($usuario->can('caja.solicitar') || $usuario->can('caja.registrar'));
    }

    protected function prepareForValidation(): void
    {
        $this->mayusculas('moneda', 'persona_nombre', 'persona_ci');
        $this->colapsarEspacios('glosa');
    }

    public function rules(): array
    {
        return [
            'caja_id'        => ['required', 'integer',
                                 Rule::exists(Caja::class, 'id')->where('activa', true)->where('requiere_aprobacion', true)],
            'concepto_id'    => ['required', 'integer',
                                 Rule::exists(Concepto::class, 'id')->where('origen', Concepto::MANUAL)->where('tipo', 'EGRESO')->where('activo', true)],
            'monto'          => ['required', 'numeric', 'gt:0', 'max:999999999999', 'decimal:0,2'],
            'moneda'         => ['required', Rule::in(Movimiento::MONEDAS)],
            'glosa'          => ['required', 'string', 'min:5', 'max:200'],
            'persona_id'     => ['nullable', 'integer', Rule::exists(Persona::class, 'id')->where('activo', true)],
            'persona_nombre' => ['nullable', 'string', 'max:150'],
            'persona_ci'     => ['nullable', 'string', 'max:15'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }
                $caja = Caja::find($this->integer('caja_id'));
                $usuario = $this->user();
                $aNombreDe = $this->filled('persona_id') || $this->filled('persona_nombre');

                if ($aNombreDe && ! ($usuario->can('caja.registrar') && $caja->esCajero($usuario))) {
                    $validator->errors()->add('persona_nombre',
                        "Solo un cajero de la caja {$caja->codigo} registra solicitudes a nombre de otra persona.");
                }
                if (! $aNombreDe && ! $usuario->can('caja.solicitar')) {
                    $validator->errors()->add('persona_nombre', 'Indique a nombre de quién es la solicitud.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'caja_id.exists'     => 'Elija una caja activa que trabaje con aprobación.',
            'concepto_id.exists' => 'Elija un concepto de egreso manual y activo.',
            'monto.gt'           => 'El monto debe ser mayor que cero.',
            'monto.decimal'      => 'El monto lleva como máximo dos decimales.',
            'glosa.required'     => 'Explique para qué es el dinero.',
            'glosa.min'          => 'Explique para qué es el dinero con un poco más de detalle.',
            'persona_id.exists'  => 'La persona elegida no existe o está desactivada.',
        ];
    }
}
