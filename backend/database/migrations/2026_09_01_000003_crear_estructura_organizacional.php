<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Estructura organizacional y personal.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EL MODELO
 *
 *   Área (PORCO, POTOSI, UNIFICADA)
 *    └─ Centro de costo (ACOPIO_PORCO, ADM_POTOSI…)
 *        ├─ Almacén          ← reutiliza el del sistema de almacenes
 *        ├─ Personal         ← quienes reciben bienes en custodia
 *        └─ Ubicaciones      ← dónde están físicamente los bienes
 *            └─ Activos
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EMPLEADO NO ES USUARIO
 *
 * Un operario de acopio recibe herramientas y responde por ellas, pero no
 * tiene cuenta en el sistema. Un almacenero es las dos cosas. Si el custodio
 * tuviera que ser un usuario, la mayor parte del personal no podría recibir
 * bienes.
 *
 * Por eso `empleado` es la entidad de custodia y `user_id` es un vínculo
 * OPCIONAL hacia quienes además acceden al sistema.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EL ÁMBITO SALE DE LA CADENA QUE YA EXISTE
 *
 * Cada centro de costo tiene su almacén, y el sistema ya asigna almacenes a
 * los usuarios. Entonces: usuario → sus almacenes → centros de esos almacenes
 * → activos de esos centros. No hace falta un pivote nuevo.
 */
return new class extends Migration
{
    private const TABLA_ALMACENES = 'almacenes';

    public function up(): void
    {
        $this->areas();
        $this->centrosCosto();
        $this->empleados();
        $this->vincularUbicaciones();
        $this->migrarCustodios();
    }

    private function areas(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS activos.area (
                id          bigserial PRIMARY KEY,
                codigo      varchar(30)  NOT NULL UNIQUE,
                nombre      varchar(120) NOT NULL,
                activo      boolean      NOT NULL DEFAULT true,
                created_at  timestamptz  NOT NULL DEFAULT now(),
                updated_at  timestamptz
            )
        ");

        DB::statement("
            COMMENT ON TABLE activos.area IS
            'Área operativa: PORCO, POTOSI, UNIFICADA. Agrupa centros de costo.'
        ");
    }

    private function centrosCosto(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS activos.centro_costo (
                id          bigserial PRIMARY KEY,
                area_id     bigint       NOT NULL REFERENCES activos.area(id),
                codigo      varchar(40)  NOT NULL UNIQUE,
                nombre      varchar(150) NOT NULL,
                almacen_id  bigint,
                responsable_id bigint,
                activo      boolean      NOT NULL DEFAULT true,
                created_at  timestamptz  NOT NULL DEFAULT now(),
                updated_at  timestamptz
            )
        ");

        DB::statement("
            COMMENT ON COLUMN activos.centro_costo.almacen_id IS
            'Almacén del centro. De acá sale el ámbito: un usuario ve los activos de los centros cuyos almacenes tiene asignados.'
        ");

        DB::statement('CREATE INDEX IF NOT EXISTS ix_centro_area ON activos.centro_costo (area_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS ix_centro_almacen ON activos.centro_costo (almacen_id)');

        if (Schema::hasTable(self::TABLA_ALMACENES)) {
            $t = self::TABLA_ALMACENES;
            DB::statement("
                ALTER TABLE activos.centro_costo
                ADD CONSTRAINT fk_centro_almacen FOREIGN KEY (almacen_id)
                REFERENCES public.{$t}(id)
            ");
        }
    }

    private function empleados(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS activos.empleado (
                id                bigserial PRIMARY KEY,
                codigo            varchar(30)  NOT NULL UNIQUE,

                nombres           varchar(120) NOT NULL,
                apellido_paterno  varchar(80),
                apellido_materno  varchar(80),

                ci                varchar(25)  NOT NULL,
                expedido          varchar(10),
                tipo_documento    varchar(30),

                cargo             varchar(120),
                profesion         varchar(120),
                centro_costo_id   bigint       NOT NULL REFERENCES activos.centro_costo(id),

                fecha_ingreso     date,
                fecha_baja        date,

                telefono          varchar(30),
                movil             varchar(30),
                email             varchar(150),
                direccion         varchar(250),

                -- Vínculo OPCIONAL con la cuenta del sistema. La mayoría del
                -- personal no tiene: recibe bienes pero no entra al sistema.
                user_id           bigint UNIQUE,

                activo            boolean      NOT NULL DEFAULT true,
                observaciones     text,
                created_at        timestamptz  NOT NULL DEFAULT now(),
                updated_at        timestamptz,

                CONSTRAINT ck_empleado_baja CHECK (
                    (activo = true AND fecha_baja IS NULL)
                    OR (activo = false)
                )
            )
        ");

        DB::statement("
            COMMENT ON COLUMN activos.empleado.user_id IS
            'Cuenta del sistema, si la tiene. Un almacenero es empleado Y usuario; un operario solo empleado.'
        ");

        DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS uq_empleado_ci ON activos.empleado (upper(ci))");
        DB::statement('CREATE INDEX IF NOT EXISTS ix_empleado_centro ON activos.empleado (centro_costo_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS ix_empleado_activo ON activos.empleado (activo)');

        if (Schema::hasTable('users')) {
            DB::statement("
                ALTER TABLE activos.empleado
                ADD CONSTRAINT fk_empleado_user FOREIGN KEY (user_id)
                REFERENCES public.users(id) ON DELETE SET NULL
            ");
        }
    }

    /**
     * La ubicación pertenece a un centro de costo, no directamente a un
     * almacén: el centro ya tiene el suyo y así la cadena queda en un solo
     * lugar.
     */
    private function vincularUbicaciones(): void
    {
        DB::statement('ALTER TABLE activos.ubicacion ADD COLUMN IF NOT EXISTS centro_costo_id bigint');

        DB::statement("
            ALTER TABLE activos.ubicacion
            ADD CONSTRAINT fk_ubicacion_centro FOREIGN KEY (centro_costo_id)
            REFERENCES activos.centro_costo(id)
        ");

        DB::statement('CREATE INDEX IF NOT EXISTS ix_ubicacion_centro ON activos.ubicacion (centro_costo_id)');

        DB::statement("
            COMMENT ON COLUMN activos.ubicacion.centro_costo_id IS
            'Centro al que pertenece. Obligatorio en ubicaciones raíz; las hijas lo heredan.'
        ");
    }

    /**
     * El custodio pasa a ser un empleado.
     *
     * Antes apuntaba a `users`, lo que dejaba fuera a todo el personal sin
     * cuenta en el sistema — que es la mayoría de quienes efectivamente
     * reciben bienes.
     */
        private function migrarCustodios(): void
    {
        DB::statement("
            UPDATE activos.documento
            SET estado = 'ANULADO',
                motivo_anulacion = 'Anulado por migración: el custodio pasó de usuario a empleado',
                anulado_por = COALESCE(confirmado_por, created_by),
                anulado_at = now()
            WHERE estado = 'CONFIRMADO'
        ");

        DB::statement("
            UPDATE activos.activo
            SET custodio_id = NULL,
                estado = CASE WHEN estado = 'EN_USO' THEN 'REGISTRADO' ELSE estado END
            WHERE custodio_id IS NOT NULL
        ");

        DB::statement('UPDATE activos.documento SET custodio_origen_id = NULL, custodio_destino_id = NULL');

        DB::statement("
            ALTER TABLE activos.activo
            ADD CONSTRAINT fk_activo_custodio FOREIGN KEY (custodio_id)
            REFERENCES activos.empleado(id)
        ");

        DB::statement("
            ALTER TABLE activos.documento
            ADD CONSTRAINT fk_doc_custodio_origen FOREIGN KEY (custodio_origen_id)
            REFERENCES activos.empleado(id),
            ADD CONSTRAINT fk_doc_custodio_destino FOREIGN KEY (custodio_destino_id)
            REFERENCES activos.empleado(id)
        ");

        DB::statement("
            ALTER TABLE activos.activo
            ADD CONSTRAINT fk_activo_centro FOREIGN KEY (centro_costo_id)
            REFERENCES activos.centro_costo(id)
        ");
    }

    public function down(): void
    {
        foreach ([
            'ALTER TABLE activos.activo DROP CONSTRAINT IF EXISTS fk_activo_custodio',
            'ALTER TABLE activos.activo DROP CONSTRAINT IF EXISTS fk_activo_centro',
            'ALTER TABLE activos.documento DROP CONSTRAINT IF EXISTS fk_doc_custodio_origen',
            'ALTER TABLE activos.documento DROP CONSTRAINT IF EXISTS fk_doc_custodio_destino',
            'ALTER TABLE activos.ubicacion DROP CONSTRAINT IF EXISTS fk_ubicacion_centro',
            'ALTER TABLE activos.ubicacion DROP COLUMN IF EXISTS centro_costo_id',
            'DROP TABLE IF EXISTS activos.empleado CASCADE',
            'DROP TABLE IF EXISTS activos.centro_costo CASCADE',
            'DROP TABLE IF EXISTS activos.area CASCADE',
        ] as $sql) {
            DB::statement($sql);
        }
    }
};
