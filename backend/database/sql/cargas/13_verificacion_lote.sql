/* =====================================================================
   13. VERIFICACIÓN DEL LOTE POR QR
   ---------------------------------------------------------------------
   El rótulo que se coloca junto a la carga lleva un QR con una URL de
   verificación. La URL no usa el código del lote (es correlativo y se
   puede adivinar) sino un código aleatorio de 128 bits: solo quien tiene
   el rótulo en la mano llega a la ficha pública, y un rótulo falsificado
   con un código inventado no lleva a ningún lote.
   El código se genera al crear el lote y no cambia nunca: los rótulos
   reimpresos siguen valiendo.
   ===================================================================== */

ALTER TABLE cargas.lote
    ADD COLUMN codigo_verificacion char(32) NOT NULL
        DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE cargas.lote
    ADD CONSTRAINT uq_lote_codigo_verificacion UNIQUE (codigo_verificacion);
COMMENT ON COLUMN cargas.lote.codigo_verificacion IS
    'Código aleatorio del QR del rótulo (URL pública de verificación). No cambia.';

CREATE FUNCTION cargas.tg_lote_verificacion_fija() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.codigo_verificacion IS DISTINCT FROM OLD.codigo_verificacion THEN
        RAISE EXCEPTION 'El código de verificación del lote % no cambia: los rótulos impresos dejarían de valer.', OLD.codigo;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER lote_verificacion_fija
    BEFORE UPDATE OF codigo_verificacion ON cargas.lote
    FOR EACH ROW EXECUTE FUNCTION cargas.tg_lote_verificacion_fija();
