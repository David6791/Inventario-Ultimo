<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Validation\Rule;

/** Datos para previsualizar un formato mientras se edita. No guarda nada. */
class VistaPreviaSerieRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.series';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('prefijo', 'origen', 'reinicio');
    }

    public function rules(): array
    {
        return [
            'serie_id'          => ['nullable', 'integer', Rule::exists(SerieLote::class, 'id')],
            'prefijo'           => ['nullable', 'string', 'max:10'],
            'linea_producto_id' => ['nullable', 'integer'],
            'origen'            => ['nullable', Rule::in(SerieLote::ORIGENES)],
            'formato'           => ['nullable', 'string', 'max:60'],
            'reinicio'          => ['required', Rule::in(SerieLote::REINICIOS)],
            'fecha'             => ['nullable', 'date'],
        ];
    }
}
