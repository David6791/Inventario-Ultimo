-- ============================================================================
-- MÓDULO DE ACTIVOS FIJOS
-- Schema: activos
-- Motor:  PostgreSQL 13+
-- Integra sobre el sistema de almacenes existente (Laravel + Angular)
--
-- CONVENCIONES
--   * Un activo es una INSTANCIA única. No hay campo cantidad.
--   * Nada se borra. Los documentos se anulan; los activos se dan de baja.
--   * Toda valuación vive en activos.valuacion, una fila por activo/periodo/tipo.
--   * Los montos usan numeric(18,2); la UFV usa numeric(12,5).
--
-- ANTES DE EJECUTAR
--   Revisar la sección [INTEGRACIÓN] al final y ajustar los nombres de las
--   tablas del sistema de almacenes (users, proveedores, unidades, almacenes,
--   recepciones, centros de costo) a los reales del proyecto.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS activos;

-- ============================================================================
-- 1. PARÁMETROS Y CATÁLOGOS
-- ============================================================================

CREATE TABLE activos.parametro (
    id              bigserial PRIMARY KEY,
    clave           varchar(60)  NOT NULL,
    valor           varchar(200) NOT NULL,
    tipo_dato       varchar(10)  NOT NULL DEFAULT 'texto'
                    CHECK (tipo_dato IN ('texto','numero','fecha','booleano')),
    descripcion     text,
    vigente_desde   date         NOT NULL,
    vigente_hasta   date,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz,
    CONSTRAINT uq_parametro_vigencia UNIQUE (clave, vigente_desde),
    CONSTRAINT ck_parametro_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);
COMMENT ON TABLE activos.parametro IS 'Parámetros con vigencia. Ej: UMBRAL_CAPITALIZACION_UFV, DIAS_ALTA, DIAS_OCIOSO.';

-- Clases alineadas al Anexo del Artículo 22 del DS 24051
CREATE TABLE activos.clase (
    id                      bigserial PRIMARY KEY,
    codigo                  char(2)      NOT NULL UNIQUE,
    nombre                  varchar(120) NOT NULL,
    deprecia                boolean      NOT NULL DEFAULT true,
    vida_util_fiscal_meses  integer,
    coeficiente_fiscal      numeric(6,4),
    cuenta_activo           varchar(30),
    cuenta_dep_acumulada    varchar(30),
    cuenta_gasto_dep        varchar(30),
    es_bien_control         boolean      NOT NULL DEFAULT false,
    activo                  boolean      NOT NULL DEFAULT true,
    CONSTRAINT ck_clase_vida CHECK (
        (deprecia = false AND vida_util_fiscal_meses IS NULL)
        OR (deprecia = true AND vida_util_fiscal_meses > 0)
    )
);
COMMENT ON COLUMN activos.clase.deprecia IS 'false para terrenos.';

CREATE TABLE activos.subclase (
    id                          bigserial PRIMARY KEY,
    clase_id                    bigint       NOT NULL REFERENCES activos.clase(id),
    codigo                      char(2)      NOT NULL,
    nombre                      varchar(120) NOT NULL,
    vida_util_economica_meses   integer,
    activo                      boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_subclase UNIQUE (clase_id, codigo)
);
COMMENT ON COLUMN activos.subclase.vida_util_economica_meses IS 'Vida útil financiera sugerida. Puede diferir de la fiscal.';

CREATE TABLE activos.ubicacion (
    id                  bigserial PRIMARY KEY,
    codigo              varchar(20)  NOT NULL UNIQUE,
    nombre              varchar(150) NOT NULL,
    unidad_org_id       bigint,
    sucursal            varchar(100),
    direccion           varchar(250),
    ambiente            varchar(100),
    padre_id            bigint REFERENCES activos.ubicacion(id),
    activo              boolean      NOT NULL DEFAULT true
);

-- Correlativos controlados por aplicación (SELECT ... FOR UPDATE)
CREATE TABLE activos.secuencia (
    ambito      varchar(30) NOT NULL,   -- 'ACTIVO' | 'DOCUMENTO'
    clave       varchar(40) NOT NULL,   -- 'CC-SS' para activos, tipo+gestión para documentos
    ultimo      integer     NOT NULL DEFAULT 0,
    PRIMARY KEY (ambito, clave)
);

-- ============================================================================
-- 2. ACTIVO — TABLA CENTRAL
-- ============================================================================

CREATE TABLE activos.activo (
    id                      bigserial PRIMARY KEY,
    codigo                  varchar(30)  NOT NULL UNIQUE,
    clase_id                bigint       NOT NULL REFERENCES activos.clase(id),
    subclase_id             bigint       NOT NULL REFERENCES activos.subclase(id),
    correlativo             integer      NOT NULL,

    -- Identificación
    denominacion            varchar(200) NOT NULL,
    descripcion             text,
    marca                   varchar(80),
    modelo                  varchar(80),
    serie                   varchar(120),
    chasis                  varchar(120),
    motor                   varchar(120),
    placa                   varchar(30),
    anio_fabricacion        smallint,
    bien_padre_id           bigint REFERENCES activos.activo(id),
    es_bien_control         boolean      NOT NULL DEFAULT false,

    -- Origen
    tipo_origen             varchar(20)  NOT NULL DEFAULT 'COMPRA'
                            CHECK (tipo_origen IN ('COMPRA','IMPORTACION','CONSTRUCCION',
                                                   'DONACION','PERMUTA','APORTE','SOBRANTE_INVENTARIO')),
    proveedor_id            bigint,
    factura_nro             varchar(40),
    factura_fecha           date,
    orden_compra_id         bigint,
    recepcion_id            bigint,          -- documento de recepción del almacén
    almacen_origen_id       bigint,
    acta_recepcion_nro      varchar(30),
    acta_recepcion_fecha    date,

    -- Fechas clave. Se registran por separado a propósito.
    fecha_incorporacion     date         NOT NULL,   -- fecha del acta de recepción
    fecha_inicio_uso        date,                    -- base del cómputo de depreciación

    -- Valuación de origen
    moneda                  char(3)      NOT NULL DEFAULT 'BOB',
    tipo_cambio             numeric(12,6) NOT NULL DEFAULT 1,
    valor_origen            numeric(18,2) NOT NULL CHECK (valor_origen >= 0),
    valor_residual          numeric(18,2) NOT NULL DEFAULT 0,

    -- Parámetros de depreciación
    vida_util_economica_meses  integer,
    vida_util_fiscal_meses     integer,
    regimen_fiscal          varchar(20)  NOT NULL DEFAULT 'REGULAR'
                            CHECK (regimen_fiscal IN ('REGULAR','ACELERADO_DS5563','SECTORIAL','NO_DEPRECIA')),
    ds5563_ddjj_presentada  boolean      NOT NULL DEFAULT false,

    -- Situación
    estado                  varchar(20)  NOT NULL DEFAULT 'REGISTRADO'
                            CHECK (estado IN ('REGISTRADO','EN_USO','EN_REPARACION','OCIOSO',
                                              'EN_TRANSITO','FUERA_DE_INSTALACION','DADO_DE_BAJA')),
    condicion               varchar(15)  NOT NULL DEFAULT 'BUENO'
                            CHECK (condicion IN ('NUEVO','BUENO','REGULAR','MALO','INSERVIBLE')),
    ubicacion_id            bigint REFERENCES activos.ubicacion(id),
    custodio_id             bigint,
    centro_costo_id         bigint,
    fecha_ocioso_desde      date,

    -- Inmuebles
    latitud                 numeric(10,7),
    longitud                numeric(10,7),
    matricula_ddrr          varchar(60),

    -- Baja
    fecha_baja              date,
    causal_baja             varchar(30),
    documento_baja_id       bigint,

    foto_path               varchar(300),
    observaciones           text,
    created_by              bigint,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    updated_at              timestamptz,

    CONSTRAINT ck_activo_baja CHECK (
        (estado = 'DADO_DE_BAJA' AND fecha_baja IS NOT NULL AND causal_baja IS NOT NULL)
        OR (estado <> 'DADO_DE_BAJA' AND fecha_baja IS NULL)
    ),
    CONSTRAINT ck_activo_uso_custodio CHECK (
        estado <> 'EN_USO' OR custodio_id IS NOT NULL
    ),
    CONSTRAINT ck_activo_padre CHECK (bien_padre_id IS NULL OR bien_padre_id <> id),
    CONSTRAINT ck_activo_inicio_uso CHECK (fecha_inicio_uso IS NULL OR fecha_inicio_uso >= fecha_incorporacion)
);

COMMENT ON CONSTRAINT ck_activo_uso_custodio ON activos.activo
    IS 'Art. 43 del Reglamento: ningún bien en uso sin custodio asignado.';
COMMENT ON COLUMN activos.activo.fecha_inicio_uso
    IS 'DS 24051 Art. 22: la depreciación impositiva corre desde la utilización y uso, no desde la recepción.';

CREATE UNIQUE INDEX uq_activo_serie ON activos.activo (upper(serie))
    WHERE serie IS NOT NULL AND serie <> '';
CREATE INDEX ix_activo_custodio   ON activos.activo (custodio_id) WHERE estado <> 'DADO_DE_BAJA';
CREATE INDEX ix_activo_ubicacion  ON activos.activo (ubicacion_id) WHERE estado <> 'DADO_DE_BAJA';
CREATE INDEX ix_activo_clase      ON activos.activo (clase_id, subclase_id);
CREATE INDEX ix_activo_estado     ON activos.activo (estado);
CREATE INDEX ix_activo_recepcion  ON activos.activo (recepcion_id);

-- Desglose del costo de incorporación (Art. 26 del Reglamento)
CREATE TABLE activos.activo_costo (
    id              bigserial PRIMARY KEY,
    activo_id       bigint       NOT NULL REFERENCES activos.activo(id),
    concepto        varchar(30)  NOT NULL
                    CHECK (concepto IN ('PRECIO','FLETE','SEGURO','TRIBUTOS_IMPORTACION',
                                        'DESADUANIZACION','INSTALACION','MONTAJE','PRUEBAS','OTRO')),
    monto           numeric(18,2) NOT NULL,
    documento       varchar(60),
    observacion     varchar(250),
    created_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_activo_costo ON activos.activo_costo (activo_id);

-- Mejoras capitalizables posteriores (Art. 27 del Reglamento)
CREATE TABLE activos.mejora (
    id                      bigserial PRIMARY KEY,
    activo_id               bigint       NOT NULL REFERENCES activos.activo(id),
    fecha                   date         NOT NULL,
    descripcion             text         NOT NULL,
    monto                   numeric(18,2) NOT NULL CHECK (monto > 0),
    criterio                varchar(30)  NOT NULL
                            CHECK (criterio IN ('EXTIENDE_VIDA_UTIL','AUMENTA_CAPACIDAD',
                                                'MEJORA_CALIDAD','REDUCE_COSTOS')),
    meses_vida_adicional    integer      NOT NULL DEFAULT 0,
    informe_tecnico         varchar(60)  NOT NULL,
    aprobado_por            bigint,
    aplicada_en_periodo     date,
    created_at              timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN activos.mejora.informe_tecnico
    IS 'Obligatorio: toda capitalización requiere informe técnico previo.';

-- ============================================================================
-- 3. VALUACIÓN — CIERRE MENSUAL
-- ============================================================================

CREATE TABLE activos.cierre (
    id                  bigserial PRIMARY KEY,
    periodo             date         NOT NULL UNIQUE,   -- primer día del mes
    ufv_inicial         numeric(12,5),
    ufv_final           numeric(12,5),
    factor              numeric(14,8) GENERATED ALWAYS AS (
                            CASE WHEN ufv_inicial IS NULL OR ufv_inicial = 0
                                 THEN NULL ELSE ufv_final / ufv_inicial END
                        ) STORED,
    estado              varchar(15)  NOT NULL DEFAULT 'ABIERTO'
                        CHECK (estado IN ('ABIERTO','CALCULADO','CERRADO','ANULADO')),
    activos_procesados  integer,
    total_actualizacion numeric(18,2),
    total_dep_financiera numeric(18,2),
    total_dep_fiscal    numeric(18,2),
    total_no_deducible  numeric(18,2),
    comprobante_contable varchar(40),
    calculado_por       bigint,
    calculado_at        timestamptz,
    cerrado_por         bigint,
    cerrado_at          timestamptz,
    CONSTRAINT ck_cierre_periodo CHECK (date_trunc('month', periodo) = periodo)
);
COMMENT ON TABLE activos.cierre IS
    'Un cierre por mes. Orden obligatorio: actualizar por UFV, validar límite de valor recuperable, luego depreciar sobre el valor actualizado.';

CREATE TABLE activos.valuacion (
    id                          bigserial PRIMARY KEY,
    cierre_id                   bigint       NOT NULL REFERENCES activos.cierre(id),
    activo_id                   bigint       NOT NULL REFERENCES activos.activo(id),
    periodo                     date         NOT NULL,
    tipo                        varchar(12)  NOT NULL
                                CHECK (tipo IN ('FINANCIERA','IMPOSITIVA')),

    -- Base del activo
    valor_base_inicial          numeric(18,2) NOT NULL DEFAULT 0,
    actualizacion               numeric(18,2) NOT NULL DEFAULT 0,
    incremento_revaluo          numeric(18,2) NOT NULL DEFAULT 0,
    incremento_mejora           numeric(18,2) NOT NULL DEFAULT 0,
    ajuste_valor_recuperable    numeric(18,2) NOT NULL DEFAULT 0,
    valor_base_final            numeric(18,2) NOT NULL DEFAULT 0,

    -- Depreciación
    dep_acum_inicial            numeric(18,2) NOT NULL DEFAULT 0,
    dep_actualizacion           numeric(18,2) NOT NULL DEFAULT 0,
    dep_periodo                 numeric(18,2) NOT NULL DEFAULT 0,
    dep_periodo_no_deducible    numeric(18,2) NOT NULL DEFAULT 0,
    dep_acum_final              numeric(18,2) NOT NULL DEFAULT 0,

    valor_neto                  numeric(18,2) GENERATED ALWAYS AS
                                (valor_base_final - dep_acum_final) STORED,
    meses_depreciados           integer      NOT NULL DEFAULT 0,
    vida_util_meses             integer,

    CONSTRAINT uq_valuacion UNIQUE (activo_id, periodo, tipo),
    CONSTRAINT ck_valuacion_tope CHECK (dep_acum_final <= valor_base_final + 0.01),
    CONSTRAINT ck_valuacion_no_deducible CHECK (
        tipo = 'IMPOSITIVA' OR dep_periodo_no_deducible = 0
    )
);
COMMENT ON CONSTRAINT ck_valuacion_tope ON activos.valuacion
    IS 'DS 24051 Art. 22: la depreciación acumulada no puede superar el valor contabilizado del bien.';
COMMENT ON COLUMN activos.valuacion.dep_periodo_no_deducible
    IS 'Porción proveniente de revalúos técnicos. No deducible para el IUE.';

CREATE INDEX ix_valuacion_periodo ON activos.valuacion (periodo, tipo);
CREATE INDEX ix_valuacion_activo  ON activos.valuacion (activo_id, tipo, periodo DESC);

-- Prueba del límite de la NC 3 (costo o mercado, el más bajo)
CREATE TABLE activos.prueba_valor_recuperable (
    id                      bigserial PRIMARY KEY,
    activo_id               bigint       NOT NULL REFERENCES activos.activo(id),
    periodo                 date         NOT NULL,
    valor_actualizado_ufv   numeric(18,2) NOT NULL,
    valor_recuperable       numeric(18,2) NOT NULL,
    valor_adoptado          numeric(18,2) NOT NULL,
    metodo                  varchar(30)  NOT NULL
                            CHECK (metodo IN ('VALOR_NETO_REALIZACION','VALOR_UTILIZACION_ECONOMICA',
                                              'VALOR_MERCADO','TASACION_PERICIAL')),
    respaldo                varchar(250),
    registrado_por          bigint,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_prueba UNIQUE (activo_id, periodo)
);
COMMENT ON TABLE activos.prueba_valor_recuperable IS
    'NC 3: la actualización por UFV no puede exceder el valor recuperable. La verificación debe quedar documentada.';

-- ============================================================================
-- 4. REVALORIZACIÓN TÉCNICA (NC 4)
-- ============================================================================

CREATE TABLE activos.revaluo (
    id                      bigserial PRIMARY KEY,
    numero                  varchar(20)  NOT NULL UNIQUE,
    fecha                   date         NOT NULL,
    perito_nombre           varchar(150) NOT NULL,
    perito_matricula        varchar(40)  NOT NULL,
    perito_colegio          varchar(100) NOT NULL,
    informe_nro             varchar(60)  NOT NULL,
    acta_directorio_nro     varchar(40),
    acta_directorio_fecha   date,
    acta_junta_nro          varchar(40),
    acta_junta_fecha        date,
    estado                  varchar(20)  NOT NULL DEFAULT 'BORRADOR'
                            CHECK (estado IN ('BORRADOR','APROBADO_DIRECTORIO','APROBADO_JUNTA',
                                              'CONTABILIZADO','ANULADO')),
    periodo_aplicacion      date,
    total_ajuste            numeric(18,2) NOT NULL DEFAULT 0,
    total_aitb              numeric(18,2) NOT NULL DEFAULT 0,
    total_reserva           numeric(18,2) NOT NULL DEFAULT 0,
    created_by              bigint,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_revaluo_contabilizado CHECK (
        estado <> 'CONTABILIZADO'
        OR (acta_directorio_nro IS NOT NULL AND acta_junta_nro IS NOT NULL)
    )
);
COMMENT ON CONSTRAINT ck_revaluo_contabilizado ON activos.revaluo
    IS 'NC 4: el revalúo requiere aprobación del Directorio y de la Junta o Asamblea.';

CREATE TABLE activos.revaluo_detalle (
    id                      bigserial PRIMARY KEY,
    revaluo_id              bigint       NOT NULL REFERENCES activos.revaluo(id),
    activo_id               bigint       NOT NULL REFERENCES activos.activo(id),
    valor_base_previo       numeric(18,2) NOT NULL,
    dep_acum_previa         numeric(18,2) NOT NULL,
    valor_libros_previo     numeric(18,2) NOT NULL,
    valor_pericial          numeric(18,2) NOT NULL,
    ajuste_total            numeric(18,2) NOT NULL,
    importe_aitb            numeric(18,2) NOT NULL DEFAULT 0,
    importe_reserva         numeric(18,2) NOT NULL DEFAULT 0,
    nueva_vida_util_meses   integer,
    CONSTRAINT uq_revaluo_detalle UNIQUE (revaluo_id, activo_id),
    CONSTRAINT ck_revaluo_reparto CHECK (ajuste_total = importe_aitb + importe_reserva)
);
COMMENT ON COLUMN activos.revaluo_detalle.importe_reserva
    IS 'Excedente sobre la actualización NC 3. Va a Reserva por Revalúos Técnicos: solo capitalizable o para absorber pérdidas. No distribuible.';

-- ============================================================================
-- 5. DOCUMENTOS Y MOVIMIENTOS
-- ============================================================================

CREATE TABLE activos.documento (
    id                          bigserial PRIMARY KEY,
    tipo                        varchar(20)  NOT NULL
                                CHECK (tipo IN ('ASIGNACION','TRASPASO','SALIDA_TEMPORAL',
                                                'DEVOLUCION','BAJA')),
    numero                      varchar(30)  NOT NULL,
    gestion                     smallint     NOT NULL,
    fecha                       date         NOT NULL,
    estado                      varchar(15)  NOT NULL DEFAULT 'BORRADOR'
                                CHECK (estado IN ('BORRADOR','CONFIRMADO','ANULADO')),
    motivo                      text,
    observaciones               text,

    custodio_origen_id          bigint,
    custodio_destino_id         bigint,
    ubicacion_origen_id         bigint REFERENCES activos.ubicacion(id),
    ubicacion_destino_id        bigint REFERENCES activos.ubicacion(id),
    centro_costo_destino_id     bigint,

    -- Salida temporal
    destino_externo             varchar(250),
    fecha_retorno_comprometida  date,
    fecha_retorno_real          date,

    -- Baja
    causal                      varchar(30)
                                CHECK (causal IS NULL OR causal IN (
                                    'VENTA','PERMUTA','DONACION','HURTO_ROBO','PERDIDA_FORTUITA',
                                    'SINIESTRO','INUTILIZACION','DESTRUCCION','OBSOLESCENCIA',
                                    'DESMANTELAMIENTO','APORTE_CAPITAL','FIN_TENENCIA')),
    informe_comision            varchar(60),
    valor_disposicion           numeric(18,2),
    factura_venta_nro           varchar(40),
    resultado_disposicion       numeric(18,2),

    solicitante_id              bigint,
    autorizador_id              bigint,
    fecha_autorizacion          date,
    created_by                  bigint,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    confirmado_por              bigint,
    confirmado_at               timestamptz,
    anulado_por                 bigint,
    anulado_at                  timestamptz,
    motivo_anulacion            text,

    CONSTRAINT uq_documento UNIQUE (tipo, gestion, numero),
    CONSTRAINT ck_documento_baja CHECK (tipo <> 'BAJA' OR causal IS NOT NULL),
    CONSTRAINT ck_documento_confirmado CHECK (
        estado <> 'CONFIRMADO' OR (confirmado_por IS NOT NULL AND confirmado_at IS NOT NULL)
    ),
    CONSTRAINT ck_documento_anulado CHECK (
        estado <> 'ANULADO' OR (anulado_por IS NOT NULL AND motivo_anulacion IS NOT NULL)
    ),
    CONSTRAINT ck_documento_salida CHECK (
        tipo <> 'SALIDA_TEMPORAL' OR fecha_retorno_comprometida IS NOT NULL
    )
);
CREATE INDEX ix_documento_tipo_estado ON activos.documento (tipo, estado, fecha DESC);
CREATE INDEX ix_documento_pendiente_retorno
    ON activos.documento (fecha_retorno_comprometida)
    WHERE tipo = 'SALIDA_TEMPORAL' AND estado = 'CONFIRMADO' AND fecha_retorno_real IS NULL;

CREATE TABLE activos.documento_detalle (
    id                      bigserial PRIMARY KEY,
    documento_id            bigint       NOT NULL REFERENCES activos.documento(id),
    activo_id               bigint       NOT NULL REFERENCES activos.activo(id),
    estado_verificado       varchar(15),
    condicion_verificada    varchar(15),
    valor_libros_a_fecha    numeric(18,2),
    observacion             varchar(300),
    CONSTRAINT uq_documento_detalle UNIQUE (documento_id, activo_id)
);
CREATE INDEX ix_documento_detalle_activo ON activos.documento_detalle (activo_id);

-- Log inmutable. Se escribe solo al confirmar un documento.
CREATE TABLE activos.movimiento (
    id                      bigserial PRIMARY KEY,
    activo_id               bigint       NOT NULL REFERENCES activos.activo(id),
    documento_id            bigint REFERENCES activos.documento(id),
    tipo                    varchar(25)  NOT NULL
                            CHECK (tipo IN ('ALTA','ASIGNACION','TRASPASO','SALIDA_TEMPORAL',
                                            'RETORNO','DEVOLUCION','MEJORA','REVALUO',
                                            'CAMBIO_ESTADO','BAJA','AJUSTE_INVENTARIO')),
    fecha                   timestamptz  NOT NULL DEFAULT now(),
    custodio_anterior_id    bigint,
    custodio_nuevo_id       bigint,
    ubicacion_anterior_id   bigint,
    ubicacion_nueva_id      bigint,
    estado_anterior         varchar(20),
    estado_nuevo            varchar(20),
    detalle                 jsonb,
    usuario_id              bigint       NOT NULL
);
CREATE INDEX ix_movimiento_activo ON activos.movimiento (activo_id, fecha DESC);

-- ============================================================================
-- 6. MANTENIMIENTO Y SEGUROS
-- ============================================================================

CREATE TABLE activos.plan_mantenimiento (
    id                  bigserial PRIMARY KEY,
    nombre              varchar(150) NOT NULL,
    clase_id            bigint REFERENCES activos.clase(id),
    subclase_id         bigint REFERENCES activos.subclase(id),
    periodicidad_meses  smallint     NOT NULL CHECK (periodicidad_meses > 0),
    descripcion         text,
    gestion             smallint,
    activo              boolean      NOT NULL DEFAULT true
);

CREATE TABLE activos.mantenimiento (
    id                      bigserial PRIMARY KEY,
    activo_id               bigint       NOT NULL REFERENCES activos.activo(id),
    plan_id                 bigint REFERENCES activos.plan_mantenimiento(id),
    tipo                    varchar(12)  NOT NULL CHECK (tipo IN ('PREVENTIVO','CORRECTIVO')),
    fecha_programada        date,
    fecha_ejecucion         date,
    descripcion             text         NOT NULL,
    proveedor_id            bigint,
    costo                   numeric(18,2) NOT NULL DEFAULT 0,
    horas_fuera_servicio    numeric(10,2),
    resultado               varchar(20)
                            CHECK (resultado IS NULL OR resultado IN ('OPERATIVO','OPERATIVO_CON_OBSERVACIONES',
                                                                      'INSERVIBLE','PENDIENTE_REPUESTO')),
    es_capitalizable        boolean      NOT NULL DEFAULT false,
    mejora_id               bigint REFERENCES activos.mejora(id),
    informe_tecnico         varchar(60),
    registrado_por          bigint,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_mantenimiento_capitaliza CHECK (
        es_capitalizable = false OR (mejora_id IS NOT NULL AND informe_tecnico IS NOT NULL)
    )
);
CREATE INDEX ix_mantenimiento_activo ON activos.mantenimiento (activo_id, fecha_ejecucion DESC);

CREATE TABLE activos.poliza (
    id              bigserial PRIMARY KEY,
    aseguradora     varchar(150) NOT NULL,
    numero          varchar(60)  NOT NULL,
    ramo            varchar(80)  NOT NULL,
    fecha_inicio    date         NOT NULL,
    fecha_fin       date         NOT NULL,
    prima           numeric(18,2),
    observaciones   text,
    CONSTRAINT uq_poliza UNIQUE (aseguradora, numero),
    CONSTRAINT ck_poliza_vigencia CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE activos.poliza_activo (
    poliza_id       bigint       NOT NULL REFERENCES activos.poliza(id),
    activo_id       bigint       NOT NULL REFERENCES activos.activo(id),
    suma_asegurada  numeric(18,2) NOT NULL,
    PRIMARY KEY (poliza_id, activo_id)
);

-- ============================================================================
-- 7. INVENTARIO FÍSICO
-- ============================================================================

CREATE TABLE activos.inventario (
    id                  bigserial PRIMARY KEY,
    gestion             smallint     NOT NULL,
    descripcion         varchar(200) NOT NULL,
    fecha_corte         date         NOT NULL,
    alcance             text,
    estado              varchar(15)  NOT NULL DEFAULT 'PLANIFICADO'
                        CHECK (estado IN ('PLANIFICADO','EN_EJECUCION','VERIFICADO',
                                          'REGULARIZADO','CERRADO','ANULADO')),
    fecha_inicio        date,
    fecha_fin           date,
    acta_nro            varchar(30),
    total_registrados   integer,
    total_conformes     integer,
    total_faltantes     integer,
    total_sobrantes     integer,
    created_by          bigint,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    cerrado_por         bigint,
    cerrado_at          timestamptz
);
COMMENT ON COLUMN activos.inventario.estado IS
    'Solo pasa a CERRADO cuando todas las diferencias tienen ajuste contabilizado.';

CREATE TABLE activos.inventario_comision (
    inventario_id   bigint      NOT NULL REFERENCES activos.inventario(id),
    usuario_id      bigint      NOT NULL,
    rol             varchar(20) NOT NULL CHECK (rol IN ('PRESIDENTE','MIEMBRO','VERIFICADOR_CONTABLE')),
    PRIMARY KEY (inventario_id, usuario_id)
);

CREATE TABLE activos.inventario_detalle (
    id                      bigserial PRIMARY KEY,
    inventario_id           bigint       NOT NULL REFERENCES activos.inventario(id),
    activo_id               bigint REFERENCES activos.activo(id),
    codigo_leido            varchar(30),
    ubicacion_esperada_id   bigint REFERENCES activos.ubicacion(id),
    ubicacion_verificada_id bigint REFERENCES activos.ubicacion(id),
    custodio_esperado_id    bigint,
    custodio_verificado_id  bigint,
    condicion_verificada    varchar(15),
    resultado               varchar(20)  NOT NULL
                            CHECK (resultado IN ('CONFORME','FALTANTE','SOBRANTE','DIF_UBICACION',
                                                 'DIF_CUSTODIO','MAL_ESTADO','SIN_ETIQUETA','OCIOSO')),
    observacion             varchar(300),
    verificado_por          bigint,
    verificado_at           timestamptz,
    CONSTRAINT ck_inventario_detalle_ref CHECK (activo_id IS NOT NULL OR codigo_leido IS NOT NULL)
);
CREATE INDEX ix_inventario_detalle ON activos.inventario_detalle (inventario_id, resultado);

CREATE TABLE activos.inventario_ajuste (
    id                      bigserial PRIMARY KEY,
    inventario_detalle_id   bigint       NOT NULL REFERENCES activos.inventario_detalle(id),
    tipo_ajuste             varchar(25)  NOT NULL
                            CHECK (tipo_ajuste IN ('ALTA_SOBRANTE','BAJA_FALTANTE','RESARCIMIENTO',
                                                   'REGULARIZA_UBICACION','REGULARIZA_CUSTODIO',
                                                   'CAMBIO_CONDICION','DERIVA_A_BAJA')),
    descripcion             text,
    autorizado_por          bigint,
    fecha_autorizacion      date,
    documento_id            bigint REFERENCES activos.documento(id),
    comprobante_contable    varchar(40),
    estado                  varchar(15)  NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado IN ('PENDIENTE','AUTORIZADO','CONTABILIZADO','DESESTIMADO')),
    created_at              timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. ADJUNTOS
-- ============================================================================

CREATE TABLE activos.adjunto (
    id              bigserial PRIMARY KEY,
    entidad         varchar(30)  NOT NULL,   -- 'ACTIVO','DOCUMENTO','REVALUO','INVENTARIO','MANTENIMIENTO'
    entidad_id      bigint       NOT NULL,
    nombre          varchar(200) NOT NULL,
    path            varchar(400) NOT NULL,
    mime            varchar(100),
    tamano_bytes    bigint,
    hash_sha256     char(64),
    subido_por      bigint,
    created_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_adjunto_entidad ON activos.adjunto (entidad, entidad_id);

-- ============================================================================
-- 9. VISTAS PARA REPORTES
-- ============================================================================

-- R-AF-01 Auxiliar de activos fijos por cuenta contable
CREATE OR REPLACE VIEW activos.v_auxiliar AS
SELECT  v.periodo,
        c.codigo            AS clase_codigo,
        c.nombre            AS clase,
        c.cuenta_activo,
        c.cuenta_dep_acumulada,
        a.id                AS activo_id,
        a.codigo,
        a.denominacion,
        a.estado,
        v.valor_base_final,
        v.dep_acum_final,
        v.valor_neto
FROM    activos.valuacion v
JOIN    activos.activo a ON a.id = v.activo_id
JOIN    activos.clase  c ON c.id = a.clase_id
WHERE   v.tipo = 'FINANCIERA';

-- R-AF-02 Movimiento del período (insumo de la nota a los estados financieros)
CREATE OR REPLACE VIEW activos.v_movimiento_periodo AS
SELECT  v.periodo,
        c.nombre AS clase,
        SUM(v.valor_base_inicial)   AS saldo_inicial,
        SUM(v.incremento_mejora)    AS mejoras,
        SUM(v.actualizacion)        AS actualizacion_ufv,
        SUM(v.incremento_revaluo)   AS revaluos,
        SUM(v.ajuste_valor_recuperable) AS ajuste_limite,
        SUM(v.valor_base_final)     AS saldo_final,
        SUM(v.dep_acum_inicial)     AS dep_acum_inicial,
        SUM(v.dep_periodo)          AS dep_periodo,
        SUM(v.dep_acum_final)       AS dep_acum_final,
        SUM(v.valor_neto)           AS valor_neto
FROM    activos.valuacion v
JOIN    activos.activo a ON a.id = v.activo_id
JOIN    activos.clase  c ON c.id = a.clase_id
WHERE   v.tipo = 'FINANCIERA'
GROUP BY v.periodo, c.nombre;

-- R-AF-03 Conciliación financiera vs. impositiva (determinación del IUE)
CREATE OR REPLACE VIEW activos.v_conciliacion_fiscal AS
SELECT  f.periodo,
        a.id AS activo_id,
        a.codigo,
        a.denominacion,
        a.regimen_fiscal,
        f.dep_periodo               AS dep_financiera,
        i.dep_periodo               AS dep_impositiva,
        i.dep_periodo_no_deducible  AS dep_no_deducible,
        (i.dep_periodo - i.dep_periodo_no_deducible) AS dep_deducible,
        f.dep_periodo - (i.dep_periodo - i.dep_periodo_no_deducible) AS diferencia
FROM    activos.valuacion f
JOIN    activos.valuacion i
        ON i.activo_id = f.activo_id AND i.periodo = f.periodo AND i.tipo = 'IMPOSITIVA'
JOIN    activos.activo a ON a.id = f.activo_id
WHERE   f.tipo = 'FINANCIERA';

-- R-AF-05 Inventario por custodio
CREATE OR REPLACE VIEW activos.v_por_custodio AS
SELECT  a.custodio_id,
        a.id AS activo_id,
        a.codigo,
        a.denominacion,
        a.marca, a.modelo, a.serie,
        a.estado, a.condicion,
        u.nombre AS ubicacion,
        d.numero AS acta_asignacion,
        d.fecha  AS fecha_asignacion
FROM    activos.activo a
LEFT JOIN activos.ubicacion u ON u.id = a.ubicacion_id
LEFT JOIN LATERAL (
        SELECT doc.numero, doc.fecha
        FROM   activos.documento doc
        JOIN   activos.documento_detalle dd ON dd.documento_id = doc.id
        WHERE  dd.activo_id = a.id
          AND  doc.tipo = 'ASIGNACION'
          AND  doc.estado = 'CONFIRMADO'
        ORDER BY doc.fecha DESC
        LIMIT 1
) d ON true
WHERE   a.estado <> 'DADO_DE_BAJA';

-- Tablero de alertas (controles automáticos del Manual)
CREATE OR REPLACE VIEW activos.v_alertas AS
SELECT 'EN_USO_SIN_CUSTODIO'   AS alerta, a.id, a.codigo, a.denominacion, NULL::date AS referencia
FROM   activos.activo a WHERE a.estado = 'EN_USO' AND a.custodio_id IS NULL
UNION ALL
SELECT 'SIN_FECHA_INICIO_USO', a.id, a.codigo, a.denominacion, a.fecha_incorporacion
FROM   activos.activo a
WHERE  a.estado NOT IN ('DADO_DE_BAJA','REGISTRADO') AND a.fecha_inicio_uso IS NULL
UNION ALL
SELECT 'TOTALMENTE_DEPRECIADO_EN_USO', a.id, a.codigo, a.denominacion, NULL
FROM   activos.activo a
JOIN   LATERAL (
        SELECT valor_neto FROM activos.valuacion v
        WHERE v.activo_id = a.id AND v.tipo = 'FINANCIERA'
        ORDER BY v.periodo DESC LIMIT 1
) ult ON true
WHERE  a.estado = 'EN_USO' AND ult.valor_neto <= 0
UNION ALL
SELECT 'SALIDA_TEMPORAL_VENCIDA', a.id, a.codigo, a.denominacion, d.fecha_retorno_comprometida
FROM   activos.documento d
JOIN   activos.documento_detalle dd ON dd.documento_id = d.id
JOIN   activos.activo a ON a.id = dd.activo_id
WHERE  d.tipo = 'SALIDA_TEMPORAL' AND d.estado = 'CONFIRMADO'
  AND  d.fecha_retorno_real IS NULL AND d.fecha_retorno_comprometida < CURRENT_DATE
UNION ALL
SELECT 'POLIZA_POR_VENCER', a.id, a.codigo, a.denominacion, p.fecha_fin
FROM   activos.poliza p
JOIN   activos.poliza_activo pa ON pa.poliza_id = p.id
JOIN   activos.activo a ON a.id = pa.activo_id
WHERE  p.fecha_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';

-- ============================================================================
-- 10. DATOS INICIALES — Anexo del Artículo 22 del DS 24051
-- ============================================================================

INSERT INTO activos.clase (codigo, nombre, deprecia, vida_util_fiscal_meses, coeficiente_fiscal) VALUES
('01','Terrenos',                                   false, NULL, NULL),
('02','Edificaciones y obras civiles',              true,  480, 0.0250),
('03','Muebles y enseres de oficina',               true,  120, 0.1000),
('04','Equipos e instalaciones',                    true,   96, 0.1250),
('05','Equipos de computación',                     true,   48, 0.2500),
('06','Maquinaria en general',                      true,   96, 0.1250),
('07','Maquinaria para la construcción',            true,   60, 0.2000),
('08','Vehículos automotores',                      true,   60, 0.2000),
('09','Herramientas en general',                    true,   48, 0.2500),
('10','Maquinaria agrícola',                        true,   48, 0.2500),
('11','Barcos y lanchas en general',                true,  120, 0.1000),
('12','Aviones',                                    true,   60, 0.2000),
('13','Silos, almacenes y galpones',                true,  240, 0.0500),
('14','Viviendas para el personal',                 true,  240, 0.0500),
('15','Muebles y enseres en viviendas del personal',true,  120, 0.1000),
('16','Canales de regadío y pozos',                 true,  240, 0.0500),
('17','Estanques, bañaderos y abrevaderos',         true,  120, 0.1000),
('18','Alambrados, tranqueras y vallas',            true,  120, 0.1000),
('19','Tinglados y cobertizos de madera',           true,  120, 0.1000),
('20','Tinglados y cobertizos de metal',            true,  240, 0.0500),
('21','Instalaciones de electrificación y telefonía rurales', true, 120, 0.1000),
('22','Caminos interiores',                         true,  120, 0.1000),
('23','Animales de trabajo',                        true,   48, 0.2500),
('24','Reproductores y hembras de pedigree',        true,   96, 0.1250);

INSERT INTO activos.clase (codigo, nombre, deprecia, vida_util_fiscal_meses, coeficiente_fiscal, es_bien_control) VALUES
('99','Bienes de control (bajo umbral)', false, NULL, NULL, true);

INSERT INTO activos.parametro (clave, valor, tipo_dato, descripcion, vigente_desde) VALUES
('UMBRAL_CAPITALIZACION_UFV', '500',  'numero',   'Umbral mínimo para capitalizar, en UFV (Art. 22 del Reglamento)', CURRENT_DATE),
('DIAS_HABILES_ALTA',         '5',    'numero',   'Plazo máximo de registro desde la recepción',                      CURRENT_DATE),
('DIAS_PARA_OCIOSO',          '90',   'numero',   'Días sin uso para calificar un bien como ocioso',                  CURRENT_DATE),
('DIAS_ALERTA_POLIZA',        '30',   'numero',   'Anticipación de alerta de vencimiento de póliza',                  CURRENT_DATE),
('REGIMEN_DS5563_ADOPTADO',   'false','booleano', 'La empresa se acoge al régimen de depreciación acelerada 2026',    CURRENT_DATE),
('PREFIJO_CODIGO',            'AF',   'texto',    'Prefijo del código de activo',                                     CURRENT_DATE),
('SIGLA_EMPRESA',             'XYZ',  'texto',    'Sigla de la empresa en el código de activo',                       CURRENT_DATE);

-- ============================================================================
-- 11. [INTEGRACIÓN] — Ajustar a los nombres reales del sistema de almacenes
-- ============================================================================
-- Descomentar y corregir los nombres de tabla antes de aplicar en producción.
--
-- ALTER TABLE activos.activo
--   ADD CONSTRAINT fk_activo_proveedor  FOREIGN KEY (proveedor_id)      REFERENCES public.proveedores(id),
--   ADD CONSTRAINT fk_activo_recepcion  FOREIGN KEY (recepcion_id)      REFERENCES public.recepciones(id),
--   ADD CONSTRAINT fk_activo_almacen    FOREIGN KEY (almacen_origen_id) REFERENCES public.almacenes(id),
--   ADD CONSTRAINT fk_activo_custodio   FOREIGN KEY (custodio_id)       REFERENCES public.users(id),
--   ADD CONSTRAINT fk_activo_ccosto     FOREIGN KEY (centro_costo_id)   REFERENCES public.centros_costo(id);
--
-- ALTER TABLE activos.ubicacion
--   ADD CONSTRAINT fk_ubicacion_unidad  FOREIGN KEY (unidad_org_id)     REFERENCES public.unidades_organizacionales(id);
--
-- ALTER TABLE activos.documento
--   ADD CONSTRAINT fk_doc_custodio_ori  FOREIGN KEY (custodio_origen_id)  REFERENCES public.users(id),
--   ADD CONSTRAINT fk_doc_custodio_des  FOREIGN KEY (custodio_destino_id) REFERENCES public.users(id);
--
-- Marca en la recepción del almacén para derivar la línea a activos fijos:
-- ALTER TABLE public.recepcion_detalle
--   ADD COLUMN destino varchar(15) NOT NULL DEFAULT 'INVENTARIO'
--   CHECK (destino IN ('INVENTARIO','ACTIVO_FIJO','BIEN_CONTROL','CONSUMO_DIRECTO'));
-- ============================================================================