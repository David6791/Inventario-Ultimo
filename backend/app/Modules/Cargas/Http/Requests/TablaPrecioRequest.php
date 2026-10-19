<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\LineaProducto;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Borrador de tabla de precios. La modalidad la decide la línea (por punto o
 * por porcentaje); los concentrados se valoran en la liquidación, no aquí.
 */
class TablaPrecioRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.precios-editar';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('descripcion');
        $this->merge(['tramos' => collect((array) $this->input('tramos', []))
            ->map(fn ($t) => ['ley_hasta' => null, 'precio_punto' => null, 'porcentaje_pagable' => null,
                              ...array_map(fn ($v) => $v === '' ? null : $v, (array) $t)])
            ->sortBy(fn ($t) => (float) ($t['ley_desde'] ?? 0))->values()->all()]);
    }

    private function modalidad(): ?string
    {
        return LineaProducto::whereKey($this->input('linea_producto_id'))->value('modalidad_precio');
    }

    public function rules(): array
    {
        $m = $this->modalidad();

        return [
            'linea_producto_id'           => ['required', 'integer', Rule::exists(LineaProducto::class, 'id')],
            'elemento_id'                 => ['required', 'integer', Rule::exists(Elemento::class, 'id')],
            'moneda'                      => ['required', Rule::in(['BOB', 'USD'])],
            'factor_conversion'           => [$m === 'POR_PORCENTAJE' ? 'required' : 'nullable', 'numeric', 'gt:0', 'decimal:0,6'],
            'descripcion'                 => ['nullable', 'string', 'max:200'],
            'vigente_desde'               => ['required', 'date'],
            'tramos'                      => ['required', 'array', 'min:1', 'max:60'],
            'tramos.*.ley_desde'          => ['required', 'numeric', 'min:0', 'decimal:0,4'],
            'tramos.*.ley_hasta'          => ['nullable', 'numeric', 'decimal:0,4'],
            'tramos.*.precio_punto'       => [$m === 'POR_PUNTO' ? 'required' : 'nullable', 'numeric', 'gt:0', 'decimal:0,4'],
            'tramos.*.porcentaje_pagable' => [$m === 'POR_PORCENTAJE' ? 'required' : 'nullable', 'numeric', 'gt:0', 'max:100', 'decimal:0,3'],
        ];
    }

    public function messages(): array
    {
        return [
            'factor_conversion.required'           => 'Una tabla por porcentaje necesita el factor de conversión a la unidad de la cotización.',
            'tramos.required'                      => 'Cargue al menos un tramo.',
            'tramos.*.precio_punto.required'       => 'Cada tramo lleva su precio por punto.',
            'tramos.*.porcentaje_pagable.required' => 'Cada tramo lleva su porcentaje pagable.',
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            if (! in_array($this->modalidad(), ['POR_PUNTO', 'POR_PORCENTAJE'], true)) {
                $v->errors()->add('linea_producto_id', 'Los concentrados se valoran en la liquidación: su línea no lleva tabla de precios.');
                return;
            }
            $pagable = DB::table('cargas.linea_producto_elemento')->where('linea_producto_id', $this->input('linea_producto_id'))
                ->where('elemento_id', $this->input('elemento_id'))->where('rol', 'PAGABLE')->exists();
            if (! $pagable) {
                $v->errors()->add('elemento_id', 'El elemento no es pagable en esa línea.');
            }
            $tramos = $this->input('tramos');
            foreach ($tramos as $i => $t) {
                if ($t['ley_hasta'] !== null && (float) $t['ley_hasta'] <= (float) $t['ley_desde']) {
                    $v->errors()->add("tramos.{$i}.ley_hasta", 'Cada tramo termina en una ley mayor a la que empieza.');
                }
                if ($i > 0 && $tramos[$i - 1]['ley_hasta'] === null) {
                    $v->errors()->add("tramos.{$i}.ley_desde", 'Solo el último tramo puede quedar sin «hasta».');
                }
            }
        }];
    }
}
