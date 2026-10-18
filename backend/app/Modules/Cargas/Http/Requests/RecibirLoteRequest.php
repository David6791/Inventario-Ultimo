<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Models\Almacen;
use App\Modules\Cargas\Models\Bocamina;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Recepción de un lote, con su primer pesaje si el camión ya pasó por la
 * báscula. La serie decide el origen: de compra exige productor; de
 * producción propia exige mina propia y bocamina, sin productor.
 */
class RecibirLoteRequest extends PesajeRequest
{
    protected string $prefijo = 'pesaje.';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('guia_transporte');
        $this->colapsarEspacios('observaciones');
        if (! array_filter((array) $this->input('pesaje', []), fn ($v) => $v !== null && $v !== '')) {
            $this->merge(['pesaje' => null]);
        } else {
            $this->limpiarPesaje('pesaje.');
        }
    }

    public function rules(): array
    {
        return [
            'serie_id'        => ['required', 'integer', Rule::exists(SerieLote::class, 'id')->where('activa', true)],
            'almacen_id'      => ['required', 'integer', Rule::exists(Almacen::class, 'id')->where('activo', true)],
            'productor_id'    => ['nullable', 'integer', Rule::exists(Productor::class, 'id')->where('activo', true)],
            'mina_id'         => ['nullable', 'integer', Rule::exists(Mina::class, 'id')->where('activa', true)],
            'bocamina_id'     => ['nullable', 'integer', Rule::exists(Bocamina::class, 'id')->where('activa', true)],
            'guia_transporte' => ['nullable', 'string', 'max:40'],
            'material'        => ['nullable', \Illuminate\Validation\Rule::in(\App\Modules\Cargas\Models\Lote::MATERIALES)],
            'observaciones'   => ['nullable', 'string', 'max:1000'],
            'pesaje'          => ['nullable', 'array'],
            ...self::reglas('pesaje.', false),
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            if (! $this->user()->can('cargas.ver-todos-almacenes') && ! $this->user()->accedeAlmacen((int) $this->input('almacen_id'))) {
                $v->errors()->add('almacen_id', 'Su usuario no tiene acceso a esa sede.');
            }

            $serie = SerieLote::find($this->integer('serie_id'));
            if ($serie->origen === 'COMPRA') {
                if (! $this->filled('productor_id')) {
                    $v->errors()->add('productor_id', 'Elija el productor que entrega el mineral.');
                }
                if ($this->filled('bocamina_id')) {
                    $v->errors()->add('bocamina_id', 'La bocamina es solo para producción propia.');
                }
            } else {
                if ($this->filled('productor_id')) {
                    $v->errors()->add('productor_id', 'La producción propia no lleva productor.');
                }
                if (! $this->filled('mina_id') || ! $this->filled('bocamina_id')) {
                    $v->errors()->add('bocamina_id', 'Indique la mina propia y la bocamina de donde sale el mineral.');
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'serie_id.exists'     => 'Elija una serie de lotes activa.',
            'productor_id.exists' => 'El productor no existe o está inactivo.',
            ...self::mensajes('pesaje.'),
        ];
    }

    /** Solo los datos del lote. */
    public function datosLote(): array
    {
        return collect($this->validated())->except('pesaje')->all();
    }

    public function datosPesaje(): ?array
    {
        $p = $this->validated()['pesaje'] ?? null;

        return $p ? array_filter($p, fn ($v) => $v !== null) + ['tipo' => 'INGRESO'] : null;
    }
}
