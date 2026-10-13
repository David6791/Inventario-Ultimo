<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fotografías de los activos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ UNA TABLA Y NO UNA COLUMNA
 *
 * La columna `foto_path` del activo alcanzaba para identificar el bien, pero
 * una sola foto se pisa a sí misma: cuando alguien documenta un golpe nuevo,
 * borra la imagen del alta y con ella la evidencia de cómo estaba antes.
 *
 * Eso importa en tres momentos:
 *
 *   · En la toma física, cuando se encuentra un bien deteriorado y hay que
 *     dejar constancia de en qué estado apareció.
 *   · Al reclamar a un custodio: la comparación entre la foto de entrega y
 *     la de devolución es la prueba.
 *   · En la baja por deterioro, que exige respaldo documental.
 *
 * La columna `foto_path` se conserva: guarda la ruta de la principal, para
 * que los listados no tengan que consultar esta tabla en cada fila.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS activos.foto (
                id            bigserial PRIMARY KEY,
                activo_id     bigint       NOT NULL REFERENCES activos.activo(id) ON DELETE CASCADE,

                path          varchar(300) NOT NULL,
                path_miniatura varchar(300),

                -- Qué documenta la foto. El tipo es lo que permite buscar
                -- «cómo estaba al entregarse» sin revisar todas.
                tipo          varchar(20)  NOT NULL DEFAULT 'IDENTIFICACION',

                descripcion   varchar(250),

                -- La que se muestra en listados y en la consulta por QR.
                es_principal  boolean      NOT NULL DEFAULT false,

                -- Referencia al documento o toma que originó la foto, si la hay.
                documento_id  bigint REFERENCES activos.documento(id),

                tamanio_bytes integer,
                ancho         integer,
                alto          integer,

                subido_por    bigint       NOT NULL,
                created_at    timestamptz  NOT NULL DEFAULT now(),

                CONSTRAINT ck_foto_tipo CHECK (tipo IN (
                    'IDENTIFICACION',   -- qué es el bien
                    'ESTADO',           -- cómo está en un momento dado
                    'SERIE',            -- placa o número de serie legible
                    'ENTREGA',          -- al asignarlo a un custodio
                    'DEVOLUCION',       -- al recibirlo de vuelta
                    'TOMA_FISICA',      -- hallazgo en inventario
                    'BAJA'              -- respaldo de la disposición
                ))
            )
        ");

        DB::statement('CREATE INDEX IF NOT EXISTS ix_foto_activo ON activos.foto (activo_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS ix_foto_tipo ON activos.foto (activo_id, tipo)');

        // Una sola principal por activo. La base lo garantiza en vez de
        // confiar en que el servicio lo recuerde.
        DB::statement("
            CREATE UNIQUE INDEX IF NOT EXISTS uq_foto_principal
            ON activos.foto (activo_id) WHERE es_principal = true
        ");

        DB::statement("
            COMMENT ON TABLE activos.foto IS
            'Fotografías del bien. Varias por activo: la del alta no se pierde cuando se documenta un deterioro posterior.'
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS activos.foto CASCADE');
    }
};
