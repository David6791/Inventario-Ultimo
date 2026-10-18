/* =====================================================================
   07 — REGLAS DE CAJA (sprint 2) — esquema caja
   ---------------------------------------------------------------------
   Lo que 02_caja.sql no cubría y aparece al administrar cajas y conceptos
   desde la interfaz:

   1. Caja con sesiones: el código y la sede quedan fijos. Los comprobantes
      ya impresos llevan ese código y esa sede.
   2. Caja con una sesión abierta: no se desactiva.
   3. Dólares: no se deja de manejar USD mientras haya una sesión abierta en
      dólares o el último cierre haya contado dólares en caja (ese efectivo
      quedaría fuera de todo control).
   4. Formato del comprobante: si el próximo número que saldría con el
      formato nuevo ya existe, se rechaza (se repetirían comprobantes).
   5. Conceptos: el origen nunca cambia; el tipo no cambia si el concepto
      ya tiene movimientos; un concepto que genera otro módulo (origen
      distinto de MANUAL) no cambia de código, porque ese módulo lo busca
      por código.
   6. vista_previa_comprobante(): cómo saldrá el próximo comprobante con un
      formato todavía no guardado (o de una caja nueva), sin consumirlo.
   ===================================================================== */

BEGIN;

-- 6. Vista previa (va primero: la usa la regla 4) --------------------------
CREATE FUNCTION caja.vista_previa_comprobante(
    p_formato  varchar,
    p_reinicio varchar,
    p_codigo   varchar,
    p_caja_id  bigint DEFAULT NULL,
    p_fecha    date   DEFAULT current_date
) RETURNS varchar
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF p_codigo IS NULL OR btrim(p_codigo) = '' THEN
        RAISE EXCEPTION 'Escriba el código de la caja: el comprobante lo usa en {CAJA}.';
    END IF;

    -- Una caja nueva no tiene contador: su primer comprobante sale con el 1.
    RETURN comun.vista_previa_codigo(
        'caja.comprobante:' || COALESCE(p_caja_id::text, 'nueva'),
        p_formato, p_reinicio, p_fecha,
        jsonb_build_object('CAJA', upper(btrim(p_codigo))),
        ARRAY['CAJA']);
END $$;

-- 1 a 4. Caja ---------------------------------------------------------------
CREATE FUNCTION caja.tg_caja_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_sesiones boolean;
    v_abierta  bigint;
    v_usd      numeric;
    v_proximo  varchar;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM caja.sesion WHERE caja_id = OLD.id) THEN
            RAISE EXCEPTION 'La caja % ya tiene sesiones: no se elimina, se desactiva.', OLD.codigo;
        END IF;
        RETURN OLD;
    END IF;

    v_sesiones := EXISTS (SELECT 1 FROM caja.sesion WHERE caja_id = NEW.id);
    SELECT id INTO v_abierta FROM caja.sesion WHERE caja_id = NEW.id AND estado = 'ABIERTA';

    IF v_sesiones AND NEW.codigo <> OLD.codigo THEN
        RAISE EXCEPTION 'La caja % ya emitió comprobantes con ese código: el código no se cambia.', OLD.codigo;
    END IF;
    IF v_sesiones AND NEW.almacen_id <> OLD.almacen_id THEN
        RAISE EXCEPTION 'La caja % ya tiene sesiones en su sede: no se cambia de sede. Cree otra caja.', OLD.codigo;
    END IF;

    IF OLD.activa AND NOT NEW.activa AND v_abierta IS NOT NULL THEN
        RAISE EXCEPTION 'La caja % tiene una sesión abierta: ciérrela antes de desactivarla.', OLD.codigo;
    END IF;

    IF OLD.maneja_usd AND NOT NEW.maneja_usd THEN
        IF EXISTS (SELECT 1 FROM caja.sesion_saldo WHERE sesion_id = v_abierta AND moneda = 'USD') THEN
            RAISE EXCEPTION 'La sesión abierta de la caja % tiene saldo en dólares: ciérrela antes de dejar de manejar dólares.', OLD.codigo;
        END IF;
        SELECT ss.saldo_contado INTO v_usd
          FROM caja.sesion_saldo ss JOIN caja.sesion s ON s.id = ss.sesion_id
         WHERE s.caja_id = OLD.id AND s.estado <> 'ABIERTA' AND ss.moneda = 'USD'
         ORDER BY s.numero DESC LIMIT 1;
        IF COALESCE(v_usd, 0) > 0 THEN
            RAISE EXCEPTION 'En el último cierre de la caja % se contaron % USD: deposítelos o entréguelos antes de dejar de manejar dólares.', OLD.codigo, v_usd;
        END IF;
    END IF;

    IF (NEW.formato_comprobante, NEW.reinicio_comprobante) IS DISTINCT FROM (OLD.formato_comprobante, OLD.reinicio_comprobante) THEN
        v_proximo := caja.vista_previa_comprobante(NEW.formato_comprobante, NEW.reinicio_comprobante, NEW.codigo, NEW.id);
        IF EXISTS (SELECT 1 FROM caja.movimiento WHERE numero = v_proximo) THEN
            RAISE EXCEPTION 'Con ese formato el próximo comprobante sería %, que ya existe: se repetirían números. Cambie el formato.', v_proximo;
        END IF;
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER caja_control
    BEFORE UPDATE OR DELETE ON caja.caja
    FOR EACH ROW EXECUTE FUNCTION caja.tg_caja_control();

-- 5. Conceptos ----------------------------------------------------------------
CREATE FUNCTION caja.tg_concepto_control() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM caja.movimiento WHERE concepto_id = OLD.id) THEN
            RAISE EXCEPTION 'El concepto «%» ya tiene movimientos: no se elimina, se desactiva.', OLD.nombre;
        END IF;
        IF OLD.origen <> 'MANUAL' THEN
            RAISE EXCEPTION 'El concepto «%» lo usa otro módulo (%): no se elimina.', OLD.nombre, OLD.origen;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.origen <> OLD.origen THEN
        RAISE EXCEPTION 'El origen de un concepto no se cambia.';
    END IF;
    IF OLD.origen <> 'MANUAL' AND NEW.codigo <> OLD.codigo THEN
        RAISE EXCEPTION 'El concepto «%» lo usa otro módulo (%) por su código: el código no se cambia.', OLD.nombre, OLD.origen;
    END IF;
    IF NEW.tipo <> OLD.tipo AND (OLD.origen <> 'MANUAL'
                                 OR EXISTS (SELECT 1 FROM caja.movimiento WHERE concepto_id = OLD.id)) THEN
        RAISE EXCEPTION 'El concepto «%» ya tiene movimientos como %: no se cambia a %. Cree otro concepto.', OLD.nombre, OLD.tipo, NEW.tipo;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER concepto_control
    BEFORE UPDATE OR DELETE ON caja.concepto
    FOR EACH ROW EXECUTE FUNCTION caja.tg_concepto_control();

COMMIT;
