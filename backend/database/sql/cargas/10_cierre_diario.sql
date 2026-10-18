/* =====================================================================
   10 — CIERRE DIARIO (sprint 3) — esquema caja
   ---------------------------------------------------------------------
   La caja se cierra todos los días. Una sesión abierta un día anterior ya
   no admite movimientos nuevos: primero se cierra (con su arqueo y su
   reporte) y se abre la del día. Así cada reporte diario corresponde a un
   solo día y lo contado al cerrar es el punto de partida del siguiente.

   Anular sí se permite en una sesión de un día anterior todavía abierta:
   es la forma de corregir antes de cerrarla.

   La fecha es la de Bolivia (la conexión fija DB_TIMEZONE=America/La_Paz).
   ===================================================================== */

BEGIN;

CREATE FUNCTION caja.tg_movimiento_dia() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    s caja.sesion;
BEGIN
    SELECT * INTO s FROM caja.sesion WHERE id = NEW.sesion_id;
    IF s.estado = 'ABIERTA' AND s.abierta_en::date < current_date THEN
        RAISE EXCEPTION 'La sesión % se abrió el % y la caja se cierra a diario: ciérrela con su arqueo y abra la de hoy para registrar.',
            s.numero, to_char(s.abierta_en, 'DD/MM/YYYY');
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER movimiento_dia
    BEFORE INSERT ON caja.movimiento
    FOR EACH ROW EXECUTE FUNCTION caja.tg_movimiento_dia();

-- Resumen por concepto de una sesión (reporte diario).
CREATE VIEW caja.v_sesion_conceptos AS
SELECT m.sesion_id, m.moneda, m.tipo, k.codigo AS concepto_codigo, k.nombre AS concepto,
       count(*)                                                     AS movimientos,
       sum(m.monto)                                                 AS total,
       COALESCE(sum(m.monto) FILTER (WHERE m.forma_pago = 'EFECTIVO'), 0)  AS efectivo,
       COALESCE(sum(m.monto) FILTER (WHERE m.forma_pago <> 'EFECTIVO'), 0) AS otras_formas
  FROM caja.movimiento m
  JOIN caja.concepto k ON k.id = m.concepto_id
 WHERE m.estado = 'VIGENTE'
 GROUP BY m.sesion_id, m.moneda, m.tipo, k.codigo, k.nombre;

COMMIT;
