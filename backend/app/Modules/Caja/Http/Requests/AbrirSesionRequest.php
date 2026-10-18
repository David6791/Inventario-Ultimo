<?php

namespace App\Modules\Caja\Http\Requests;

/**
 * Apertura de la sesión del día. El saldo inicial solo se digita la primera
 * vez (o la primera vez en dólares); después la base lo toma de lo contado en
 * el cierre anterior.
 */
class AbrirSesionRequest extends FormularioCaja
{
    protected string $permiso = 'caja.abrir';

    public function rules(): array
    {
        return [
            'saldo_inicial'     => ['nullable', 'array'],
            'saldo_inicial.BOB' => ['nullable', 'numeric', 'min:0', 'max:999999999999', 'decimal:0,2'],
            'saldo_inicial.USD' => ['nullable', 'numeric', 'min:0', 'max:999999999999', 'decimal:0,2'],
        ];
    }

    public function messages(): array
    {
        return [
            'saldo_inicial.*.min'     => 'El saldo inicial no puede ser negativo.',
            'saldo_inicial.*.decimal' => 'El saldo inicial lleva como máximo dos decimales.',
        ];
    }
}
