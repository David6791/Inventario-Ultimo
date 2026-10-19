/* =====================================================================
   16. PRECIOS, COTIZACIONES, RETENCIONES Y VALOR ESTIMADO (sprint 6)
   ---------------------------------------------------------------------
   El modelo de 03_cargas.sql ya valida las tablas al aprobar (sin huecos,
   sin bajar de precio, aprobada por otra persona, sin solape de
   vigencias). Aquí se agrega:

   a) cargas.aprobar_tabla_precio(): aprueba y, si había una tabla vigente
      sin fecha de cierre que empezó antes, la cierra el día en que empieza
      la nueva. No se cambia el precio de días pasados: con una tabla
      anterior de por medio, la nueva empieza hoy o después.
   b) Una tabla en BORRADOR se descarta (ANULADA) o se borra; una APROBADA
      se anula solo si su vigencia todavía no empezó.
   c) cargas.publicar_tasa_retencion(): misma lógica para las tasas de
      retención (general o por cooperativa).
   d) Las cotizaciones se corrigen mientras ninguna liquidación las use
      (el sprint 8 cerrará esa puerta); quién y cuándo queda en
      cotizacion_cambio.
   e) cargas.valor_estimado_lote(): peso seco × valor por TM de cada
      elemento pagable, con la tabla y la cotización vigentes a la fecha
      de recepción. Sin descuentos ni retenciones: eso es liquidación.
      Antes de la ley final usa el análisis de la empresa o la lectura
      estimada, y lo dice.
   ===================================================================== */

-- ------------------------------------------------- a) aprobar tabla
CREATE FUNCTION cargas.aprobar_tabla_precio(p_tabla bigint, p_usuario bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    t cargas.tabla_precio; v_prev cargas.tabla_precio;
BEGIN
    SELECT * INTO t FROM cargas.tabla_precio WHERE id = p_tabla FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La tabla de precios % no existe.', p_tabla;
    END IF;
    IF t.estado <> 'BORRADOR' THEN
        RAISE EXCEPTION 'La tabla de precios % está %: solo se aprueba un borrador.', p_tabla, t.estado;
    END IF;

    -- La vigente sin cierre que empezó antes: se cierra donde empieza la nueva.
    SELECT * INTO v_prev FROM cargas.tabla_precio
     WHERE linea_producto_id = t.linea_producto_id AND elemento_id = t.elemento_id
       AND estado = 'APROBADA' AND vigente_hasta IS NULL AND vigente_desde < t.vigente_desde
     FOR UPDATE;
    IF FOUND THEN
        IF t.vigente_desde < current_date THEN
            RAISE EXCEPTION 'La tabla empieza el % y reemplazaría a la vigente en días pasados: los lotes ya recibidos cambiarían de valor. Use hoy o una fecha posterior.',
                to_char(t.vigente_desde, 'DD/MM/YYYY');
        END IF;
        UPDATE cargas.tabla_precio SET vigente_hasta = t.vigente_desde, updated_at = now() WHERE id = v_prev.id;
    END IF;

    UPDATE cargas.tabla_precio
       SET estado = 'APROBADA', aprobado_por = p_usuario, aprobado_en = now(), updated_at = now()
     WHERE id = p_tabla;
END $$;

-- ------------------------------------------------- b) anular aprobada
CREATE FUNCTION cargas.tg_tabla_precio_anular() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = 'ANULADA' AND OLD.estado = 'APROBADA' AND OLD.vigente_desde <= current_date THEN
        RAISE EXCEPTION 'La tabla de precios % ya está en vigencia desde el %: no se anula, se reemplaza con otra tabla.',
            OLD.id, to_char(OLD.vigente_desde, 'DD/MM/YYYY');
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER tabla_precio_anular
    BEFORE UPDATE OF estado ON cargas.tabla_precio
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_tabla_precio_anular();

-- ------------------------------------------------- c) tasa de retención
CREATE FUNCTION cargas.publicar_tasa_retencion(p_concepto bigint, p_cooperativa bigint, p_porcentaje numeric,
                                               p_desde date, p_usuario bigint)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
    v_prev cargas.retencion_tasa; v_id bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM cargas.retencion_tasa
                WHERE concepto_id = p_concepto AND cooperativa_id IS NOT DISTINCT FROM p_cooperativa
                  AND vigente_desde >= p_desde) THEN
        RAISE EXCEPTION 'Ya hay una tasa que empieza el % o después: la nueva tasa debe empezar más tarde.', to_char(p_desde, 'DD/MM/YYYY');
    END IF;
    SELECT * INTO v_prev FROM cargas.retencion_tasa
     WHERE concepto_id = p_concepto AND cooperativa_id IS NOT DISTINCT FROM p_cooperativa
       AND vigente_hasta IS NULL
     FOR UPDATE;
    IF FOUND THEN
        IF p_desde < current_date THEN
            RAISE EXCEPTION 'La tasa nueva empieza el % y cambiaría la tasa de días pasados. Use hoy o una fecha posterior.', to_char(p_desde, 'DD/MM/YYYY');
        END IF;
        UPDATE cargas.retencion_tasa SET vigente_hasta = p_desde, updated_at = now() WHERE id = v_prev.id;
    END IF;
    INSERT INTO cargas.retencion_tasa (concepto_id, cooperativa_id, porcentaje, vigente_desde, registrado_por, created_at, updated_at)
    VALUES (p_concepto, p_cooperativa, p_porcentaje, p_desde, p_usuario, now(), now())
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

CREATE FUNCTION cargas.retencion_vigente(p_concepto_codigo varchar, p_cooperativa bigint, p_fecha date)
RETURNS numeric LANGUAGE sql STABLE AS $$
    SELECT t.porcentaje FROM cargas.retencion_tasa t JOIN cargas.retencion_concepto c ON c.id = t.concepto_id
     WHERE c.codigo = p_concepto_codigo
       AND t.cooperativa_id IS NOT DISTINCT FROM (CASE WHEN c.por_cooperativa THEN p_cooperativa END)
       AND daterange(t.vigente_desde, t.vigente_hasta, '[)') @> p_fecha
$$;

-- ---------------------------------------------- d) cambios de cotización
CREATE TABLE cargas.cotizacion_cambio (
    id             bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cotizacion_id  bigint NOT NULL,
    accion         varchar(10) NOT NULL CHECK (accion IN ('CORREGIDA','ELIMINADA')),
    antes          jsonb NOT NULL,
    usuario_id     bigint REFERENCES public.users(id),
    cambiado_en    timestamp(0) NOT NULL DEFAULT now()
);

CREATE FUNCTION cargas.tg_cotizacion_cambio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO cargas.cotizacion_cambio (cotizacion_id, accion, antes, usuario_id)
    VALUES (OLD.id, CASE WHEN TG_OP = 'DELETE' THEN 'ELIMINADA' ELSE 'CORREGIDA' END, to_jsonb(OLD),
            NULLIF(current_setting('cargas.usuario_id', true), '')::bigint);
    RETURN NULL;
END $$;

CREATE TRIGGER cotizacion_cambio
    AFTER UPDATE OR DELETE ON cargas.cotizacion
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_cotizacion_cambio();

-- ------------------------------------------------- e) valor estimado
CREATE FUNCTION cargas.valor_estimado_lote(p_lote bigint)
RETURNS TABLE (
    elemento_id bigint, elemento varchar, unidad_ley varchar,
    fuente varchar, ley numeric,
    tabla_precio_id bigint, modalidad varchar, moneda char(3),
    cotizacion numeric, cotizacion_tipo varchar,
    valor_por_tm numeric, peso_seco_tm numeric, valor numeric,
    observacion varchar
) LANGUAGE plpgsql STABLE AS $$
DECLARE
    l cargas.lote; v_fecha date; v_humedo numeric; v_h numeric; v_fuente_h varchar;
    e record; v_tabla cargas.tabla_precio;
BEGIN
    SELECT * INTO l FROM cargas.lote WHERE id = p_lote;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El lote % no existe.', p_lote;
    END IF;
    v_fecha := l.fecha_recepcion::date;

    SELECT COALESCE(sum(p.peso_neto_kg), 0) INTO v_humedo
      FROM cargas.pesaje p WHERE p.lote_id = l.id AND p.tipo = 'INGRESO' AND NOT p.anulado;

    -- Humedad: la final, o la de la empresa en la muestra vigente, o la estimada.
    SELECT x.valor, 'LEY_FINAL' INTO v_h, v_fuente_h
      FROM cargas.lote_ley x JOIN cargas.elemento ex ON ex.id = x.elemento_id AND ex.codigo = 'H2O' WHERE x.lote_id = l.id;
    IF v_h IS NULL THEN
        SELECT x.ley_empresa, 'ANALISIS_EMPRESA' INTO v_h, v_fuente_h
          FROM cargas.v_lote_ensayes x WHERE x.lote_id = l.id AND x.elemento = 'H2O';
    END IF;
    IF v_h IS NULL THEN
        SELECT x.valor, 'LECTURA_ESTIMADA' INTO v_h, v_fuente_h
          FROM cargas.lote_lectura_estimada x JOIN cargas.elemento ex ON ex.id = x.elemento_id AND ex.codigo = 'H2O' WHERE x.lote_id = l.id;
    END IF;

    FOR e IN
        SELECT el.id, el.codigo, el.unidad_ley FROM cargas.linea_producto_elemento lpe
          JOIN cargas.elemento el ON el.id = lpe.elemento_id
         WHERE lpe.linea_producto_id = l.linea_producto_id AND lpe.rol = 'PAGABLE'
         ORDER BY el.codigo
    LOOP
        elemento_id := e.id; elemento := e.codigo; unidad_ley := e.unidad_ley;
        ley := NULL; fuente := NULL; tabla_precio_id := NULL; modalidad := NULL; moneda := NULL;
        cotizacion := NULL; cotizacion_tipo := NULL; valor_por_tm := NULL; valor := NULL; observacion := NULL;
        peso_seco_tm := round(v_humedo * (1 - COALESCE(v_h, 0) / 100) / 1000, 4);

        SELECT x.valor, 'LEY_FINAL' INTO ley, fuente FROM cargas.lote_ley x WHERE x.lote_id = l.id AND x.elemento_id = e.id;
        IF ley IS NULL THEN
            SELECT x.ley_empresa, 'ANALISIS_EMPRESA' INTO ley, fuente FROM cargas.v_lote_ensayes x
             WHERE x.lote_id = l.id AND x.elemento_id = e.id;
        END IF;
        IF ley IS NULL THEN
            SELECT x.valor, 'LECTURA_ESTIMADA' INTO ley, fuente FROM cargas.lote_lectura_estimada x
             WHERE x.lote_id = l.id AND x.elemento_id = e.id;
        END IF;

        tabla_precio_id := cargas.tabla_precio_vigente(l.linea_producto_id, e.id, v_fecha);
        IF tabla_precio_id IS NOT NULL THEN
            SELECT * INTO v_tabla FROM cargas.tabla_precio WHERE id = tabla_precio_id;
            modalidad := v_tabla.modalidad; moneda := v_tabla.moneda;
        END IF;

        IF ley IS NULL THEN
            observacion := 'Sin ley: falta la ley final, el análisis de la empresa o una lectura estimada.';
        ELSIF tabla_precio_id IS NULL THEN
            observacion := 'Sin tabla de precios aprobada para ' || e.codigo || ' al ' || to_char(v_fecha, 'DD/MM/YYYY') || '.';
        ELSE
            IF modalidad = 'POR_PORCENTAJE' THEN
                cotizacion := cargas.cotizacion_vigente(e.id, v_fecha, 'REFERENCIA'); cotizacion_tipo := 'REFERENCIA';
                IF cotizacion IS NULL THEN
                    cotizacion := cargas.cotizacion_vigente(e.id, v_fecha, 'OFICIAL'); cotizacion_tipo := 'OFICIAL';
                END IF;
                IF cotizacion IS NULL THEN
                    cotizacion_tipo := NULL;
                    observacion := 'Sin cotización de ' || e.codigo || ' para la quincena del ' || to_char(v_fecha, 'DD/MM/YYYY') || '.';
                END IF;
            END IF;
            IF observacion IS NULL THEN
                BEGIN
                    valor_por_tm := cargas.valor_por_tm(tabla_precio_id, ley, cotizacion);
                    valor := round(valor_por_tm * peso_seco_tm, 2);
                EXCEPTION WHEN raise_exception THEN
                    observacion := SQLERRM;
                END;
            END IF;
        END IF;
        IF observacion IS NULL AND v_h IS NULL THEN
            observacion := 'Sin humedad todavía: calculado sobre el peso húmedo.';
        ELSIF observacion IS NULL AND v_fuente_h <> 'LEY_FINAL' THEN
            observacion := 'Humedad ' || CASE v_fuente_h WHEN 'ANALISIS_EMPRESA' THEN 'del análisis de la empresa' ELSE 'estimada' END || ' (' || v_h || ' %).';
        END IF;
        RETURN NEXT;
    END LOOP;
END $$;

COMMENT ON FUNCTION cargas.valor_estimado_lote(bigint) IS
    'Valor estimado por elemento pagable: peso seco × valor por TM con la tabla y cotización vigentes a la recepción. Sin descuentos ni retenciones.';


-- ------------------------------------- mensajes con números legibles
/* 16.0000 → «16»; 30.6400 → «30,64». Para los mensajes de error. */
CREATE FUNCTION cargas.fmt_num(p numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p IS NULL THEN NULL
                WHEN p::text NOT LIKE '%.%' THEN p::text
                ELSE replace(rtrim(rtrim(p::text, '0'), '.'), '.', ',') END
$$;

-- Mismo control de 03_cargas.sql; solo cambian los números de los mensajes.
CREATE OR REPLACE FUNCTION cargas.tg_tabla_precio_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_modalidad_linea varchar;
    v_n          integer;
    r            record;
    v_hay_prev   boolean := false;
    v_prev_hasta numeric;
    v_prev_valor numeric;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'BORRADOR' THEN
            RAISE EXCEPTION 'Solo se elimina una tabla de precios en BORRADOR; la tabla % está %. Anúlela o cierre su vigencia.', OLD.id, OLD.estado;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'BORRADOR' THEN
            RAISE EXCEPTION 'Una tabla de precios nace en BORRADOR; se aprueba después de cargar sus tramos.';
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF OLD.estado = 'ANULADA' THEN
        RAISE EXCEPTION 'La tabla de precios % está anulada y no admite cambios.', OLD.id;
    END IF;

    IF OLD.estado = 'APROBADA' THEN
        IF NEW.estado = 'BORRADOR' THEN
            RAISE EXCEPTION 'Una tabla de precios aprobada no vuelve a borrador.';
        END IF;
        IF (NEW.linea_producto_id, NEW.elemento_id, NEW.modalidad, NEW.moneda, NEW.factor_conversion,
            NEW.vigente_desde, NEW.creado_por, NEW.aprobado_por, NEW.aprobado_en)
           IS DISTINCT FROM
           (OLD.linea_producto_id, OLD.elemento_id, OLD.modalidad, OLD.moneda, OLD.factor_conversion,
            OLD.vigente_desde, OLD.creado_por, OLD.aprobado_por, OLD.aprobado_en) THEN
            RAISE EXCEPTION 'Una tabla de precios aprobada solo admite cerrar su vigencia (vigente_hasta) o anularse.';
        END IF;
        RETURN NEW;
    END IF;

    -- OLD.estado = 'BORRADOR'
    IF NEW.estado = 'APROBADA' THEN
        SELECT modalidad_precio INTO v_modalidad_linea
          FROM cargas.linea_producto WHERE id = NEW.linea_producto_id;
        IF v_modalidad_linea <> NEW.modalidad THEN
            RAISE EXCEPTION 'La línea de producto se paga %, pero la tabla es %.', v_modalidad_linea, NEW.modalidad;
        END IF;

        SELECT count(*) INTO v_n FROM cargas.tabla_precio_tramo WHERE tabla_precio_id = NEW.id;
        IF v_n = 0 THEN
            RAISE EXCEPTION 'La tabla de precios % no tiene tramos: no se puede aprobar.', NEW.id;
        END IF;

        IF EXISTS (SELECT 1 FROM cargas.tabla_precio_tramo
                    WHERE tabla_precio_id = NEW.id
                      AND ((NEW.modalidad = 'POR_PUNTO'      AND precio_punto IS NULL) OR
                           (NEW.modalidad = 'POR_PORCENTAJE' AND porcentaje_pagable IS NULL))) THEN
            RAISE EXCEPTION 'Hay tramos que no corresponden a la modalidad % de la tabla.', NEW.modalidad;
        END IF;

        FOR r IN SELECT ley_desde, ley_hasta, COALESCE(precio_punto, porcentaje_pagable) AS valor
                   FROM cargas.tabla_precio_tramo
                  WHERE tabla_precio_id = NEW.id
                  ORDER BY ley_desde
        LOOP
            IF v_hay_prev THEN
                IF v_prev_hasta IS NULL OR r.ley_desde <> v_prev_hasta THEN
                    RAISE EXCEPTION 'Hay un hueco entre los tramos: uno termina en % y el siguiente empieza en %. Una ley en ese intervalo no tendría precio.',
                        COALESCE(cargas.fmt_num(v_prev_hasta), '∞'), cargas.fmt_num(r.ley_desde);
                END IF;
                IF r.valor < v_prev_valor THEN
                    RAISE EXCEPTION 'El tramo que empieza en ley % paga % y el anterior paga %: una ley mayor no puede valer menos.',
                        cargas.fmt_num(r.ley_desde), cargas.fmt_num(r.valor), cargas.fmt_num(v_prev_valor);
                END IF;
            END IF;
            v_hay_prev   := true;
            v_prev_hasta := r.ley_hasta;
            v_prev_valor := r.valor;
        END LOOP;
    END IF;

    RETURN NEW;
END $$;
