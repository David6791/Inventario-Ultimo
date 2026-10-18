<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Models\SerieLote;
use App\Modules\Cargas\Services\SerieLoteService;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Alta y edición de una serie de lotes. Además de las reglas de cada campo,
 * valida el formato contra la base (mismas reglas que al numerar) y avisa si
 * el próximo código ya existe: pasa cuando se vuelve a un formato usado antes.
 */
class SerieLoteRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.series';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('prefijo', 'origen', 'reinicio');
        $this->colapsarEspacios('nombre');
        if (is_string($this->input('formato'))) {
            $this->merge(['formato' => trim($this->input('formato'))]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('serie')?->id;

        return [
            'prefijo'           => ['required', 'string', 'max:10', 'regex:/^[A-Z0-9]+(-[A-Z0-9]+)*$/',
                                    Rule::unique(SerieLote::class, 'prefijo')->ignore($id)],
            'nombre'            => ['required', 'string', 'max:100'],
            'linea_producto_id' => ['required', 'integer', Rule::exists(LineaProducto::class, 'id')],
            'origen'            => ['required', Rule::in(SerieLote::ORIGENES)],
            'formato'           => ['required', 'string', 'max:60'],
            'reinicio'          => ['required', Rule::in(SerieLote::REINICIOS)],
            'activa'            => ['boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var SerieLote|null $serie */
                $serie = $this->route('serie');

                if ($serie?->tieneLotes()) {
                    foreach (['prefijo', 'linea_producto_id', 'origen'] as $campo) {
                        if ((string) $this->input($campo) !== (string) $serie->{$campo}) {
                            $validator->errors()->add($campo,
                                'La serie ya tiene lotes: el prefijo, la línea y el origen no se cambian. Cree una serie nueva si necesita otros.');
                        }
                    }
                    if ($validator->errors()->isNotEmpty()) {
                        return;
                    }
                }

                $previa = app(SerieLoteService::class)->vistaPrevia(
                    $this->only(['prefijo', 'linea_producto_id', 'origen', 'formato', 'reinicio']),
                    $serie
                );

                if ($previa['error'] !== null) {
                    $validator->errors()->add('formato', $previa['error']);
                } elseif ($previa['repetido']) {
                    $validator->errors()->add('formato',
                        "Con este formato el próximo código sería {$previa['codigo']}, que ya existe. Use un formato distinto.");
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'prefijo.regex'  => 'El prefijo va en mayúsculas y números, separados por guiones (por ejemplo CZP o EC-ZN).',
            'prefijo.unique' => 'Ya existe una serie con ese prefijo.',
        ];
    }
}
