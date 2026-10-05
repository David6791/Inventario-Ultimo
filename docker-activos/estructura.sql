--
-- PostgreSQL database dump
--

\restrict UBwVtqRTcaEF5hCvsbcc5izOoJq1XzQ4XGvpQPdOWVeUvtQeP2TVw7LpIWcNFdY

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: inmutable_unaccent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inmutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT unaccent('unaccent', $1) $_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: almacenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.almacenes (
    id bigint NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(120) NOT NULL,
    ubicacion character varying(200),
    responsable character varying(120),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: almacenes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.almacenes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: almacenes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.almacenes_id_seq OWNED BY public.almacenes.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: capas_existencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capas_existencia (
    id bigint NOT NULL,
    producto_id bigint NOT NULL,
    almacen_id bigint NOT NULL,
    ingreso_detalle_id bigint,
    fecha timestamp(0) without time zone NOT NULL,
    cantidad_inicial numeric(14,4) NOT NULL,
    cantidad_restante numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) NOT NULL,
    lote character varying(60),
    fecha_vencimiento date,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT capa_inicial_positiva CHECK ((cantidad_inicial > (0)::numeric)),
    CONSTRAINT capa_restante_valido CHECK (((cantidad_restante >= (0)::numeric) AND (cantidad_restante <= cantidad_inicial)))
);


--
-- Name: capas_existencia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capas_existencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capas_existencia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capas_existencia_id_seq OWNED BY public.capas_existencia.id;


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id bigint NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion character varying(250),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: consumos_capa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumos_capa (
    id bigint NOT NULL,
    salida_detalle_id bigint NOT NULL,
    capa_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT consumo_cantidad_positiva CHECK ((cantidad > (0)::numeric))
);


--
-- Name: consumos_capa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consumos_capa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consumos_capa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consumos_capa_id_seq OWNED BY public.consumos_capa.id;


--
-- Name: contadores_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contadores_documento (
    id bigint NOT NULL,
    almacen_id bigint NOT NULL,
    tipo character varying(30) NOT NULL,
    gestion smallint NOT NULL,
    ultimo integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: contadores_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contadores_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contadores_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contadores_documento_id_seq OWNED BY public.contadores_documento.id;


--
-- Name: devoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devoluciones (
    id bigint NOT NULL,
    numero character varying(30) NOT NULL,
    gestion smallint NOT NULL,
    fecha date NOT NULL,
    salida_id bigint NOT NULL,
    almacen_id bigint NOT NULL,
    solicitante_id bigint,
    unidad_solicitante_id bigint,
    solicitante_nombre character varying(165),
    unidad_nombre character varying(150),
    salida_numero character varying(30) NOT NULL,
    motivo character varying(40) NOT NULL,
    costo_total numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    cantidad_lineas integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'registrada'::character varying NOT NULL,
    motivo_anulacion character varying(255),
    observaciones text,
    pdf_path character varying(255),
    nota_firmada boolean DEFAULT false NOT NULL,
    usuario_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: devoluciones_consumo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devoluciones_consumo (
    id bigint NOT NULL,
    devolucion_detalle_id bigint NOT NULL,
    consumo_capa_id bigint NOT NULL,
    capa_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) NOT NULL,
    costo_total numeric(14,2) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: devoluciones_consumo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devoluciones_consumo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devoluciones_consumo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devoluciones_consumo_id_seq OWNED BY public.devoluciones_consumo.id;


--
-- Name: devoluciones_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devoluciones_detalle (
    id bigint NOT NULL,
    devolucion_id bigint NOT NULL,
    salida_detalle_id bigint NOT NULL,
    producto_id bigint NOT NULL,
    producto_codigo character varying(30) NOT NULL,
    producto_nombre character varying(200) NOT NULL,
    unidad_medida character varying(20),
    cantidad numeric(14,4) NOT NULL,
    costo_total numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    estado_bien character varying(20) DEFAULT 'bueno'::character varying NOT NULL,
    observaciones text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: devoluciones_detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devoluciones_detalle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devoluciones_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devoluciones_detalle_id_seq OWNED BY public.devoluciones_detalle.id;


--
-- Name: devoluciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devoluciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devoluciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devoluciones_id_seq OWNED BY public.devoluciones.id;


--
-- Name: existencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.existencias (
    id bigint NOT NULL,
    producto_id bigint NOT NULL,
    almacen_id bigint NOT NULL,
    cantidad numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    costo_promedio numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    ubicacion_fisica character varying(60),
    ultimo_movimiento_en timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT existencias_no_negativas CHECK ((cantidad >= (0)::numeric))
);


--
-- Name: existencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.existencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: existencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.existencias_id_seq OWNED BY public.existencias.id;


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection character varying(255) NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: ingreso_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingreso_detalles (
    id bigint NOT NULL,
    ingreso_id bigint NOT NULL,
    producto_id bigint NOT NULL,
    solicitud_compra_detalle_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) NOT NULL,
    lote character varying(60),
    fecha_vencimiento date,
    observacion character varying(300),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT id_cantidad_positiva CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT id_costo_no_negativo CHECK ((costo_unitario >= (0)::numeric))
);


--
-- Name: ingreso_detalles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingreso_detalles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingreso_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingreso_detalles_id_seq OWNED BY public.ingreso_detalles.id;


--
-- Name: ingresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingresos (
    id bigint NOT NULL,
    numero character varying(40) NOT NULL,
    almacen_id bigint NOT NULL,
    solicitud_compra_id bigint NOT NULL,
    fecha date NOT NULL,
    proveedor character varying(200) NOT NULL,
    tipo_documento character varying(30) NOT NULL,
    numero_documento character varying(40),
    fecha_documento date,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    respaldo_ruta character varying(255),
    respaldo_nombre character varying(200),
    respaldo_subido_en timestamp(0) without time zone,
    confirmada_en timestamp(0) without time zone,
    registrado_por bigint NOT NULL,
    confirmada_por bigint,
    motivo_anulacion character varying(300),
    anulada_en timestamp(0) without time zone,
    anulada_por bigint,
    observaciones text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT ingresos_estado_valido CHECK (((estado)::text = ANY ((ARRAY['borrador'::character varying, 'confirmada'::character varying, 'anulada'::character varying])::text[])))
);


--
-- Name: ingresos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingresos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingresos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingresos_id_seq OWNED BY public.ingresos.id;


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: kardex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kardex (
    id bigint NOT NULL,
    producto_id bigint NOT NULL,
    almacen_id bigint NOT NULL,
    fecha timestamp(0) without time zone NOT NULL,
    tipo character varying(20) NOT NULL,
    documento_tipo character varying(30) NOT NULL,
    documento_id bigint NOT NULL,
    documento_numero character varying(40) NOT NULL,
    entrada numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    salida numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    saldo numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    costo_total numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    registrado_por bigint NOT NULL,
    observacion character varying(300),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT kardex_un_solo_sentido CHECK ((((entrada > (0)::numeric) AND (salida = (0)::numeric)) OR ((salida > (0)::numeric) AND (entrada = (0)::numeric))))
);


--
-- Name: kardex_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kardex_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kardex_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kardex_id_seq OWNED BY public.kardex.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: model_has_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_has_permissions (
    permission_id bigint NOT NULL,
    model_type character varying(255) NOT NULL,
    model_id bigint NOT NULL
);


--
-- Name: model_has_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_has_roles (
    role_id bigint NOT NULL,
    model_type character varying(255) NOT NULL,
    model_id bigint NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    guard_name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name text NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id bigint NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion character varying(500),
    categoria_id bigint NOT NULL,
    unidad_medida_id bigint NOT NULL,
    partida_presupuestaria character varying(20),
    codigo_barras character varying(60),
    stock_minimo numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    stock_maximo numeric(14,4),
    controla_lote boolean DEFAULT false NOT NULL,
    controla_vencimiento boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: role_has_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_has_permissions (
    permission_id bigint NOT NULL,
    role_id bigint NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    guard_name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    descripcion character varying(200),
    es_sistema boolean DEFAULT false NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: salida_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salida_detalles (
    id bigint NOT NULL,
    salida_id bigint NOT NULL,
    producto_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    observacion character varying(300),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT sd_cantidad_positiva CHECK ((cantidad > (0)::numeric))
);


--
-- Name: salida_detalles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salida_detalles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salida_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salida_detalles_id_seq OWNED BY public.salida_detalles.id;


--
-- Name: salidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salidas (
    id bigint NOT NULL,
    numero character varying(40) NOT NULL,
    almacen_id bigint NOT NULL,
    fecha date NOT NULL,
    unidad_solicitante character varying(150) NOT NULL,
    solicitante character varying(150) NOT NULL,
    recibido_por character varying(150) NOT NULL,
    centro_costo character varying(60),
    destino character varying(200),
    motivo text,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    respaldo_ruta character varying(255),
    respaldo_nombre character varying(200),
    respaldo_subido_en timestamp(0) without time zone,
    confirmada_en timestamp(0) without time zone,
    registrado_por bigint NOT NULL,
    confirmada_por bigint,
    motivo_anulacion character varying(300),
    anulada_en timestamp(0) without time zone,
    anulada_por bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    unidad_solicitante_id bigint,
    solicitante_id bigint,
    recibido_por_id bigint,
    CONSTRAINT salidas_estado_valido CHECK (((estado)::text = ANY ((ARRAY['borrador'::character varying, 'confirmada'::character varying, 'anulada'::character varying])::text[])))
);


--
-- Name: salidas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salidas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salidas_id_seq OWNED BY public.salidas.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: solicitantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitantes (
    id bigint NOT NULL,
    unidad_solicitante_id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    ci character varying(20),
    cargo character varying(120),
    telefono character varying(30),
    autorizado_retirar boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: solicitantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitantes_id_seq OWNED BY public.solicitantes.id;


--
-- Name: solicitud_compra_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitud_compra_detalles (
    id bigint NOT NULL,
    solicitud_compra_id bigint NOT NULL,
    producto_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    cantidad_atendida numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    especificacion character varying(300),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT scd_atendida_no_excede CHECK (((cantidad_atendida >= (0)::numeric) AND (cantidad_atendida <= cantidad))),
    CONSTRAINT scd_cantidad_positiva CHECK ((cantidad > (0)::numeric))
);


--
-- Name: solicitud_compra_detalles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitud_compra_detalles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitud_compra_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitud_compra_detalles_id_seq OWNED BY public.solicitud_compra_detalles.id;


--
-- Name: solicitudes_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_compra (
    id bigint NOT NULL,
    numero character varying(40) NOT NULL,
    almacen_id bigint NOT NULL,
    fecha date NOT NULL,
    unidad_solicitante character varying(150) NOT NULL,
    solicitante character varying(150) NOT NULL,
    justificacion text,
    partida_presupuestaria character varying(20),
    monto_estimado numeric(14,2),
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    documento_ruta character varying(255),
    documento_nombre character varying(200),
    fecha_aprobacion date,
    observacion_aprobacion character varying(300),
    registrado_por bigint NOT NULL,
    aprobado_por bigint,
    observaciones text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT sc_estado_valido CHECK (((estado)::text = ANY ((ARRAY['borrador'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'atendida_parcial'::character varying, 'atendida'::character varying, 'anulada'::character varying])::text[])))
);


--
-- Name: solicitudes_compra_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_compra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_compra_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_compra_id_seq OWNED BY public.solicitudes_compra.id;


--
-- Name: transferencia_capas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transferencia_capas (
    id bigint NOT NULL,
    transferencia_detalle_id bigint NOT NULL,
    capa_origen_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    costo_unitario numeric(14,4) NOT NULL,
    lote character varying(60),
    fecha_vencimiento date,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT tc_cantidad_positiva CHECK ((cantidad > (0)::numeric))
);


--
-- Name: transferencia_capas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transferencia_capas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transferencia_capas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transferencia_capas_id_seq OWNED BY public.transferencia_capas.id;


--
-- Name: transferencia_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transferencia_detalles (
    id bigint NOT NULL,
    transferencia_id bigint NOT NULL,
    producto_id bigint NOT NULL,
    cantidad numeric(14,4) NOT NULL,
    cantidad_recibida numeric(14,4),
    observacion character varying(300),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT td_cantidad_positiva CHECK ((cantidad > (0)::numeric))
);


--
-- Name: transferencia_detalles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transferencia_detalles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transferencia_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transferencia_detalles_id_seq OWNED BY public.transferencia_detalles.id;


--
-- Name: transferencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transferencias (
    id bigint NOT NULL,
    numero character varying(40) NOT NULL,
    almacen_origen_id bigint NOT NULL,
    almacen_destino_id bigint NOT NULL,
    fecha date NOT NULL,
    motivo text,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    transportista character varying(150),
    despachada_en timestamp(0) without time zone,
    despachada_por bigint,
    recibida_en timestamp(0) without time zone,
    recibida_por bigint,
    observacion_recepcion character varying(300),
    motivo_anulacion character varying(300),
    anulada_en timestamp(0) without time zone,
    anulada_por bigint,
    registrado_por bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT transferencia_almacenes_distintos CHECK ((almacen_origen_id <> almacen_destino_id)),
    CONSTRAINT transferencia_estado_valido CHECK (((estado)::text = ANY ((ARRAY['borrador'::character varying, 'despachada'::character varying, 'recibida'::character varying, 'anulada'::character varying])::text[])))
);


--
-- Name: transferencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transferencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transferencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transferencias_id_seq OWNED BY public.transferencias.id;


--
-- Name: unidades_medida; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidades_medida (
    id bigint NOT NULL,
    codigo character varying(10) NOT NULL,
    nombre character varying(60) NOT NULL,
    permite_decimales boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: unidades_medida_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unidades_medida_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unidades_medida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unidades_medida_id_seq OWNED BY public.unidades_medida.id;


--
-- Name: unidades_solicitantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidades_solicitantes (
    id bigint NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(150) NOT NULL,
    responsable character varying(150),
    centro_costo character varying(60),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: unidades_solicitantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unidades_solicitantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unidades_solicitantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unidades_solicitantes_id_seq OWNED BY public.unidades_solicitantes.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    ci character varying(20),
    cargo character varying(120),
    telefono character varying(30),
    activo boolean DEFAULT true NOT NULL,
    debe_cambiar_clave boolean DEFAULT false NOT NULL,
    ultimo_acceso_en timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: usuario_almacen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_almacen (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    almacen_id bigint NOT NULL,
    es_predeterminado boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: usuario_almacen_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_almacen_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_almacen_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_almacen_id_seq OWNED BY public.usuario_almacen.id;


--
-- Name: almacenes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.almacenes ALTER COLUMN id SET DEFAULT nextval('public.almacenes_id_seq'::regclass);


--
-- Name: capas_existencia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas_existencia ALTER COLUMN id SET DEFAULT nextval('public.capas_existencia_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: consumos_capa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumos_capa ALTER COLUMN id SET DEFAULT nextval('public.consumos_capa_id_seq'::regclass);


--
-- Name: contadores_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contadores_documento ALTER COLUMN id SET DEFAULT nextval('public.contadores_documento_id_seq'::regclass);


--
-- Name: devoluciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones ALTER COLUMN id SET DEFAULT nextval('public.devoluciones_id_seq'::regclass);


--
-- Name: devoluciones_consumo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_consumo ALTER COLUMN id SET DEFAULT nextval('public.devoluciones_consumo_id_seq'::regclass);


--
-- Name: devoluciones_detalle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_detalle ALTER COLUMN id SET DEFAULT nextval('public.devoluciones_detalle_id_seq'::regclass);


--
-- Name: existencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias ALTER COLUMN id SET DEFAULT nextval('public.existencias_id_seq'::regclass);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: ingreso_detalles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso_detalles ALTER COLUMN id SET DEFAULT nextval('public.ingreso_detalles_id_seq'::regclass);


--
-- Name: ingresos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos ALTER COLUMN id SET DEFAULT nextval('public.ingresos_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: kardex id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex ALTER COLUMN id SET DEFAULT nextval('public.kardex_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: salida_detalles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_detalles ALTER COLUMN id SET DEFAULT nextval('public.salida_detalles_id_seq'::regclass);


--
-- Name: salidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas ALTER COLUMN id SET DEFAULT nextval('public.salidas_id_seq'::regclass);


--
-- Name: solicitantes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitantes ALTER COLUMN id SET DEFAULT nextval('public.solicitantes_id_seq'::regclass);


--
-- Name: solicitud_compra_detalles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_compra_detalles ALTER COLUMN id SET DEFAULT nextval('public.solicitud_compra_detalles_id_seq'::regclass);


--
-- Name: solicitudes_compra id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_compra ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_compra_id_seq'::regclass);


--
-- Name: transferencia_capas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_capas ALTER COLUMN id SET DEFAULT nextval('public.transferencia_capas_id_seq'::regclass);


--
-- Name: transferencia_detalles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_detalles ALTER COLUMN id SET DEFAULT nextval('public.transferencia_detalles_id_seq'::regclass);


--
-- Name: transferencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias ALTER COLUMN id SET DEFAULT nextval('public.transferencias_id_seq'::regclass);


--
-- Name: unidades_medida id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_medida ALTER COLUMN id SET DEFAULT nextval('public.unidades_medida_id_seq'::regclass);


--
-- Name: unidades_solicitantes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_solicitantes ALTER COLUMN id SET DEFAULT nextval('public.unidades_solicitantes_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: usuario_almacen id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_almacen ALTER COLUMN id SET DEFAULT nextval('public.usuario_almacen_id_seq'::regclass);


--
-- Name: almacenes almacenes_codigo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.almacenes
    ADD CONSTRAINT almacenes_codigo_unique UNIQUE (codigo);


--
-- Name: almacenes almacenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.almacenes
    ADD CONSTRAINT almacenes_pkey PRIMARY KEY (id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: capas_existencia capas_existencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas_existencia
    ADD CONSTRAINT capas_existencia_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_codigo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_codigo_unique UNIQUE (codigo);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: consumos_capa consumos_capa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumos_capa
    ADD CONSTRAINT consumos_capa_pkey PRIMARY KEY (id);


--
-- Name: contadores_documento contadores_documento_almacen_id_tipo_gestion_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contadores_documento
    ADD CONSTRAINT contadores_documento_almacen_id_tipo_gestion_unique UNIQUE (almacen_id, tipo, gestion);


--
-- Name: contadores_documento contadores_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contadores_documento
    ADD CONSTRAINT contadores_documento_pkey PRIMARY KEY (id);


--
-- Name: devoluciones_consumo devoluciones_consumo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_consumo
    ADD CONSTRAINT devoluciones_consumo_pkey PRIMARY KEY (id);


--
-- Name: devoluciones_detalle devoluciones_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_detalle
    ADD CONSTRAINT devoluciones_detalle_pkey PRIMARY KEY (id);


--
-- Name: devoluciones devoluciones_numero_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_numero_unique UNIQUE (numero);


--
-- Name: devoluciones devoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_pkey PRIMARY KEY (id);


--
-- Name: existencias existencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_pkey PRIMARY KEY (id);


--
-- Name: existencias existencias_producto_id_almacen_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_producto_id_almacen_id_unique UNIQUE (producto_id, almacen_id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: ingreso_detalles ingreso_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso_detalles
    ADD CONSTRAINT ingreso_detalles_pkey PRIMARY KEY (id);


--
-- Name: ingresos ingresos_numero_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_numero_unique UNIQUE (numero);


--
-- Name: ingresos ingresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_pkey PRIMARY KEY (id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: kardex kardex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: model_has_permissions model_has_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_has_permissions
    ADD CONSTRAINT model_has_permissions_pkey PRIMARY KEY (permission_id, model_id, model_type);


--
-- Name: model_has_roles model_has_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_has_roles
    ADD CONSTRAINT model_has_roles_pkey PRIMARY KEY (role_id, model_id, model_type);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: permissions permissions_name_guard_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_guard_name_unique UNIQUE (name, guard_name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: productos productos_codigo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_unique UNIQUE (codigo);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: role_has_permissions role_has_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_has_permissions
    ADD CONSTRAINT role_has_permissions_pkey PRIMARY KEY (permission_id, role_id);


--
-- Name: roles roles_name_guard_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_guard_name_unique UNIQUE (name, guard_name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salida_detalles salida_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_detalles
    ADD CONSTRAINT salida_detalles_pkey PRIMARY KEY (id);


--
-- Name: salida_detalles salida_detalles_salida_id_producto_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_detalles
    ADD CONSTRAINT salida_detalles_salida_id_producto_id_unique UNIQUE (salida_id, producto_id);


--
-- Name: salidas salidas_numero_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_numero_unique UNIQUE (numero);


--
-- Name: salidas salidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: solicitantes solicitantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitantes
    ADD CONSTRAINT solicitantes_pkey PRIMARY KEY (id);


--
-- Name: solicitantes solicitantes_unidad_solicitante_id_nombre_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitantes
    ADD CONSTRAINT solicitantes_unidad_solicitante_id_nombre_unique UNIQUE (unidad_solicitante_id, nombre);


--
-- Name: solicitud_compra_detalles solicitud_compra_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_compra_detalles
    ADD CONSTRAINT solicitud_compra_detalles_pkey PRIMARY KEY (id);


--
-- Name: solicitud_compra_detalles solicitud_compra_detalles_solicitud_compra_id_producto_id_uniqu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_compra_detalles
    ADD CONSTRAINT solicitud_compra_detalles_solicitud_compra_id_producto_id_uniqu UNIQUE (solicitud_compra_id, producto_id);


--
-- Name: solicitudes_compra solicitudes_compra_numero_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_compra
    ADD CONSTRAINT solicitudes_compra_numero_unique UNIQUE (numero);


--
-- Name: solicitudes_compra solicitudes_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_compra
    ADD CONSTRAINT solicitudes_compra_pkey PRIMARY KEY (id);


--
-- Name: transferencia_capas transferencia_capas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_capas
    ADD CONSTRAINT transferencia_capas_pkey PRIMARY KEY (id);


--
-- Name: transferencia_detalles transferencia_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_detalles
    ADD CONSTRAINT transferencia_detalles_pkey PRIMARY KEY (id);


--
-- Name: transferencia_detalles transferencia_detalles_transferencia_id_producto_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_detalles
    ADD CONSTRAINT transferencia_detalles_transferencia_id_producto_id_unique UNIQUE (transferencia_id, producto_id);


--
-- Name: transferencias transferencias_numero_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_numero_unique UNIQUE (numero);


--
-- Name: transferencias transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_pkey PRIMARY KEY (id);


--
-- Name: unidades_medida unidades_medida_codigo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_codigo_unique UNIQUE (codigo);


--
-- Name: unidades_medida unidades_medida_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_pkey PRIMARY KEY (id);


--
-- Name: unidades_solicitantes unidades_solicitantes_codigo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_solicitantes
    ADD CONSTRAINT unidades_solicitantes_codigo_unique UNIQUE (codigo);


--
-- Name: unidades_solicitantes unidades_solicitantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_solicitantes
    ADD CONSTRAINT unidades_solicitantes_pkey PRIMARY KEY (id);


--
-- Name: users users_ci_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_ci_unique UNIQUE (ci);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: usuario_almacen usuario_almacen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_almacen
    ADD CONSTRAINT usuario_almacen_pkey PRIMARY KEY (id);


--
-- Name: usuario_almacen usuario_almacen_user_id_almacen_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_almacen
    ADD CONSTRAINT usuario_almacen_user_id_almacen_id_unique UNIQUE (user_id, almacen_id);


--
-- Name: almacenes_activo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX almacenes_activo_index ON public.almacenes USING btree (activo);


--
-- Name: cache_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);


--
-- Name: cache_locks_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);


--
-- Name: capas_existencia_ingreso_detalle_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capas_existencia_ingreso_detalle_id_index ON public.capas_existencia USING btree (ingreso_detalle_id);


--
-- Name: capas_existencia_producto_id_almacen_id_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capas_existencia_producto_id_almacen_id_fecha_index ON public.capas_existencia USING btree (producto_id, almacen_id, fecha);


--
-- Name: categorias_activo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categorias_activo_index ON public.categorias USING btree (activo);


--
-- Name: consumos_capa_salida_detalle_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consumos_capa_salida_detalle_id_index ON public.consumos_capa USING btree (salida_detalle_id);


--
-- Name: devoluciones_consumo_capa_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_consumo_capa_id_index ON public.devoluciones_consumo USING btree (capa_id);


--
-- Name: devoluciones_consumo_consumo_capa_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_consumo_consumo_capa_id_index ON public.devoluciones_consumo USING btree (consumo_capa_id);


--
-- Name: devoluciones_consumo_devolucion_detalle_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_consumo_devolucion_detalle_id_index ON public.devoluciones_consumo USING btree (devolucion_detalle_id);


--
-- Name: devoluciones_detalle_devolucion_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_detalle_devolucion_id_index ON public.devoluciones_detalle USING btree (devolucion_id);


--
-- Name: devoluciones_detalle_producto_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_detalle_producto_id_index ON public.devoluciones_detalle USING btree (producto_id);


--
-- Name: devoluciones_detalle_salida_detalle_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_detalle_salida_detalle_id_index ON public.devoluciones_detalle USING btree (salida_detalle_id);


--
-- Name: devoluciones_fecha_estado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_fecha_estado_index ON public.devoluciones USING btree (fecha, estado);


--
-- Name: devoluciones_salida_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_salida_id_index ON public.devoluciones USING btree (salida_id);


--
-- Name: devoluciones_unidad_solicitante_id_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devoluciones_unidad_solicitante_id_fecha_index ON public.devoluciones USING btree (unidad_solicitante_id, fecha);


--
-- Name: existencias_almacen_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX existencias_almacen_id_index ON public.existencias USING btree (almacen_id);


--
-- Name: failed_jobs_connection_queue_failed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX failed_jobs_connection_queue_failed_at_index ON public.failed_jobs USING btree (connection, queue, failed_at);


--
-- Name: ingreso_detalles_ingreso_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingreso_detalles_ingreso_id_index ON public.ingreso_detalles USING btree (ingreso_id);


--
-- Name: ingresos_almacen_id_estado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingresos_almacen_id_estado_index ON public.ingresos USING btree (almacen_id, estado);


--
-- Name: ingresos_estado_respaldo_ruta_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingresos_estado_respaldo_ruta_index ON public.ingresos USING btree (estado, respaldo_ruta);


--
-- Name: ingresos_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingresos_fecha_index ON public.ingresos USING btree (fecha);


--
-- Name: ingresos_solicitud_compra_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingresos_solicitud_compra_id_index ON public.ingresos USING btree (solicitud_compra_id);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: kardex_documento_tipo_documento_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kardex_documento_tipo_documento_id_index ON public.kardex USING btree (documento_tipo, documento_id);


--
-- Name: kardex_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kardex_fecha_index ON public.kardex USING btree (fecha);


--
-- Name: kardex_producto_id_almacen_id_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kardex_producto_id_almacen_id_fecha_index ON public.kardex USING btree (producto_id, almacen_id, fecha);


--
-- Name: model_has_permissions_model_id_model_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_has_permissions_model_id_model_type_index ON public.model_has_permissions USING btree (model_id, model_type);


--
-- Name: model_has_roles_model_id_model_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_has_roles_model_id_model_type_index ON public.model_has_roles USING btree (model_id, model_type);


--
-- Name: personal_access_tokens_expires_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: productos_activo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX productos_activo_index ON public.productos USING btree (activo);


--
-- Name: productos_categoria_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX productos_categoria_id_index ON public.productos USING btree (categoria_id);


--
-- Name: productos_nombre_busqueda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX productos_nombre_busqueda ON public.productos USING gin (lower(public.inmutable_unaccent((nombre)::text)) public.gin_trgm_ops);


--
-- Name: salidas_almacen_id_estado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_almacen_id_estado_index ON public.salidas USING btree (almacen_id, estado);


--
-- Name: salidas_estado_respaldo_ruta_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_estado_respaldo_ruta_index ON public.salidas USING btree (estado, respaldo_ruta);


--
-- Name: salidas_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_fecha_index ON public.salidas USING btree (fecha);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: solicitantes_unidad_solicitante_id_activo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitantes_unidad_solicitante_id_activo_index ON public.solicitantes USING btree (unidad_solicitante_id, activo);


--
-- Name: solicitudes_compra_almacen_id_estado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_compra_almacen_id_estado_index ON public.solicitudes_compra USING btree (almacen_id, estado);


--
-- Name: solicitudes_compra_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_compra_fecha_index ON public.solicitudes_compra USING btree (fecha);


--
-- Name: transferencia_capas_transferencia_detalle_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transferencia_capas_transferencia_detalle_id_index ON public.transferencia_capas USING btree (transferencia_detalle_id);


--
-- Name: transferencias_almacen_destino_id_estado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transferencias_almacen_destino_id_estado_index ON public.transferencias USING btree (almacen_destino_id, estado);


--
-- Name: transferencias_almacen_origen_id_estado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transferencias_almacen_origen_id_estado_index ON public.transferencias USING btree (almacen_origen_id, estado);


--
-- Name: transferencias_fecha_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transferencias_fecha_index ON public.transferencias USING btree (fecha);


--
-- Name: unidades_solicitantes_activo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unidades_solicitantes_activo_index ON public.unidades_solicitantes USING btree (activo);


--
-- Name: users_activo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_activo_index ON public.users USING btree (activo);


--
-- Name: usuario_almacen_almacen_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_almacen_almacen_id_index ON public.usuario_almacen USING btree (almacen_id);


--
-- Name: usuario_almacen_predeterminado_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX usuario_almacen_predeterminado_unico ON public.usuario_almacen USING btree (user_id) WHERE (es_predeterminado = true);


--
-- Name: capas_existencia capas_existencia_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas_existencia
    ADD CONSTRAINT capas_existencia_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: capas_existencia capas_existencia_ingreso_detalle_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas_existencia
    ADD CONSTRAINT capas_existencia_ingreso_detalle_id_foreign FOREIGN KEY (ingreso_detalle_id) REFERENCES public.ingreso_detalles(id);


--
-- Name: capas_existencia capas_existencia_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas_existencia
    ADD CONSTRAINT capas_existencia_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: consumos_capa consumos_capa_capa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumos_capa
    ADD CONSTRAINT consumos_capa_capa_id_foreign FOREIGN KEY (capa_id) REFERENCES public.capas_existencia(id);


--
-- Name: consumos_capa consumos_capa_salida_detalle_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumos_capa
    ADD CONSTRAINT consumos_capa_salida_detalle_id_foreign FOREIGN KEY (salida_detalle_id) REFERENCES public.salida_detalles(id) ON DELETE CASCADE;


--
-- Name: contadores_documento contadores_documento_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contadores_documento
    ADD CONSTRAINT contadores_documento_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: devoluciones devoluciones_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: devoluciones_consumo devoluciones_consumo_capa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_consumo
    ADD CONSTRAINT devoluciones_consumo_capa_id_foreign FOREIGN KEY (capa_id) REFERENCES public.capas_existencia(id);


--
-- Name: devoluciones_consumo devoluciones_consumo_consumo_capa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_consumo
    ADD CONSTRAINT devoluciones_consumo_consumo_capa_id_foreign FOREIGN KEY (consumo_capa_id) REFERENCES public.consumos_capa(id);


--
-- Name: devoluciones_consumo devoluciones_consumo_devolucion_detalle_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_consumo
    ADD CONSTRAINT devoluciones_consumo_devolucion_detalle_id_foreign FOREIGN KEY (devolucion_detalle_id) REFERENCES public.devoluciones_detalle(id) ON DELETE CASCADE;


--
-- Name: devoluciones_detalle devoluciones_detalle_devolucion_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_detalle
    ADD CONSTRAINT devoluciones_detalle_devolucion_id_foreign FOREIGN KEY (devolucion_id) REFERENCES public.devoluciones(id) ON DELETE CASCADE;


--
-- Name: devoluciones_detalle devoluciones_detalle_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_detalle
    ADD CONSTRAINT devoluciones_detalle_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: devoluciones_detalle devoluciones_detalle_salida_detalle_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones_detalle
    ADD CONSTRAINT devoluciones_detalle_salida_detalle_id_foreign FOREIGN KEY (salida_detalle_id) REFERENCES public.salida_detalles(id);


--
-- Name: devoluciones devoluciones_salida_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_salida_id_foreign FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: devoluciones devoluciones_solicitante_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_solicitante_id_foreign FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id) ON DELETE SET NULL;


--
-- Name: devoluciones devoluciones_unidad_solicitante_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_unidad_solicitante_id_foreign FOREIGN KEY (unidad_solicitante_id) REFERENCES public.unidades_solicitantes(id) ON DELETE SET NULL;


--
-- Name: devoluciones devoluciones_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.users(id);


--
-- Name: existencias existencias_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: existencias existencias_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: ingreso_detalles ingreso_detalles_ingreso_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso_detalles
    ADD CONSTRAINT ingreso_detalles_ingreso_id_foreign FOREIGN KEY (ingreso_id) REFERENCES public.ingresos(id) ON DELETE CASCADE;


--
-- Name: ingreso_detalles ingreso_detalles_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso_detalles
    ADD CONSTRAINT ingreso_detalles_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: ingreso_detalles ingreso_detalles_solicitud_compra_detalle_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso_detalles
    ADD CONSTRAINT ingreso_detalles_solicitud_compra_detalle_id_foreign FOREIGN KEY (solicitud_compra_detalle_id) REFERENCES public.solicitud_compra_detalles(id);


--
-- Name: ingresos ingresos_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: ingresos ingresos_anulada_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_anulada_por_foreign FOREIGN KEY (anulada_por) REFERENCES public.users(id);


--
-- Name: ingresos ingresos_confirmada_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_confirmada_por_foreign FOREIGN KEY (confirmada_por) REFERENCES public.users(id);


--
-- Name: ingresos ingresos_registrado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_registrado_por_foreign FOREIGN KEY (registrado_por) REFERENCES public.users(id);


--
-- Name: ingresos ingresos_solicitud_compra_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_solicitud_compra_id_foreign FOREIGN KEY (solicitud_compra_id) REFERENCES public.solicitudes_compra(id);


--
-- Name: kardex kardex_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: kardex kardex_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: kardex kardex_registrado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_registrado_por_foreign FOREIGN KEY (registrado_por) REFERENCES public.users(id);


--
-- Name: model_has_permissions model_has_permissions_permission_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_has_permissions
    ADD CONSTRAINT model_has_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: model_has_roles model_has_roles_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_has_roles
    ADD CONSTRAINT model_has_roles_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: productos productos_categoria_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_categoria_id_foreign FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: productos productos_unidad_medida_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_unidad_medida_id_foreign FOREIGN KEY (unidad_medida_id) REFERENCES public.unidades_medida(id);


--
-- Name: role_has_permissions role_has_permissions_permission_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_has_permissions
    ADD CONSTRAINT role_has_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_has_permissions role_has_permissions_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_has_permissions
    ADD CONSTRAINT role_has_permissions_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: salida_detalles salida_detalles_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_detalles
    ADD CONSTRAINT salida_detalles_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: salida_detalles salida_detalles_salida_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_detalles
    ADD CONSTRAINT salida_detalles_salida_id_foreign FOREIGN KEY (salida_id) REFERENCES public.salidas(id) ON DELETE CASCADE;


--
-- Name: salidas salidas_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: salidas salidas_anulada_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_anulada_por_foreign FOREIGN KEY (anulada_por) REFERENCES public.users(id);


--
-- Name: salidas salidas_confirmada_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_confirmada_por_foreign FOREIGN KEY (confirmada_por) REFERENCES public.users(id);


--
-- Name: salidas salidas_recibido_por_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_recibido_por_id_foreign FOREIGN KEY (recibido_por_id) REFERENCES public.solicitantes(id);


--
-- Name: salidas salidas_registrado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_registrado_por_foreign FOREIGN KEY (registrado_por) REFERENCES public.users(id);


--
-- Name: salidas salidas_solicitante_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_solicitante_id_foreign FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id);


--
-- Name: salidas salidas_unidad_solicitante_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_unidad_solicitante_id_foreign FOREIGN KEY (unidad_solicitante_id) REFERENCES public.unidades_solicitantes(id);


--
-- Name: solicitantes solicitantes_unidad_solicitante_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitantes
    ADD CONSTRAINT solicitantes_unidad_solicitante_id_foreign FOREIGN KEY (unidad_solicitante_id) REFERENCES public.unidades_solicitantes(id);


--
-- Name: solicitud_compra_detalles solicitud_compra_detalles_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_compra_detalles
    ADD CONSTRAINT solicitud_compra_detalles_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: solicitud_compra_detalles solicitud_compra_detalles_solicitud_compra_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_compra_detalles
    ADD CONSTRAINT solicitud_compra_detalles_solicitud_compra_id_foreign FOREIGN KEY (solicitud_compra_id) REFERENCES public.solicitudes_compra(id) ON DELETE CASCADE;


--
-- Name: solicitudes_compra solicitudes_compra_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_compra
    ADD CONSTRAINT solicitudes_compra_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id);


--
-- Name: solicitudes_compra solicitudes_compra_aprobado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_compra
    ADD CONSTRAINT solicitudes_compra_aprobado_por_foreign FOREIGN KEY (aprobado_por) REFERENCES public.users(id);


--
-- Name: solicitudes_compra solicitudes_compra_registrado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_compra
    ADD CONSTRAINT solicitudes_compra_registrado_por_foreign FOREIGN KEY (registrado_por) REFERENCES public.users(id);


--
-- Name: transferencia_capas transferencia_capas_capa_origen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_capas
    ADD CONSTRAINT transferencia_capas_capa_origen_id_foreign FOREIGN KEY (capa_origen_id) REFERENCES public.capas_existencia(id);


--
-- Name: transferencia_capas transferencia_capas_transferencia_detalle_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_capas
    ADD CONSTRAINT transferencia_capas_transferencia_detalle_id_foreign FOREIGN KEY (transferencia_detalle_id) REFERENCES public.transferencia_detalles(id) ON DELETE CASCADE;


--
-- Name: transferencia_detalles transferencia_detalles_producto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_detalles
    ADD CONSTRAINT transferencia_detalles_producto_id_foreign FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: transferencia_detalles transferencia_detalles_transferencia_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencia_detalles
    ADD CONSTRAINT transferencia_detalles_transferencia_id_foreign FOREIGN KEY (transferencia_id) REFERENCES public.transferencias(id) ON DELETE CASCADE;


--
-- Name: transferencias transferencias_almacen_destino_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_almacen_destino_id_foreign FOREIGN KEY (almacen_destino_id) REFERENCES public.almacenes(id);


--
-- Name: transferencias transferencias_almacen_origen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_almacen_origen_id_foreign FOREIGN KEY (almacen_origen_id) REFERENCES public.almacenes(id);


--
-- Name: transferencias transferencias_anulada_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_anulada_por_foreign FOREIGN KEY (anulada_por) REFERENCES public.users(id);


--
-- Name: transferencias transferencias_despachada_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_despachada_por_foreign FOREIGN KEY (despachada_por) REFERENCES public.users(id);


--
-- Name: transferencias transferencias_recibida_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_recibida_por_foreign FOREIGN KEY (recibida_por) REFERENCES public.users(id);


--
-- Name: transferencias transferencias_registrado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_registrado_por_foreign FOREIGN KEY (registrado_por) REFERENCES public.users(id);


--
-- Name: usuario_almacen usuario_almacen_almacen_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_almacen
    ADD CONSTRAINT usuario_almacen_almacen_id_foreign FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id) ON DELETE CASCADE;


--
-- Name: usuario_almacen usuario_almacen_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_almacen
    ADD CONSTRAINT usuario_almacen_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict UBwVtqRTcaEF5hCvsbcc5izOoJq1XzQ4XGvpQPdOWVeUvtQeP2TVw7LpIWcNFdY

