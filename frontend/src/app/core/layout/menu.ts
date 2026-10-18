import { Signal, computed } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { PermisosService } from '../services/permisos.service';

interface ItemMenu {
  etiqueta: string;
  icono: string;
  ruta?: string;
  permiso?: string;
  hijos?: ItemMenu[];
}

/**
 * El menú se define una vez con el permiso que abre cada entrada y se filtra
 * solo. Nunca se escribe `if (rol === 'almacenero')` acá: si mañana el
 * administrador crea un rol nuevo con esos permisos, el menú ya funciona.
 */
const ESTRUCTURA: ItemMenu[] = [
  { etiqueta: 'Tablero', icono: 'pi pi-home', ruta: '/tablero', permiso: 'dashboard.ver' },
  { etiqueta: 'Solicitudes de compra', icono: 'pi pi-file-edit',
    ruta: '/solicitudes', permiso: 'solicitudes.ver' },
      { etiqueta: 'Custodia',          icono: 'pi pi-user-edit',
    ruta: '/activos/custodia',              permiso: 'activos.ver' },
  { etiqueta: 'Bienes por custodio', icono: 'pi pi-users',
    ruta: '/activos/custodia/por-custodio', permiso: 'activos.ver' },
  {
    etiqueta: 'Movimientos', icono: 'pi pi-arrows-h', hijos: [
      { etiqueta: 'Ingresos',       icono: 'pi pi-arrow-down-left', ruta: '/ingresos',       permiso: 'ingresos.ver' },
      { etiqueta: 'Salidas',        icono: 'pi pi-arrow-up-right',  ruta: '/salidas',        permiso: 'salidas.ver' },
      { etiqueta: 'Devoluciones', icono: 'pi pi-reply', ruta: '/devoluciones', permiso: 'devoluciones.ver' },
      { etiqueta: 'Transferencias', icono: 'pi pi-sync',            ruta: '/transferencias', permiso: 'transferencias.ver' },
      { etiqueta: 'Ajustes',        icono: 'pi pi-sliders-h',       ruta: '/ajustes',        permiso: 'ajustes.ver' },
    ],
  },
  {
    etiqueta: 'Inventario', icono: 'pi pi-database', hijos: [
      { etiqueta: 'Existencias',  icono: 'pi pi-box',          ruta: '/existencias', permiso: 'stock.ver' },
      { etiqueta: 'Tomas físicas',icono: 'pi pi-check-square', ruta: '/tomas',       permiso: 'tomas.ver' },
    ],
  },
  {
    etiqueta: 'Catálogos', icono: 'pi pi-tags', hijos: [
      { etiqueta: 'Productos',  icono: 'pi pi-box',      ruta: '/productos',  permiso: 'productos.ver' },
      { etiqueta: 'Clasificación', icono: 'pi pi-tags',  ruta: '/categorias', permiso: 'categorias.ver' },
      { etiqueta: 'Almacenes',  icono: 'pi pi-building', ruta: '/almacenes',  permiso: 'almacenes.ver' },
      { etiqueta: 'Unidades y solicitantes', icono: 'pi pi-id-card',
        ruta: '/solicitantes', permiso: 'solicitantes.ver' },
    ],
  },
  {
    etiqueta: 'Reportes', icono: 'pi pi-chart-bar', hijos: [
      { etiqueta: 'Existencias',  icono: 'pi pi-list',     ruta: '/reportes/existencias',  permiso: 'reportes.existencias' },
      { etiqueta: 'Valorizado',   icono: 'pi pi-dollar',   ruta: '/reportes/valorizado',   permiso: 'reportes.valorizado' },
      { etiqueta: 'Movimientos',  icono: 'pi pi-calendar', ruta: '/reportes/movimientos',  permiso: 'reportes.movimientos' },
      { etiqueta: 'Vencimientos', icono: 'pi pi-clock',    ruta: '/reportes/vencimientos', permiso: 'reportes.vencimientos' },
      { etiqueta: 'Consumo por área',        icono: 'pi pi-chart-bar', ruta: '/reportes/consumo-areas',        permiso: 'reportes.consumo' },
      { etiqueta: 'Consumo por solicitante', icono: 'pi pi-user',      ruta: '/reportes/consumo-solicitantes', permiso: 'reportes.consumo' },
      { etiqueta: 'Consumo por producto',    icono: 'pi pi-box',       ruta: '/reportes/consumo-productos',    permiso: 'reportes.consumo' },
    ],
  },
  {
    etiqueta: 'Administración', icono: 'pi pi-cog', hijos: [
      { etiqueta: 'Usuarios',         icono: 'pi pi-users',   ruta: '/usuarios',  permiso: 'usuarios.ver' },
      { etiqueta: 'Roles y permisos', icono: 'pi pi-shield',  ruta: '/roles',     permiso: 'roles.ver' },
      { etiqueta: 'Auditoría',        icono: 'pi pi-history', ruta: '/auditoria', permiso: 'auditoria.ver' },
    ],
  },
    {
    etiqueta: 'Activos fijos', icono: 'pi pi-desktop', hijos: [
      { etiqueta: 'Registro de activos', icono: 'pi pi-list',      ruta: '/activos/registro',                   permiso: 'activos.ver' },
      { etiqueta: 'Clases',              icono: 'pi pi-sitemap',   ruta: '/activos/configuracion/clases',       permiso: 'activos-config.ver' },
      { etiqueta: 'Subclases',           icono: 'pi pi-tags',      ruta: '/activos/configuracion/subclases',    permiso: 'activos-config.ver' },
      { etiqueta: 'Ubicaciones',         icono: 'pi pi-map-marker',ruta: '/activos/configuracion/ubicaciones',  permiso: 'activos-config.ver' },
      { etiqueta: 'Parámetros',          icono: 'pi pi-sliders-h', ruta: '/activos/configuracion/parametros',   permiso: 'activos-config.ver' },
      { etiqueta: 'Personal',          icono: 'pi pi-users',ruta: '/activos/organizacion/personal', permiso: 'activos.ver' },
      { etiqueta: 'Centros de costo',  icono: 'pi pi-building',ruta: '/activos/organizacion/centros',  permiso: 'activos.ver' },
      { etiqueta: 'Cierre mensual', icono: 'pi pi-calculator',ruta: '/activos/valuacion', permiso: 'activos-valuacion.ver' },
    ],
  },
  {
    etiqueta: 'Caja', icono: 'pi pi-wallet', hijos: [
      { etiqueta: 'Mis cajas',  icono: 'pi pi-wallet',   ruta: '/caja/operar',    permiso: 'caja.ver' },
      { etiqueta: 'Cierres',    icono: 'pi pi-lock',     ruta: '/caja/cierres',   permiso: 'caja.ver' },
      { etiqueta: 'Libro de caja', icono: 'pi pi-book',  ruta: '/caja/libro',     permiso: 'caja.reportes' },
      { etiqueta: 'Personas',   icono: 'pi pi-users',    ruta: '/caja/personas',  permiso: 'caja.ver' },
      { etiqueta: 'Conceptos',  icono: 'pi pi-list',     ruta: '/caja/conceptos', permiso: 'caja.ver' },
      { etiqueta: 'Cajas',      icono: 'pi pi-cog',      ruta: '/caja/cajas',     permiso: 'caja.administrar' },
    ],
  },
  {
    etiqueta: 'Manejo de cargas', icono: 'pi pi-truck', hijos: [
      { etiqueta: 'Productores',         icono: 'pi pi-users',      ruta: '/cargas/productores',  permiso: 'cargas.ver' },
      { etiqueta: 'Cooperativas',        icono: 'pi pi-sitemap',    ruta: '/cargas/cooperativas', permiso: 'cargas.ver' },
      { etiqueta: 'Minas y bocaminas',   icono: 'pi pi-map',        ruta: '/cargas/minas',        permiso: 'cargas.ver' },
      { etiqueta: 'Municipios',          icono: 'pi pi-map-marker', ruta: '/cargas/municipios',   permiso: 'cargas.ver' },
      { etiqueta: 'Laboratorios',        icono: 'pi pi-filter',     ruta: '/cargas/laboratorios', permiso: 'cargas.ver' },
      { etiqueta: 'Bancos',              icono: 'pi pi-building-columns', ruta: '/cargas/bancos', permiso: 'cargas.ver' },
      { etiqueta: 'Líneas y elementos',  icono: 'pi pi-tags',       ruta: '/cargas/lineas',       permiso: 'cargas.ver' },
      { etiqueta: 'Series de lote',      icono: 'pi pi-hashtag',    ruta: '/cargas/series',       permiso: 'cargas.ver' },
      { etiqueta: 'Estado del módulo',   icono: 'pi pi-heart',      ruta: '/cargas/estado',       permiso: 'cargas.ver' },
    ],
  },
];

export function construirMenu(permisos: PermisosService): Signal<MenuItem[]> {
  return computed(() => filtrar(ESTRUCTURA, permisos));
}

function filtrar(items: ItemMenu[], permisos: PermisosService): MenuItem[] {
  return items.reduce<MenuItem[]>((acumulado, item) => {
    if (item.hijos) {
      const hijos = filtrar(item.hijos, permisos);
      // Un grupo sin hijos visibles no se muestra: nada de menús que no abren.
      if (hijos.length) {
        acumulado.push({ label: item.etiqueta, icon: item.icono, items: hijos });
      }
      return acumulado;
    }

    if (!item.permiso || permisos.can(item.permiso)) {
      acumulado.push({ label: item.etiqueta, icon: item.icono, routerLink: item.ruta });
    }

    return acumulado;
  }, []);
}
