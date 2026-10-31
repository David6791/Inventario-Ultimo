<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\SerieLote;
use App\Modules\Cargas\Models\TipoBono;
use Illuminate\Validation\Rule;

/** Alta o cambio de un bono del catálogo. */
class TipoBonoRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.configurar-bono';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo');
        $this->colapsarEspacios('nombre', 'descripcion');
        if (is_string($this->input('codigo'))) {
            $this->merge(['codigo' => preg_replace('/[^A-Z0-9_]+/', '_', $this->input('codigo'))]);
        }
    }

    public function rules(): array
    {
        $tipo = $this->route('tipo');

        return [
            'codigo'       => ['required', 'string', 'regex:/^[A-Z0-9_]{2,20}$/',
                               Rule::unique(TipoBono::class, 'codigo')->ignore($tipo?->id)],
            'nombre'       => ['required', 'string', 'min:3', 'max:80'],
            'descripcion'  => ['nullable', 'string', 'max:250'],
            'calculo'      => ['required', Rule::in(TipoBono::CALCULOS)],
            'naturaleza'   => ['required', Rule::in(['ANTICIPO', 'PREMIO'])],
            'cobra'        => ['required', Rule::in(['PRODUCTOR', 'CHOFER'])],
            'permite_otro' => ['required', 'boolean'],
            'aplica_a'     => ['required', Rule::in(['TODOS', 'COMPRA', 'PROPIA'])],
            'serie_id'     => ['nullable', 'integer', Rule::exists(SerieLote::class, 'id')],
            'activo'       => ['sometimes', 'boolean'],
            'orden'        => ['sometimes', 'integer', 'min:0', 'max:999'],
        ];
    }

    public function messages(): array
    {
        return [
            'codigo.regex'  => 'El código va en mayúsculas, números o «_», de 2 a 20 caracteres (ej. CARGUIO).',
            'codigo.unique' => 'Ya hay un bono con ese código.',
        ];
    }
}
