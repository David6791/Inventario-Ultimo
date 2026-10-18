<?php

namespace App\Modules\Caja\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Base de los formularios de caja: cada uno declara el permiso que exige. */
abstract class FormularioCaja extends FormRequest
{
    protected string $permiso = 'caja.administrar';

    public function authorize(): bool
    {
        return $this->user()?->can($this->permiso) ?? false;
    }

    /** Mayúsculas y sin espacios sobrantes en los campos indicados. */
    protected function mayusculas(string ...$campos): void
    {
        $limpios = [];
        foreach ($campos as $campo) {
            $valor = $this->input($campo);
            if (is_string($valor)) {
                $valor = mb_strtoupper(preg_replace('/\s+/u', ' ', trim($valor)));
                $limpios[$campo] = $valor === '' ? null : $valor;
            }
        }
        $this->merge($limpios);
    }

    /** Colapsa espacios repetidos; un texto vacío queda en null. */
    protected function colapsarEspacios(string ...$campos): void
    {
        $limpios = [];
        foreach ($campos as $campo) {
            $valor = $this->input($campo);
            if (is_string($valor)) {
                $valor = preg_replace('/\s+/u', ' ', trim($valor));
                $limpios[$campo] = $valor === '' ? null : $valor;
            }
        }
        $this->merge($limpios);
    }
}
