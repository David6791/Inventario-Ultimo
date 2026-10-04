<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentoDetalle extends ActivoModel
{
    protected $table = 'activos.documento_detalle';

    protected $fillable = [
        'documento_id', 'activo_id', 'estado_verificado',
        'condicion_verificada', 'valor_libros_a_fecha', 'observacion',
    ];

    protected $casts = ['valor_libros_a_fecha' => 'decimal:2'];

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'documento_id');
    }

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }
}
