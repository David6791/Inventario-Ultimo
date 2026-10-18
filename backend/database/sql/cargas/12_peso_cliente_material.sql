/* =====================================================================
   12. PESO DEL CLIENTE Y MATERIAL DEL LOTE
   ---------------------------------------------------------------------
   - pesaje.peso_cliente_kg: peso neto que declara el productor (su
     báscula o su guía). Es opcional y solo informativo: el lote, el bono
     y la liquidación usan el peso de la empresa (bruto − tara). Si no se
     registra, el peso del cliente es el mismo de la empresa.
   - lote.material: elementos que trae el mineral, como en el sistema
     anterior (ZN, AG, PB y sus combinaciones). Opcional.
   Como los demás pesos, el del cliente no se corrige: se anula el pesaje
   y se registra otro.
   ===================================================================== */

ALTER TABLE cargas.pesaje
    ADD COLUMN peso_cliente_kg numeric(12,2)
        CONSTRAINT ck_pesaje_peso_cliente CHECK (peso_cliente_kg IS NULL OR peso_cliente_kg > 0);
COMMENT ON COLUMN cargas.pesaje.peso_cliente_kg IS
    'Peso neto declarado por el productor. Informativo: el lote usa peso_neto_kg (báscula de la empresa).';

ALTER TABLE cargas.lote
    ADD COLUMN material varchar(10)
        CONSTRAINT ck_lote_material CHECK (material IS NULL OR material IN
            ('ZN', 'AG', 'PB', 'ZN-AG', 'PB-AG', 'ZN-PB', 'ZN-AG-PB'));
COMMENT ON COLUMN cargas.lote.material IS 'Elementos que trae el mineral según la recepción (ZN, AG, PB y combinaciones).';

/* El peso del cliente queda tan fijo como los de la báscula. */
CREATE OR REPLACE FUNCTION cargas.tg_pesaje_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_estado varchar; v_codigo varchar;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los pesajes no se eliminan: se anulan con motivo.';
    END IF;

    SELECT estado, codigo INTO v_estado, v_codigo FROM cargas.lote WHERE id = NEW.lote_id;

    IF TG_OP = 'UPDATE' THEN
        IF (NEW.lote_id, NEW.tipo, NEW.bascula, NEW.ticket, NEW.peso_bruto_kg, NEW.tara_kg, NEW.peso_cliente_kg)
           IS DISTINCT FROM
           (OLD.lote_id, OLD.tipo, OLD.bascula, OLD.ticket, OLD.peso_bruto_kg, OLD.tara_kg, OLD.peso_cliente_kg) THEN
            RAISE EXCEPTION 'Un pesaje registrado no se corrige: se anula y se registra otro.';
        END IF;
        IF OLD.anulado AND NOT NEW.anulado THEN
            RAISE EXCEPTION 'Un pesaje anulado no se reactiva.';
        END IF;
    END IF;

    IF NEW.tipo = 'INGRESO' AND v_estado <> 'RECIBIDO' THEN
        RAISE EXCEPTION 'El lote % está %: los pesajes de ingreso solo se registran o anulan mientras está RECIBIDO.', v_codigo, v_estado;
    END IF;
    IF v_estado IN ('ANULADO','LIQUIDADO') THEN
        RAISE EXCEPTION 'El lote % está % y no admite pesajes.', v_codigo, v_estado;
    END IF;
    RETURN NEW;
END $$;

/* Peso de la empresa frente al del cliente, por lote (pesajes de ingreso
   vigentes). Donde el cliente no declaró, cuenta el peso de la empresa. */
CREATE VIEW cargas.v_lote_peso_cliente AS
SELECT p.lote_id,
       sum(p.peso_neto_kg)                                         AS peso_empresa_kg,
       sum(COALESCE(p.peso_cliente_kg, p.peso_neto_kg))            AS peso_cliente_kg,
       sum(COALESCE(p.peso_cliente_kg, p.peso_neto_kg) - p.peso_neto_kg) AS diferencia_kg,
       count(p.peso_cliente_kg)                                    AS pesajes_con_peso_cliente
  FROM cargas.pesaje p
 WHERE p.tipo = 'INGRESO' AND NOT p.anulado
 GROUP BY p.lote_id;
