/* =====================================================================
   22. PESO QUE VALE Y SEDES DE RECEPCIÓN
   ---------------------------------------------------------------------
   a) Peso que vale de cada pesaje, comparando el neto de nuestra báscula
      (E) con el neto del cliente (C):
        - E ≥ C                      → el del cliente (el menor).
        - E < C y C − E ≤ límite     → el promedio de los dos.
        - E < C y C − E > límite     → el nuestro.
        - sin peso del cliente       → el nuestro.
      El límite es el parámetro LIMITE_PROMEDIO_PESO_KG (100 kg), con
      historia: cada pesaje usa el que regía en su fecha. Lo calcula la base
      al registrar y al corregir el peso del cliente; queda el criterio usado.
      El peso del lote (v_lote_resumen.peso_neto_humedo_kg) y su valor
      estimado pasan a sumar el peso que vale.
      Los pesajes anteriores a este cambio se registraron con «vale el de la
      empresa»: conservan ese peso y quedan con criterio EMPRESA.
   b) Sedes de recepción con recepcionistas asignados, como las cajas con
      sus cajeros: en una sede con recepcionistas solo ellos reciben; quien
      tiene una sola sede asignada no elige la sede.
   ===================================================================== */

BEGIN;

-- ---------------------------------------------------------------------
-- a) Peso que vale
-- ---------------------------------------------------------------------
INSERT INTO cargas.parametro (clave, valor, tipo_dato, descripcion, vigente_desde)
SELECT 'LIMITE_PROMEDIO_PESO_KG', '100', 'numero',
       'Si nuestra báscula pesa menos que el cliente y la diferencia no pasa de este límite (kg), vale el promedio; si pasa, vale el nuestro.',
       DATE '2026-01-01'
 WHERE NOT EXISTS (SELECT 1 FROM cargas.parametro WHERE clave = 'LIMITE_PROMEDIO_PESO_KG');

ALTER TABLE cargas.pesaje
    ADD COLUMN peso_final_kg numeric(12,2),
    ADD COLUMN criterio_peso varchar(8)
        CONSTRAINT ck_pesaje_criterio CHECK (criterio_peso IN ('EMPRESA','CLIENTE','PROMEDIO'));
COMMENT ON COLUMN cargas.pesaje.peso_final_kg IS 'Peso que vale para el lote (empresa, cliente o promedio). Lo calcula la base.';
COMMENT ON COLUMN cargas.pesaje.criterio_peso IS 'Con qué regla salió peso_final_kg: EMPRESA, CLIENTE o PROMEDIO.';

-- Los pesajes ya registrados no se pueden modificar (pesaje_control): solo para
-- llenar las columnas nuevas se suspende esa regla dentro de esta transacción.
ALTER TABLE cargas.pesaje DISABLE TRIGGER pesaje_control;
UPDATE cargas.pesaje SET peso_final_kg = peso_neto_kg, criterio_peso = 'EMPRESA';
ALTER TABLE cargas.pesaje ENABLE TRIGGER pesaje_control;
ALTER TABLE cargas.pesaje ALTER COLUMN peso_final_kg SET NOT NULL, ALTER COLUMN criterio_peso SET NOT NULL;

-- Regla de la empresa: qué peso vale entre el nuestro y el del cliente.
CREATE FUNCTION cargas.peso_que_vale(p_empresa numeric, p_cliente numeric, p_fecha date,
                                     OUT peso_kg numeric, OUT criterio varchar)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_limite numeric;
BEGIN
    IF p_cliente IS NULL OR p_cliente <= 0 THEN
        peso_kg := p_empresa; criterio := 'EMPRESA';
        RETURN;
    END IF;
    IF p_empresa >= p_cliente THEN
        peso_kg := p_cliente; criterio := 'CLIENTE';
        RETURN;
    END IF;
    SELECT valor::numeric INTO v_limite FROM cargas.parametro
     WHERE clave = 'LIMITE_PROMEDIO_PESO_KG'
       AND daterange(vigente_desde, vigente_hasta, '[)') @> p_fecha;
    IF p_cliente - p_empresa <= COALESCE(v_limite, 100) THEN
        peso_kg := round((p_empresa + p_cliente) / 2, 2); criterio := 'PROMEDIO';
    ELSE
        peso_kg := p_empresa; criterio := 'EMPRESA';
    END IF;
END $$;

CREATE FUNCTION cargas.tg_pesaje_peso_final() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_empresa numeric := NEW.peso_bruto_kg - NEW.tara_kg - NEW.descuento_sacos_kg;
    v_cliente numeric;
    r record;
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.peso_cliente_kg, NEW.peso_cliente_tipo) IS NOT DISTINCT FROM (OLD.peso_cliente_kg, OLD.peso_cliente_tipo) THEN
        NEW.peso_final_kg := OLD.peso_final_kg;       -- nada que recalcular (ni se toca a mano)
        NEW.criterio_peso := OLD.criterio_peso;
        RETURN NEW;
    END IF;
    IF NEW.tipo <> 'INGRESO' THEN
        NEW.peso_final_kg := v_empresa; NEW.criterio_peso := 'EMPRESA';
        RETURN NEW;
    END IF;
    v_cliente := CASE WHEN NEW.peso_cliente_kg IS NULL THEN NULL
                      WHEN NEW.peso_cliente_tipo = 'BRUTO' THEN NEW.peso_cliente_kg - NEW.tara_kg
                      ELSE NEW.peso_cliente_kg END;
    r := cargas.peso_que_vale(v_empresa, v_cliente, COALESCE(NEW.fecha, now())::date);
    NEW.peso_final_kg := r.peso_kg;
    NEW.criterio_peso := r.criterio;
    RETURN NEW;
END $$;

-- «zz_»: corre después de pesaje_control (los BEFORE van en orden alfabético).
CREATE TRIGGER zz_pesaje_peso_final
    BEFORE INSERT OR UPDATE ON cargas.pesaje
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_pesaje_peso_final();

-- El peso del lote y su valor estimado suman el peso que vale.
DO $$
DECLARE
    v_def text := pg_get_viewdef('cargas.v_lote_resumen'::regclass);
    v_fn  text := pg_get_functiondef('cargas.valor_estimado_lote(bigint)'::regprocedure);
BEGIN
    IF position('sum(pesaje.peso_neto_kg)' IN v_def) = 0 THEN
        RAISE EXCEPTION 'v_lote_resumen no tiene la forma esperada: revise el script 22.';
    END IF;
    EXECUTE 'CREATE OR REPLACE VIEW cargas.v_lote_resumen AS '
         || replace(v_def, 'sum(pesaje.peso_neto_kg)', 'sum(pesaje.peso_final_kg)');

    IF position('sum(p.peso_neto_kg)' IN v_fn) = 0 THEN
        RAISE EXCEPTION 'valor_estimado_lote no tiene la forma esperada: revise el script 22.';
    END IF;
    EXECUTE replace(v_fn, 'sum(p.peso_neto_kg)', 'sum(p.peso_final_kg)');
END $$;

-- ---------------------------------------------------------------------
-- b) Sedes de recepción
-- ---------------------------------------------------------------------
CREATE TABLE cargas.sede_recepcionista (
    almacen_id bigint NOT NULL REFERENCES public.almacenes(id),
    user_id    bigint NOT NULL REFERENCES public.users(id),
    created_at timestamp(0) NOT NULL DEFAULT now(),
    PRIMARY KEY (almacen_id, user_id)
);
CREATE INDEX ix_sede_recepcionista_usuario ON cargas.sede_recepcionista (user_id);
COMMENT ON TABLE cargas.sede_recepcionista IS
    'Quién recibe carga en cada sede. Una sede con recepcionistas solo la usan ellos; con uno asignado a una sola sede, el formulario no pide sede.';

COMMIT;
