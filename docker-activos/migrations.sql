--
-- PostgreSQL database dump
--

\restrict Yebv4opXqZkdvhL4C8z5xsC65fZjAdVHMO5zRfEprFOWxpyu4HjIcxSkSeJSOum

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
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, migration, batch) FROM stdin;
1	0001_01_01_000000_create_users_table	1
2	0001_01_01_000001_create_cache_table	1
3	0001_01_01_000002_create_jobs_table	1
4	2026_01_01_000001_create_almacenes_table	1
5	2026_01_01_000002_add_campos_a_users_table	1
6	2026_01_01_000003_create_usuario_almacen_table	1
7	2026_09_08_040342_create_permission_tables	1
8	2026_12_31_000001_add_campos_a_roles_table	1
9	2026_09_08_045815_create_personal_access_tokens_table	2
10	2026_12_31_000010_create_categorias_table	3
11	2026_12_31_000011_create_unidades_medida_table	3
12	2026_12_31_000012_create_productos_table	4
13	2026_12_31_000020_create_solicitudes_compra_table	5
14	2026_12_31_000021_create_solicitudes_material_table	5
15	2026_12_31_000015_create_existencias_table	6
16	2026_12_31_000030_create_kardex_table	7
17	2026_12_31_000031_create_salidas_table	7
18	2026_12_31_000032_create_solicitantes_table	8
19	2026_12_31_000040_create_capas_existencia_table	9
20	2026_12_31_000041_create_ingresos_table	9
21	2026_12_31_000050_create_transferencias_table	10
22	2026_01_01_000000_crear_extensiones	11
26	2026_09_23_000004_add_devuelto_to_consumos_capa	14
27	2026_09_23_000001_create_devoluciones_table	15
28	2026_09_23_000002_create_devoluciones_detalle_table	15
29	2026_09_23_000003_create_devoluciones_consumo_table	15
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 29, true);


--
-- PostgreSQL database dump complete
--

\unrestrict Yebv4opXqZkdvhL4C8z5xsC65fZjAdVHMO5zRfEprFOWxpyu4HjIcxSkSeJSOum

