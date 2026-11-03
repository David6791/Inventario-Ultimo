/* =====================================================================
   27. CAJA PRINCIPAL, DEVOLUCIÓN AL CERRAR Y QUÉ PUEDE PAGAR CADA CAJA
   ---------------------------------------------------------------------
   Ciclo diario del efectivo:

       CAJA PRINCIPAL ── entrega del día (en tránsito) ──► CAJA DEL ACOPIO
             ▲                                               │ paga bonos
             └──── devolución al cerrar (en tránsito) ───────┘ y anticipos

   - La caja PRINCIPAL es una caja marcada (una sola activa). Es la única
     que entrega dinero a las demás y la que recibe las devoluciones.
     Reemplaza la regla anterior («la caja del centro de costo central»).
   - Una caja que DEVUELVE AL CERRAR entrega todo lo contado en el cierre a
     la principal: el cierre guarda lo contado (con su arqueo y diferencia,
     como siempre) y lo devuelto; la caja abre al día siguiente con
     contado − devuelto = 0. La devolución queda en tránsito hasta que el
     cajero de la principal la cuenta y la recibe (ingreso en la
     principal). No se anula: la diferencia, si la hay, sale en el arqueo.
   - Mientras una caja tenga una devolución sin recibir, la principal no
     le hace la entrega del día siguiente.
   - QUÉ PUEDE PAGAR: TODO (bonos, anticipos y gastos) o CARGAS (solo
     bonos y anticipos, además de las entregas y devoluciones de dinero).
   - Principal, devolución y qué puede pagar se cambian solo con la caja
     cerrada: cada día de caja queda con una sola regla.
   ===================================================================== */

BEGIN;

-- ---------------------------------------------------------------------
-- 1. La caja: principal, devuelve al cerrar, qué puede pagar
-- ---------------------------------------------------------------------
ALTER TABLE caja.caja
    ADD COLUMN es_principal       boolean    NOT NULL DEFAULT false,
    ADD COLUMN devuelve_al_cerrar boolean    NOT NULL DEFAULT false,
    ADD COLUMN pagos              varchar(6) NOT NULL DEFAULT 'TODO' CHECK (pagos IN ('TODO','CARGAS')),
    ADD CONSTRAINT ck_caja_principal CHECK (NOT es_principal OR (NOT devuelve_al_cerrar AND pagos = 'TODO'));
COMMENT ON COLUMN caja.caja.es_principal IS 'Entrega el dinero a las demás cajas y recibe sus devoluciones. Una sola activa.';
COMMENT ON COLUMN caja.caja.devuelve_al_cerrar IS 'Al cerrar devuelve todo el efectivo contado a la caja principal y abre en 0.';
COMMENT ON COLUMN caja.caja.pagos IS 'TODO: bonos, anticipos y gastos. CARGAS: solo bonos y anticipos (y el movimiento de fondos).';

CREATE UNIQUE INDEX ux_caja_una_principal ON caja.caja (es_principal) WHERE es_principal AND activa;

-- Arranque: es principal la única caja activa del centro de costo central, si hay una sola.
UPDATE caja.caja c SET es_principal = true
 WHERE c.activa
   AND c.almacen_id IN (SELECT almacen_id FROM activos.centro_costo WHERE es_central AND activo)
   AND (SELECT count(*) FROM caja.caja x
         WHERE x.activa AND x.almacen_id IN (SELECT almacen_id FROM activos.centro_costo WHERE es_central AND activo)) = 1;

CREATE FUNCTION caja.tg_caja_reglas_dinero() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.es_principal, NEW.devuelve_al_cerrar, NEW.pagos) IS DISTINCT FROM (OLD.es_principal, OLD.devuelve_al_cerrar, OLD.pagos)
       AND EXISTS (SELECT 1 FROM caja.sesion WHERE caja_id = NEW.id AND estado = 'ABIERTA') THEN
        RAISE EXCEPTION 'La caja % está abierta: si es principal, si devuelve al cerrar y qué puede pagar se cambian con la caja cerrada.', NEW.codigo;
    END IF;
    IF OLD.es_principal AND NOT NEW.es_principal
       AND EXISTS (SELECT 1 FROM caja.envio_fondos WHERE caja_destino_id = NEW.id AND estado = 'EN_TRANSITO') THEN
        RAISE EXCEPTION 'La caja % tiene devoluciones por recibir: recíbalas antes de quitarle la marca de principal.', NEW.codigo;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER caja_reglas_dinero
    BEFORE UPDATE OF es_principal, devuelve_al_cerrar, pagos ON caja.caja
    FOR EACH ROW EXECUTE FUNCTION caja.tg_caja_reglas_dinero();

-- ---------------------------------------------------------------------
-- 2. Qué puede pagar: una caja de CARGAS no registra conceptos manuales
-- ---------------------------------------------------------------------
CREATE FUNCTION caja.tg_movimiento_pagos_caja() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    c caja.caja; k caja.concepto;
BEGIN
    SELECT cj.* INTO c FROM caja.caja cj JOIN caja.sesion s ON s.caja_id = cj.id WHERE s.id = NEW.sesion_id;
    SELECT * INTO k FROM caja.concepto WHERE id = NEW.concepto_id;
    IF c.pagos = 'CARGAS' AND k.origen = 'MANUAL' THEN
        RAISE EXCEPTION 'La caja % solo paga bonos y anticipos: «%» no se registra en ella.', c.codigo, k.nombre;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER movimiento_pagos_caja
    BEFORE INSERT ON caja.movimiento
    FOR EACH ROW EXECUTE FUNCTION caja.tg_movimiento_pagos_caja();

CREATE FUNCTION caja.tg_solicitud_pagos_caja() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    c caja.caja;
BEGIN
    SELECT * INTO c FROM caja.caja WHERE id = NEW.caja_id;
    IF c.pagos = 'CARGAS' THEN
        RAISE EXCEPTION 'La caja % solo paga bonos y anticipos: no recibe solicitudes de dinero para gastos.', c.codigo;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER solicitud_pagos_caja
    BEFORE INSERT ON caja.solicitud
    FOR EACH ROW EXECUTE FUNCTION caja.tg_solicitud_pagos_caja();

-- ---------------------------------------------------------------------
-- 3. Cierre con devolución: lo devuelto por moneda
-- ---------------------------------------------------------------------
ALTER TABLE caja.sesion_saldo
    ADD COLUMN devuelto numeric(14,2) NOT NULL DEFAULT 0 CHECK (devuelto >= 0),
    ADD CONSTRAINT ck_saldo_devuelto CHECK (saldo_contado IS NULL OR devuelto <= saldo_contado);
COMMENT ON COLUMN caja.sesion_saldo.devuelto IS 'Lo contado al cerrar que se devolvió a la caja principal. La siguiente apertura arranca con contado − devuelto.';

-- Continuidad: la apertura arranca con lo contado menos lo devuelto.
CREATE OR REPLACE FUNCTION caja.tg_sesion_saldo_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_estado  varchar;
    v_caja    bigint;
    v_usd     boolean;
    v_previo  numeric;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los saldos de una sesión no se eliminan.';
    END IF;

    SELECT s.estado, s.caja_id, c.maneja_usd INTO v_estado, v_caja, v_usd
      FROM caja.sesion s JOIN caja.caja c ON c.id = s.caja_id
     WHERE s.id = NEW.sesion_id;

    IF v_estado <> 'ABIERTA' THEN
        RAISE EXCEPTION 'La sesión está %: sus saldos ya no se modifican.', v_estado;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.moneda = 'USD' AND NOT v_usd THEN
            RAISE EXCEPTION 'Esta caja no maneja dólares.';
        END IF;
        SELECT ss.saldo_contado - ss.devuelto INTO v_previo
          FROM caja.sesion_saldo ss
          JOIN caja.sesion s ON s.id = ss.sesion_id
         WHERE s.caja_id = v_caja AND s.id <> NEW.sesion_id AND s.estado <> 'ABIERTA'
           AND ss.moneda = NEW.moneda
         ORDER BY s.numero DESC
         LIMIT 1;
        IF FOUND THEN
            NEW.saldo_inicial := v_previo;   -- continuidad: lo que quedó en la caja al cerrar
        END IF;
        NEW.saldo_esperado := NULL;
        NEW.devuelto := 0;
        RETURN NEW;
    END IF;

    IF NEW.saldo_inicial <> OLD.saldo_inicial OR NEW.moneda <> OLD.moneda OR NEW.sesion_id <> OLD.sesion_id THEN
        RAISE EXCEPTION 'El saldo inicial sale del cierre anterior y no se modifica.';
    END IF;
    RETURN NEW;
END $$;

-- Al cerrar: una caja que devuelve, devuelve todo lo contado; las demás, nada.
CREATE FUNCTION caja.tg_sesion_cierre_devolucion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    c caja.caja; s record;
BEGIN
    IF NOT (OLD.estado = 'ABIERTA' AND NEW.estado = 'CERRADA') THEN
        RETURN NEW;
    END IF;
    SELECT * INTO c FROM caja.caja WHERE id = NEW.caja_id;
    FOR s IN SELECT * FROM caja.sesion_saldo WHERE sesion_id = NEW.id LOOP
        IF c.devuelve_al_cerrar AND s.saldo_contado IS NOT NULL AND s.devuelto <> s.saldo_contado THEN
            RAISE EXCEPTION 'La caja % devuelve todo el efectivo al cerrar: en % se contaron % y se devuelven %.',
                c.codigo, s.moneda, s.saldo_contado, s.devuelto;
        END IF;
        IF NOT c.devuelve_al_cerrar AND s.devuelto <> 0 THEN
            RAISE EXCEPTION 'La caja % no devuelve el efectivo al cerrar.', c.codigo;
        END IF;
    END LOOP;
    RETURN NEW;
END $$;
CREATE TRIGGER sesion_cierre_devolucion
    BEFORE UPDATE OF estado ON caja.sesion
    FOR EACH ROW EXECUTE FUNCTION caja.tg_sesion_cierre_devolucion();

-- Lo devuelto viaja como devolución a la principal (se verifica al confirmar).
CREATE FUNCTION caja.tg_sesion_devolucion_registrada() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    s record;
BEGIN
    IF NOT (OLD.estado = 'ABIERTA' AND NEW.estado = 'CERRADA') THEN
        RETURN NULL;
    END IF;
    FOR s IN SELECT * FROM caja.sesion_saldo WHERE sesion_id = NEW.id AND devuelto > 0 LOOP
        IF NOT EXISTS (SELECT 1 FROM caja.envio_fondos
                        WHERE tipo = 'DEVOLUCION' AND sesion_origen_id = NEW.id AND moneda = s.moneda AND monto = s.devuelto) THEN
            RAISE EXCEPTION 'El cierre % devuelve % % pero no tiene su devolución a la caja principal.', NEW.numero, s.devuelto, s.moneda;
        END IF;
    END LOOP;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sesion_devolucion_registrada
    AFTER UPDATE OF estado ON caja.sesion
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION caja.tg_sesion_devolucion_registrada();

-- ---------------------------------------------------------------------
-- 4. Envíos: entrega (principal → caja) y devolución (caja → principal)
-- ---------------------------------------------------------------------
INSERT INTO caja.concepto (codigo, nombre, tipo, origen, created_at, updated_at)
VALUES ('RECEPCION_DEVOLUCION', 'Devolución de efectivo de otra caja', 'INGRESO', 'FONDOS_RECEPCION', now(), now())
ON CONFLICT (codigo) DO NOTHING;
UPDATE caja.concepto SET nombre = 'Entrega de dinero a otra caja' WHERE codigo = 'ENVIO_FONDOS';
UPDATE caja.concepto SET nombre = 'Dinero recibido de la caja principal' WHERE codigo = 'RECEPCION_FONDOS';

ALTER TABLE caja.envio_fondos
    ADD COLUMN tipo             varchar(10) NOT NULL DEFAULT 'ENTREGA' CHECK (tipo IN ('ENTREGA','DEVOLUCION')),
    ADD COLUMN sesion_origen_id bigint REFERENCES caja.sesion(id),
    ALTER COLUMN movimiento_envio_id DROP NOT NULL,
    ADD CONSTRAINT ck_envio_tipo CHECK (
        (tipo = 'ENTREGA'    AND movimiento_envio_id IS NOT NULL AND sesion_origen_id IS NULL) OR
        (tipo = 'DEVOLUCION' AND movimiento_envio_id IS NULL AND sesion_origen_id IS NOT NULL)),
    ADD CONSTRAINT ck_envio_devolucion_no_anula CHECK (tipo = 'ENTREGA' OR estado <> 'ANULADO');
CREATE UNIQUE INDEX ux_envio_devolucion ON caja.envio_fondos (sesion_origen_id, moneda) WHERE tipo = 'DEVOLUCION';
COMMENT ON COLUMN caja.envio_fondos.tipo IS 'ENTREGA: de la principal a una caja (egreso en la principal). DEVOLUCION: lo contado al cerrar una caja, de vuelta a la principal.';
COMMENT ON COLUMN caja.envio_fondos.sesion_origen_id IS 'Devolución: el cierre de la caja que devuelve.';

CREATE OR REPLACE FUNCTION caja.tg_envio_fondos_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    o caja.caja; d caja.caja; ss caja.sesion_saldo; v_ses caja.sesion; v_pend varchar;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los envíos de dinero no se eliminan: se anulan con motivo.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT * INTO o FROM caja.caja WHERE id = NEW.caja_origen_id;
        SELECT * INTO d FROM caja.caja WHERE id = NEW.caja_destino_id;
        IF NEW.tipo = 'ENTREGA' THEN
            IF NOT (o.es_principal AND o.activa) THEN
                RAISE EXCEPTION 'La caja % no es la caja principal: solo la principal entrega dinero a las demás cajas.', o.codigo;
            END IF;
            IF NOT d.activa THEN
                RAISE EXCEPTION 'La caja % está inactiva: no recibe entregas.', d.codigo;
            END IF;
            SELECT numero INTO v_pend FROM caja.envio_fondos
             WHERE tipo = 'DEVOLUCION' AND caja_origen_id = d.id AND estado = 'EN_TRANSITO' LIMIT 1;
            IF v_pend IS NOT NULL THEN
                RAISE EXCEPTION 'La caja % tiene la devolución % sin recibir: recíbala en la principal antes de entregar el dinero del día.', d.codigo, v_pend;
            END IF;
            PERFORM caja.validar_mov_envio(NEW.movimiento_envio_id, NEW.caja_origen_id, 'ENVIO_FONDOS', NEW.monto, NEW.moneda, 'entrega');
        ELSE
            IF NOT d.es_principal THEN
                RAISE EXCEPTION 'Las devoluciones van a la caja principal y la caja % no lo es.', d.codigo;
            END IF;
            IF NOT o.devuelve_al_cerrar THEN
                RAISE EXCEPTION 'La caja % no devuelve el efectivo al cerrar.', o.codigo;
            END IF;
            SELECT * INTO v_ses FROM caja.sesion WHERE id = NEW.sesion_origen_id;
            IF NOT FOUND OR v_ses.caja_id <> o.id OR v_ses.estado = 'ABIERTA' THEN
                RAISE EXCEPTION 'La devolución sale del cierre de la caja % que devuelve.', o.codigo;
            END IF;
            SELECT * INTO ss FROM caja.sesion_saldo WHERE sesion_id = v_ses.id AND moneda = NEW.moneda;
            IF NOT FOUND OR ss.devuelto <> NEW.monto THEN
                RAISE EXCEPTION 'La devolución de % % no coincide con lo devuelto en el cierre %.', NEW.monto, NEW.moneda, v_ses.numero;
            END IF;
            NEW.movimiento_envio_id := NULL;
        END IF;
        NEW.estado := 'EN_TRANSITO';
        NEW.movimiento_recepcion_id := NULL; NEW.movimiento_reintegro_id := NULL;
        NEW.recibido_por := NULL; NEW.recibido_en := NULL; NEW.anulado_por := NULL; NEW.anulado_en := NULL;
        RETURN NEW;
    END IF;

    IF (NEW.tipo, NEW.caja_origen_id, NEW.caja_destino_id, NEW.monto, NEW.moneda, NEW.movimiento_envio_id, NEW.sesion_origen_id,
        NEW.enviado_por, NEW.motivo)
       IS DISTINCT FROM
       (OLD.tipo, OLD.caja_origen_id, OLD.caja_destino_id, OLD.monto, OLD.moneda, OLD.movimiento_envio_id, OLD.sesion_origen_id,
        OLD.enviado_por, OLD.motivo) THEN
        RAISE EXCEPTION 'Los datos de un envío de dinero no se modifican.';
    END IF;
    IF NEW.estado <> OLD.estado THEN
        IF OLD.estado <> 'EN_TRANSITO' THEN
            RAISE EXCEPTION 'El envío % ya está %.', OLD.numero, OLD.estado;
        END IF;
        IF NEW.estado = 'RECIBIDO' THEN
            PERFORM caja.validar_mov_envio(NEW.movimiento_recepcion_id, NEW.caja_destino_id,
                CASE NEW.tipo WHEN 'ENTREGA' THEN 'RECEPCION_FONDOS' ELSE 'RECEPCION_DEVOLUCION' END,
                NEW.monto, NEW.moneda, 'recepción');
            NEW.recibido_en := COALESCE(NEW.recibido_en, now());
        ELSIF NEW.estado = 'ANULADO' THEN
            IF NEW.tipo = 'DEVOLUCION' THEN
                RAISE EXCEPTION 'La devolución % no se anula: la principal la recibe y la diferencia, si la hay, sale en su arqueo.', OLD.numero;
            END IF;
            PERFORM caja.validar_mov_envio(NEW.movimiento_reintegro_id, NEW.caja_origen_id, 'REINTEGRO_FONDOS', NEW.monto, NEW.moneda, 'reintegro');
            NEW.anulado_en := COALESCE(NEW.anulado_en, now());
        END IF;
    END IF;
    RETURN NEW;
END $$;

-- Entregas ENT-AAAA-nnnnn (las de antes conservan su número ENV-) y devoluciones DEV-AAAA-nnnnn.
CREATE OR REPLACE FUNCTION caja.tg_envio_fondos_numero() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE caja.envio_fondos
       SET numero = CASE NEW.tipo WHEN 'DEVOLUCION' THEN 'DEV-' ELSE 'ENT-' END
                    || to_char(NEW.enviado_en, 'YYYY') || '-' || lpad(NEW.id::text, 5, '0')
     WHERE id = NEW.id;
    RETURN NULL;
END $$;

COMMIT;
