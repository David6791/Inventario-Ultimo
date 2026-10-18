<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Cargas\Models\Municipio;
use Closure;
use Illuminate\Validation\Rule;

class MinaRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('nombre');

        // Una mina propia de la empresa no pertenece a una cooperativa.
        if ($this->boolean('propia')) {
            $this->merge(['cooperativa_id' => null]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('mina')?->id;

        return [
            'nombre' => ['required', 'string', 'max:150', function (string $campo, mixed $valor, Closure $falla) use ($id) {
                $coop = $this->input('cooperativa_id') ? (int) $this->input('cooperativa_id') : null;
                $otra = Mina::conNombre((string) $valor, $coop)->when($id, fn ($q) => $q->whereKeyNot($id))->first();
                if ($otra) {
                    $falla($coop
                        ? "Esa cooperativa ya tiene la mina «{$otra->nombre}»."
                        : "Ya existe la mina «{$otra->nombre}» sin cooperativa.");
                }
            }],
            'propia'         => ['required', 'boolean'],
            'cooperativa_id' => ['nullable', 'integer', Rule::exists(Cooperativa::class, 'id')],
            'municipio_id'   => ['nullable', 'integer', Rule::exists(Municipio::class, 'id')],
            'activa'         => ['boolean'],
        ];
    }
}
