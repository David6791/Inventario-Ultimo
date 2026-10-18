<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Analisis;
use Illuminate\Validation\Rule;

/**
 * Análisis de laboratorio con sus resultados por elemento y, si ya se tiene,
 * el certificado escaneado (PDF o imagen). Puede llegar como multipart: los
 * resultados entonces vienen como JSON en un solo campo.
 */
class RegistrarAnalisisRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.cargar-analisis';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('numero_certificado');
        $r = $this->input('resultados');
        if (is_string($r)) {
            $this->merge(['resultados' => json_decode($r, true) ?: []]);
        }
        // Celdas vacías del formulario: no son resultados.
        $this->merge(['resultados' => collect((array) $this->input('resultados', []))
            ->filter(fn ($x) => isset($x['valor']) && $x['valor'] !== '' && $x['valor'] !== null)->values()->all()]);
    }

    public function rules(): array
    {
        return [
            'tipo'                     => ['required', Rule::in(Analisis::TIPOS)],
            'laboratorio_id'           => ['required', 'integer', Rule::exists(\App\Modules\Cargas\Models\Laboratorio::class, 'id')->where('activo', true)],
            'numero_certificado'       => ['required', 'string', 'max:30'],
            'fecha_emision'            => ['nullable', 'date', 'before_or_equal:today'],
            'resultados'               => ['required', 'array', 'min:1'],
            'resultados.*.elemento_id' => ['required', 'integer', 'distinct', Rule::exists(\App\Modules\Cargas\Models\Elemento::class, 'id')],
            'resultados.*.valor'       => ['required', 'numeric', 'min:0', 'max:99999999', 'decimal:0,4'],
            'certificado'              => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'laboratorio_id.exists'       => 'Elija un laboratorio activo.',
            'numero_certificado.required' => 'Indique el número del certificado del laboratorio.',
            'resultados.required'         => 'Cargue al menos un resultado.',
            'resultados.min'              => 'Cargue al menos un resultado.',
            'certificado.mimes'           => 'El certificado debe ser PDF, JPG o PNG.',
            'certificado.max'             => 'El certificado no puede pasar de 10 MB.',
            'fecha_emision.before_or_equal' => 'La fecha del certificado no puede ser futura.',
        ];
    }

    public function datos(): array
    {
        return collect($this->validated())->except('certificado')->all();
    }
}
