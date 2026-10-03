<?php

namespace App\Enums;

/**
 * Catálogo único de permisos del sistema.
 *
 * Los permisos NO se crean desde la interfaz: existen porque hay código que los
 * consulta. Este archivo es la fuente de verdad — el seeder lo lee para poblar
 * la tabla `permissions` y el frontend lo recibe agrupado por módulo.
 *
 * Convención: modulo.accion  (el prefijo antes del punto define el módulo)
 */
final class Permisos
{
    /**
     * Módulos en el orden en que deben mostrarse en la pantalla de roles.
     * clave => [etiqueta visible, icono PrimeIcons]
     */
    public const MODULOS = [
        'dashboard'     => ['Tablero',              'pi pi-home'],
        'productos'     => ['Productos',            'pi pi-box'],
        'categorias'    => ['Categorías',           'pi pi-tags'],
        'almacenes'     => ['Almacenes',            'pi pi-building'],
        'solicitantes'  => ['Unidades y solicitantes', 'pi pi-id-card'],
        'solicitudes'   => ['Solicitudes de compra', 'pi pi-file-edit'],
        'stock'         => ['Existencias',          'pi pi-database'],
        'kardex'        => ['Kardex',               'pi pi-list'],
        'ingresos'      => ['Ingresos',             'pi pi-arrow-down-left'],
        'salidas'       => ['Salidas',              'pi pi-arrow-up-right'],
        'devoluciones'  => ['Devoluciones',         'pi pi-reply'],
        'transferencias'=> ['Transferencias',       'pi pi-arrows-h'],
        'ajustes'       => ['Ajustes de inventario','pi pi-sliders-h'],
        'tomas'         => ['Tomas físicas',        'pi pi-check-square'],
        'reportes'      => ['Reportes',             'pi pi-chart-bar'],
        'usuarios'      => ['Usuarios',             'pi pi-users'],
        'roles'         => ['Roles y permisos',     'pi pi-shield'],
        'auditoria'     => ['Auditoría',            'pi pi-history'],
        'activos'               => ['Activos fijos',             'pi pi-desktop'],
        'activos-custodia'      => ['Custodia de activos',       'pi pi-user-edit'],
        'activos-mantenimiento' => ['Mantenimiento de activos',  'pi pi-wrench'],
        'activos-valuacion'     => ['Valuación y depreciación',  'pi pi-calculator'],
        'activos-inventario'    => ['Inventario de activos',     'pi pi-check-square'],
        'activos-bajas'         => ['Bajas de activos',          'pi pi-trash'],
        'activos-config'        => ['Configuración de activos',  'pi pi-cog'],
        
    ];

    /**
     * permiso => descripción que ve el administrador al armar un rol.
     * Escrita en lenguaje del usuario, no del sistema.
     */
    public const CATALOGO = [
        // Tablero
        'dashboard.ver'              => 'Entrar al tablero principal',

        // Productos
        'productos.ver'              => 'Consultar el catálogo de productos',
        'productos.crear'            => 'Registrar productos nuevos',
        'productos.editar'           => 'Modificar datos de un producto',
        'productos.eliminar'         => 'Dar de baja un producto',

        // Categorías y unidades
        'categorias.ver'             => 'Consultar categorías y unidades de medida',
        'categorias.gestionar'       => 'Crear y modificar categorías y unidades',

        // Almacenes
        'almacenes.ver'              => 'Consultar la lista de almacenes',
        'almacenes.gestionar'        => 'Crear y modificar almacenes',
        'almacenes.ver-todos'        => 'Ver información de todos los almacenes, no solo los asignados',

        // Solicitudes
        'solicitudes.ver'                => 'Consultar solicitudes de compra',
        'solicitudes.registrar'          => 'Registrar solicitudes de compra',
        'solicitudes.editar'             => 'Modificar una solicitud en borrador',
        'solicitudes.aprobar'            => 'Registrar la aprobación firmada y adjuntar el documento',
        'solicitudes.anular'             => 'Anular una solicitud ya aprobada',

        // Unidades y solicitantes
        'solicitantes.ver'       => 'Consultar unidades y personas que solicitan material',
        'solicitantes.gestionar' => 'Registrar y modificar unidades y solicitantes',

        // Existencias
        'stock.ver'                  => 'Consultar existencias y saldos',
        'stock.ver-costos'           => 'Ver costos unitarios y valorización',

        // Kardex
        'kardex.ver'                 => 'Consultar el kardex de un producto',
        'kardex.exportar'            => 'Exportar el kardex a Excel o PDF',

        // Ingresos
        'ingresos.ver'               => 'Consultar notas de ingreso',
        'ingresos.registrar'         => 'Registrar una nota de ingreso en borrador',
        'ingresos.editar'            => 'Modificar una nota de ingreso en borrador',
        'ingresos.confirmar'         => 'Confirmar un ingreso y afectar existencias',
        'ingresos.anular'            => 'Anular una nota de ingreso confirmada',

        // Salidas
        'salidas.ver'                => 'Consultar notas de salida',
        'salidas.registrar'          => 'Registrar una nota de salida en borrador',
        'salidas.editar'             => 'Modificar una nota de salida en borrador',
        'salidas.confirmar'          => 'Confirmar una salida y descargar existencias',
        'salidas.anular'             => 'Anular una nota de salida confirmada',

        // Devoluciones
        'devoluciones.ver'           => 'Consultar devoluciones de material al almacén',
        'devoluciones.registrar'     => 'Registrar la devolución de material entregado',
        'devoluciones.anular'        => 'Anular una devolución y volver a descargar existencias',

        // Transferencias
        'transferencias.ver'         => 'Consultar transferencias entre almacenes',
        'transferencias.registrar'   => 'Solicitar una transferencia entre almacenes',
        'transferencias.confirmar'   => 'Aceptar la recepción de una transferencia',
        'transferencias.anular'      => 'Anular una transferencia',

        // Ajustes
        'ajustes.ver'                => 'Consultar ajustes de inventario',
        'ajustes.registrar'          => 'Registrar un ajuste de inventario',
        'ajustes.confirmar'          => 'Confirmar un ajuste y corregir existencias',

        // Tomas físicas
        'tomas.ver'                  => 'Consultar tomas físicas de inventario',
        'tomas.registrar'            => 'Abrir una toma física y cargar conteos',
        'tomas.cerrar'               => 'Cerrar una toma física y generar los ajustes',

        // Reportes
        'reportes.existencias'       => 'Reporte de existencias por almacén',
        'reportes.valorizado'        => 'Reporte de inventario valorizado',
        'reportes.movimientos'       => 'Reporte de movimientos por período',
        'reportes.vencimientos'      => 'Reporte de productos próximos a vencer',
        'reportes.vencimientos'      => 'Reporte de productos próximos a vencer',
        'reportes.consumo'           => 'Reporte de consumo por unidad solicitante',

        // Usuarios
        'usuarios.ver'               => 'Consultar la lista de usuarios',
        'usuarios.crear'             => 'Registrar usuarios nuevos',
        'usuarios.editar'            => 'Modificar datos y roles de un usuario',
        'usuarios.desactivar'        => 'Desactivar el acceso de un usuario',
        'usuarios.asignar-almacenes' => 'Asignar a qué almacenes accede un usuario',
        'usuarios.restablecer-clave' => 'Restablecer la contraseña de un usuario',

        // Roles
        'roles.ver'                  => 'Consultar los roles del sistema',
        'roles.crear'                => 'Crear roles nuevos',
        'roles.editar'               => 'Modificar los permisos de un rol',
        'roles.eliminar'             => 'Eliminar un rol',

        // Auditoría
        'auditoria.ver'              => 'Consultar la bitácora de acciones',

        // ── 2. Agregar a la constante CATALOGO ───────────────────────────────────────

        // Activos fijos
        'activos.ver'                => 'Consultar activos fijos y sus fichas',           // [S1]
        'activos.crear'              => 'Dar de alta activos fijos',
        'activos.editar'             => 'Modificar los datos de un activo',
        'activos.codificar'          => 'Generar códigos y reimprimir etiquetas',
        'activos.reportes'           => 'Ver y exportar los reportes del módulo',

        // Custodia de activos
        'activos-custodia.asignar'              => 'Asignar bienes a un custodio',
        'activos-custodia.traspasar'            => 'Emitir traspasos internos de bienes',
        'activos-custodia.autorizar-traspaso'   => 'Autorizar traspasos internos',
        'activos-custodia.salida'               => 'Emitir salidas temporales de bienes',
        'activos-custodia.autorizar-salida'     => 'Autorizar salidas temporales',
        'activos-custodia.descargar'            => 'Emitir la constancia de descargo por desvinculación',

        // Mantenimiento de activos
        'activos-mantenimiento.ver'         => 'Consultar el plan y el historial de mantenimiento',
        'activos-mantenimiento.registrar'   => 'Registrar mantenimientos ejecutados',
        'activos-mantenimiento.capitalizar' => 'Capitalizar una mejora como mayor valor del bien',
        'activos-mantenimiento.seguros'     => 'Administrar las pólizas de seguro de los bienes',

        // Valuación y depreciación
        'activos-valuacion.ver'                  => 'Consultar la valuación y la depreciación',
        'activos-valuacion.calcular'             => 'Calcular el cierre mensual',
        'activos-valuacion.cerrar'               => 'Cerrar el período de valuación',
        'activos-valuacion.reabrir'              => 'Reabrir un período ya calculado',
        'activos-valuacion.valor-recuperable'    => 'Registrar la prueba de valor recuperable',
        'activos-valuacion.revaluo-registrar'    => 'Cargar una revalorización técnica',
        'activos-valuacion.revaluo-aprobar'      => 'Aprobar una revalorización técnica',
        'activos-valuacion.revaluo-contabilizar' => 'Contabilizar una revalorización aprobada',

        // Inventario de activos
        'activos-inventario.ver'        => 'Consultar las tomas físicas de activos',
        'activos-inventario.planificar' => 'Planificar una toma física',
        'activos-inventario.tomar'      => 'Ejecutar la verificación física de bienes',
        'activos-inventario.resolver'   => 'Resolver las diferencias de una toma física',
        'activos-inventario.cerrar'     => 'Cerrar la toma física y generar los ajustes',

        // Bajas de activos
        'activos-bajas.ver'        => 'Consultar las bajas de activos',
        'activos-bajas.solicitar'  => 'Solicitar la baja de un bien',
        'activos-bajas.dictaminar' => 'Emitir el informe técnico que sustenta la baja',
        'activos-bajas.autorizar'  => 'Autorizar la baja y su disposición',

        // Configuración de activos
        'activos-config.ver'         => 'Consultar clases, ubicaciones y parámetros',
        'activos-config.administrar' => 'Administrar clases, ubicaciones y parámetros',   // [S1]
    ];

    /** Nombre del rol con acceso total. Se resuelve vía Gate::before. */
    public const SUPER_ADMIN = 'super-admin';

    /** @return list<string> */
    public static function todos(): array
    {
        return array_keys(self::CATALOGO);
    }

    /** Módulo al que pertenece un permiso: 'salidas.confirmar' => 'salidas' */
    public static function modulo(string $permiso): string
    {
        return explode('.', $permiso)[0];
    }

    /**
     * Catálogo agrupado por módulo, listo para el árbol de la pantalla de roles.
     *
     * @return list<array{clave:string, etiqueta:string, icono:string, permisos:list<array{nombre:string,descripcion:string}>}>
     */
    public static function agrupado(): array
    {
        $grupos = [];

        foreach (self::CATALOGO as $nombre => $descripcion) {
            $grupos[self::modulo($nombre)][] = [
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
            ];
        }

        $salida = [];
        foreach (self::MODULOS as $clave => [$etiqueta, $icono]) {
            if (! isset($grupos[$clave])) {
                continue;
            }
            $salida[] = [
                'clave'    => $clave,
                'etiqueta' => $etiqueta,
                'icono'    => $icono,
                'permisos' => $grupos[$clave],
            ];
        }

        return $salida;
    }
}
