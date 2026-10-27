/* =====================================================================
   19 — NUMERACIÓN SEPARADA PARA INGRESOS Y EGRESOS — esquema caja
   ---------------------------------------------------------------------
   Hasta ahora una caja tenía un solo correlativo para todos sus
   comprobantes. Con caja.numeracion_separada cada tipo lleva el suyo:

     egresos : empiezan en inicio_egreso  (por ejemplo 1)
     ingresos: empiezan en inicio_ingreso (por ejemplo 10000)

   Si el formato reinicia (anual, mensual, diario), cada período vuelve a
   empezar en ese número, no en 1. Los ingresos pueden tener un formato
   propio (formato_ingreso); si se deja vacío usan el de la caja.

   Con el mismo formato para los dos, los rangos no deben cruzarse: si los
   egresos llegan al primer número de los ingresos, el comprobante saldría
   repetido y la base lo rechaza con un mensaje claro.

   Al pasar una caja existente a numeración separada, los egresos siguen
   desde donde iba el correlativo único del período.
   ===================================================================== */

BEGIN;

ALTER TABLE caja.caja
    ADD COLUMN numeracion_separada boolean NOT NULL DEFAULT false,
    ADD COLUMN inicio_egreso       integer NOT NULL DEFAULT 1 CHECK (inicio_egreso >= 1),
    ADD COLUMN inicio_ingreso      integer NOT NULL DEFAULT 1 CHECK (inicio_ingreso >= 1),
    ADD COLUMN formato_ingreso     varchar(60);
COMMENT ON COLUMN caja.caja.numeracion_separada IS 'true: ingresos y egresos con correlativos propios (inicio_ingreso / inicio_egreso).';
COMMENT ON COLUMN caja.caja.formato_ingreso IS 'Formato propio de los ingresos con numeración separada. Vacío: el de la caja.';

ALTER TABLE caja.ajuste_numeracion ADD COLUMN tipo varchar(7) CHECK (tipo IN ('INGRESO', 'EGRESO'));
COMMENT ON COLUMN caja.ajuste_numeracion.tipo IS 'Con numeración separada, a qué correlativo se refiere el ajuste. Vacío: el único.';

-- El formato de ingresos se valida igual que el de la caja.
CREATE OR REPLACE FUNCTION caja.tg_caja_formato() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM comun.validar_formato(NEW.formato_comprobante, NEW.reinicio_comprobante, ARRAY['CAJA']);
    IF NEW.formato_ingreso IS NOT NULL AND btrim(NEW.formato_ingreso) = '' THEN
        NEW.formato_ingreso := NULL;
    END IF;
    IF NEW.formato_ingreso IS NOT NULL THEN
        PERFORM comun.validar_formato(NEW.formato_ingreso, NEW.reinicio_comprobante, ARRAY['CAJA']);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER caja_formato ON caja.caja;
CREATE TRIGGER caja_formato
    BEFORE INSERT OR UPDATE OF formato_comprobante, reinicio_comprobante, formato_ingreso ON caja.caja
    FOR EACH ROW EXECUTE FUNCTION caja.tg_caja_formato();

/* ---------------------------------------------------------------------
   Piezas de la numeración
   --------------------------------------------------------------------- */

-- Tipo efectivo del correlativo: NULL si la caja numera todo junto.
CREATE FUNCTION caja.tipo_correlativo(c caja.caja, p_tipo varchar) RETURNS varchar
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN c.numeracion_separada THEN COALESCE(upper(p_tipo), 'EGRESO') END
$$;

CREATE FUNCTION caja.clave_comprobante(c caja.caja, p_tipo varchar) RETURNS varchar
LANGUAGE sql IMMUTABLE AS $$
    SELECT 'caja.comprobante:' || c.id || COALESCE(':' || caja.tipo_correlativo(c, p_tipo), '')
$$;

CREATE FUNCTION caja.inicio_comprobante(c caja.caja, p_tipo varchar) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE caja.tipo_correlativo(c, p_tipo) WHEN 'INGRESO' THEN c.inicio_ingreso
                                                 WHEN 'EGRESO'  THEN c.inicio_egreso
                                                 ELSE 1 END
$$;

CREATE FUNCTION caja.formato_de(c caja.caja, p_tipo varchar) RETURNS varchar
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN caja.tipo_correlativo(c, p_tipo) = 'INGRESO' THEN COALESCE(c.formato_ingreso, c.formato_comprobante)
                ELSE c.formato_comprobante END
$$;

-- Último correlativo emitido en el período (o inicio − 1 si todavía ninguno).
DROP FUNCTION caja.ultimo_comprobante(bigint, date);
CREATE FUNCTION caja.ultimo_comprobante(p_caja_id bigint, p_fecha date DEFAULT current_date, p_tipo varchar DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE AS $$
    SELECT COALESCE((SELECT k.ultimo_numero FROM comun.contador k
                      WHERE k.clave = caja.clave_comprobante(c, p_tipo)
                        AND k.periodo = comun.periodo_de(c.reinicio_comprobante, p_fecha)),
                    caja.inicio_comprobante(c, p_tipo) - 1)
      FROM caja.caja c WHERE c.id = p_caja_id
$$;

-- Cómo saldrá el próximo comprobante de ese tipo (no consume el número).
CREATE FUNCTION caja.proximo_comprobante(p_caja_id bigint, p_tipo varchar DEFAULT NULL, p_fecha date DEFAULT current_date)
RETURNS varchar LANGUAGE sql STABLE AS $$
    SELECT comun.formatear_codigo(caja.formato_de(c, p_tipo), p_fecha,
                                  caja.ultimo_comprobante(c.id, p_fecha, p_tipo) + 1,
                                  jsonb_build_object('CAJA', c.codigo))
      FROM caja.caja c WHERE c.id = p_caja_id
$$;

-- Toma el siguiente número (lo consume) y arma el comprobante.
CREATE FUNCTION caja.siguiente_comprobante(p_caja_id bigint, p_tipo varchar, p_fecha date) RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    c        caja.caja;
    v_fmt    varchar;
    v_datos  jsonb;
    v_n      integer;
    v_codigo varchar;
BEGIN
    SELECT * INTO c FROM caja.caja WHERE id = p_caja_id;
    v_fmt   := caja.formato_de(c, p_tipo);
    v_datos := jsonb_build_object('CAJA', c.codigo);
    -- Se arma primero con un número de prueba: si al formato le falta un dato, no se consume el correlativo.
    PERFORM comun.formatear_codigo(v_fmt, p_fecha, 1, v_datos);

    INSERT INTO comun.contador AS k (clave, periodo, ultimo_numero)
    VALUES (caja.clave_comprobante(c, p_tipo), comun.periodo_de(c.reinicio_comprobante, p_fecha), caja.inicio_comprobante(c, p_tipo))
    ON CONFLICT (clave, periodo) DO UPDATE SET ultimo_numero = k.ultimo_numero + 1, updated_at = now()
    RETURNING ultimo_numero INTO v_n;

    v_codigo := comun.formatear_codigo(v_fmt, p_fecha, v_n, v_datos);
    IF EXISTS (SELECT 1 FROM caja.movimiento WHERE numero = v_codigo) THEN
        RAISE EXCEPTION 'El comprobante % ya existe: con numeración separada, los egresos alcanzaron a los ingresos (o al revés). Use un formato propio para los ingresos o mueva su número de inicio en Caja → Cajas.', v_codigo;
    END IF;
    RETURN v_codigo;
END $$;

-- Próximo número de un correlativo (por tipo si la caja numera por separado).
DROP FUNCTION caja.fijar_proximo_comprobante(bigint, integer, bigint, text);
CREATE FUNCTION caja.fijar_proximo_comprobante(p_caja_id bigint, p_proximo integer, p_usuario bigint,
                                               p_motivo text DEFAULT NULL, p_tipo varchar DEFAULT NULL)
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
    c         caja.caja;
    v_tipo    varchar;
    v_periodo varchar;
    v_ultimo  integer;
    v_codigo  varchar;
    v_datos   jsonb;
BEGIN
    SELECT * INTO c FROM caja.caja WHERE id = p_caja_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La caja no existe.';
    END IF;
    IF p_proximo IS NULL OR p_proximo < 1 THEN
        RAISE EXCEPTION 'El próximo comprobante debe ser un número mayor que cero.';
    END IF;

    v_tipo    := caja.tipo_correlativo(c, p_tipo);
    v_periodo := comun.periodo_de(c.reinicio_comprobante, current_date);
    v_ultimo  := caja.ultimo_comprobante(c.id, current_date, p_tipo);
    v_datos   := jsonb_build_object('CAJA', c.codigo);

    IF p_proximo = v_ultimo + 1 THEN
        RETURN NULL;                                  -- sin cambio
    END IF;
    IF p_proximo <= v_ultimo THEN
        RAISE EXCEPTION 'La caja % ya emitió hasta el comprobante %: el próximo no puede ser %, se repetirían números.',
            c.codigo,
            comun.formatear_codigo(caja.formato_de(c, p_tipo), current_date, v_ultimo, v_datos) || COALESCE(' de ' || lower(v_tipo) || 's', ''),
            p_proximo;
    END IF;

    v_codigo := comun.formatear_codigo(caja.formato_de(c, p_tipo), current_date, p_proximo, v_datos);
    IF EXISTS (SELECT 1 FROM caja.movimiento WHERE numero = v_codigo) THEN
        RAISE EXCEPTION 'El comprobante % ya existe: elija otro número.', v_codigo;
    END IF;

    INSERT INTO comun.contador (clave, periodo, ultimo_numero)
    VALUES (caja.clave_comprobante(c, p_tipo), v_periodo, p_proximo - 1)
    ON CONFLICT (clave, periodo) DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero, updated_at = now();

    INSERT INTO caja.ajuste_numeracion (caja_id, periodo, anterior, proximo, motivo, usuario_id, tipo)
    VALUES (c.id, v_periodo, v_ultimo + 1, p_proximo, NULLIF(btrim(COALESCE(p_motivo, '')), ''), p_usuario, v_tipo);

    RETURN v_codigo;
END $$;

-- Al pasar a numeración separada, los egresos siguen donde iba el correlativo
-- único del período; al volver a uno solo, sigue desde el mayor de los dos.
CREATE FUNCTION caja.tg_caja_numeracion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_periodo varchar := comun.periodo_de(NEW.reinicio_comprobante, current_date);
    v_base    varchar := 'caja.comprobante:' || NEW.id;
    v_ultimo  integer;
BEGIN
    IF NEW.numeracion_separada = OLD.numeracion_separada THEN
        RETURN NEW;
    END IF;
    IF NEW.numeracion_separada THEN
        SELECT ultimo_numero INTO v_ultimo FROM comun.contador WHERE clave = v_base AND periodo = v_periodo;
        IF v_ultimo IS NOT NULL THEN
            INSERT INTO comun.contador (clave, periodo, ultimo_numero)
            VALUES (v_base || ':EGRESO', v_periodo, greatest(v_ultimo, NEW.inicio_egreso - 1))
            ON CONFLICT (clave, periodo) DO NOTHING;
        END IF;
    ELSE
        SELECT max(ultimo_numero) INTO v_ultimo FROM comun.contador
         WHERE clave IN (v_base || ':EGRESO', v_base || ':INGRESO') AND periodo = v_periodo;
        IF v_ultimo IS NOT NULL THEN
            INSERT INTO comun.contador (clave, periodo, ultimo_numero)
            VALUES (v_base, v_periodo, v_ultimo)
            ON CONFLICT (clave, periodo) DO UPDATE SET ultimo_numero = greatest(comun.contador.ultimo_numero, EXCLUDED.ultimo_numero);
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER caja_numeracion
    BEFORE UPDATE OF numeracion_separada ON caja.caja
    FOR EACH ROW EXECUTE FUNCTION caja.tg_caja_numeracion();

/* ---------------------------------------------------------------------
   El comprobante toma su número con caja.siguiente_comprobante
   --------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION caja.tg_movimiento_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    s        caja.sesion;
    c        caja.caja;
    k        caja.concepto;
    v_saldo  numeric;
    v_ajuste boolean;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los movimientos de caja no se eliminan: se anulan con motivo (comprobante %).', OLD.numero;
    END IF;

    -- La sesión se bloquea para que dos egresos simultáneos no se salten el control de saldo.
    SELECT * INTO s FROM caja.sesion WHERE id = NEW.sesion_id FOR UPDATE;
    IF s.estado <> 'ABIERTA' THEN
        RAISE EXCEPTION 'La sesión % de caja está %: no admite movimientos.', s.numero, s.estado;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT * INTO c FROM caja.caja WHERE id = s.caja_id;
        SELECT * INTO k FROM caja.concepto WHERE id = NEW.concepto_id;
        IF NOT k.activo THEN
            RAISE EXCEPTION 'El concepto «%» está inactivo.', k.nombre;
        END IF;
        NEW.caja_id := s.caja_id;
        NEW.tipo    := k.tipo;              -- el tipo lo define el concepto
        NEW.estado  := 'VIGENTE';
        NEW.anulado_por := NULL; NEW.anulado_en := NULL; NEW.motivo_anulacion := NULL;

        IF NOT EXISTS (SELECT 1 FROM caja.sesion_saldo WHERE sesion_id = s.id AND moneda = NEW.moneda) THEN
            RAISE EXCEPTION 'La sesión no tiene saldo abierto en %.', NEW.moneda;
        END IF;

        IF NEW.tipo = 'EGRESO' AND NEW.forma_pago = 'EFECTIVO' THEN
            v_saldo := caja.saldo_efectivo(s.id, NEW.moneda);
            IF v_saldo < NEW.monto THEN
                RAISE EXCEPTION 'Saldo insuficiente en caja: hay % % en efectivo y el egreso es de %.', v_saldo, NEW.moneda, NEW.monto;
            END IF;
        END IF;

        -- Numeración única, o separada para ingresos y egresos (19_numeracion_por_tipo.sql).
        NEW.numero := caja.siguiente_comprobante(c.id, NEW.tipo, NEW.fecha::date);
        RETURN NEW;
    END IF;

    -- UPDATE: se anula, o se ajusta el monto de un provisional (desde caja.aplicar_ajuste).
    v_ajuste := current_setting('caja.ajustando_movimiento', true) IS NOT DISTINCT FROM OLD.id::text;

    IF (NEW.sesion_id, NEW.caja_id, NEW.numero, NEW.fecha, NEW.tipo, NEW.concepto_id, NEW.moneda,
        NEW.forma_pago, NEW.banco_id, NEW.nro_documento, NEW.persona_nombre, NEW.persona_ci, NEW.glosa, NEW.registrado_por)
       IS DISTINCT FROM
       (OLD.sesion_id, OLD.caja_id, OLD.numero, OLD.fecha, OLD.tipo, OLD.concepto_id, OLD.moneda,
        OLD.forma_pago, OLD.banco_id, OLD.nro_documento, OLD.persona_nombre, OLD.persona_ci, OLD.glosa, OLD.registrado_por)
       OR (NEW.monto IS DISTINCT FROM OLD.monto AND NOT v_ajuste) THEN
        RAISE EXCEPTION 'Un movimiento de caja no se corrige: se anula y se registra otro (comprobante %).', OLD.numero;
    END IF;
    IF OLD.estado = 'ANULADO' THEN
        RAISE EXCEPTION 'El comprobante % ya está anulado.', OLD.numero;
    END IF;

    -- Aumento de un egreso en efectivo: la diferencia sale de la caja.
    IF v_ajuste AND NEW.monto > OLD.monto AND OLD.tipo = 'EGRESO' AND OLD.forma_pago = 'EFECTIVO' THEN
        v_saldo := caja.saldo_efectivo(s.id, OLD.moneda);
        IF v_saldo < NEW.monto - OLD.monto THEN
            RAISE EXCEPTION 'Saldo insuficiente en caja: hay % % en efectivo y la diferencia a entregar es de %.',
                v_saldo, OLD.moneda, NEW.monto - OLD.monto;
        END IF;
    END IF;

    IF NEW.estado = 'ANULADO' AND NEW.tipo = 'INGRESO' AND NEW.forma_pago = 'EFECTIVO' THEN
        v_saldo := caja.saldo_efectivo(s.id, NEW.moneda);
        IF v_saldo - NEW.monto < 0 THEN
            RAISE EXCEPTION 'Anular este ingreso dejaría la caja en negativo (saldo %).', v_saldo;
        END IF;
    END IF;
    RETURN NEW;
END $$;


COMMIT;
