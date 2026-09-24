<?php

namespace App\Http\Requests;

class SolicitudMaterialRequest extends SolicitudBaseRequest
{
    protected function reglasPropias(): array
    {
        return [
            'centro_costo' => ['nullable', 'string', 'max:60'],
            'destino'      => ['nullable', 'string', 'max:200'],
        ];
    }

    public function attributes(): array
    {
        return array_merge(parent::attributes(), [
            'centro_costo' => 'centro de costo',
        ]);
    }
}
