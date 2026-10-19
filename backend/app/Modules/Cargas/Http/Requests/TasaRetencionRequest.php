<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\RetencionConcepto;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Tasa nueva de una retención: reemplaza a la vigente desde la fecha indicada. */
class TasaRetencionRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.retenciones';

    public function rules(): array
    {
        return [
            'concepto_id'    => ['required', 'integer', Rule::exists(RetencionConcepto::class, 'id')],
            'cooperativa_id' => ['nullable', 'integer', Rule::exists(Cooperativa::class, 'id')],
            'porcentaje'     => ['required', 'numeric', 'between:0,100', 'decimal:0,4'],
            'vigente_desde'  => ['required', 'date'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            $c = RetencionConcepto::find($this->input('concepto_id'));
            if ($c && $c->por_cooperativa && ! $this->filled('cooperativa_id')) {
                $v->errors()->add('cooperativa_id', "La retención {$c->nombre} se define por cooperativa: elija la cooperativa.");
            }
            if ($c && ! $c->por_cooperativa && $this->filled('cooperativa_id')) {
                $v->errors()->add('cooperativa_id', "La retención {$c->nombre} tiene una tasa general: no lleva cooperativa.");
            }
        }];
    }
}
