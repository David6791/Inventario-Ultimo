<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un activo es una INSTANCIA única. No hay campo cantidad: cinco laptops
 * iguales son cinco filas, cada una con su serie y su historia.
 *
 * La valuación NO vive acá. Está en activos.valuacion, una fila por activo,
 * período y tipo (FINANCIERA / IMPOSITIVA). Esta tabla guarda los parámetros
 * con los que se calcula, no los resultados.
 */
class Activo extends ActivoModel
{
    protected $table = 'activos.activo';

    public $timestamps = true;

    protected $fillable = [
        'codigo', 'clase_id', 'subclase_id', 'correlativo',
        'denominacion', 'descripcion', 'marca', 'modelo', 'serie',
        'chasis', 'motor', 'placa', 'anio_fabricacion',
        'bien_padre_id', 'es_bien_control',
        'tipo_origen', 'proveedor_id', 'factura_nro', 'factura_fecha',
        'orden_compra_id', 'recepcion_id', 'almacen_origen_id',
        'acta_recepcion_nro', 'acta_recepcion_fecha',
        'fecha_incorporacion', 'fecha_inicio_uso',
        'moneda', 'tipo_cambio', 'valor_origen', 'valor_residual',
        'vida_util_economica_meses', 'vida_util_fiscal_meses',
        'regimen_fiscal', 'ds5563_ddjj_presentada',
        'estado', 'condicion', 'ubicacion_id', 'custodio_id', 'centro_costo_id',
        'fecha_ocioso_desde', 'latitud', 'longitud', 'matricula_ddrr',
        'foto_path', 'observaciones', 'created_by',
    ];

    protected $casts = [
        'factura_fecha'             => 'date',
        'acta_recepcion_fecha'      => 'date',
        'fecha_incorporacion'       => 'date',
        'fecha_inicio_uso'          => 'date',
        'fecha_ocioso_desde'        => 'date',
        'fecha_baja'                => 'date',
        'es_bien_control'           => 'boolean',
        'ds5563_ddjj_presentada'    => 'boolean',
        'valor_origen'              => 'decimal:2',
        'valor_residual'            => 'decimal:2',
        'tipo_cambio'               => 'decimal:6',
        'created_at'                => 'datetime',
        'updated_at'                => 'datetime',
    ];

    public const ESTADOS = [
        'REGISTRADO', 'EN_USO', 'EN_REPARACION', 'OCIOSO',
        'EN_TRANSITO', 'FUERA_DE_INSTALACION', 'DADO_DE_BAJA',
    ];

    public const CONDICIONES = ['NUEVO', 'BUENO', 'REGULAR', 'MALO', 'INSERVIBLE'];

    public const ORIGENES = [
        'COMPRA', 'IMPORTACION', 'CONSTRUCCION', 'DONACION',
        'PERMUTA', 'APORTE', 'SOBRANTE_INVENTARIO',
    ];

    // ---------------------------------------------------------- Relaciones

    public function clase(): BelongsTo
    {
        return $this->belongsTo(Clase::class, 'clase_id');
    }

    public function subclase(): BelongsTo
    {
        return $this->belongsTo(Subclase::class, 'subclase_id');
    }

    public function ubicacion(): BelongsTo
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id');
    }

    public function bienPadre(): BelongsTo
    {
        return $this->belongsTo(self::class, 'bien_padre_id');
    }

    public function componentes(): HasMany
    {
        return $this->hasMany(self::class, 'bien_padre_id');
    }

    public function costos(): HasMany
    {
        return $this->hasMany(ActivoCosto::class, 'activo_id');
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class, 'activo_id')->orderByDesc('fecha');
    }

    // ------------------------------------------------------------- Scopes

    public function scopeVigentes($query)
    {
        return $query->where('estado', '<>', 'DADO_DE_BAJA');
    }

    public function scopeCapitalizables($query)
    {
        return $query->where('es_bien_control', false);
    }

    /**
     * PUNTO DE EXTENSIÓN — filtrado por ámbito.
     *
     * Cuando se defina si las ubicaciones de activos coinciden con los
     * almacenes o son una dimensión propia, el filtro por los ámbitos del
     * usuario va acá, y el controlador lo aplica salvo que tenga el permiso
     * de ver todas las ubicaciones.
     */
    public function scopeDelAmbitoDe($query, $usuario)
    {
        return $query;
    }

    // -------------------------------------------------------- Comodidades

    public function getDepreciaAttribute(): bool
    {
        return $this->regimen_fiscal !== 'NO_DEPRECIA'
            && $this->vida_util_fiscal_meses !== null;
    }

    /** Un bien en uso siempre tiene custodio: lo garantiza ck_activo_uso_custodio. */
    public function getEstaAsignadoAttribute(): bool
    {
        return $this->custodio_id !== null;
    }

    /** El QR solo lleva el código: lo demás se consulta al escanearlo. */
    public function getContenidoQrAttribute(): string
    {
        return $this->codigo;
    }
}
