<?php

namespace App\Modules\Cargas\Http\Requests;

class AnularPesajeRequest extends AnularConMotivoRequest
{
    protected string $permiso = 'cargas.recibir';
}
