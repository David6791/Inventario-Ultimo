/* =====================================================================
   21. DATOS DE LA BOLETA PARA IDENTIFICAR LA CARGA
   ---------------------------------------------------------------------
   Además del ticket y los pesos, de la boleta se leen el productor (socio),
   el chofer (transportista), la fecha y hora del pesaje y un segundo número
   (en San Cristóbal hay N. Pesaje y N. Orden). El productor y el chofer
   llenan el formulario; la fecha de la boleta y el número de orden quedan en
   el pesaje, para identificarlo y buscarlo. Como el resto del pesaje, no se
   corrigen: se anula y se registra otro.
   ===================================================================== */

BEGIN;

ALTER TABLE cargas.pesaje
    ADD COLUMN numero_orden varchar(30),
    ADD COLUMN fecha_ticket timestamp(0);
COMMENT ON COLUMN cargas.pesaje.numero_orden IS 'Segundo número de la boleta (N. Orden en San Cristóbal), si la báscula lo imprime.';
COMMENT ON COLUMN cargas.pesaje.fecha_ticket IS 'Fecha y hora impresas en la boleta (la de la báscula, no la del registro).';
CREATE INDEX ix_pesaje_numero_orden ON cargas.pesaje (numero_orden) WHERE numero_orden IS NOT NULL;

CREATE OR REPLACE FUNCTION cargas.tg_pesaje_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_estado varchar; v_codigo varchar;
    v_corrigiendo boolean := COALESCE(current_setting('cargas.corrigiendo_peso_cliente', true), '') = 'si';
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los pesajes no se eliminan: se anulan con motivo.';
    END IF;

    SELECT estado, codigo INTO v_estado, v_codigo FROM cargas.lote WHERE id = NEW.lote_id;

    IF TG_OP = 'UPDATE' THEN
        IF (NEW.lote_id, NEW.tipo, NEW.bascula, NEW.ticket, NEW.peso_bruto_kg, NEW.tara_kg,
            NEW.modalidad, NEW.descuento_sacos_kg, NEW.pesaje_viaje_id, NEW.num_sacos, NEW.numero_orden, NEW.fecha_ticket)
           IS DISTINCT FROM
           (OLD.lote_id, OLD.tipo, OLD.bascula, OLD.ticket, OLD.peso_bruto_kg, OLD.tara_kg,
            OLD.modalidad, OLD.descuento_sacos_kg, OLD.pesaje_viaje_id, OLD.num_sacos, OLD.numero_orden, OLD.fecha_ticket)
           OR (NOT v_corrigiendo AND (NEW.peso_cliente_kg, NEW.peso_cliente_tipo)
                                     IS DISTINCT FROM (OLD.peso_cliente_kg, OLD.peso_cliente_tipo)) THEN
            RAISE EXCEPTION 'Un pesaje registrado no se corrige: se anula y se registra otro.';
        END IF;
        IF OLD.anulado AND NOT NEW.anulado THEN
            RAISE EXCEPTION 'Un pesaje anulado no se reactiva.';
        END IF;
        IF v_corrigiendo THEN
            RETURN NEW;      -- la función ya validó estado y motivo
        END IF;
    END IF;

    IF NEW.tipo = 'INGRESO' AND v_estado <> 'RECIBIDO' THEN
        RAISE EXCEPTION 'El lote % está %: los pesajes de ingreso solo se registran o anulan mientras está RECIBIDO.', v_codigo, v_estado;
    END IF;
    IF v_estado IN ('ANULADO','LIQUIDADO') THEN
        RAISE EXCEPTION 'El lote % está % y no admite pesajes.', v_codigo, v_estado;
    END IF;
    IF TG_OP = 'INSERT' AND NEW.pesaje_viaje_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM cargas.pesaje v
                        WHERE v.id = NEW.pesaje_viaje_id AND v.modalidad = 'BASCULA' AND v.tipo = 'INGRESO'
                          AND NOT v.anulado AND v.lote_id <> NEW.lote_id) THEN
            RAISE EXCEPTION 'Los sacos de una recepción mixta van ligados al pesaje de báscula vigente del camión, en otro lote.';
        END IF;
    END IF;
    RETURN NEW;
END $$;

COMMIT;
