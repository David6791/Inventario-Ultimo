<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\TipoBono;
use Illuminate\Validation\Rule;

/** Bono de monto manual agregado a un lote desde su ficha. */
class AgregarBonoRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.recibir';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('observacion');
        $this->merge([
            'beneficiario_nombre' => mb_strtoupper(preg_replace('/\s+/u', ' ', trim((string) $this->input('beneficiario_nombre')))) ?: null,
            'beneficiario_ci'     => mb_strtoupper(preg_replace('/\s+/u', '', trim((string) $this->input('beneficiario_ci')))) ?: null,
        ]);
    }

    public function rules(): array
    {
        return [
            'tipo_bono_id'        => ['required', 'integer', Rule::exists(TipoBono::class, 'id')
                                         ->where('calculo', 'MANUAL')->where('activo', true)],
            'monto'               => ['required', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            'moneda'              => ['nullable', 'in:BOB,USD'],
            'beneficiario_nombre' => ['nullable', 'string', 'min:3', 'max:150'],
            'beneficiario_ci'     => ['nullable', 'string', 'max:15'],
            'observacion'         => ['nullable', 'string', 'max:250'],
        ];
    }

    public function messages(): array
    {
        return ['tipo_bono_id.exists' => 'Elija un bono de monto manual activo del catálogo.'];
    }
}
