<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Base de los formularios de catálogos de cargas: escribir exige cargas.catalogos. */
abstract class CatalogoRequest extends FormRequest
{
    protected string $permiso = 'cargas.catalogos';

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

    /** Colapsa espacios repetidos en los campos indicados. */
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
