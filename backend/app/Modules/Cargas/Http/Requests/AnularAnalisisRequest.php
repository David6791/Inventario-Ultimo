<?php

namespace App\Modules\Cargas\Http\Requests;

class AnularAnalisisRequest extends AnularConMotivoRequest
{
    protected string $permiso = 'cargas.cargar-analisis';
}
