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
        $this->merge(['tipo_recepcion' => $this->input('tipo_recepcion') ?: 'BASCULA']);
        $sacos = $this->input('sacos');
        if (is_array($sacos)) {
            foreach (['bascula' => ' ', 'placa' => '', 'chofer_ci' => '', 'chofer_nombre' => ' '] as $c => $sep) {
                if (isset($sacos[$c]) && is_string($sacos[$c])) {
                    $sacos[$c] = mb_strtoupper(preg_replace('/\s+/u', $sep, trim($sacos[$c]))) ?: null;
                }
            }
            $sacos['bascula'] ??= 'BALANZA MANUAL';
            $this->merge(['sacos' => $sacos]);
        }
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
            'tipo_recepcion'  => ['required', Rule::in(\App\Modules\Cargas\Models\Lote::TIPOS_RECEPCION)],
            'pesaje'          => ['nullable', 'array', 'required_if:tipo_recepcion,MIXTA', 'prohibited_if:tipo_recepcion,SACOS'],
            ...self::reglas('pesaje.', false),
            'sacos'                   => ['nullable', 'array', 'required_if:tipo_recepcion,SACOS,MIXTA', 'prohibited_if:tipo_recepcion,BASCULA'],
            'sacos.bascula'           => ['required_with:sacos', 'string', 'max:40'],
            'sacos.placa'             => ['nullable', 'string', 'max:15'],
            'sacos.chofer_nombre'     => ['nullable', 'string', 'max:150'],
            'sacos.chofer_ci'         => ['nullable', 'string', 'max:15'],
            'sacos.pesadas'           => ['required_with:sacos', 'array', 'min:1', 'max:500'],
            'sacos.pesadas.*.sacos'   => ['required', 'integer', 'min:1', 'max:10000'],
            'sacos.pesadas.*.peso_kg' => ['required', 'numeric', 'gt:0', 'max:999999', 'decimal:0,2'],
            'sacos.pesadas.*.foto_id' => ['required', 'integer', 'distinct', self::fotoSuelta('BALANZA_MANUAL')],
            'lote_sacos'              => ['nullable', 'array', 'prohibited_unless:tipo_recepcion,MIXTA'],
            'lote_sacos.material'     => ['nullable', Rule::in(\App\Modules\Cargas\Models\Lote::MATERIALES)],
            'lote_sacos.observaciones' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            if (! app(\App\Modules\Cargas\Services\SedeRecepcionService::class)->puedeRecibirEn($this->user(), (int) $this->input('almacen_id'))) {
                $v->errors()->add('almacen_id', 'Su usuario no recibe carga en esa sede: la sede tiene sus propios recepcionistas o no tiene acceso a ella.');
            }

            if ($this->input('tipo_recepcion') === 'MIXTA') {
                $p = (array) $this->input('pesaje');
                $neto = (float) ($p['peso_bruto_kg'] ?? 0) - (float) ($p['tara_kg'] ?? 0);
                $kgSacos = array_sum(array_map(fn ($x) => (float) ($x['peso_kg'] ?? 0), (array) $this->input('sacos.pesadas')));
                if ($kgSacos >= $neto) {
                    $v->errors()->add('sacos.pesadas', sprintf('Los sacos (%s kg) deben pesar menos que el neto del ticket (%s kg): la diferencia es el granel.',
                        number_format($kgSacos, 2, ',', '.'), number_format($neto, 2, ',', '.')));
                }
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
            'pesaje.required_if'  => 'La recepción mixta necesita el pesaje del camión en la báscula.',
            'sacos.required_if'   => 'Registre las pesadas de los sacos en la balanza manual.',
            'sacos.pesadas.min'   => 'Registre al menos una pesada de sacos.',
            'sacos.pesadas.*.foto_id.required' => 'Cada pesada en la balanza manual necesita su foto.',
            'sacos.pesadas.*.foto_id.exists'   => 'Una foto de la balanza manual no es válida o ya está en otro pesaje: tómela de nuevo.',
            'sacos.pesadas.*.foto_id.distinct' => 'Cada pesada lleva su propia foto.',
            ...self::mensajes('pesaje.'),
        ];
    }

    /** Solo los datos del lote. */
    public function datosLote(): array
    {
        return collect($this->validated())->except(['pesaje', 'sacos', 'lote_sacos', 'tipo_recepcion'])->all();
    }

    public function tipoRecepcion(): string
    {
        return $this->validated()['tipo_recepcion'];
    }

    public function datosSacos(): ?array
    {
        return $this->validated()['sacos'] ?? null;
    }

    public function datosLoteSacos(): ?array
    {
        return $this->validated()['lote_sacos'] ?? null;
    }

    public function datosPesaje(): ?array
    {
        $p = $this->validated()['pesaje'] ?? null;

        return $p ? array_filter($p, fn ($v) => $v !== null) + ['tipo' => 'INGRESO'] : null;
    }
}
