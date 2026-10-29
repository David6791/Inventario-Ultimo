<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Caja\Models\Caja;
use Illuminate\Validation\Rule;

/** Pago del bono de laboratorio: al productor o a la persona que viene a cobrar. */
class PagarBonoLaboratorioRequest extends CatalogoRequest
{
    protected string $permiso = 'caja.pagar-bono';

    protected function prepareForValidation(): void
    {
        $this->merge([
            'beneficiario_nombre' => mb_strtoupper(preg_replace('/\s+/u', ' ', trim((string) $this->input('beneficiario_nombre')))) ?: null,
            'beneficiario_ci'     => mb_strtoupper(preg_replace('/\s+/u', '', trim((string) $this->input('beneficiario_ci')))) ?: null,
        ]);
    }

    public function rules(): array
    {
        return [
            'caja_id'             => ['required', 'integer', Rule::exists(Caja::class, 'id')],
            'beneficiario_nombre' => ['required', 'string', 'min:3', 'max:150'],
            'beneficiario_ci'     => ['nullable', 'string', 'max:15'],
        ];
    }

    public function messages(): array
    {
        return ['beneficiario_nombre.required' => 'Indique quién cobra el bono de laboratorio.'];
    }
}
