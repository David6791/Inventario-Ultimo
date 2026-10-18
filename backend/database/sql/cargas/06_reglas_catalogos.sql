/* =====================================================================
   06 — REGLAS DE CATÁLOGOS (sprint 1) — esquema cargas
   ---------------------------------------------------------------------
   Lo que los catálogos NO pueden cambiar una vez que hay datos que
   dependen de ellos, más dos funciones para el editor de series:

   1. Serie con lotes: prefijo, línea y origen quedan fijos. Cambiar el
      prefijo de una serie usada deja libre ese prefijo para otra serie, que
      arrancaría su contador en 1 y repetiría códigos ya emitidos.
   2. Elemento: el código nunca cambia (las vistas y reglas usan H2O, ZN,
      PB, AG); la unidad de la ley no cambia si ya hay análisis, leyes,
      precios o cotizaciones en esa unidad.
   3. Línea de producto: la modalidad de precio no cambia si ya tiene tablas
      de precio.
   4. Mina con lotes: no cambia de propia a ajena ni al revés (los lotes de
      compra y de producción propia se validan con ese dato).
   5. vista_previa_formato_lote(): cómo saldría el próximo código con un
      formato que todavía no se guardó (o de una serie nueva).
   6. fijar_ultimo_numero_serie(): continuar la numeración de otro sistema.
      El contador nunca retrocede.
   ===================================================================== */

BEGIN;

-- 1. Serie con lotes -----------------------------------------------------
CREATE FUNCTION cargas.tg_serie_lote_con_lotes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.prefijo, NEW.linea_producto_id, NEW.origen)
       IS DISTINCT FROM (OLD.prefijo, OLD.linea_producto_id, OLD.origen)
       AND EXISTS (SELECT 1 FROM cargas.lote WHERE serie_id = OLD.id) THEN
        RAISE EXCEPTION 'La serie % ya tiene lotes: su prefijo, línea y origen no se cambian. Cree una serie nueva si necesita otros.', OLD.prefijo;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER serie_lote_con_lotes
    BEFORE UPDATE OF prefijo, linea_producto_id, origen ON cargas.serie_lote
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_serie_lote_con_lotes();

-- 2. Elemento -------------------------------------------------------------
CREATE FUNCTION cargas.tg_elemento_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_donde text;
BEGIN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
        RAISE EXCEPTION 'El código del elemento % no se cambia: las reglas y reportes lo usan.', OLD.codigo;
    END IF;

    IF NEW.unidad_ley IS DISTINCT FROM OLD.unidad_ley THEN
        v_donde := CASE
            WHEN EXISTS (SELECT 1 FROM cargas.analisis_resultado WHERE elemento_id = OLD.id) THEN 'análisis'
            WHEN EXISTS (SELECT 1 FROM cargas.lote_ley           WHERE elemento_id = OLD.id) THEN 'leyes finales de lotes'
            WHEN EXISTS (SELECT 1 FROM cargas.tabla_precio       WHERE elemento_id = OLD.id) THEN 'tablas de precio'
            WHEN EXISTS (SELECT 1 FROM cargas.cotizacion         WHERE elemento_id = OLD.id) THEN 'cotizaciones'
        END;
        IF v_donde IS NOT NULL THEN
            RAISE EXCEPTION 'El elemento % ya tiene % registrados en %: su unidad de ley no se cambia.', OLD.codigo, v_donde, OLD.unidad_ley;
        END IF;
    END IF;

    IF OLD.codigo = 'H2O' AND NOT NEW.activo THEN
        RAISE EXCEPTION 'La humedad (H2O) no se desactiva: todo lote la necesita para calcular el peso seco.';
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER elemento_control
    BEFORE UPDATE ON cargas.elemento
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_elemento_control();

-- 3. Línea de producto ----------------------------------------------------
CREATE FUNCTION cargas.tg_linea_producto_control() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.modalidad_precio IS DISTINCT FROM OLD.modalidad_precio
       AND EXISTS (SELECT 1 FROM cargas.tabla_precio WHERE linea_producto_id = OLD.id) THEN
        RAISE EXCEPTION 'La línea % ya tiene tablas de precio: su modalidad de precio no se cambia.', OLD.codigo;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER linea_producto_control
    BEFORE UPDATE OF modalidad_precio ON cargas.linea_producto
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_linea_producto_control();

-- 4. Mina con lotes -------------------------------------------------------
CREATE FUNCTION cargas.tg_mina_con_lotes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.propia IS DISTINCT FROM OLD.propia
       AND EXISTS (SELECT 1 FROM cargas.lote WHERE mina_id = OLD.id) THEN
        RAISE EXCEPTION 'La mina «%» ya tiene lotes: no puede pasar de % a %.', OLD.nombre,
            CASE WHEN OLD.propia THEN 'propia' ELSE 'ajena' END,
            CASE WHEN NEW.propia THEN 'propia' ELSE 'ajena' END;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER mina_con_lotes
    BEFORE UPDATE OF propia ON cargas.mina
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_mina_con_lotes();

-- 5. Vista previa de un formato sin guardar -------------------------------
CREATE FUNCTION cargas.vista_previa_formato_lote(
    p_formato   varchar,
    p_reinicio  varchar,
    p_prefijo   varchar,
    p_linea_id  bigint,
    p_origen    varchar,
    p_fecha     date   DEFAULT current_date,
    p_serie_id  bigint DEFAULT NULL
) RETURNS varchar
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_linea varchar;
BEGIN
    SELECT codigo INTO v_linea FROM cargas.linea_producto WHERE id = p_linea_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Elija la línea de producto de la serie.';
    END IF;

    -- Una serie nueva no tiene contador: su primer código sale con el 1.
    RETURN comun.vista_previa_codigo(
        'cargas.serie_lote:' || COALESCE(p_serie_id::text, 'nueva'),
        p_formato, p_reinicio, p_fecha,
        jsonb_build_object(
            'PREFIJO', NULLIF(btrim(p_prefijo), ''),
            'LINEA',   v_linea,
            'ORIGEN',  CASE p_origen WHEN 'COMPRA' THEN 'C' WHEN 'PROPIA' THEN 'P' END,
            'SIGLA',   cargas.parametro_vigente('SIGLA_EMPRESA', p_fecha)),
        cargas.marcadores_lote());
END $$;

-- 6. Continuar la numeración ------------------------------------------------
CREATE FUNCTION cargas.fijar_ultimo_numero_serie(p_serie_id bigint, p_ultimo integer, p_fecha date DEFAULT current_date)
RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    s         cargas.serie_lote;
    v_clave   varchar;
    v_periodo varchar;
    v_actual  integer;
BEGIN
    SELECT * INTO s FROM cargas.serie_lote WHERE id = p_serie_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La serie de lotes % no existe.', p_serie_id;
    END IF;
    IF p_ultimo IS NULL OR p_ultimo < 0 THEN
        RAISE EXCEPTION 'El último número usado debe ser cero o mayor.';
    END IF;

    v_clave   := 'cargas.serie_lote:' || s.id;
    v_periodo := comun.periodo_de(s.reinicio, p_fecha);

    SELECT ultimo_numero INTO v_actual FROM comun.contador
     WHERE clave = v_clave AND periodo = v_periodo
       FOR UPDATE;

    IF COALESCE(v_actual, 0) > p_ultimo THEN
        RAISE EXCEPTION 'La serie % ya va en el número % de este período: el contador no retrocede, porque se repetirían códigos.', s.prefijo, v_actual;
    END IF;

    INSERT INTO comun.contador (clave, periodo, ultimo_numero)
    VALUES (v_clave, v_periodo, p_ultimo)
    ON CONFLICT (clave, periodo)
    DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero, updated_at = now();

    RETURN cargas.vista_previa_codigo_lote(s.id, p_fecha);
END $$;

COMMIT;
