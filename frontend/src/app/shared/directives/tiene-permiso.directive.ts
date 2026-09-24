import {
  Directive, TemplateRef, ViewContainerRef, effect, inject, input,
} from '@angular/core';
import { PermisosService } from '../../core/services/permisos.service';

/**
 * Muestra el contenido solo si el usuario tiene el permiso.
 *
 *   <button *appTienePermiso="'salidas.confirmar'">Confirmar salida</button>
 *   <p-column *appTienePermiso="'stock.ver-costos'" field="costo" />
 *
 * Con `modo: 'alguno'` basta con uno de la lista:
 *   <div *appTienePermiso="['usuarios.crear','usuarios.editar']; modo: 'alguno'">
 *
 * Es un effect, no una comprobación única: si el perfil se recarga porque
 * cambiaron los permisos, la vista se ajusta sola.
 */
@Directive({
  selector: '[appTienePermiso]',
  standalone: true,
})
export class TienePermisoDirective {
  private readonly permisos = inject(PermisosService);
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);

  readonly appTienePermiso = input.required<string | string[]>();
  readonly appTienePermisoModo = input<'todos' | 'alguno'>('todos');

  private visible = false;

  constructor() {
    effect(() => {
      const requerido = this.appTienePermiso();
      const lista = Array.isArray(requerido) ? requerido : [requerido];

      const permitido = this.appTienePermisoModo() === 'alguno'
        ? this.permisos.canAlguno(lista)
        : this.permisos.canTodos(lista);

      if (permitido && !this.visible) {
        this.contenedor.createEmbeddedView(this.plantilla);
        this.visible = true;
      } else if (!permitido && this.visible) {
        this.contenedor.clear();
        this.visible = false;
      }
    });
  }
}
