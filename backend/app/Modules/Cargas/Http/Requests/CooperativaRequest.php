<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Municipio;
use Closure;
use Illuminate\Validation\Rule;

class CooperativaRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('nombre');
        $this->mayusculas('sigla', 'nit', 'nim');
    }

    public function rules(): array
    {
        $id = $this->route('cooperativa')?->id;

        return [
            'nombre' => ['required', 'string', 'max:150', function (string $campo, mixed $valor, Closure $falla) use ($id) {
                // Igual que el índice de la base: «Cerro Rico  R.L.» choca con «CERRO RICO R.L.».
                $otra = Cooperativa::conNombre((string) $valor)->when($id, fn ($q) => $q->whereKeyNot($id))->first();
                if ($otra) {
                    $falla("Ya existe la cooperativa «{$otra->nombre}».");
                }
            }],
            'sigla'        => ['nullable', 'string', 'max:30'],
            'nit'          => ['nullable', 'string', 'max:20', Rule::unique(Cooperativa::class, 'nit')->ignore($id)],
            'nim'          => ['nullable', 'string', 'max:30', Rule::unique(Cooperativa::class, 'nim')->ignore($id)],
            'municipio_id' => ['nullable', 'integer', Rule::exists(Municipio::class, 'id')],
            'activa'       => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nit.unique' => 'Ya hay una cooperativa registrada con ese NIT.',
            'nim.unique' => 'Ya hay una cooperativa registrada con ese NIM.',
        ];
    }
}
