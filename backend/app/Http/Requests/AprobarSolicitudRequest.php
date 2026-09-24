<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * La aprobación ocurre en papel. El sistema solo registra que la solicitud
 * volvió firmada y guarda el escaneo.
 */
class AprobarSolicitudRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'aprobada'         => ['required', 'boolean'],
            'fecha_aprobacion' => ['required', 'date', 'before_or_equal:today'],
            'observacion'      => ['nullable', 'string', 'max:300'],

            // Obligatorio al aprobar: sin el respaldo escaneado, la aprobación
            // en el sistema no prueba nada ante una auditoría. Al rechazar es
            // opcional, porque puede no haber papel que adjuntar.
            'documento' => [
                $this->boolean('aprobada') ? 'required' : 'nullable',
                'file', 'mimes:pdf', 'max:10240',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'documento.required' => 'Adjunte el documento firmado en PDF.',
            'documento.mimes'    => 'El documento debe ser un archivo PDF.',
            'documento.max'      => 'El documento no puede superar los 10 MB.',
            'fecha_aprobacion.before_or_equal' => 'La fecha no puede ser posterior a hoy.',
        ];
    }
}
