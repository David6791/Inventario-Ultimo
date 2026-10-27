<?php

namespace App\Modules\Cargas\Models;

/**
 * Dónde está cada dato en el ticket impreso de una balanza. Los recuadros van
 * en fracciones (0–1) del ticket enderezado a la proporción de la plantilla.
 */
class PlantillaBascula extends CargasModel
{
    protected $table = 'cargas.plantilla_bascula';

    /** Datos que se pueden leer de un ticket. */
    public const CAMPOS = [
        'ticket'        => ['etiqueta' => 'N.º de ticket', 'tipo' => 'digitos'],
        'peso_bruto_kg' => ['etiqueta' => 'Peso bruto',    'tipo' => 'numero'],
        'tara_kg'       => ['etiqueta' => 'Tara',          'tipo' => 'numero'],
        'peso_neto_kg'  => ['etiqueta' => 'Peso neto',     'tipo' => 'numero'],
        'placa'         => ['etiqueta' => 'Placa',         'tipo' => 'texto'],
        'fecha'         => ['etiqueta' => 'Fecha',         'tipo' => 'texto'],
    ];

    public const USOS = ['INTERIOR', 'EXTERIOR', 'AMBAS'];

    protected $fillable = ['nombre', 'bascula', 'uso', 'proporcion', 'campos', 'imagen_muestra', 'activa', 'registrado_por'];

    protected $hidden = ['imagen_muestra'];

    protected $appends = ['tiene_muestra'];

    protected $casts = [
        'proporcion'     => 'float',
        'campos'         => 'array',
        'activa'         => 'boolean',
        'registrado_por' => 'integer',
    ];

    public function getTieneMuestraAttribute(): bool
    {
        return $this->imagen_muestra !== null;
    }
}
