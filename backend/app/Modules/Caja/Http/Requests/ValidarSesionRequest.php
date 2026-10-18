<?php

namespace App\Modules\Caja\Http\Requests;

/** Validar el cierre de otro cajero. Quien cerró no puede validar (lo exige la base). */
class ValidarSesionRequest extends FormularioCaja
{
    protected string $permiso = 'caja.validar';

    public function rules(): array
    {
        return [];
    }
}
