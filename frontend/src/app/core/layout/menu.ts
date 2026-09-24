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
