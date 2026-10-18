/* =====================================================================
   11 — RECEPCIÓN (sprint 4) — esquema cargas
   ---------------------------------------------------------------------
   1. Anular un pesaje anula su bono de transporte pendiente. Si el bono
      ya se pagó, el pesaje no se anula: primero hay que resolver el pago
      (el chofer cobró por ese viaje).
   2. Anular un lote anula los bonos pendientes de sus pesajes. Los ya
      pagados se mantienen: el viaje se hizo aunque la carga se rechace.
   3. Tabla de tramos del bono con vigencia: publicar una tabla nueva
      cierra la vigente el día anterior al inicio de la nueva. No se
      publica con fecha pasada, porque los bonos ya calculados quedarían
      con un tramo que ya no correspondería.
   ===================================================================== */

BEGIN;

-- 1. Pesaje anulado ---------------------------------------------------------
CREATE FUNCTION cargas.tg_pesaje_anulado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_comprobante varchar;
BEGIN
    IF NEW.anulado AND NOT OLD.anulado THEN
        SELECT m.numero INTO v_comprobante
          FROM cargas.bono_transporte b JOIN caja.movimiento m ON m.id = b.movimiento_caja_id
         WHERE b.pesaje_id = NEW.id AND b.estado = 'PAGADO';
        IF FOUND THEN
            RAISE EXCEPTION 'El bono de transporte de este pesaje ya se pagó (comprobante %): el pesaje no se anula.', v_comprobante;
        END IF;

        UPDATE cargas.bono_transporte
           SET estado = 'ANULADO', anulado_por = cargas.usuario_actual(), anulado_en = now(),
               motivo_anulacion = left('Pesaje anulado: ' || NEW.motivo_anulacion, 250), updated_at = now()
         WHERE pesaje_id = NEW.id AND estado = 'PENDIENTE';
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER pesaje_anulado
    AFTER UPDATE OF anulado ON cargas.pesaje
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_pesaje_anulado();

-- 2. Lote anulado -----------------------------------------------------------
CREATE FUNCTION cargas.tg_lote_anulado_bonos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = 'ANULADO' AND OLD.estado <> 'ANULADO' THEN
        UPDATE cargas.bono_transporte b
           SET estado = 'ANULADO', anulado_por = cargas.usuario_actual(), anulado_en = now(),
               motivo_anulacion = left('Lote anulado: ' || NEW.motivo_anulacion, 250), updated_at = now()
          FROM cargas.pesaje p
         WHERE p.id = b.pesaje_id AND p.lote_id = NEW.id AND b.estado = 'PENDIENTE';
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER lote_anulado_bonos
    AFTER UPDATE OF estado ON cargas.lote
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_lote_anulado_bonos();

-- 3. Publicar una tabla de tramos -------------------------------------------
--    p_tramos: [{"tipo_vehiculo": "TONKA", "peso_desde_kg": 500, "peso_hasta_kg": 7000, "monto": 50}, ...]
CREATE FUNCTION cargas.publicar_tramos_bono(p_desde date, p_tramos jsonb, p_usuario bigint)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    v_n integer;
BEGIN
    IF p_desde IS NULL OR p_desde < current_date THEN
        RAISE EXCEPTION 'La tabla de tramos rige desde hoy o una fecha futura: los bonos ya calculados no cambian.';
    END IF;
    IF p_tramos IS NULL OR jsonb_array_length(p_tramos) = 0 THEN
        RAISE EXCEPTION 'La tabla de tramos necesita al menos un tramo.';
    END IF;

    -- Tramos que empezaban en esa fecha o después y no se usaron: se reemplazan.
    IF EXISTS (SELECT 1 FROM cargas.bono_transporte b JOIN cargas.bono_transporte_tramo t ON t.id = b.tramo_id
                WHERE t.vigente_desde >= p_desde) THEN
        RAISE EXCEPTION 'Ya hay bonos calculados con la tabla que empieza el % o después: publique la nueva con otra fecha.', p_desde;
    END IF;
    DELETE FROM cargas.bono_transporte_tramo WHERE vigente_desde >= p_desde;

    -- La tabla vigente termina donde empieza la nueva.
    UPDATE cargas.bono_transporte_tramo
       SET vigente_hasta = p_desde, updated_at = now()
     WHERE vigente_desde < p_desde AND (vigente_hasta IS NULL OR vigente_hasta > p_desde);

    INSERT INTO cargas.bono_transporte_tramo
           (tipo_vehiculo, peso_desde_kg, peso_hasta_kg, monto, moneda, vigente_desde, registrado_por, created_at, updated_at)
    SELECT upper(btrim(t->>'tipo_vehiculo')), (t->>'peso_desde_kg')::numeric, NULLIF(t->>'peso_hasta_kg', '')::numeric,
           (t->>'monto')::numeric, COALESCE(t->>'moneda', 'BOB'), p_desde, p_usuario, now(), now()
      FROM jsonb_array_elements(p_tramos) t;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END $$;

COMMIT;
