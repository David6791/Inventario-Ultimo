<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Muestra;
use App\Modules\Cargas\Models\MuestraPorcion;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Muestra del lote con sus tres porciones precintadas: empresa, productor y testigo. */
class RegistrarMuestraRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.muestrear';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('observaciones');
        $porciones = collect((array) $this->input('porciones', []))->map(function ($p) {
            $p = (array) $p;
            foreach (['precinto' => '', 'entregada_a' => ' '] as $c => $sep) {
                if (isset($p[$c]) && is_string($p[$c])) {
                    $p[$c] = mb_strtoupper(preg_replace('/\s+/u', $sep, trim($p[$c]))) ?: null;
                }
            }
            return $p;
        })->all();
        $this->merge(['porciones' => $porciones, 'metodo' => $this->input('metodo') ? mb_strtoupper($this->input('metodo')) : null]);
    }

    public function rules(): array
    {
        return [
            'metodo'                  => ['nullable', Rule::in(Muestra::METODOS)],
            'peso_g'                  => ['nullable', 'numeric', 'gt:0', 'max:99999999', 'decimal:0,2'],
            'observaciones'           => ['nullable', 'string', 'max:250'],
            'porciones'               => ['required', 'array', 'size:3'],
            'porciones.*.destino'     => ['required', 'distinct', Rule::in(MuestraPorcion::DESTINOS)],
            'porciones.*.precinto'    => ['required', 'string', 'max:30', 'distinct'],
            'porciones.*.entregada_a' => ['nullable', 'string', 'max:150'],
        ];
    }

    public function messages(): array
    {
        return [
            'porciones.size'                => 'Registre las tres porciones: empresa, productor y testigo.',
            'porciones.*.precinto.required' => 'Cada porción lleva su número de precinto.',
            'porciones.*.precinto.distinct' => 'Dos porciones no pueden tener el mismo precinto.',
            'porciones.*.destino.distinct'  => 'Cada porción va a un destino distinto.',
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            $usados = \Illuminate\Support\Facades\DB::table('cargas.muestra_porcion')
                ->whereIn('precinto', collect($this->input('porciones', []))->pluck('precinto')->filter())
                ->pluck('precinto');
            foreach ($usados as $p) {
                $v->errors()->add('porciones', "El precinto {$p} ya se usó en otra muestra.");
            }
        }];
    }
}
