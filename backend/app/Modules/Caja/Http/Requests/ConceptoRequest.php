<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Concepto;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Conceptos manuales de ingreso y egreso. Los que genera otro módulo (por
 * ejemplo el pago de anticipos) se ven en la lista, pero aquí no se crean ni
 * se editan: ese módulo los busca por su código.
 */
class ConceptoRequest extends FormularioCaja
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo', 'tipo');
        $this->colapsarEspacios('nombre');
        if (is_string($this->input('codigo'))) {
            $this->merge(['codigo' => str_replace([' ', '-'], '_', $this->input('codigo'))]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('concepto')?->id;

        return [
            'codigo' => ['required', 'string', 'max:40', 'regex:/^[A-Z0-9_]+$/',
                         Rule::unique(Concepto::class, 'codigo')->ignore($id)],
            'nombre' => ['required', 'string', 'max:120'],
            'tipo'   => ['required', Rule::in(Concepto::TIPOS)],
            'activo' => ['boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                /** @var Concepto|null $concepto */
                $concepto = $this->route('concepto');
                if (! $concepto) {
                    return;
                }

                if (! $concepto->esManual()) {
                    $validator->errors()->add('codigo',
                        "El concepto «{$concepto->nombre}» lo genera el módulo {$concepto->origen}: no se edita desde caja.");

                    return;
                }

                if ($this->input('tipo') !== $concepto->tipo && $concepto->tieneMovimientos()) {
                    $validator->errors()->add('tipo',
                        "El concepto ya tiene movimientos como {$concepto->tipo}: no se cambia. Cree otro concepto.");
                }
            },
        ];
    }

    /** El origen no viene del formulario: todo concepto creado aquí es manual. */
    public function datos(): array
    {
        return [...$this->validated(), 'origen' => Concepto::MANUAL];
    }

    public function messages(): array
    {
        return [
            'codigo.regex'  => 'El código va en mayúsculas, sin espacios (letras, números y guion bajo), por ejemplo PAGO_SERVICIOS.',
            'codigo.unique' => 'Ya existe un concepto con ese código.',
        ];
    }
}
