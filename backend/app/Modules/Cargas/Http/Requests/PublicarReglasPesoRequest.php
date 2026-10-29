<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Validation\Validator;

/** Nuevo juego de reglas del peso que vale, vigente desde una fecha. La base prueba cada fórmula. */
class PublicarReglasPesoRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.catalogos';

    public function rules(): array
    {
        return [
            'vigente_desde'         => ['required', 'date', 'after_or_equal:today'],
            'reglas'                => ['required', 'array', 'min:1', 'max:20'],
            'reglas.*.unidad'       => ['required', 'in:KG,PCT'],
            'reglas.*.desde'        => ['nullable', 'numeric', 'between:-9999999,9999999'],
            'reglas.*.hasta'        => ['nullable', 'numeric', 'between:-9999999,9999999'],
            'reglas.*.formula'      => ['required', 'string', 'max:200'],
            'reglas.*.descripcion'  => ['nullable', 'string', 'max:150'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            foreach ((array) $this->input('reglas') as $i => $r) {
                $d = $r['desde'] ?? null; $h = $r['hasta'] ?? null;
                if (is_numeric($d) && is_numeric($h) && (float) $h <= (float) $d) {
                    $v->errors()->add("reglas.{$i}.hasta", 'En la regla ' . ($i + 1) . ', «hasta» debe ser mayor que «desde».');
                }
            }
        }];
    }

    public function messages(): array
    {
        return ['vigente_desde.after_or_equal' => 'Las reglas rigen desde hoy o una fecha futura: los pesajes ya registrados no cambian.'];
    }
}
