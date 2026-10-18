<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * Serie de numeración de lotes. El código lo arma la base con el formato y
 * el reinicio de la serie (ver comun.validar_formato para los marcadores).
 */
class SerieLote extends CargasModel
{
    protected $table = 'cargas.serie_lote';

    protected $fillable = ['prefijo', 'nombre', 'linea_producto_id', 'origen', 'formato', 'reinicio', 'activa'];

    protected $casts = [
        'activa'            => 'boolean',
        'linea_producto_id' => 'integer',
    ];

    public const ORIGENES  = ['COMPRA', 'PROPIA'];
    public const REINICIOS = ['NUNCA', 'ANUAL', 'MENSUAL', 'DIARIO'];
    public const MARCADORES = [
        '{PREFIJO}' => 'Prefijo de la serie',
        '{LINEA}'   => 'Código de la línea de producto',
        '{ORIGEN}'  => 'C = compra, P = producción propia',
        '{SIGLA}'   => 'Sigla de la empresa',
        '{AAAA}'    => 'Año (2026)',
        '{AA}'      => 'Año corto (26)',
        '{MM}'      => 'Mes (01 a 12)',
        '{DD}'      => 'Día (01 a 31)',
        '{N:4}'     => 'Correlativo con 4 dígitos (cambie el 4)',
    ];

    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaProducto::class, 'linea_producto_id');
    }

    public function tieneLotes(): bool
    {
        return $this->exists && DB::table('cargas.lote')->where('serie_id', $this->id)->exists();
    }

    public function cantidadLotes(): int
    {
        return $this->exists ? DB::table('cargas.lote')->where('serie_id', $this->id)->count() : 0;
    }

    /** Próximo código según el formato guardado (no consume números). */
    public function proximoCodigo(?string $fecha = null): ?string
    {
        if (! $this->exists) {
            return null;
        }

        return DB::selectOne(
            'select cargas.vista_previa_codigo_lote(?, ?::date) as codigo',
            [$this->id, $fecha ?? now()->toDateString()]
        )->codigo;
    }
}
