<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Caja\Models\Caja;
use Illuminate\Validation\Rule;

/** Pago de un bono de transporte desde una caja abierta. */
class PagarBonoRequest extends CatalogoRequest
{
    protected string $permiso = 'caja.pagar-bono';

    public function rules(): array
    {
        return ['caja_id' => ['required', 'integer', Rule::exists(Caja::class, 'id')]];
    }
}
