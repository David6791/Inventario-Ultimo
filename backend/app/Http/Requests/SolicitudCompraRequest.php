<?php

namespace App\Http\Requests;

class SolicitudCompraRequest extends SolicitudBaseRequest
{
    protected function reglasPropias(): array
    {
        return [
            // Pueden no conocerse al armar el borrador, pero el área contable
            // los va a exigir antes de aprobar.
            'partida_presupuestaria' => ['nullable', 'string', 'max:20'],
            'monto_estimado'         => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function attributes(): array
    {
        return array_merge(parent::attributes(), [
            'partida_presupuestaria' => 'partida presupuestaria',
            'monto_estimado'         => 'monto estimado',
        ]);
    }
}
