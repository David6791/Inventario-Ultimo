<?php

namespace App\Modules\Caja\Http\Requests;

use Illuminate\Validation\Validator;

/**
 * Cierre de la sesión: por moneda, el arqueo por corte o el total contado.
 * Que lo contado coincida con lo esperado (o que se explique la diferencia)
 * lo verifica la base.
 */
class CerrarSesionRequest extends FormularioCaja
{
    protected string $permiso = 'caja.cerrar';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('observaciones');
    }

    public function rules(): array
    {
        return [
            'monedas'                          => ['required', 'array'],
            'monedas.*.contado'                => ['nullable', 'numeric', 'min:0', 'decimal:0,2'],
            'monedas.*.arqueo'                 => ['nullable', 'array'],
            'monedas.*.arqueo.*.denominacion'  => ['required', 'numeric', 'gt:0'],
            'monedas.*.arqueo.*.cantidad'      => ['required', 'integer', 'min:0', 'max:1000000'],
            'observaciones'                    => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                // Cada moneda con que trabaja la sesión tiene que contarse.
                $monedas = $this->route('sesion')?->saldos()->pluck('moneda')->all() ?? array_keys((array) $this->input('monedas', []));
                foreach ($monedas as $moneda) {
                    $datos = (array) $this->input("monedas.{$moneda}", []);
                    $hayArqueo = collect($datos['arqueo'] ?? [])->sum(fn ($c) => (int) ($c['cantidad'] ?? 0)) > 0;
                    if (! $hayArqueo && ! is_numeric($datos['contado'] ?? null)) {
                        $validator->errors()->add("monedas.{$moneda}.contado",
                            "Cuente el efectivo en {$moneda}: llene el arqueo o el total contado (cero si no hay).");
                    }
                }
            },
        ];
    }
}
