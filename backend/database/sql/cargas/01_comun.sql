/* =====================================================================
   01 — ESQUEMA comun: piezas compartidas entre módulos (PostgreSQL 16)
   ---------------------------------------------------------------------
   - Motor de numeración configurable (lotes, comprobantes de caja,
     anticipos): el formato se define desde la interfaz, sin tocar código.
   - Catálogo de bancos (lo usan caja y cargas).
   ===================================================================== */

BEGIN;

CREATE SCHEMA IF NOT EXISTS comun;

/* =====================================================================
   MOTOR DE NUMERACIÓN
   ---------------------------------------------------------------------
   Un FORMATO es texto con marcadores entre llaves:
       {AAAA} año (2026)        {AA} año corto (26)
       {MM}   mes (01-12)       {DD} día (01-31)
       {N}    correlativo       {N:4} correlativo con 4 dígitos (0001)
       {OTRO} cualquier dato que el módulo entregue (p. ej. {PREFIJO},
              {LINEA}, {SIGLA}, {CAJA}); cada módulo declara cuáles admite.
   Todo lo que está fuera de llaves se copia tal cual (letras, números,
   guion, punto, barra o guion bajo; sin espacios).

   Un REINICIO dice cuándo el correlativo vuelve a 1:
       NUNCA · ANUAL · MENSUAL · DIARIO
   Para que no se repitan códigos, el formato debe mostrar el período que
   reinicia: MENSUAL exige {MM} y un año; ANUAL exige un año; DIARIO exige
   día, mes y año. Se valida al guardar el formato.

   Ejemplo:  formato '{PREFIJO}-{AA}{MM}-{N:4}', reinicio MENSUAL
             → CZP-2610-0001, CZP-2610-0002 … y en noviembre CZP-2611-0001

   El número se toma dentro de la transacción del documento: si el
   documento no llega a guardarse, el número tampoco se consume.
   ===================================================================== */

CREATE TABLE comun.contador (
    clave         varchar(80) NOT NULL,
    periodo       varchar(10) NOT NULL,
    ultimo_numero integer NOT NULL CHECK (ultimo_numero >= 0),
    updated_at    timestamp(0) NOT NULL DEFAULT now(),
    PRIMARY KEY (clave, periodo)
);
COMMENT ON TABLE comun.contador IS
  'Último número usado por cada numeración y período. clave = "<tabla>:<id>"; periodo = "-", "2026", "2026-10" o "2026-10-17" según el reinicio.';

CREATE FUNCTION comun.periodo_de(p_reinicio varchar, p_fecha date) RETURNS varchar
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN CASE p_reinicio
        WHEN 'NUNCA'   THEN '-'
        WHEN 'ANUAL'   THEN to_char(p_fecha, 'YYYY')
        WHEN 'MENSUAL' THEN to_char(p_fecha, 'YYYY-MM')
        WHEN 'DIARIO'  THEN to_char(p_fecha, 'YYYY-MM-DD')
    END;
END $$;

-- Valida un formato. p_datos = marcadores propios que admite el módulo.
CREATE FUNCTION comun.validar_formato(p_formato varchar, p_reinicio varchar, p_datos text[])
RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    m          text[];
    v_n        integer := 0;
    v_anio     boolean := false;
    v_mes      boolean := false;
    v_dia      boolean := false;
    v_resto    text;
BEGIN
    IF p_formato IS NULL OR btrim(p_formato) = '' THEN
        RAISE EXCEPTION 'El formato no puede estar vacío.';
    END IF;
    IF length(p_formato) > 60 THEN
        RAISE EXCEPTION 'El formato no puede pasar de 60 caracteres.';
    END IF;
    IF p_reinicio NOT IN ('NUNCA','ANUAL','MENSUAL','DIARIO') THEN
        RAISE EXCEPTION 'Reinicio «%» no válido: use NUNCA, ANUAL, MENSUAL o DIARIO.', p_reinicio;
    END IF;

    FOR m IN SELECT regexp_matches(p_formato, '\{([A-Za-z]+)(:([0-9]+))?\}', 'g') LOOP
        IF m[1] = 'N' THEN
            v_n := v_n + 1;
            IF m[3] IS NOT NULL AND (m[3]::int < 1 OR m[3]::int > 9) THEN
                RAISE EXCEPTION 'El correlativo {N:%} debe tener entre 1 y 9 dígitos.', m[3];
            END IF;
        ELSIF m[3] IS NOT NULL THEN
            RAISE EXCEPTION 'Solo el correlativo admite cantidad de dígitos ({N:4}); «{%:%}» no.', m[1], m[3];
        ELSIF m[1] IN ('AAAA','AA') THEN v_anio := true;
        ELSIF m[1] = 'MM' THEN v_mes := true;
        ELSIF m[1] = 'DD' THEN v_dia := true;
        ELSIF NOT (m[1] = ANY (COALESCE(p_datos, '{}'))) THEN
            RAISE EXCEPTION 'Marcador desconocido {%}. Disponibles: {AAAA} {AA} {MM} {DD} {N} {N:k}%',
                m[1], COALESCE(' ' || (SELECT string_agg('{' || d || '}', ' ') FROM unnest(p_datos) d), '');
        END IF;
    END LOOP;

    IF v_n = 0 THEN
        RAISE EXCEPTION 'El formato debe incluir el correlativo {N} (por ejemplo {N:4}).';
    END IF;
    IF v_n > 1 THEN
        RAISE EXCEPTION 'El formato solo puede tener un correlativo {N}.';
    END IF;

    v_resto := regexp_replace(p_formato, '\{([A-Za-z]+)(:([0-9]+))?\}', '', 'g');
    IF v_resto !~ '^[A-Za-z0-9._/-]*$' THEN
        RAISE EXCEPTION 'El texto fijo del formato solo admite letras, números, guion, punto, barra y guion bajo (sin espacios ni llaves sueltas): «%».', v_resto;
    END IF;

    IF p_reinicio = 'ANUAL' AND NOT v_anio THEN
        RAISE EXCEPTION 'Con reinicio ANUAL el formato debe mostrar el año ({AAAA} o {AA}); si no, los códigos se repetirían cada año.';
    END IF;
    IF p_reinicio = 'MENSUAL' AND NOT (v_anio AND v_mes) THEN
        RAISE EXCEPTION 'Con reinicio MENSUAL el formato debe mostrar el año y el mes ({AAAA}/{AA} y {MM}); si no, los códigos se repetirían.';
    END IF;
    IF p_reinicio = 'DIARIO' AND NOT (v_anio AND v_mes AND v_dia) THEN
        RAISE EXCEPTION 'Con reinicio DIARIO el formato debe mostrar año, mes y día.';
    END IF;
END $$;

-- Arma el código con un número dado (no consume nada).
CREATE FUNCTION comun.formatear_codigo(p_formato varchar, p_fecha date, p_numero integer, p_datos jsonb DEFAULT '{}')
RETURNS varchar LANGUAGE plpgsql STABLE AS $$
DECLARE
    v      text := p_formato;
    v_dig  text;
    k      text;
    val    text;
BEGIN
    v := replace(v, '{AAAA}', to_char(p_fecha, 'YYYY'));
    v := replace(v, '{AA}',   to_char(p_fecha, 'YY'));
    v := replace(v, '{MM}',   to_char(p_fecha, 'MM'));
    v := replace(v, '{DD}',   to_char(p_fecha, 'DD'));

    v_dig := (regexp_match(v, '\{N(?::([0-9]+))?\}'))[1];
    -- Si el número supera los dígitos pedidos, se muestra completo (nunca se trunca).
    v := regexp_replace(v, '\{N(:[0-9]+)?\}',
             lpad(p_numero::text, greatest(COALESCE(v_dig::int, 1), length(p_numero::text)), '0'));

    FOR k, val IN SELECT key, value FROM jsonb_each_text(COALESCE(p_datos, '{}')) LOOP
        IF position('{' || k || '}' IN v) > 0 THEN
            IF val IS NULL OR btrim(val) = '' THEN
                RAISE EXCEPTION 'El formato usa {%} pero ese dato no tiene valor.', k;
            END IF;
            v := replace(v, '{' || k || '}', val);
        END IF;
    END LOOP;

    IF v ~ '[{}]' THEN
        RAISE EXCEPTION 'Quedaron marcadores sin reemplazar en el código «%».', v;
    END IF;
    RETURN v;
END $$;

-- Toma el siguiente número de una numeración (lo consume).
CREATE FUNCTION comun.siguiente_numero(p_clave varchar, p_periodo varchar DEFAULT '-')
RETURNS integer LANGUAGE sql AS $$
    INSERT INTO comun.contador AS c (clave, periodo, ultimo_numero)
    VALUES (p_clave, p_periodo, 1)
    ON CONFLICT (clave, periodo)
    DO UPDATE SET ultimo_numero = c.ultimo_numero + 1, updated_at = now()
    RETURNING ultimo_numero
$$;

-- Genera el código definitivo: valida, toma el número y arma el texto.
CREATE FUNCTION comun.generar_codigo(p_clave varchar, p_formato varchar, p_reinicio varchar,
                                     p_fecha date, p_datos jsonb DEFAULT '{}')
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
    v_codigo varchar;
BEGIN
    -- Se arma primero con un número de prueba para detectar datos faltantes
    -- ANTES de consumir el correlativo.
    PERFORM comun.formatear_codigo(p_formato, p_fecha, 1, p_datos);
    v_codigo := comun.formatear_codigo(p_formato, p_fecha,
                    comun.siguiente_numero(p_clave, comun.periodo_de(p_reinicio, p_fecha)), p_datos);
    RETURN v_codigo;
END $$;

-- Vista previa para la interfaz: cómo saldrá el PRÓXIMO código, sin consumirlo.
CREATE FUNCTION comun.vista_previa_codigo(p_clave varchar, p_formato varchar, p_reinicio varchar,
                                          p_fecha date, p_datos jsonb DEFAULT '{}', p_marcadores text[] DEFAULT NULL)
RETURNS varchar LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_ultimo integer;
BEGIN
    IF p_marcadores IS NOT NULL THEN
        PERFORM comun.validar_formato(p_formato, p_reinicio, p_marcadores);
    END IF;
    SELECT ultimo_numero INTO v_ultimo FROM comun.contador
     WHERE clave = p_clave AND periodo = comun.periodo_de(p_reinicio, p_fecha);
    RETURN comun.formatear_codigo(p_formato, p_fecha, COALESCE(v_ultimo, 0) + 1, p_datos);
END $$;


/* =====================================================================
   BANCOS
   ===================================================================== */
CREATE TABLE comun.banco (
    id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre     varchar(60) NOT NULL UNIQUE,
    activo     boolean NOT NULL DEFAULT true,
    created_at timestamp(0),
    updated_at timestamp(0)
);

COMMIT;
