<?php

namespace App\Enums;

enum MotivoDevolucion: string
{
    case SOBRANTE              = 'sobrante';
    case NO_CORRESPONDIA       = 'no_correspondia';
    case DEFECTUOSO            = 'defectuoso';
    case CAMBIO_REQUERIMIENTO  = 'cambio_requerimiento';
    case OTRO                  = 'otro';

    public function etiqueta(): string
    {
        return match ($this) {
            self::SOBRANTE             => 'Sobrante no utilizado',
            self::NO_CORRESPONDIA      => 'No correspondia a lo solicitado',
            self::DEFECTUOSO           => 'Bien defectuoso o danado',
            self::CAMBIO_REQUERIMIENTO => 'Cambio en el requerimiento',
            self::OTRO                 => 'Otro motivo',
        };
    }

    /** Un bien defectuoso vuelve al almacen pero no deberia reingresar al stock util. */
    public function reingresaAlStock(): bool
    {
        return $this !== self::DEFECTUOSO;
    }
}
