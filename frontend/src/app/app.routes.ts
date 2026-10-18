import { Routes } from '@angular/router';
import {
  autenticadoGuard, claveVigenteGuard, conAlgunPermiso, conPermiso,
} from './core/guards/permisos.guard';

export const routes: Routes = [
  {
    path: 'a/:codigo',
    title: 'Consulta de bien',
    loadComponent: () =>
      import('./activos/consulta/consulta-publica.component')
        .then((m) => m.ConsultaPublicaComponent),
  },
  {
    path: 'ingresar',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'cambiar-clave',
    canActivate: [autenticadoGuard],
    loadComponent: () =>
      import('./features/auth/cambiar-clave.component').then(m => m.CambiarClaveComponent),
  },
  {
    path: 'sin-permiso',
    loadComponent: () =>
      import('./features/auth/sin-permiso.component').then(m => m.SinPermisoComponent),
  },

  {
    path: '',
    canActivate: [autenticadoGuard, claveVigenteGuard],
    loadComponent: () => import('./core/layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tablero' },

      {
        path: 'tablero',
        canMatch: [conPermiso('dashboard.ver')],
        loadComponent: () =>
          import('./features/tablero/tablero.component').then(m => m.TableroComponent),
      },

      /*
       | Solicitudes: dos ramas que reutilizan las mismas pantallas.
       | El tipo viaja como dato estático de la ruta, así el componente no tiene
       | que adivinar de dónde viene ni leer parámetros de consulta.
       */
      {
        path: 'solicitudes',
        data: { tipo: 'compra' },
        canMatch: [conPermiso('solicitudes.ver')],
        loadComponent: () =>
          import('./features/solicitudes/solicitud-lista.component').then(m => m.SolicitudListaComponent),
      },
      {
        path: 'solicitudes/nueva',
        data: { tipo: 'compra' },
        canMatch: [conPermiso('solicitudes.registrar')],
        loadComponent: () =>
          import('./features/solicitudes/solicitud-form.component').then(m => m.SolicitudFormComponent),
      },
      {
        path: 'solicitudes/:id/editar',
        data: { tipo: 'compra' },
        canMatch: [conPermiso('solicitudes.editar')],
        loadComponent: () =>
          import('./features/solicitudes/solicitud-form.component').then(m => m.SolicitudFormComponent),
      },
      {
        path: 'solicitudes/:id',
        data: { tipo: 'compra' },
        canMatch: [conPermiso('solicitudes.ver')],
        loadComponent: () =>
          import('./features/solicitudes/solicitud-detalle.component').then(m => m.SolicitudDetalleComponent),
      },

      /*
       | Reportes: cuatro rutas que reutilizan la misma pantalla.
       | El tipo viaja como dato estático y cada una exige su propio permiso —
       | en varias instituciones el valorizado solo lo ve el área financiera.
       */
      {
        path: 'reportes/existencias',
        data: { tipo: 'existencias' },
        canMatch: [conPermiso('reportes.existencias')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/valorizado',
        data: { tipo: 'valorizado' },
        canMatch: [conPermiso('reportes.valorizado')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/movimientos',
        data: { tipo: 'movimientos' },
        canMatch: [conPermiso('reportes.movimientos')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/vencimientos',
        data: { tipo: 'vencimientos' },
        canMatch: [conPermiso('reportes.vencimientos')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },

      /*
       | Reportes: cuatro rutas que comparten el mismo componente. El tipo viaja
       | como dato estático, así agregar un reporte no obliga a escribir otra
       | pantalla.
       */
      {
        path: 'reportes/existencias',
        data: { tipo: 'existencias' },
        canMatch: [conPermiso('reportes.existencias')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/valorizado',
        data: { tipo: 'valorizado' },
        canMatch: [conPermiso('reportes.valorizado')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/movimientos',
        data: { tipo: 'movimientos' },
        canMatch: [conPermiso('reportes.movimientos')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/vencimientos',
        data: { tipo: 'vencimientos' },
        canMatch: [conPermiso('reportes.vencimientos')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },

      // Inventario
      {
        path: 'existencias',
        canMatch: [conPermiso('stock.ver')],
        loadComponent: () =>
          import('./features/inventario/existencia-lista.component').then(m => m.ExistenciaListaComponent),
      },
      {
        path: 'kardex/:productoId',
        canMatch: [conPermiso('kardex.ver')],
        loadComponent: () =>
          import('./features/inventario/kardex.component').then(m => m.KardexComponent),
      },

      // Ingresos
      {
        path: 'ingresos',
        canMatch: [conPermiso('ingresos.ver')],
        loadComponent: () =>
          import('./features/ingresos/ingreso-lista.component').then(m => m.IngresoListaComponent),
      },
      {
        path: 'ingresos/nuevo',
        canMatch: [conPermiso('ingresos.registrar')],
        loadComponent: () =>
          import('./features/ingresos/ingreso-form.component').then(m => m.IngresoFormComponent),
      },
      {
        path: 'ingresos/:id/editar',
        canMatch: [conPermiso('ingresos.editar')],
        loadComponent: () =>
          import('./features/ingresos/ingreso-form.component').then(m => m.IngresoFormComponent),
      },
      {
        path: 'ingresos/:id',
        canMatch: [conPermiso('ingresos.ver')],
        loadComponent: () =>
          import('./features/ingresos/ingreso-detalle.component').then(m => m.IngresoDetalleComponent),
      },

      // Transferencias
      {
        path: 'transferencias',
        canMatch: [conPermiso('transferencias.ver')],
        loadComponent: () =>
          import('./features/transferencias/transferencia-lista.component').then(m => m.TransferenciaListaComponent),
      },
      {
        path: 'transferencias/nueva',
        canMatch: [conPermiso('transferencias.registrar')],
        loadComponent: () =>
          import('./features/transferencias/transferencia-form.component').then(m => m.TransferenciaFormComponent),
      },
      {
        path: 'transferencias/:id/editar',
        canMatch: [conPermiso('transferencias.registrar')],
        loadComponent: () =>
          import('./features/transferencias/transferencia-form.component').then(m => m.TransferenciaFormComponent),
      },
      {
        path: 'transferencias/:id',
        canMatch: [conPermiso('transferencias.ver')],
        loadComponent: () =>
          import('./features/transferencias/transferencia-detalle.component').then(m => m.TransferenciaDetalleComponent),
      },

      // Salidas
      {
        path: 'salidas',
        canMatch: [conPermiso('salidas.ver')],
        loadComponent: () =>
          import('./features/salidas/salida-lista.component').then(m => m.SalidaListaComponent),
      },
      {
        path: 'salidas/nueva',
        canMatch: [conPermiso('salidas.registrar')],
        loadComponent: () =>
          import('./features/salidas/salida-form.component').then(m => m.SalidaFormComponent),
      },
      {
        path: 'salidas/:id/editar',
        canMatch: [conPermiso('salidas.editar')],
        loadComponent: () =>
          import('./features/salidas/salida-form.component').then(m => m.SalidaFormComponent),
      },
      {
        path: 'salidas/:id',
        canMatch: [conPermiso('salidas.ver')],
        loadComponent: () =>
          import('./features/salidas/salida-detalle.component').then(m => m.SalidaDetalleComponent),
      },

      // Catálogos
      {
        path: 'productos',
        canMatch: [conPermiso('productos.ver')],
        loadComponent: () =>
          import('./features/catalogos/producto-lista.component').then(m => m.ProductoListaComponent),
      },
      {
        path: 'productos/nuevo',
        canMatch: [conPermiso('productos.crear')],
        loadComponent: () =>
          import('./features/catalogos/producto-form.component').then(m => m.ProductoFormComponent),
      },
      /*
       | `productos/importar` ANTES que `productos/:id`.
       |
       | Angular toma la primera ruta que coincide. Si la genérica va primero,
       | interpreta "importar" como un identificador, pide /api/productos/NaN
       | y devuelve un error de base de datos que no dice nada de la causa.
       */
      {
        path: 'productos/importar',
        canMatch: [conPermiso('productos.crear')],
        loadComponent: () =>
          import('./features/catalogos/producto-importar.component').then(m => m.ProductoImportarComponent),
      },
      {
        path: 'productos/:id',
        canMatch: [conAlgunPermiso(['productos.editar', 'productos.ver'])],
        loadComponent: () =>
          import('./features/catalogos/producto-form.component').then(m => m.ProductoFormComponent),
      },
      {
        path: 'categorias',
        canMatch: [conPermiso('categorias.ver')],
        loadComponent: () =>
          import('./features/catalogos/clasificacion.component').then(m => m.ClasificacionComponent),
      },
      {
        path: 'solicitantes',
        canMatch: [conPermiso('solicitantes.ver')],
        loadComponent: () =>
          import('./features/catalogos/solicitante-lista.component').then(m => m.SolicitanteListaComponent),
      },
      {
        path: 'almacenes',
        canMatch: [conPermiso('almacenes.ver')],
        loadComponent: () =>
          import('./features/catalogos/almacen-lista.component').then(m => m.AlmacenListaComponent),
      },

      // Roles
      {
        path: 'roles',
        canMatch: [conPermiso('roles.ver')],
        loadComponent: () =>
          import('./features/roles/rol-lista.component').then(m => m.RolListaComponent),
      },
      {
        path: 'roles/nuevo',
        canMatch: [conPermiso('roles.crear')],
        loadComponent: () =>
          import('./features/roles/rol-form.component').then(m => m.RolFormComponent),
      },
      {
        path: 'roles/:id',
        canMatch: [conAlgunPermiso(['roles.editar', 'roles.ver'])],
        loadComponent: () =>
          import('./features/roles/rol-form.component').then(m => m.RolFormComponent),
      },

      // Usuarios
      {
        path: 'usuarios',
        canMatch: [conPermiso('usuarios.ver')],
        loadComponent: () =>
          import('./features/usuarios/usuario-lista.component').then(m => m.UsuarioListaComponent),
      },
      {
        path: 'usuarios/nuevo',
        canMatch: [conPermiso('usuarios.crear')],
        loadComponent: () =>
          import('./features/usuarios/usuario-form.component').then(m => m.UsuarioFormComponent),
      },
      {
        path: 'usuarios/:id',
        canMatch: [conAlgunPermiso(['usuarios.editar', 'usuarios.ver'])],
        loadComponent: () =>
          import('./features/usuarios/usuario-form.component').then(m => m.UsuarioFormComponent),
      },
            // Devoluciones
      {
        path: 'devoluciones',
        canMatch: [conPermiso('devoluciones.ver')],
        loadComponent: () =>
          import('./features/devoluciones/devolucion-lista.component').then(m => m.DevolucionListaComponent),
      },
      /*
       | `devoluciones/nueva` ANTES que `devoluciones/:id`, por lo mismo que
       | `productos/importar`: Angular toma la primera coincidencia y "nueva"
       | terminaría interpretándose como identificador.
       */
      {
        path: 'devoluciones/nueva',
        canMatch: [conPermiso('devoluciones.registrar')],
        loadComponent: () =>
          import('./features/devoluciones/devolucion-form.component').then(m => m.DevolucionFormComponent),
      },
      {
        path: 'devoluciones/:id',
        canMatch: [conPermiso('devoluciones.ver')],
        loadComponent: () =>
          import('./features/devoluciones/devolucion-detalle.component').then(m => m.DevolucionDetalleComponent),
      },

            {
        path: 'reportes/consumo-areas',
        data: { tipo: 'consumo-areas' },
        canMatch: [conPermiso('reportes.consumo')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/consumo-solicitantes',
        data: { tipo: 'consumo-solicitantes' },
        canMatch: [conPermiso('reportes.consumo')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'reportes/consumo-productos',
        data: { tipo: 'consumo-productos' },
        canMatch: [conPermiso('reportes.consumo')],
        loadComponent: () =>
          import('./features/reportes/reporte.component').then(m => m.ReporteComponent),
      },
      {
        path: 'activos',
        loadChildren: () => import('./activos/activos.routes').then(m => m.ACTIVOS_ROUTES),
      },
      {
        path: 'cargas',
        loadChildren: () => import('./cargas/cargas.routes').then(m => m.CARGAS_ROUTES),
      },
      {
        path: 'caja',
        loadChildren: () => import('./caja/caja.routes').then(m => m.CAJA_ROUTES),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
