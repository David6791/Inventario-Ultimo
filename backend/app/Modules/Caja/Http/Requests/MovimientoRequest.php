<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\Persona;
use App\Modules\Comun\Models\Banco;
use Illuminate\Validation\Rule;

/**
 * Ingreso o egreso manual. El tipo lo define el concepto; el número de
 * comprobante lo pone la base. Solo se eligen conceptos manuales y activos:
 * los de anticipos y bonos los registra el módulo de cargas con su documento.
 */
class MovimientoRequest extends FormularioCaja
{
    protected string $permiso = 'caja.registrar';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('moneda', 'forma_pago', 'persona_nombre', 'persona_ci', 'nro_documento');
        $this->colapsarEspacios('glosa');

        if ($this->input('forma_pago', 'EFECTIVO') === 'EFECTIVO') {
            $this->merge(['banco_id' => null, 'nro_documento' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'concepto_id'    => ['required', 'integer',
                                 Rule::exists(Concepto::class, 'id')->where('origen', Concepto::MANUAL)->where('activo', true)],
            'monto'          => ['required', 'numeric', 'gt:0', 'max:999999999999', 'decimal:0,2'],
            'moneda'         => ['required', Rule::in(Movimiento::MONEDAS)],
            'forma_pago'     => ['required', Rule::in(Movimiento::FORMAS_PAGO)],
            'banco_id'       => ['nullable', 'required_unless:forma_pago,EFECTIVO', 'integer',
                                 Rule::exists(Banco::class, 'id')->where('activo', true)],
            'nro_documento'  => ['nullable', 'required_unless:forma_pago,EFECTIVO', 'string', 'max:40'],
            // Una persona del registro, o nombre (y CI) de una nueva: la base la registra.
            'persona_id'     => ['nullable', 'integer', Rule::exists(Persona::class, 'id')->where('activo', true)],
            'persona_nombre' => ['required_without:persona_id', 'nullable', 'string', 'max:150'],
            'persona_ci'     => ['nullable', 'string', 'max:15'],
            'glosa'          => ['required', 'string', 'min:5', 'max:250'],
        ];
    }

    public function messages(): array
    {
        return [
            'concepto_id.exists'             => 'Elija un concepto manual y activo. Los anticipos y bonos se pagan desde cargas.',
            'monto.gt'                       => 'El monto debe ser mayor que cero.',
            'monto.decimal'                  => 'El monto lleva como máximo dos decimales.',
            'banco_id.required_unless'       => 'Indique el banco del cheque o la transferencia.',
            'nro_documento.required_unless'  => 'Indique el número del cheque o de la transferencia.',
            'persona_nombre.required_without' => 'Indique a quién se paga o quién entrega el dinero.',
            'persona_id.exists'              => 'La persona elegida no existe o está desactivada.',
            'glosa.required'                 => 'Describa el movimiento en la glosa.',
            'glosa.min'                      => 'La glosa es muy corta: describa el movimiento.',
        ];
    }

    public function attributes(): array
    {
        return ['persona_nombre' => 'persona', 'nro_documento' => 'número de documento'];
    }
}
