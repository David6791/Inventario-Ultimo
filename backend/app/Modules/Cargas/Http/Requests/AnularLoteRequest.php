<?php

namespace App\Modules\Cargas\Http\Requests;

class AnularLoteRequest extends AnularConMotivoRequest
{
    protected string $permiso = 'cargas.anular-lote';
}
