<?php

namespace App\Modules\Cargas\Http\Requests;

/** Reabrir un lote ANALIZADO (para corregir una ley o remuestrear): con motivo. */
class ReabrirLoteRequest extends AnularConMotivoRequest
{
    protected string $permiso = 'cargas.fijar-ley';

    public function messages(): array
    {
        return [
            'motivo.required' => 'Indique por qué se reabre el lote.',
            'motivo.min'      => 'Explique el motivo con al menos 10 caracteres.',
        ];
    }
}
