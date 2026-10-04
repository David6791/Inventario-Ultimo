<?php

namespace App\Modules\Activos\Http\Requests;

use App\Modules\Activos\Models\Activo;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ActivoRequest extends FormRequest
{
    public function authorize(): bool
    {
        $permiso = $this->isMethod('POST') ? 'activos.crear' : 'activos.editar';

        return $this->user()?->can($permiso) ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('activo')?->id;

        return [
            'clase_id'    => ['required', 'integer', Rule::exists(\App\Modules\Activos\Models\Clase::class, 'id')],
            'subclase_id' => ['required', 'integer', Rule::exists(\App\Modules\Activos\Models\Subclase::class, 'id')],

            'denominacion' => ['required', 'string', 'max:200'],
            'descripcion'  => ['nullable', 'string'],
            'marca'        => ['nullable', 'string', 'max:80'],
            'modelo'       => ['nullable', 'string', 'max:80'],
            'serie'        => [
                'nullable', 'string', 'max:120',
                Rule::unique('activos.activo', 'serie')->ignore($id),
            ],
            'chasis'           => ['nullable', 'string', 'max:120'],
            'motor'            => ['nullable', 'string', 'max:120'],
            'placa'            => ['nullable', 'string', 'max:30'],
            'anio_fabricacion' => ['nullable', 'integer', 'min:1900', 'max:' . (date('Y') + 1)],

            'bien_padre_id' => ['nullable', 'integer', Rule::exists(\App\Modules\Activos\Models\Activo::class, 'id')],
            'es_bien_control' => ['boolean'],

            'tipo_origen'          => ['required', Rule::in(Activo::ORIGENES)],
            'proveedor_id'         => ['nullable', 'integer'],
            'factura_nro'          => ['nullable', 'string', 'max:40'],
            'factura_fecha'        => ['nullable', 'date'],
            'acta_recepcion_nro'   => ['required_if:tipo_origen,COMPRA,IMPORTACION', 'nullable', 'string', 'max:30'],
            'acta_recepcion_fecha' => ['required_with:acta_recepcion_nro', 'nullable', 'date'],

            'fecha_incorporacion' => ['required', 'date', 'before_or_equal:today'],
            'fecha_inicio_uso'    => ['nullable', 'date', 'after_or_equal:fecha_incorporacion'],

            'moneda'         => ['required', 'string', 'size:3'],
            'tipo_cambio'    => ['required', 'numeric', 'min:0.000001'],
            'valor_residual' => ['nullable', 'numeric', 'min:0'],

            'vida_util_economica_meses' => ['nullable', 'integer', 'min:1', 'max:1200'],
            'vida_util_fiscal_meses'    => ['nullable', 'integer', 'min:1', 'max:1200'],
            'regimen_fiscal'            => ['nullable', Rule::in(['REGULAR','ACELERADO_DS5563','SECTORIAL','NO_DEPRECIA'])],

            'condicion'       => ['required', Rule::in(Activo::CONDICIONES)],
            'ubicacion_id'  => ['required', 'integer', Rule::exists(\App\Modules\Activos\Models\Ubicacion::class, 'id')],
            'centro_costo_id' => ['nullable', 'integer'],

            'latitud'        => ['nullable', 'numeric', 'between:-90,90'],
            'longitud'       => ['nullable', 'numeric', 'between:-180,180'],
            'matricula_ddrr' => ['nullable', 'string', 'max:60'],
            'observaciones'  => ['nullable', 'string'],

            // Desglose del costo
            'costos'               => ['required', 'array', 'min:1'],
            'costos.*.concepto'    => ['required', Rule::in(\App\Modules\Activos\Models\ActivoCosto::CONCEPTOS)],
            'costos.*.monto'       => ['required', 'numeric', 'min:0'],
            'costos.*.documento'   => ['nullable', 'string', 'max:60'],
            'costos.*.observacion' => ['nullable', 'string', 'max:250'],
            'serie'         => ['nullable', 'string', 'max:120', Rule::unique(\App\Modules\Activos\Models\Activo::class, 'serie')->ignore($id)],
        ];
    }

    public function messages(): array
    {
        return [
            'serie.unique' => 'Ya existe un activo registrado con ese número de serie.',
            'acta_recepcion_nro.required_if' =>
                'Una compra requiere el número de acta de recepción: sin recepción conforme no hay alta.',
            'fecha_inicio_uso.after_or_equal' =>
                'El bien no puede entrar en uso antes de haber sido recibido.',
            'fecha_incorporacion.before_or_equal' =>
                'La fecha de incorporación no puede ser futura.',
            'costos.required' => 'Falta el desglose del costo de incorporación.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'moneda'      => $this->input('moneda', 'BOB'),
            'tipo_cambio' => $this->input('tipo_cambio', 1),
            'condicion'   => $this->input('condicion', 'NUEVO'),
            'tipo_origen' => $this->input('tipo_origen', 'COMPRA'),
        ]);
    }
}
