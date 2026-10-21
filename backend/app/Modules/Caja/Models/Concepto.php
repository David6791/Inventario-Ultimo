<?php

namespace App\Modules\Caja\Models;

/**
 * Concepto de ingreso o egreso. Los de origen MANUAL los elige el cajero; los
 * demás (CARGAS_ANTICIPO, CARGAS_BONO…) solo los usa el módulo que los creó,
 * vinculados a su documento.
 */
class Concepto extends CajaModel
{
    protected $table = 'caja.concepto';

    protected $fillable = ['codigo', 'nombre', 'tipo', 'origen', 'activo', 'exento_aprobacion'];

    protected $casts = ['activo' => 'boolean', 'exento_aprobacion' => 'boolean'];

    public const TIPOS = ['INGRESO', 'EGRESO'];
    public const MANUAL = 'MANUAL';

    public function esManual(): bool
    {
        return $this->origen === self::MANUAL;
    }

    public function tieneMovimientos(): bool
    {
        return $this->exists && Movimiento::where('concepto_id', $this->id)->exists();
    }
}
