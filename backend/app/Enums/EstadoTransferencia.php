<?php

namespace App\Enums;

enum EstadoTransferencia: string
{
    case Borrador   = 'borrador';
    case Despachada = 'despachada';
    case Recibida   = 'recibida';
    case Anulada    = 'anulada';

    public function etiqueta(): string
    {
        return match ($this) {
            self::Borrador   => 'Borrador',
            self::Despachada => 'En tránsito',
            self::Recibida   => 'Recibida',
            self::Anulada    => 'Anulada',
        };
    }

    public function esEditable(): bool
    {
        return $this === self::Borrador;
    }

    /** El material ya salió del origen pero no llegó al destino. */
    public function enTransito(): bool
    {
        return $this === self::Despachada;
    }

    public function esFinal(): bool
    {
        return in_array($this, [self::Recibida, self::Anulada], true);
    }
}
