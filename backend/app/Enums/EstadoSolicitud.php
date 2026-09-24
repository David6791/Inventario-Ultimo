<?php

namespace App\Enums;

enum EstadoSolicitud: string
{
    case Borrador        = 'borrador';
    case Aprobada        = 'aprobada';
    case Rechazada       = 'rechazada';
    case AtendidaParcial = 'atendida_parcial';
    case Atendida        = 'atendida';
    case Anulada         = 'anulada';

    public function etiqueta(): string
    {
        return match ($this) {
            self::Borrador        => 'Borrador',
            self::Aprobada        => 'Aprobada',
            self::Rechazada       => 'Rechazada',
            self::AtendidaParcial => 'Atendida en parte',
            self::Atendida        => 'Atendida',
            self::Anulada         => 'Anulada',
        };
    }

    /** Solo en borrador se puede editar el detalle. */
    public function esEditable(): bool
    {
        return $this === self::Borrador;
    }

    /** Estados desde los que se puede generar un ingreso o una salida. */
    public function admiteAtencion(): bool
    {
        return in_array($this, [self::Aprobada, self::AtendidaParcial], true);
    }

    /** Un documento cerrado no vuelve atrás. */
    public function esFinal(): bool
    {
        return in_array($this, [self::Atendida, self::Rechazada, self::Anulada], true);
    }
}
