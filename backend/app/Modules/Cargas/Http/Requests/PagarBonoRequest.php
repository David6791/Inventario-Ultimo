<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Caja\Models\Caja;
use Illuminate\Validation\Rule;

/** Pago de un bono desde una caja abierta: a quien indica el catálogo o, si lo permite, a otra persona. */
class PagarBonoRequest extends CatalogoRequest
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
            'beneficiario_nombre' => ['nullable', 'string', 'min:3', 'max:150'],
            'beneficiario_ci'     => ['nullable', 'string', 'max:15'],
        ];
    }
}
