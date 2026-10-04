<?php

namespace App\Modules\Activos\Http\Requests;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Documento;
use App\Modules\Activos\Models\Ubicacion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DocumentoRequest extends FormRequest
{
    /** Cada tipo exige su propio permiso: emitir no es autorizar. */
    private const PERMISOS = [
        'ASIGNACION'      => 'activos-custodia.asignar',
        'TRASPASO'        => 'activos-custodia.traspasar',
        'SALIDA_TEMPORAL' => 'activos-custodia.salida',
        'DEVOLUCION'      => 'activos-custodia.asignar',
    ];

    public function authorize(): bool
    {
        $permiso = self::PERMISOS[$this->input('tipo')] ?? null;

        return $permiso !== null && ($this->user()?->can($permiso) ?? false);
    }

    public function rules(): array
    {
        return [
            'tipo'   => ['required', Rule::in(['ASIGNACION', 'TRASPASO', 'SALIDA_TEMPORAL', 'DEVOLUCION'])],
            'fecha'  => ['nullable', 'date', 'before_or_equal:today'],
            'motivo' => ['nullable', 'string', 'max:500'],
            'observaciones' => ['nullable', 'string'],

            'activos'   => ['required', 'array', 'min:1', 'max:200'],
            'activos.*' => ['integer', Rule::exists(Activo::class, 'id')],

            'custodio_destino_id' => [
                'required_if:tipo,ASIGNACION', 'nullable', 'integer',
            ],
            'ubicacion_destino_id' => [
                'nullable', 'integer', Rule::exists(Ubicacion::class, 'id'),
            ],
            'centro_costo_destino_id' => ['nullable', 'integer'],

            'destino_externo' => ['required_if:tipo,SALIDA_TEMPORAL', 'nullable', 'string', 'max:250'],
            'fecha_retorno_comprometida' => [
                'required_if:tipo,SALIDA_TEMPORAL', 'nullable', 'date', 'after:today',
            ],

            'autorizador_id' => ['nullable', 'integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'custodio_destino_id.required_if' =>
                'La asignación requiere un custodio: sin responsable identificado no hay custodia.',
            'fecha_retorno_comprometida.required_if' =>
                'La salida temporal requiere fecha de retorno comprometida.',
            'fecha_retorno_comprometida.after' =>
                'La fecha de retorno debe ser futura: sin plazo no hay control.',
            'destino_externo.required_if' =>
                'Indique a dónde va el bien.',
            'activos.max' =>
                'Un documento admite hasta 200 activos. Divida la operación.',
        ];
    }
}
