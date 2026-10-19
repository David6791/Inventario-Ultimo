<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Cotizacion;
use App\Modules\Cargas\Models\Elemento;
use Illuminate\Validation\Rule;

/** Cotización quincenal: elemento, tipo, año, mes, quincena, valor y unidad; alícuotas de regalía si es oficial. */
class CotizacionRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.cotizaciones';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('fuente');
    }

    public function rules(): array
    {
        $id = $this->route('cotizacion')?->id;

        return [
            'elemento_id'               => ['required', 'integer', Rule::exists(Elemento::class, 'id')],
            'tipo'                      => ['required', Rule::in(Cotizacion::TIPOS)],
            'anio'                      => ['required', 'integer', 'between:2000,2100'],
            'mes'                       => ['required', 'integer', 'between:1,12'],
            'quincena'                  => ['required', 'integer', Rule::in([1, 2]),
                                            Rule::unique(Cotizacion::class)->ignore($id)->where(fn ($q) => $q
                                                ->where('elemento_id', $this->input('elemento_id'))->where('tipo', $this->input('tipo'))
                                                ->where('anio', $this->input('anio'))->where('mes', $this->input('mes')))],
            'valor'                     => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'unidad'                    => ['required', Rule::in(Cotizacion::UNIDADES)],
            'alicuota_rm_exportacion'   => ['nullable', 'numeric', 'between:0,100', 'decimal:0,4'],
            'alicuota_rm_venta_interna' => ['nullable', 'numeric', 'between:0,100', 'decimal:0,4'],
            'fuente'                    => ['nullable', 'string', 'max:150'],
            'fecha_publicacion'         => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return ['quincena.unique' => 'Ya hay una cotización de ese elemento y tipo para esa quincena.'];
    }
}
