<?php

namespace App\Enums;

/** Estados de los documentos que mueven existencias. */
enum EstadoDocumento: string
{
    case Borrador   = 'borrador';
    case Confirmada = 'confirmada';
    case Anulada    = 'anulada';

    public function etiqueta(): string
    {
        return match ($this) {
            self::Borrador   => 'Borrador',
            self::Confirmada => 'Confirmada',
            self::Anulada    => 'Anulada',
        };
    }

    /** Solo un borrador se edita o se elimina. */
    public function esEditable(): bool
    {
        return $this === self::Borrador;
    }

    /** ¿Ya afectó las existencias? */
    public function afectaExistencias(): bool
    {
        return $this === self::Confirmada;
    }
}
