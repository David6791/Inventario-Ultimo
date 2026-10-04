<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Documento de custodia: asignación, traspaso, salida temporal, devolución y baja.
 *
 * Reutiliza la misma máquina de estados que los documentos del sistema de
 * almacenes: BORRADOR → CONFIRMADO → ANULADO. Un documento en borrador no
 * tiene efecto sobre el activo; al confirmarlo se aplica y se escribe en la
 * bitácora; al anularlo se revierte, nunca se borra.
 */
class Documento extends ActivoModel
{
    protected $table = 'activos.documento';

    public $timestamps = false;

    protected $fillable = [
        'tipo', 'numero', 'gestion', 'fecha', 'estado', 'motivo', 'observaciones',
        'custodio_origen_id', 'custodio_destino_id',
        'ubicacion_origen_id', 'ubicacion_destino_id', 'centro_costo_destino_id',
        'destino_externo', 'fecha_retorno_comprometida', 'fecha_retorno_real',
        'causal', 'informe_comision', 'valor_disposicion', 'factura_venta_nro',
        'resultado_disposicion',
        'solicitante_id', 'autorizador_id', 'fecha_autorizacion',
        'created_by', 'created_at', 'confirmado_por', 'confirmado_at',
        'anulado_por', 'anulado_at', 'motivo_anulacion',
    ];

    protected $casts = [
        'fecha'                      => 'date',
        'fecha_retorno_comprometida' => 'date',
        'fecha_retorno_real'         => 'date',
        'fecha_autorizacion'         => 'date',
        'created_at'                 => 'datetime',
        'confirmado_at'              => 'datetime',
        'anulado_at'                 => 'datetime',
        'valor_disposicion'          => 'decimal:2',
        'resultado_disposicion'      => 'decimal:2',
    ];

    public const TIPOS = ['ASIGNACION', 'TRASPASO', 'SALIDA_TEMPORAL', 'DEVOLUCION', 'BAJA'];

    public const BORRADOR   = 'BORRADOR';
    public const CONFIRMADO = 'CONFIRMADO';
    public const ANULADO    = 'ANULADO';

    public function detalles(): HasMany
    {
        return $this->hasMany(DocumentoDetalle::class, 'documento_id');
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class, 'documento_id');
    }

    public function scopeConfirmados($query)
    {
        return $query->where('estado', self::CONFIRMADO);
    }

    public function scopeDelTipo($query, string $tipo)
    {
        return $query->where('tipo', $tipo);
    }

    /** Salidas temporales confirmadas cuyo plazo venció sin retorno. */
    public function scopeRetornoVencido($query)
    {
        return $query->where('tipo', 'SALIDA_TEMPORAL')
            ->where('estado', self::CONFIRMADO)
            ->whereNull('fecha_retorno_real')
            ->whereDate('fecha_retorno_comprometida', '<', now());
    }

    public function esBorrador(): bool   { return $this->estado === self::BORRADOR; }
    public function estaConfirmado(): bool { return $this->estado === self::CONFIRMADO; }

    /** Solo se anula lo confirmado: un borrador se descarta sin ceremonia. */
    public function puedeAnularse(): bool
    {
        return $this->estaConfirmado();
    }

    public function getVencidoAttribute(): bool
    {
        return $this->tipo === 'SALIDA_TEMPORAL'
            && $this->estaConfirmado()
            && $this->fecha_retorno_real === null
            && $this->fecha_retorno_comprometida?->isPast();
    }
}
