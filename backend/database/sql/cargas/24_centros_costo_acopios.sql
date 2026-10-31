/* =====================================================================
   24. CENTROS DE COSTO: ACOPIOS Y SEDE CENTRAL
   ---------------------------------------------------------------------
   El centro de costo (activos.centro_costo) es la unidad principal de la
   empresa: cada uno tiene su almacén y, por su almacén, su caja. Algunos
   centros son ACOPIO (reciben carga y pagan sus bonos) y uno es la SEDE
   CENTRAL (distribuye el dinero de apertura de las cajas y los envíos).

   - Un centro acopio o central necesita su almacén, y un almacén es de un
     solo centro de costo vigente.
   - Desde que hay al menos un acopio marcado, la carga solo se recibe en el
     almacén de un acopio. Mientras no se marque ninguno, todo sigue como
     antes (instalaciones que todavía no ordenaron sus centros).
   - Arranque: se marcan como acopio los centros cuyo almacén ya recibió
     carga o tiene recepcionistas.
   ===================================================================== */

BEGIN;

ALTER TABLE activos.centro_costo
    ADD COLUMN es_acopio  boolean NOT NULL DEFAULT false,
    ADD COLUMN es_central boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT ck_cc_acopio_con_almacen CHECK ((NOT es_acopio AND NOT es_central) OR almacen_id IS NOT NULL);
COMMENT ON COLUMN activos.centro_costo.es_acopio IS 'Recibe carga de mineral (recepción, bonos) en su almacén.';
COMMENT ON COLUMN activos.centro_costo.es_central IS 'Sede central: envía el dinero a las cajas de los acopios. Solo uno.';

CREATE UNIQUE INDEX ux_cc_una_central ON activos.centro_costo (es_central) WHERE es_central;

-- Un almacén pertenece a un solo centro de costo vigente.
CREATE FUNCTION activos.tg_cc_almacen_unico() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_otro varchar;
BEGIN
    IF NEW.almacen_id IS NOT NULL AND NEW.activo THEN
        SELECT codigo INTO v_otro FROM activos.centro_costo
         WHERE almacen_id = NEW.almacen_id AND activo AND id <> COALESCE(NEW.id, 0)
         LIMIT 1;
        IF v_otro IS NOT NULL THEN
            RAISE EXCEPTION 'Ese almacén ya es del centro de costo %: cada centro tiene su propio almacén.', v_otro;
        END IF;
    END IF;
    IF NOT NEW.activo AND (NEW.es_acopio OR NEW.es_central) THEN
        NEW.es_acopio := false;                -- un centro dado de baja deja de ser acopio o central
        NEW.es_central := false;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER cc_almacen_unico
    BEFORE INSERT OR UPDATE OF almacen_id, activo, es_acopio, es_central ON activos.centro_costo
    FOR EACH ROW EXECUTE FUNCTION activos.tg_cc_almacen_unico();

-- Arranque: acopio donde ya se recibe carga.
UPDATE activos.centro_costo cc SET es_acopio = true
 WHERE cc.activo AND cc.almacen_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM activos.centro_costo o            -- almacén compartido: no se adivina
                    WHERE o.almacen_id = cc.almacen_id AND o.activo AND o.id <> cc.id)
   AND (EXISTS (SELECT 1 FROM cargas.lote l WHERE l.almacen_id = cc.almacen_id)
        OR EXISTS (SELECT 1 FROM cargas.sede_recepcionista s WHERE s.almacen_id = cc.almacen_id));

/* Centro de costo de cada almacén (vigente). */
CREATE VIEW cargas.v_centro_almacen AS
SELECT cc.almacen_id, cc.id AS centro_costo_id, cc.codigo, cc.nombre, cc.es_acopio, cc.es_central, a.codigo AS area
  FROM activos.centro_costo cc
  LEFT JOIN activos.area a ON a.id = cc.area_id
 WHERE cc.activo AND cc.almacen_id IS NOT NULL;

CREATE FUNCTION cargas.hay_acopios() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM activos.centro_costo WHERE es_acopio AND activo) $$;

CREATE FUNCTION cargas.es_acopio(p_almacen bigint) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT NOT cargas.hay_acopios()
        OR EXISTS (SELECT 1 FROM activos.centro_costo WHERE almacen_id = p_almacen AND es_acopio AND activo)
$$;

-- La carga se recibe solo en un acopio.
CREATE FUNCTION cargas.tg_lote_en_acopio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT cargas.es_acopio(NEW.almacen_id) THEN
        RAISE EXCEPTION 'El almacén «%» no es de un acopio: la carga se recibe en un centro de costo marcado como acopio.',
            (SELECT nombre FROM public.almacenes WHERE id = NEW.almacen_id);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER lote_en_acopio
    BEFORE INSERT ON cargas.lote
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_lote_en_acopio();

COMMIT;
