<?php

namespace App\Modules\Cargas\Http\Requests;

class ContadorSerieRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.series';

    public function rules(): array
    {
        return ['ultimo_numero' => ['required', 'integer', 'min:0', 'max:999999999']];
    }

    public function messages(): array
    {
        return ['ultimo_numero.required' => 'Indique el último número que se usó en esta serie.'];
    }
}
