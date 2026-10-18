/* =====================================================================
   05 — PRUEBAS DE LOS ESQUEMAS comun, caja y cargas
   Corre todo dentro de una transacción y al final hace ROLLBACK: no deja
   datos. Cada "OK" es una regla verificada; la primera "FALLA" detiene
   el script con error.
   Uso:  psql -v ON_ERROR_STOP=1 -d <base> -f 05_pruebas.sql
   ===================================================================== */

\set ON_ERROR_STOP on
SET client_min_messages = notice;
BEGIN;

CREATE FUNCTION pg_temp.espera_error(p_sql text, p_fragmento text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        IF position(lower(p_fragmento) IN lower(SQLERRM)) > 0 THEN
            RAISE NOTICE 'OK  rechazado: %', left(SQLERRM, 120);
            RETURN;
        END IF;
        RAISE EXCEPTION 'FALLA: se esperaba un error con «%» y llegó: %', p_fragmento, SQLERRM;
    END;
    RAISE EXCEPTION 'FALLA: se esperaba un error con «%» pero pasó: %', p_fragmento, p_sql;
END $$;

-- Para reglas diferidas (se verifican al confirmar): ejecuta y fuerza la verificación.
CREATE FUNCTION pg_temp.espera_error_al_confirmar(p_sql text, p_fragmento text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
        SET CONSTRAINTS ALL IMMEDIATE;
    EXCEPTION WHEN OTHERS THEN
        SET CONSTRAINTS ALL DEFERRED;
        IF position(lower(p_fragmento) IN lower(SQLERRM)) > 0 THEN
            RAISE NOTICE 'OK  rechazado al confirmar: %', left(SQLERRM, 110);
            RETURN;
        END IF;
        RAISE EXCEPTION 'FALLA: se esperaba un error con «%» y llegó: %', p_fragmento, SQLERRM;
    END;
    SET CONSTRAINTS ALL DEFERRED;
    RAISE EXCEPTION 'FALLA: se esperaba un error al confirmar con «%» pero pasó: %', p_fragmento, p_sql;
END $$;

CREATE FUNCTION pg_temp.afirma(p_cond boolean, p_msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_cond IS NOT TRUE THEN
        RAISE EXCEPTION 'FALLA: %', p_msg;
    END IF;
    RAISE NOTICE 'OK  %', p_msg;
END $$;

-- Usuario de la transacción (lo que hará Laravel en cada transacción)
DO $$ BEGIN PERFORM set_config('cargas.usuario_id', '1', true); END $$;

/* ---------------------------------------------------------------------
   Datos base
   --------------------------------------------------------------------- */
INSERT INTO cargas.municipio (codigo, nombre) VALUES ('TEST-01', 'Municipio de prueba');
INSERT INTO cargas.cooperativa (nombre, municipio_id)
    SELECT 'Cooperativa Prueba R.L.', id FROM cargas.municipio WHERE codigo = 'TEST-01';
INSERT INTO cargas.cooperativa (nombre) VALUES ('Otra Cooperativa R.L.');
INSERT INTO cargas.mina (nombre, cooperativa_id, municipio_id)
    SELECT 'Mina de la cooperativa', c.id, c.municipio_id FROM cargas.cooperativa c WHERE c.nombre = 'Cooperativa Prueba R.L.';
INSERT INTO cargas.mina (nombre, propia, municipio_id)
    SELECT 'Mina propia', true, id FROM cargas.municipio WHERE codigo = 'TEST-01';
INSERT INTO cargas.bocamina (mina_id, codigo, nombre)
    SELECT id, 'BM-1', 'Bocamina 1' FROM cargas.mina WHERE nombre = 'Mina propia';
INSERT INTO cargas.productor (tipo, nombre, ci, cooperativa_id)
    SELECT 'COOPERATIVISTA', 'Productor Uno', '1000001', id FROM cargas.cooperativa WHERE nombre = 'Cooperativa Prueba R.L.';
INSERT INTO cargas.productor (tipo, nombre, ci) VALUES ('PARTICULAR', 'Productor Dos', '1000002');
INSERT INTO cargas.laboratorio (nombre, propio) VALUES ('Laboratorio propio', true), ('Laboratorio del productor', false), ('Laboratorio dirimente', false);
INSERT INTO comun.banco (nombre) VALUES ('Banco de prueba');
UPDATE cargas.linea_producto_elemento SET split_limit = 0.5
 WHERE linea_producto_id = (SELECT id FROM cargas.linea_producto WHERE codigo = 'COMPLEJO_ZN_AG')
   AND elemento_id = (SELECT id FROM cargas.elemento WHERE codigo = 'AG');
UPDATE cargas.linea_producto_elemento SET split_limit = 0.6
 WHERE linea_producto_id = (SELECT id FROM cargas.linea_producto WHERE codigo = 'COMPLEJO_ZN_AG')
   AND elemento_id = (SELECT id FROM cargas.elemento WHERE codigo = 'ZN');

DO $$ BEGIN RAISE NOTICE '--- 1. Catálogos ---'; END $$;
DO $$
BEGIN
    PERFORM pg_temp.espera_error(
      $q$INSERT INTO cargas.cooperativa (nombre) VALUES ('  cooperativa   prueba r.l. ')$q$,
      'ux_cooperativa_nombre');
    PERFORM pg_temp.espera_error(
      $q$INSERT INTO cargas.productor (tipo, nombre, ci) VALUES ('COOPERATIVISTA', 'Sin cooperativa', '9')$q$,
      'ck_productor_cooperativa');
    PERFORM pg_temp.espera_error(
      $q$INSERT INTO cargas.productor (tipo, nombre) VALUES ('PARTICULAR', 'Sin documento')$q$,
      'ck_productor_identificacion');
    PERFORM pg_temp.espera_error(
      $q$INSERT INTO cargas.parametro (clave, valor, tipo_dato, vigente_desde) VALUES
         ('TIPO_CAMBIO', '1', 'numero', '2026-01-01'),
         ('TIPO_CAMBIO', '2', 'numero', '2026-06-01')$q$,
      'ex_parametro_solape');
END $$;

/* ---------------------------------------------------------------------
   2. Tablas de precio
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 2. Tablas de precio ---'; END $$;
DO $$
DECLARE
    v_linea bigint := (SELECT id FROM cargas.linea_producto WHERE codigo = 'PLATA_OXI');
    v_ag    bigint := (SELECT id FROM cargas.elemento WHERE codigo = 'AG');
    t_hueco bigint; t_baja bigint; t_ok bigint; t_otra bigint;
BEGIN
    -- Tabla con hueco entre 5 y 6
    INSERT INTO cargas.tabla_precio (linea_producto_id, elemento_id, modalidad, vigente_desde, creado_por)
    VALUES (v_linea, v_ag, 'POR_PUNTO', '2026-01-01', 1) RETURNING id INTO t_hueco;
    INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, precio_punto) VALUES
        (t_hueco, 3, 5, 21), (t_hueco, 6, NULL, 24);
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.tabla_precio SET estado=''APROBADA'', aprobado_por=2, aprobado_en=now() WHERE id=%s', t_hueco),
        'hueco');

    -- Tabla que reproduce el error del sistema anterior (31,03 → 30,64)
    INSERT INTO cargas.tabla_precio (linea_producto_id, elemento_id, modalidad, vigente_desde, creado_por)
    VALUES (v_linea, v_ag, 'POR_PUNTO', '2026-01-01', 1) RETURNING id INTO t_baja;
    INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, precio_punto) VALUES
        (t_baja, 13, 15, 30.86), (t_baja, 15, 16, 31.03), (t_baja, 16, NULL, 30.64);
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.tabla_precio SET estado=''APROBADA'', aprobado_por=2, aprobado_en=now() WHERE id=%s', t_baja),
        'una ley mayor no puede valer menos');

    -- Tramos solapados
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, precio_punto) VALUES (%s, 14, 15.5, 31)', t_baja),
        'ex_tramo_solape');

    -- Tramo de la modalidad equivocada
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, precio_punto, porcentaje_pagable) VALUES (%s, 1, 2, 10, 80)', t_baja),
        'ck_tramo_un_valor');

    -- Tabla correcta
    INSERT INTO cargas.tabla_precio (linea_producto_id, elemento_id, modalidad, vigente_desde, creado_por)
    VALUES (v_linea, v_ag, 'POR_PUNTO', '2026-01-01', 1) RETURNING id INTO t_ok;
    INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, precio_punto) VALUES
        (t_ok, 3, 5, 21), (t_ok, 5, 8, 24), (t_ok, 8, 13, 27), (t_ok, 13, NULL, 30);

    -- Quien la creó no la aprueba
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.tabla_precio SET estado=''APROBADA'', aprobado_por=1, aprobado_en=now() WHERE id=%s', t_ok),
        'ck_tp_segregacion');

    UPDATE cargas.tabla_precio SET estado = 'APROBADA', aprobado_por = 2, aprobado_en = now() WHERE id = t_ok;
    PERFORM pg_temp.afirma(true, 'tabla sin huecos, creciente y aprobada por otro usuario');

    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.tabla_precio_tramo SET precio_punto = 99 WHERE tabla_precio_id = %s AND ley_desde = 5', t_ok),
        'no se pueden modificar');
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.tabla_precio SET factor_conversion = NULL, moneda = ''USD'' WHERE id = %s', t_ok),
        'solo admite cerrar su vigencia');
    PERFORM pg_temp.espera_error(format('DELETE FROM cargas.tabla_precio WHERE id = %s', t_ok),
        'Solo se elimina una tabla de precios en BORRADOR');

    -- Valores
    PERFORM pg_temp.afirma(cargas.valor_por_tm(t_ok, 6.5) = 156.00, 'ley 6,5 × 24 = 156,00 por TM');
    PERFORM pg_temp.afirma(cargas.valor_por_tm(t_ok, 5) = 120.00, 'ley 5 cae en el tramo [5, 8): 5 × 24 = 120,00');
    PERFORM pg_temp.afirma(cargas.valor_por_tm(t_ok, 20) = 600.00, 'último tramo sin tope: 20 × 30 = 600,00');
    PERFORM pg_temp.espera_error(format('SELECT cargas.valor_por_tm(%s, 2)', t_ok), 'no cae en ningún tramo');
    PERFORM pg_temp.afirma(cargas.tabla_precio_vigente(v_linea, v_ag, '2026-10-17') = t_ok, 'tabla vigente encontrada por fecha');

    -- Otra tabla aprobada con vigencia superpuesta: rechazada
    INSERT INTO cargas.tabla_precio (linea_producto_id, elemento_id, modalidad, vigente_desde, creado_por)
    VALUES (v_linea, v_ag, 'POR_PUNTO', '2026-11-01', 1) RETURNING id INTO t_otra;
    INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, precio_punto) VALUES
        (t_otra, 3, NULL, 25);
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.tabla_precio SET estado=''APROBADA'', aprobado_por=2, aprobado_en=now() WHERE id=%s', t_otra),
        'ex_tp_solape');

    -- Cerrando la vigencia de la anterior, la nueva sí entra
    UPDATE cargas.tabla_precio SET vigente_hasta = '2026-11-01' WHERE id = t_ok;
    UPDATE cargas.tabla_precio SET estado = 'APROBADA', aprobado_por = 2, aprobado_en = now() WHERE id = t_otra;
    PERFORM pg_temp.afirma(cargas.tabla_precio_vigente(v_linea, v_ag, '2026-10-31') = t_ok
                       AND cargas.tabla_precio_vigente(v_linea, v_ag, '2026-11-01') = t_otra,
                       'al cerrar la vigencia, cada fecha encuentra su tabla');
END $$;

/* ---------------------------------------------------------------------
   3. Cotizaciones y tabla por porcentaje (sacos)
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 3. Cotizaciones y sacos ---'; END $$;
DO $$
DECLARE
    v_ag    bigint := (SELECT id FROM cargas.elemento WHERE codigo = 'AG');
    v_linea bigint := (SELECT id FROM cargas.linea_producto WHERE codigo = 'SACOS_AG');
    t_sac   bigint; v_cot numeric;
BEGIN
    INSERT INTO cargas.cotizacion (elemento_id, anio, mes, quincena, valor, unidad, registrado_por) VALUES
        (v_ag, 2026, 7, 1, 63.09, 'OT', 1),
        (v_ag, 2026, 7, 2, 64.10, 'OT', 1),
        (v_ag, 2028, 2, 2, 50.00, 'OT', 1);
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.cotizacion (elemento_id, anio, mes, quincena, valor, unidad, registrado_por) VALUES (%s, 2026, 7, 2, 70, ''OT'', 1)', v_ag),
        'uq_cotizacion_periodo');
    PERFORM pg_temp.afirma(cargas.cotizacion_vigente(v_ag, '2026-07-20') = 64.10, 'el 20 de julio usa la 2ª quincena de julio');
    PERFORM pg_temp.afirma(cargas.cotizacion_vigente(v_ag, '2026-07-15') = 63.09, 'el 15 de julio todavía es la 1ª quincena');
    PERFORM pg_temp.afirma((SELECT periodo_hasta FROM cargas.cotizacion WHERE anio = 2028) = DATE '2028-02-29',
                           'la 2ª quincena de febrero de 2028 termina el 29 (bisiesto)');

    INSERT INTO cargas.tabla_precio (linea_producto_id, elemento_id, modalidad, factor_conversion, vigente_desde, creado_por)
    VALUES (v_linea, v_ag, 'POR_PORCENTAJE', 1, '2026-01-01', 1) RETURNING id INTO t_sac;
    INSERT INTO cargas.tabla_precio_tramo (tabla_precio_id, ley_desde, ley_hasta, porcentaje_pagable) VALUES
        (t_sac, 350, 400, 81), (t_sac, 400, 500, 82), (t_sac, 500, NULL, 83);
    UPDATE cargas.tabla_precio SET estado = 'APROBADA', aprobado_por = 2, aprobado_en = now() WHERE id = t_sac;

    v_cot := cargas.cotizacion_vigente(v_ag, '2026-07-05');
    PERFORM pg_temp.afirma(cargas.valor_por_tm(t_sac, 600, v_cot) = 31418.82, 'sacos: 600 × 83% × 63,09 = 31.418,82');
    PERFORM pg_temp.afirma(cargas.valor_por_tm(t_sac, 550, v_cot) < cargas.valor_por_tm(t_sac, 600, v_cot),
                           'sacos: ley 550 paga menos que ley 600 (el error del sistema anterior ya no puede ocurrir)');
    PERFORM pg_temp.espera_error(format('SELECT cargas.valor_por_tm(%s, 600)', t_sac), 'depende de la cotización');
END $$;

/* ---------------------------------------------------------------------
   4. Retenciones
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 4. Retenciones ---'; END $$;
DO $$
DECLARE
    v_cns  bigint := (SELECT id FROM cargas.retencion_concepto WHERE codigo = 'CNS');
    v_coop_c bigint := (SELECT id FROM cargas.retencion_concepto WHERE codigo = 'APORTE_COOPERATIVA');
    v_coop bigint := (SELECT id FROM cargas.cooperativa WHERE nombre = 'Cooperativa Prueba R.L.');
    v_otra bigint := (SELECT id FROM cargas.cooperativa WHERE nombre = 'Otra Cooperativa R.L.');
BEGIN
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.retencion_tasa (concepto_id, porcentaje, vigente_desde) VALUES (%s, 2.0, ''2026-01-01'')', v_cns),
        'ex_rt_solape');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.retencion_tasa (concepto_id, porcentaje, vigente_desde) VALUES (%s, 9, ''2026-01-01'')', v_coop_c),
        'indique la cooperativa');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.retencion_tasa (concepto_id, cooperativa_id, porcentaje, vigente_desde) VALUES (%s, %s, 1.8, ''2026-01-01'')', v_cns, v_coop),
        'no lleva cooperativa');
    INSERT INTO cargas.retencion_tasa (concepto_id, cooperativa_id, porcentaje, vigente_desde) VALUES
        (v_coop_c, v_coop, 9, '2026-01-01'),
        (v_coop_c, v_otra, 5, '2026-01-01');
    PERFORM pg_temp.afirma(true, 'cada cooperativa con su propio aporte, en paralelo');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.retencion_tasa (concepto_id, cooperativa_id, porcentaje, vigente_desde) VALUES (%s, %s, 10, ''2026-06-01'')', v_coop_c, v_coop),
        'ex_rt_solape');
END $$;

/* ---------------------------------------------------------------------
   5. Bono de transporte
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 5. Bono de transporte ---'; END $$;
INSERT INTO cargas.bono_transporte_tramo (tipo_vehiculo, peso_desde_kg, peso_hasta_kg, monto, vigente_desde) VALUES
    ('TONKA',     500,  7000,  50, '2026-01-01'),
    ('SENCILLO', 7000, 10000,  80, '2026-01-01'),
    ('DOBLE',   10000, 13000, 100, '2026-01-01'),
    ('ARAÑA',   13000,  NULL, 150, '2026-01-01');
DO $$
BEGIN
    PERFORM pg_temp.afirma((SELECT monto FROM cargas.bono_transporte_tramo
                             WHERE id = cargas.tramo_bono(6999.50, '2026-10-17')) = 50,
                           '6.999,50 kg cae en TONKA (en el sistema anterior caía en un hueco)');
    PERFORM pg_temp.afirma((SELECT monto FROM cargas.bono_transporte_tramo
                             WHERE id = cargas.tramo_bono(7000, '2026-10-17')) = 80,
                           '7.000 kg exactos ya es SENCILLO');
    PERFORM pg_temp.afirma(cargas.tramo_bono(400, '2026-10-17') IS NULL, '400 kg no tiene bono');
    PERFORM pg_temp.espera_error(
        $q$INSERT INTO cargas.bono_transporte_tramo (tipo_vehiculo, peso_desde_kg, peso_hasta_kg, monto, vigente_desde)
           VALUES ('X', 9000, 11000, 90, '2026-03-01')$q$,
        'ex_btt_solape');
END $$;

/* ---------------------------------------------------------------------
   6. Formato configurable del número de lote
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 6. Formato del número de lote ---'; END $$;
DO $$
DECLARE
    s_czp bigint := (SELECT id FROM cargas.serie_lote WHERE prefijo = 'CZP');
BEGIN
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{PREFIJO}-{AAAA}', 'NUNCA', ARRAY['PREFIJO'])$q$, 'debe incluir el correlativo');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{N}-{N:3}', 'NUNCA', ARRAY[]::text[])$q$, 'solo puede tener un correlativo');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{CLIENTE}-{N}', 'NUNCA', ARRAY['PREFIJO'])$q$, 'Marcador desconocido {CLIENTE}');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{PREFIJO}-{N:4}', 'MENSUAL', ARRAY['PREFIJO'])$q$, 'debe mostrar el año y el mes');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{PREFIJO}-{MM}-{N:4}', 'MENSUAL', ARRAY['PREFIJO'])$q$, 'debe mostrar el año y el mes');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{PREFIJO}-{N:4}', 'ANUAL', ARRAY['PREFIJO'])$q$, 'debe mostrar el año');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('LOTE {N}', 'NUNCA', ARRAY[]::text[])$q$, 'sin espacios');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{AAAA:2}-{N}', 'NUNCA', ARRAY[]::text[])$q$, 'Solo el correlativo admite cantidad de dígitos');
    PERFORM pg_temp.espera_error($q$SELECT comun.validar_formato('{N:12}', 'NUNCA', ARRAY[]::text[])$q$, 'entre 1 y 9 dígitos');
    PERFORM pg_temp.espera_error(format('UPDATE cargas.serie_lote SET formato = %L WHERE id = %s', '{PREFIJO}-{N:4}', s_czp), 'debe mostrar el año y el mes');

    PERFORM pg_temp.afirma(comun.formatear_codigo('{N:2}', DATE '2026-10-17', 123) = '123',
                           'un correlativo más largo que los dígitos pedidos no se trunca (123 con {N:2})');
    PERFORM pg_temp.espera_error($q$SELECT comun.formatear_codigo('{SIGLA}-{N}', DATE '2026-10-17', 1, '{"SIGLA": null}')$q$, 'no tiene valor');

    -- Vistas previas con formatos que todavía no se guardaron
    PERFORM pg_temp.afirma(cargas.vista_previa_codigo_lote(s_czp, '2026-10-17') = 'CZP-202610-0001',
                           'formato por defecto → CZP-202610-0001');
    PERFORM pg_temp.afirma(cargas.vista_previa_codigo_lote(s_czp, '2026-10-17', '{SIGLA}{ORIGEN}-{AA}-{N:5}', 'ANUAL') = 'MACC-26-00001',
                           'vista previa {SIGLA}{ORIGEN}-{AA}-{N:5} → MACC-26-00001');
    PERFORM pg_temp.afirma(cargas.vista_previa_codigo_lote(s_czp, '2026-10-17', 'L{AAAA}{MM}{DD}/{PREFIJO}/{N:3}', 'DIARIO') = 'L20261017/CZP/001',
                           'vista previa con texto fijo y fecha completa → L20261017/CZP/001');
    PERFORM pg_temp.espera_error(format('SELECT cargas.vista_previa_codigo_lote(%s, ''2026-10-17'', ''{PREFIJO}-{N}'', ''DIARIO'')', s_czp),
                           'debe mostrar año, mes y día');
    PERFORM pg_temp.afirma(cargas.vista_previa_codigo_lote(s_czp, '2026-10-17') = 'CZP-202610-0001',
                           'la vista previa no consume números');
END $$;

/* ---------------------------------------------------------------------
   7. Lote: creación, numeración mensual y origen
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 7. Lote ---'; END $$;
DO $$
DECLARE
    s_czp  bigint := (SELECT id FROM cargas.serie_lote WHERE prefijo = 'CZP');
    s_bm   bigint := (SELECT id FROM cargas.serie_lote WHERE prefijo = 'BM');
    p_uno  bigint := (SELECT id FROM cargas.productor WHERE ci = '1000001');
    p_dos  bigint := (SELECT id FROM cargas.productor WHERE ci = '1000002');
    m_coop bigint := (SELECT id FROM cargas.mina WHERE nombre = 'Mina de la cooperativa');
    m_prop bigint := (SELECT id FROM cargas.mina WHERE nombre = 'Mina propia');
    b_prop bigint := (SELECT id FROM cargas.bocamina WHERE codigo = 'BM-1');
    l      cargas.lote;
BEGIN
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.lote (serie_id, almacen_id, fecha_recepcion, registrado_por) VALUES (%s, 1, ''2026-10-17 10:00'', 1)', s_czp),
        'ck_lote_origen');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.lote (serie_id, almacen_id, productor_id, mina_id, registrado_por) VALUES (%s, 1, %s, %s, 1)', s_czp, p_uno, m_prop),
        'es propia');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.lote (serie_id, almacen_id, productor_id, mina_id, bocamina_id, registrado_por) VALUES (%s, 1, %s, %s, %s, 1)', s_bm, p_uno, m_prop, b_prop),
        'ck_lote_origen');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.lote (serie_id, almacen_id, mina_id, bocamina_id, registrado_por) VALUES (%s, 1, %s, %s, 1)', s_bm, m_coop, b_prop),
        'mina propia');

    INSERT INTO cargas.lote (serie_id, almacen_id, fecha_recepcion, productor_id, mina_id, guia_transporte, codigo, registrado_por)
    VALUES (s_czp, 1, '2026-10-17 10:00', p_uno, m_coop, 'G-123', 'CODIGO-A-MANO', 1) RETURNING * INTO l;
    PERFORM pg_temp.afirma(l.codigo = 'CZP-202610-0001',
                           'primer lote CZP-202610-0001: los intentos fallidos no consumieron número y el código no se digita');
    PERFORM pg_temp.afirma(l.cooperativa_id = (SELECT cooperativa_id FROM cargas.productor WHERE id = p_uno),
                           'la cooperativa se copia del productor al recibir');
    PERFORM pg_temp.afirma(l.municipio_id = (SELECT municipio_id FROM cargas.mina WHERE id = m_coop),
                           'el municipio se toma de la mina');

    INSERT INTO cargas.lote (serie_id, almacen_id, fecha_recepcion, productor_id, registrado_por)
    VALUES (s_czp, 1, '2026-10-31 18:00', p_dos, 1) RETURNING * INTO l;
    PERFORM pg_temp.afirma(l.codigo = 'CZP-202610-0002', 'segundo lote de octubre → CZP-202610-0002');
    INSERT INTO cargas.lote (serie_id, almacen_id, fecha_recepcion, productor_id, registrado_por)
    VALUES (s_czp, 1, '2026-11-02 08:00', p_dos, 1) RETURNING * INTO l;
    PERFORM pg_temp.afirma(l.codigo = 'CZP-202611-0001', 'en noviembre el correlativo vuelve a 1 → CZP-202611-0001');

    INSERT INTO cargas.lote (serie_id, almacen_id, fecha_recepcion, mina_id, bocamina_id, registrado_por)
    VALUES (s_bm, 1, '2026-10-17 11:00', m_prop, b_prop, 1) RETURNING * INTO l;
    PERFORM pg_temp.afirma(l.codigo = 'BM-202610-0001' AND l.origen = 'PROPIA', 'lote de bocamina propia BM-202610-0001 (serie con su propio contador)');

    -- Cambiar el formato de una serie desde la interfaz
    UPDATE cargas.serie_lote SET formato = '{SIGLA}{ORIGEN}-{AA}-{N:5}', reinicio = 'ANUAL' WHERE id = s_czp;
    INSERT INTO cargas.lote (serie_id, almacen_id, fecha_recepcion, productor_id, registrado_por)
    VALUES (s_czp, 1, '2026-11-03 08:00', p_dos, 1) RETURNING * INTO l;
    PERFORM pg_temp.afirma(l.codigo = 'MACC-26-00001', 'con el formato nuevo, el siguiente lote sale MACC-26-00001');

    PERFORM pg_temp.espera_error(
        $q$UPDATE cargas.lote SET codigo = 'CZP-99999' WHERE codigo = 'CZP-202610-0001'$q$, 'no se pueden modificar');
    PERFORM pg_temp.espera_error(
        $q$DELETE FROM cargas.lote WHERE codigo = 'CZP-202610-0001'$q$, 'no se eliminan');
END $$;

/* ---------------------------------------------------------------------
   8. Pesaje y muestreo
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 8. Pesaje y muestreo ---'; END $$;
DO $$
DECLARE
    v_lote bigint := (SELECT id FROM cargas.lote WHERE codigo = 'CZP-202610-0001');
    v_pes  bigint; v_mue bigint;
    b      cargas.bono_transporte;
BEGIN
    PERFORM pg_temp.espera_error(
        $q$UPDATE cargas.lote SET estado = 'ANALIZADO' WHERE codigo = 'CZP-202610-0001'$q$, 'Transición no permitida');
    PERFORM pg_temp.espera_error(
        $q$UPDATE cargas.lote SET estado = 'MUESTREADO' WHERE codigo = 'CZP-202610-0001'$q$, 'pesaje de ingreso');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.pesaje (lote_id, bascula, ticket, peso_bruto_kg, tara_kg, registrado_por) VALUES (%s, ''POTOSI'', ''T-1'', 4300, 4300, 1)', v_lote),
        'ck_pesaje_pesos');

    INSERT INTO cargas.pesaje (lote_id, bascula, ticket, peso_bruto_kg, tara_kg, num_sacos, placa, chofer_nombre, chofer_ci, registrado_por)
    VALUES (v_lote, 'POTOSI', 'T-1', 12500, 4300, 160, '1234ABC', 'Chofer de prueba', '555', 1)
    RETURNING id INTO v_pes;
    PERFORM pg_temp.afirma((SELECT peso_neto_kg FROM cargas.pesaje WHERE id = v_pes) = 8200, 'peso neto = 12.500 − 4.300 = 8.200 kg (calculado por la base)');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.pesaje (lote_id, bascula, ticket, peso_bruto_kg, tara_kg, registrado_por) VALUES (%s, ''POTOSI'', ''T-1'', 9000, 3000, 1)', v_lote),
        'uq_pesaje_ticket');
    PERFORM pg_temp.espera_error(format('UPDATE cargas.pesaje SET peso_bruto_kg = 13000 WHERE id = %s', v_pes),
        'se anula y se registra otro');

    INSERT INTO cargas.bono_transporte (pesaje_id, beneficiario_nombre, monto, registrado_por)
    VALUES (v_pes, NULL, 999999, 1) RETURNING * INTO b;
    PERFORM pg_temp.afirma(b.monto = 80 AND b.estado = 'PENDIENTE' AND b.beneficiario_nombre = 'Chofer de prueba',
                           'bono de 8.200 kg = 80 (SENCILLO), PENDIENTE de pago; el monto digitado se ignora');
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.bono_transporte SET estado = ''PAGADO'' WHERE id = %s', b.id), 'indique el comprobante de caja');

    PERFORM pg_temp.espera_error(
        $q$UPDATE cargas.lote SET estado = 'MUESTREADO' WHERE codigo = 'CZP-202610-0001'$q$, 'no tiene muestra');
    INSERT INTO cargas.muestra (lote_id, metodo, registrado_por) VALUES (v_lote, 'CUARTEO', 1) RETURNING id INTO v_mue;
    PERFORM pg_temp.afirma((SELECT codigo FROM cargas.muestra WHERE id = v_mue) = 'CZP-202610-0001-M1', 'código de muestra CZP-202610-0001-M1');
    INSERT INTO cargas.muestra_porcion (muestra_id, destino, precinto) VALUES
        (v_mue, 'EMPRESA', 'P-001'), (v_mue, 'PRODUCTOR', 'P-002'), (v_mue, 'TESTIGO', 'P-003');

    UPDATE cargas.lote SET estado = 'MUESTREADO' WHERE id = v_lote;
    PERFORM pg_temp.afirma(true, 'lote pasa a MUESTREADO con pesaje y muestra');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.pesaje (lote_id, bascula, ticket, peso_bruto_kg, tara_kg, registrado_por) VALUES (%s, ''POTOSI'', ''T-2'', 9000, 3000, 1)', v_lote),
        'solo se registran o anulan mientras está RECIBIDO');
    INSERT INTO cargas.pesaje (lote_id, tipo, bascula, ticket, peso_bruto_kg, tara_kg, registrado_por)
    VALUES (v_lote, 'CONTROL', 'POTOSI', 'T-3', 12480, 4300, 1);
    PERFORM pg_temp.afirma(true, 'repesaje de CONTROL admitido después del muestreo');
END $$;

/* ---------------------------------------------------------------------
   9. Análisis y ley final
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 9. Análisis y ley final ---'; END $$;
DO $$
DECLARE
    v_lote bigint := (SELECT id FROM cargas.lote WHERE codigo = 'CZP-202610-0001');
    v_mue  bigint := (SELECT id FROM cargas.muestra WHERE codigo = 'CZP-202610-0001-M1');
    e_ag bigint := (SELECT id FROM cargas.elemento WHERE codigo = 'AG');
    e_zn bigint := (SELECT id FROM cargas.elemento WHERE codigo = 'ZN');
    e_h2o bigint := (SELECT id FROM cargas.elemento WHERE codigo = 'H2O');
    lab_p bigint := (SELECT id FROM cargas.laboratorio WHERE nombre = 'Laboratorio propio');
    lab_r bigint := (SELECT id FROM cargas.laboratorio WHERE nombre = 'Laboratorio del productor');
    lab_d bigint := (SELECT id FROM cargas.laboratorio WHERE nombre = 'Laboratorio dirimente');
    a_emp bigint; a_pro bigint; a_dir bigint;
    c record;
BEGIN
    INSERT INTO cargas.analisis (muestra_id, laboratorio_id, tipo, numero_certificado, registrado_por)
    VALUES (v_mue, lab_p, 'EMPRESA', 'E-100', 1) RETURNING id INTO a_emp;
    INSERT INTO cargas.analisis_resultado (analisis_id, elemento_id, valor) VALUES
        (a_emp, e_ag, 10.20), (a_emp, e_zn, 18.50), (a_emp, e_h2o, 7.00);
    INSERT INTO cargas.analisis (muestra_id, laboratorio_id, tipo, numero_certificado, registrado_por)
    VALUES (v_mue, lab_r, 'PRODUCTOR', 'R-200', 1) RETURNING id INTO a_pro;
    INSERT INTO cargas.analisis_resultado (analisis_id, elemento_id, valor) VALUES
        (a_pro, e_ag, 10.90), (a_pro, e_zn, 18.70), (a_pro, e_h2o, 7.20);

    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.analisis (muestra_id, laboratorio_id, tipo, numero_certificado, registrado_por) VALUES (%s, %s, ''EMPRESA'', ''E-101'', 1)', v_mue, lab_p),
        'ux_analisis_vigente');

    SELECT * INTO c FROM cargas.v_lote_comparacion_leyes WHERE lote_id = v_lote AND elemento = 'AG';
    PERFORM pg_temp.afirma(c.diferencia = 0.70 AND c.excede_split_limit, 'Ag: diferencia 0,70 > split limit 0,50 → va a dirimencia');
    SELECT * INTO c FROM cargas.v_lote_comparacion_leyes WHERE lote_id = v_lote AND elemento = 'ZN';
    PERFORM pg_temp.afirma(c.diferencia = 0.20 AND NOT c.excede_split_limit AND c.promedio = 18.60,
                           'Zn: diferencia 0,20 dentro del split limit 0,60 → promedio 18,60');

    PERFORM pg_temp.espera_error(
        $q$UPDATE cargas.lote SET estado = 'ANALIZADO' WHERE codigo = 'CZP-202610-0001'$q$, 'Falta la ley final de: AG, H2O, ZN');

    INSERT INTO cargas.analisis (muestra_id, laboratorio_id, tipo, numero_certificado, registrado_por)
    VALUES (v_mue, lab_d, 'DIRIMENTE', 'D-300', 1) RETURNING id INTO a_dir;
    INSERT INTO cargas.analisis_resultado (analisis_id, elemento_id, valor) VALUES (a_dir, e_ag, 10.50);
    INSERT INTO cargas.lote_ley (lote_id, elemento_id, valor, criterio, analisis_dirimente_id, determinado_por) VALUES
        (v_lote, e_h2o, 7.10, 'PROMEDIO', NULL, 1),
        (v_lote, e_zn, 18.60, 'PROMEDIO', NULL, 1),
        (v_lote, e_ag, 10.50, 'DIRIMENTE', a_dir, 1);

    UPDATE cargas.lote SET estado = 'ANALIZADO' WHERE id = v_lote;
    PERFORM pg_temp.afirma(true, 'lote pasa a ANALIZADO con humedad y leyes pagables');

    PERFORM pg_temp.afirma((SELECT peso_neto_seco_kg FROM cargas.v_lote_resumen WHERE lote = 'CZP-202610-0001') = 7617.80,
                           'peso seco = 8.200 × (1 − 7,10%) = 7.617,80 kg');
    PERFORM pg_temp.afirma((SELECT string_agg(estado_nuevo, '→' ORDER BY id) FROM cargas.lote_evento WHERE lote_id = v_lote)
                           = 'RECIBIDO→MUESTREADO→ANALIZADO', 'bitácora: RECIBIDO→MUESTREADO→ANALIZADO');
END $$;

/* ---------------------------------------------------------------------
   10. Caja: apertura y movimientos
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 10. Caja: apertura y movimientos ---'; END $$;
INSERT INTO caja.caja (codigo, nombre, almacen_id, maneja_usd) VALUES ('CP', 'Caja Potosí', 1, true);
INSERT INTO caja.concepto (codigo, nombre, tipo) VALUES
    ('PAGO_SERVICIOS', 'Pago de servicios básicos', 'EGRESO');
DO $$
DECLARE
    v_caja  bigint := (SELECT id FROM caja.caja WHERE codigo = 'CP');
    k_rep   bigint := (SELECT id FROM caja.concepto WHERE codigo = 'REPOSICION_FONDOS');
    k_serv  bigint := (SELECT id FROM caja.concepto WHERE codigo = 'PAGO_SERVICIOS');
    v_ses   bigint;
    m       caja.movimiento;
BEGIN
    PERFORM pg_temp.espera_error(
        $q$INSERT INTO caja.concepto (codigo, nombre, tipo) VALUES ('X', '  pago de  servicios básicos', 'EGRESO')$q$,
        'ux_concepto_nombre');
    PERFORM pg_temp.espera_error(
        $q$UPDATE caja.caja SET formato_comprobante = '{CAJA}-{N}', reinicio_comprobante = 'MENSUAL' WHERE codigo = 'CP'$q$,
        'debe mostrar el año y el mes');

    INSERT INTO caja.sesion (caja_id, abierta_por) VALUES (v_caja, 1) RETURNING id INTO v_ses;
    PERFORM pg_temp.afirma((SELECT numero FROM caja.sesion WHERE id = v_ses) = 1, 'primera apertura de la caja CP: sesión 1');
    PERFORM pg_temp.espera_error(format('INSERT INTO caja.sesion (caja_id, abierta_por) VALUES (%s, 1)', v_caja),
        'ux_sesion_una_abierta');

    INSERT INTO caja.sesion_saldo (sesion_id, moneda, saldo_inicial) VALUES (v_ses, 'BOB', 1000), (v_ses, 'USD', 100);

    PERFORM pg_temp.espera_error(format(
        'INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo) VALUES (%s, %s, 1500, ''Proveedor'', ''Luz'', 1, 0, ''x'', ''EGRESO'')', v_ses, k_serv),
        'Saldo insuficiente');

    INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo, fecha)
    VALUES (v_ses, k_rep, 20000, 'Gerencia', 'Fondos para compras', 1, 0, 'x', 'x', '2026-10-17 08:00') RETURNING * INTO m;
    PERFORM pg_temp.afirma(m.numero = 'CP-2026-000001' AND m.tipo = 'INGRESO',
                           'comprobante CP-2026-000001; el tipo lo pone el concepto (INGRESO)');

    INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo, fecha)
    VALUES (v_ses, k_serv, 300, 'Proveedor de luz', 'Factura de luz', 1, 0, 'x', 'x', '2026-10-17 09:00') RETURNING * INTO m;
    PERFORM pg_temp.espera_error(format('UPDATE caja.movimiento SET monto = 350 WHERE id = %s', m.id), 'no se corrige');
    PERFORM pg_temp.espera_error(format('DELETE FROM caja.movimiento WHERE id = %s', m.id), 'no se eliminan');
    UPDATE caja.movimiento SET estado = 'ANULADO', anulado_por = 1, anulado_en = now(), motivo_anulacion = 'Factura duplicada' WHERE id = m.id;
    PERFORM pg_temp.afirma(caja.saldo_efectivo(v_ses, 'BOB') = 21000, 'saldo BOB = 1.000 + 20.000 (el egreso anulado no cuenta)');

    PERFORM pg_temp.espera_error(format(
        'INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, forma_pago, persona_nombre, glosa, registrado_por, caja_id, numero, tipo) VALUES (%s, %s, 50, ''CHEQUE'', ''x'', ''x'', 1, 0, ''x'', ''x'')', v_ses, k_serv),
        'ck_mov_documento');
END $$;

/* ---------------------------------------------------------------------
   11. Anticipos y bonos pagados por caja
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 11. Anticipos y bonos pagados por caja ---'; END $$;
DO $$
DECLARE
    v_ses   bigint := (SELECT id FROM caja.sesion WHERE estado = 'ABIERTA');
    k_ant   bigint := (SELECT id FROM caja.concepto WHERE codigo = 'ANTICIPO_COMPRA');
    k_dev   bigint := (SELECT id FROM caja.concepto WHERE codigo = 'DEVOLUCION_ANTICIPO');
    k_bono  bigint := (SELECT id FROM caja.concepto WHERE codigo = 'BONO_TRANSPORTE');
    k_serv  bigint := (SELECT id FROM caja.concepto WHERE codigo = 'PAGO_SERVICIOS');
    v_lote  bigint := (SELECT id FROM cargas.lote WHERE codigo = 'CZP-202610-0001');
    v_bm    bigint := (SELECT id FROM cargas.lote WHERE codigo = 'BM-202610-0001');
    v_bono  bigint := (SELECT id FROM cargas.bono_transporte LIMIT 1);
    a       cargas.anticipo;
    v_mov   bigint; v_mov_mal bigint; v_mov_dev bigint; v_mov_bono bigint;
BEGIN
    -- Sin lote no hay anticipo
    PERFORM pg_temp.espera_error(
        $q$INSERT INTO cargas.anticipo (productor_id, monto, concepto, registrado_por) VALUES (1, 1000, 'x', 1)$q$,
        'null value in column "lote_id"');
    PERFORM pg_temp.espera_error(format(
        'INSERT INTO cargas.anticipo (lote_id, monto, concepto, registrado_por) VALUES (%s, 1000, ''x'', 1)', v_bm),
        'producción propia');

    -- Un "anticipo" pagado por caja sin vincularlo a un lote: rechazado al confirmar
    PERFORM pg_temp.espera_error_al_confirmar(format(
        'INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo) VALUES (%s, %s, 500, ''Productor'', ''Anticipo suelto'', 1, 0, ''x'', ''x'')', v_ses, k_ant),
        'no está vinculado a ningún anticipo');

    INSERT INTO cargas.anticipo (lote_id, monto, concepto, registrado_por, fecha)
    VALUES (v_lote, 5000, 'Anticipo a cuenta de la carga', 1, '2026-10-17') RETURNING * INTO a;
    PERFORM pg_temp.afirma(a.numero = 'ANT-2026-00001' AND a.productor_id = (SELECT productor_id FROM cargas.lote WHERE id = v_lote),
                           'anticipo ANT-2026-00001; el productor sale del lote');
    PERFORM pg_temp.espera_error(format('UPDATE cargas.anticipo SET lote_id = %s WHERE id = %s',
        (SELECT id FROM cargas.lote WHERE codigo = 'CZP-202610-0002'), a.id), 'no se modifican');
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.anticipo SET estado = ''AUTORIZADO'', autorizado_por = 1, autorizado_en = now() WHERE id = %s', a.id),
        'ck_anticipo_segregacion');
    UPDATE cargas.anticipo SET estado = 'AUTORIZADO', autorizado_por = 2, autorizado_en = now() WHERE id = a.id;

    -- Pago con un comprobante equivocado: monto distinto / concepto que no es de anticipo
    INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo)
    VALUES (v_ses, k_serv, 5000, 'Productor Uno', 'Mal concepto', 1, 0, 'x', 'x') RETURNING id INTO v_mov_mal;
    PERFORM pg_temp.espera_error(format(
        'UPDATE cargas.anticipo SET estado = ''PAGADO'', movimiento_pago_id = %s WHERE id = %s', v_mov_mal, a.id),
        'no corresponde');

    INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, persona_ci, glosa, registrado_por, caja_id, numero, tipo)
    VALUES (v_ses, k_ant, 5000, 'Productor Uno', '1000001', 'Anticipo ANT-2026-00001', 1, 0, 'x', 'x') RETURNING id INTO v_mov;
    UPDATE cargas.anticipo SET estado = 'PAGADO', movimiento_pago_id = v_mov WHERE id = a.id;
    SET CONSTRAINTS ALL IMMEDIATE;      -- el egreso de anticipo está vinculado: la regla diferida pasa
    SET CONSTRAINTS ALL DEFERRED;
    PERFORM pg_temp.afirma(true, 'anticipo pagado con su egreso de caja vinculado');
    PERFORM pg_temp.afirma(caja.saldo_efectivo(v_ses, 'BOB') = 11000, 'saldo BOB = 21.000 − 5.000 (servicio mal cargado) − 5.000 (anticipo)');

    PERFORM pg_temp.espera_error(format(
        'UPDATE caja.movimiento SET estado = ''ANULADO'', anulado_por = 1, anulado_en = now(), motivo_anulacion = ''x'' WHERE id = %s', v_mov),
        'respalda el anticipo ANT-2026-00001');
    PERFORM pg_temp.afirma((SELECT total FROM cargas.v_lote_anticipos_a_descontar WHERE lote = 'CZP-202610-0001') = 5000,
                           'la liquidación del lote deberá descontar 5.000');
    PERFORM pg_temp.espera_error(
        $q$UPDATE cargas.lote SET estado = 'ANULADO', anulado_por = 2, anulado_en = now(), motivo_anulacion = 'Carga rechazada por calidad' WHERE codigo = 'CZP-202610-0001'$q$,
        'tiene anticipos pendientes o pagados');

    -- Devolución del anticipo (ingreso a caja)
    INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo)
    VALUES (v_ses, k_dev, 5000, 'Productor Uno', 'Devuelve ANT-2026-00001', 1, 0, 'x', 'x') RETURNING id INTO v_mov_dev;
    UPDATE cargas.anticipo SET estado = 'DEVUELTO', movimiento_devolucion_id = v_mov_dev WHERE id = a.id;
    PERFORM pg_temp.afirma(NOT EXISTS (SELECT 1 FROM cargas.v_lote_anticipos_a_descontar WHERE lote = 'CZP-202610-0001'),
                           'el anticipo devuelto ya no se descuenta en la liquidación');

    -- Bono de transporte pagado por caja
    INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo)
    VALUES (v_ses, k_bono, 80, 'Chofer de prueba', 'Bono viaje T-1', 1, 0, 'x', 'x') RETURNING id INTO v_mov_bono;
    UPDATE cargas.bono_transporte SET estado = 'PAGADO', movimiento_caja_id = v_mov_bono WHERE id = v_bono;
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;
    PERFORM pg_temp.afirma(true, 'bono pagado con su egreso de caja vinculado');

    -- Otro anticipo, pendiente, para la vista del productor
    INSERT INTO cargas.anticipo (lote_id, monto, concepto, registrado_por) VALUES (v_lote, 1500, 'Segundo', 1);
    PERFORM pg_temp.afirma((SELECT devuelto = 5000 AND por_pagar = 1500 FROM cargas.v_productor_anticipos
                             WHERE productor_id = (SELECT productor_id FROM cargas.lote WHERE id = v_lote)),
                           'cuenta del productor: 5.000 devuelto, 1.500 por pagar');
END $$;

/* ---------------------------------------------------------------------
   12. Caja: cierre, validación y continuidad
   --------------------------------------------------------------------- */
DO $$ BEGIN RAISE NOTICE '--- 12. Caja: cierre y validación ---'; END $$;
DO $$
DECLARE
    v_caja bigint := (SELECT id FROM caja.caja WHERE codigo = 'CP');
    v_ses  bigint := (SELECT id FROM caja.sesion WHERE estado = 'ABIERTA');
    v_nueva bigint;
    r record;
BEGIN
    -- Esperado BOB: 21.000 − 5.000 − 5.000 + 5.000 − 80 = 15.920 ; USD: 100
    PERFORM pg_temp.afirma(caja.saldo_efectivo(v_ses, 'BOB') = 15920, 'efectivo esperado BOB = 15.920');

    PERFORM pg_temp.espera_error(format(
        'UPDATE caja.sesion SET estado = ''CERRADA'', cerrada_por = 1, cerrada_en = now() WHERE id = %s', v_ses),
        'Falta declarar el efectivo contado en BOB');

    UPDATE caja.sesion_saldo SET saldo_contado = 15900 WHERE sesion_id = v_ses AND moneda = 'BOB';
    UPDATE caja.sesion_saldo SET saldo_contado = 100   WHERE sesion_id = v_ses AND moneda = 'USD';
    PERFORM pg_temp.espera_error(format(
        'UPDATE caja.sesion_saldo SET saldo_inicial = 5000 WHERE sesion_id = %s AND moneda = ''BOB''', v_ses),
        'no se modifica');

    INSERT INTO caja.arqueo (sesion_id, moneda, denominacion, cantidad) VALUES
        (v_ses, 'BOB', 200, 79), (v_ses, 'BOB', 100, 1);     -- 15.900
    INSERT INTO caja.arqueo (sesion_id, moneda, denominacion, cantidad) VALUES
        (v_ses, 'USD', 100, 1);
    UPDATE caja.arqueo SET cantidad = 78 WHERE sesion_id = v_ses AND moneda = 'BOB' AND denominacion = 200;
    PERFORM pg_temp.espera_error(format(
        'UPDATE caja.sesion SET estado = ''CERRADA'', cerrada_por = 1, cerrada_en = now(), observaciones = ''Faltan 20 bolivianos'' WHERE id = %s', v_ses),
        'El arqueo de BOB suma 15700.00 pero se declararon 15900.00');
    UPDATE caja.arqueo SET cantidad = 79 WHERE sesion_id = v_ses AND moneda = 'BOB' AND denominacion = 200;

    PERFORM pg_temp.espera_error(format(
        'UPDATE caja.sesion SET estado = ''CERRADA'', cerrada_por = 1, cerrada_en = now() WHERE id = %s', v_ses),
        'explique la diferencia');
    UPDATE caja.sesion SET estado = 'CERRADA', cerrada_por = 1, cerrada_en = now(),
           observaciones = 'Faltan 20 Bs: vuelto mal entregado en el bono' WHERE id = v_ses;

    SELECT * INTO r FROM caja.v_sesion_resumen WHERE sesion_id = v_ses AND moneda = 'BOB';
    PERFORM pg_temp.afirma(r.saldo_esperado = 15920 AND r.saldo_contado = 15900 AND r.diferencia = -20,
                           'cierre BOB: esperado 15.920, contado 15.900, faltante −20');
    PERFORM pg_temp.afirma(r.egresos_no_efectivo = 0 AND r.ingresos_efectivo = 25000,
                           'resumen: ingresos en efectivo 25.000 (reposición + devolución)');

    PERFORM pg_temp.espera_error(format(
        'INSERT INTO caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo) VALUES (%s, %s, 10, ''x'', ''x'', 1, 0, ''x'', ''x'')',
        v_ses, (SELECT id FROM caja.concepto WHERE codigo = 'REPOSICION_FONDOS')),
        'no admite movimientos');
    PERFORM pg_temp.espera_error(format(
        'UPDATE caja.sesion SET estado = ''VALIDADA'', validada_por = 1, validada_en = now() WHERE id = %s', v_ses),
        'ck_sesion_segregacion');
    UPDATE caja.sesion SET estado = 'VALIDADA', validada_por = 2, validada_en = now() WHERE id = v_ses;
    PERFORM pg_temp.afirma(true, 'cierre validado por un supervisor distinto del cajero');

    -- La siguiente apertura arranca con lo CONTADO, aunque se intente poner otro monto
    INSERT INTO caja.sesion (caja_id, abierta_por) VALUES (v_caja, 1) RETURNING id INTO v_nueva;
    INSERT INTO caja.sesion_saldo (sesion_id, moneda, saldo_inicial) VALUES (v_nueva, 'BOB', 99999);
    PERFORM pg_temp.afirma((SELECT saldo_inicial FROM caja.sesion_saldo WHERE sesion_id = v_nueva AND moneda = 'BOB') = 15900
                       AND (SELECT numero FROM caja.sesion WHERE id = v_nueva) = 2,
                           'sesión 2 arranca con 15.900 (lo contado al cerrar la 1), no con lo que se digitó');
END $$;

DO $$ BEGIN RAISE NOTICE '=== TODAS LAS PRUEBAS PASARON ==='; END $$;
ROLLBACK;
