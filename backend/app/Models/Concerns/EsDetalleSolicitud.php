<?php

namespace App\Models\Concerns;

use App\Models\Producto;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait EsDetalleSolicitud
{
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /** Lo que falta despachar o recibir contra esta línea. */
    public function saldo(): float
    {
        return max(0, (float) $this->cantidad - (float) $this->cantidad_atendida);
    }
}
