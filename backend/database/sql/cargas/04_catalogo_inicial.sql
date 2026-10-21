/* =====================================================================
   04 — CATÁLOGO INICIAL DE LOS MÓDULOS DE CARGAS Y CAJA
   ---------------------------------------------------------------------
   Estructura, no datos de demostración: se puede correr en producción.
   Las LÍNEAS y SERIES son una propuesta armada a partir de la tabla
   "numeracion" del sistema anterior; revísenlas antes de usarlas.
   Las tablas de precio NO se cargan aquí: las define la empresa.
   ===================================================================== */

BEGIN;

-- ---------------------------------------------------------------------
-- Elementos. OJO con la plata: se propone DM (decimarcos), que es la
-- unidad usual en Potosí. Si la empresa trabaja en g/TM u oz/TM, cambiar
-- unidad_ley ANTES de registrar el primer análisis.
-- ---------------------------------------------------------------------
INSERT INTO cargas.elemento (codigo, nombre, unidad_ley, unidad_cotizacion) VALUES
    ('ZN',   'Zinc',      '%',    'LF'),
    ('PB',   'Plomo',     '%',    'LF'),
    ('AG',   'Plata',     'DM',   'OT'),
    ('SN',   'Estaño',    '%',    'LF'),
    ('CU',   'Cobre',     '%',    'LF'),
    ('AU',   'Oro',       'G_TM', 'OT'),
    ('SB',   'Antimonio', '%',    'TMF'),
    ('BI',   'Bismuto',   '%',    'LF'),
    ('AS',   'Arsénico',  '%',    NULL),
    ('FE',   'Hierro',    '%',    NULL),
    ('CD',   'Cadmio',    '%',    NULL),
    ('SIO2', 'Sílice',    '%',    NULL),
    ('H2O',  'Humedad',   '%',    NULL)
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- Líneas de producto (propuesta)
-- ---------------------------------------------------------------------
INSERT INTO cargas.linea_producto (codigo, nombre, forma, modalidad_precio) VALUES
    ('PLATA_OXI',      'Carga de plata oxidada (OXI)',          'CARGA',       'POR_PUNTO'),
    ('COMPLEJO_ZN_AG', 'Carga de complejo zinc-plata (CZP)',    'CARGA',       'POR_PUNTO'),
    ('BROSA_AG',       'Brosa de plata de alta ley',            'BROSA',       'POR_PORCENTAJE'),
    ('SACOS_AG',       'Mineral de plata en sacos',             'SACOS',       'POR_PORCENTAJE'),
    ('CONC_ZN',        'Concentrado de zinc',                   'CONCENTRADO', 'VALORACION_CONCENTRADO'),
    ('CONC_PB',        'Concentrado de plomo-plata',            'CONCENTRADO', 'VALORACION_CONCENTRADO')
ON CONFLICT (codigo) DO NOTHING;

-- Elementos por línea. split_limit queda NULL: lo fija la empresa.
INSERT INTO cargas.linea_producto_elemento (linea_producto_id, elemento_id, rol)
SELECT lp.id, e.id, x.rol
  FROM (VALUES
        ('PLATA_OXI',      'AG', 'PAGABLE'),
        ('COMPLEJO_ZN_AG', 'AG', 'PAGABLE'),
        ('COMPLEJO_ZN_AG', 'ZN', 'PAGABLE'),
        ('COMPLEJO_ZN_AG', 'PB', 'INFORMATIVO'),
        ('BROSA_AG',       'AG', 'PAGABLE'),
        ('SACOS_AG',       'AG', 'PAGABLE'),
        ('CONC_ZN',        'ZN', 'PAGABLE'),
        ('CONC_ZN',        'AG', 'PAGABLE'),
        ('CONC_ZN',        'FE', 'PENALIZABLE'),
        ('CONC_ZN',        'SIO2','PENALIZABLE'),
        ('CONC_ZN',        'CD', 'PENALIZABLE'),
        ('CONC_ZN',        'AS', 'PENALIZABLE'),
        ('CONC_ZN',        'SB', 'PENALIZABLE'),
        ('CONC_ZN',        'BI', 'PENALIZABLE'),
        ('CONC_ZN',        'SN', 'PENALIZABLE'),
        ('CONC_PB',        'PB', 'PAGABLE'),
        ('CONC_PB',        'AG', 'PAGABLE'),
        ('CONC_PB',        'ZN', 'PENALIZABLE'),
        ('CONC_PB',        'AS', 'PENALIZABLE'),
        ('CONC_PB',        'SB', 'PENALIZABLE'),
        ('CONC_PB',        'BI', 'PENALIZABLE')
       ) AS x(linea, elemento, rol)
  JOIN cargas.linea_producto lp ON lp.codigo = x.linea
  JOIN cargas.elemento e        ON e.codigo  = x.elemento
ON CONFLICT (linea_producto_id, elemento_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Series de lote (propuesta). Todas con el formato por defecto:
--   {PREFIJO}-{AAAA}{MM}-{N:4} con reinicio MENSUAL → CZP-202610-0001
-- El formato y el reinicio se cambian desde la interfaz.
-- ---------------------------------------------------------------------
INSERT INTO cargas.serie_lote (prefijo, nombre, linea_producto_id, origen)
SELECT x.prefijo, x.nombre, lp.id, x.origen
  FROM (VALUES
        ('OXI',   'Compra de plata oxidada',             'PLATA_OXI',      'COMPRA'),
        ('CZP',   'Compra de complejo zinc-plata',       'COMPLEJO_ZN_AG', 'COMPRA'),
        ('ECB',   'Compra de brosas de alta ley',        'BROSA_AG',       'COMPRA'),
        ('SAC',   'Compra de mineral en sacos',          'SACOS_AG',       'COMPRA'),
        ('EC-ZN', 'Compra de concentrado de zinc',       'CONC_ZN',        'COMPRA'),
        ('EC-PB', 'Compra de concentrado de plomo',      'CONC_PB',        'COMPRA'),
        ('BM',    'Producción propia de bocaminas (CZP)','COMPLEJO_ZN_AG', 'PROPIA')
       ) AS x(prefijo, nombre, linea, origen)
  JOIN cargas.linea_producto lp ON lp.codigo = x.linea
ON CONFLICT (prefijo) DO NOTHING;

INSERT INTO cargas.correlativo (clave, descripcion, formato, reinicio) VALUES
    ('ANTICIPO', 'Anticipos a productores', 'ANT-{AAAA}-{N:5}', 'ANUAL')
ON CONFLICT (clave) DO NOTHING;

-- Sigla de la empresa para el marcador {SIGLA} (la misma del módulo de activos).
INSERT INTO cargas.parametro (clave, valor, tipo_dato, descripcion, vigente_desde)
SELECT 'SIGLA_EMPRESA', 'MAC', 'texto', 'Sigla usada en los códigos de lote ({SIGLA})', DATE '2026-01-01'
 WHERE NOT EXISTS (SELECT 1 FROM cargas.parametro WHERE clave = 'SIGLA_EMPRESA');

-- ---------------------------------------------------------------------
-- Retenciones. Solo la CNS tiene tasa legal general (DS 2892, 1,8% sobre
-- el valor neto de venta de minerales de cooperativas). El aporte a la
-- cooperativa y el de COMIBOL se definen cooperativa por cooperativa.
-- ---------------------------------------------------------------------
INSERT INTO cargas.retencion_concepto (codigo, nombre, base_calculo, por_cooperativa, norma) VALUES
    ('CNS',                'Aporte a la Caja Nacional de Salud (seguro de corto plazo)', 'VALOR_NETO', false, 'DS 2892 de 01/09/2016'),
    ('APORTE_COOPERATIVA', 'Aporte a la cooperativa (por convenio)',                     'VALOR_NETO', true,  'Convenio con cada cooperativa'),
    ('COMIBOL',            'Aporte a COMIBOL (áreas arrendadas)',                        'VALOR_NETO', true,  'Contrato de arrendamiento de cada cooperativa')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cargas.retencion_tasa (concepto_id, cooperativa_id, porcentaje, vigente_desde)
SELECT id, NULL, 1.8, DATE '2016-09-01'
  FROM cargas.retencion_concepto
 WHERE codigo = 'CNS'
   AND NOT EXISTS (SELECT 1 FROM cargas.retencion_tasa t
                    JOIN cargas.retencion_concepto c ON c.id = t.concepto_id
                   WHERE c.codigo = 'CNS');

-- ---------------------------------------------------------------------
-- Conceptos de caja que genera el módulo de cargas. Solo se pueden usar
-- vinculados a su documento (anticipo o bono); el cajero no los elige a
-- mano. Los conceptos administrativos (sueldos, alquiler, servicios…) se
-- crean desde la interfaz con origen MANUAL.
-- ---------------------------------------------------------------------
INSERT INTO caja.concepto (codigo, nombre, tipo, origen) VALUES
    ('ANTICIPO_COMPRA',     'Anticipo por compra de mineral',      'EGRESO',  'CARGAS_ANTICIPO'),
    ('DEVOLUCION_ANTICIPO', 'Devolución de anticipo de mineral',   'INGRESO', 'CARGAS_ANTICIPO_DEVOLUCION'),
    ('BONO_TRANSPORTE',     'Pago de bono de transporte',          'EGRESO',  'CARGAS_BONO'),
    ('REPOSICION_FONDOS',   'Reposición de fondos a caja',         'INGRESO', 'MANUAL')
ON CONFLICT (codigo) DO NOTHING;

-- Conceptos manuales de arranque (sprint 2). El administrador los cambia o
-- agrega otros desde Caja → Conceptos.
-- El depósito en banco no sale de la empresa: en cajas con aprobación la
-- cajera lo registra directo, sin solicitud (17_solicitudes_caja.sql).
INSERT INTO caja.concepto (codigo, nombre, tipo, origen, exento_aprobacion) VALUES
    ('DEPOSITO_BANCARIO',   'Depósito de efectivo en banco',       'EGRESO',  'MANUAL', true)
ON CONFLICT DO NOTHING;

INSERT INTO caja.concepto (codigo, nombre, tipo, origen) VALUES
    ('SERVICIOS_BASICOS',   'Servicios básicos (luz, agua, internet)', 'EGRESO', 'MANUAL'),
    ('COMBUSTIBLE',         'Compra de combustible',               'EGRESO',  'MANUAL'),
    ('GASTOS_MENORES',      'Gastos menores de oficina',           'EGRESO',  'MANUAL'),
    ('OTROS_INGRESOS',      'Otros ingresos a caja',               'INGRESO', 'MANUAL')
ON CONFLICT DO NOTHING;   -- sin columna: tampoco choca si ya crearon uno con el mismo nombre

COMMIT;
