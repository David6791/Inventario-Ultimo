import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { SedeRecepcion } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';

/**
 * Sedes de recepción y quién recibe en cada una, como los cajeros de una caja.
 * En una sede con recepcionistas solo ellos reciben carga; quien tiene una sola
 * sede asignada no ve el campo «Sede» en el formulario.
 */
@Component({
  selector: 'app-sedes-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, MultiSelectModule, ToastModule, TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Sedes de recepción</h2>
        <p class="subtitulo">Quién recibe carga en cada sede. Con recepcionistas asignados, solo ellos reciben ahí; si una
          persona tiene una sola sede, el formulario de recepción ya no le pide la sede.</p>
      </div>
    </header>

    <div class="sedes">
      <article class="sede" *ngFor="let s of sedes()">
        <div class="cabeza">
          <h3><i class="pi pi-map-marker"></i> {{ s.nombre }} <span class="codigo secundario">{{ s.codigo }}</span></h3>
          <span class="pastilla" [class.pastilla-acento]="s.recepcionistas.length">
            {{ s.recepcionistas.length ? s.recepcionistas.length + ' recepcionista' + (s.recepcionistas.length === 1 ? '' : 's') : 'Abierta' }}</span>
        </div>
        <p class="secundario" *ngIf="!s.recepcionistas.length">Sin recepcionistas: recibe cualquiera que tenga acceso a la sede.</p>
        <ng-container *appTienePermiso="'cargas.catalogos'">
          <p-multiSelect [options]="candidatos()" [(ngModel)]="elegidos[s.id]" optionLabel="name" optionValue="id" display="chip"
                         placeholder="Elija quién recibe aquí" [filter]="true" filterBy="name,email" appendTo="body"
                         [style]="{ width: '100%' }" [ariaLabel]="'Recepcionistas de ' + s.nombre" />
          <div class="acciones">
            <p-button label="Guardar" icon="pi pi-check" size="small" [loading]="guardando() === s.id"
                      [disabled]="!cambio(s)" (onClick)="guardar(s)" />
          </div>
        </ng-container>
        <div class="nombres" *ngIf="!puedeEditar()">
          <span class="chip" *ngFor="let r of s.recepcionistas">{{ r.name }}</span>
        </div>
      </article>
    </div>
  `,
  styles: [ESTILOS_CARGAS, `
    .sedes { display: grid; grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr)); gap: 0.9rem; }
    .sede { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.9rem 1rem; background: var(--surface-card, #fff);
            display: flex; flex-direction: column; gap: 0.6rem; }
    .cabeza { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .cabeza h3 { margin: 0; font-size: 1rem; display: flex; gap: 0.4rem; align-items: center; }
    .acciones { display: flex; justify-content: flex-end; }
    .nombres { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip { font-size: 0.8rem; background: var(--surface-ground, #f1f5f9); border-radius: 999px; padding: 0.15rem 0.6rem; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.8rem; }
    .secundario { color: var(--text-color-secondary, #6b7280); margin: 0; font-size: 0.85rem; }
  `],
})
export class SedesRecepcionComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);

  readonly sedes = signal<SedeRecepcion[]>([]);
  readonly candidatos = signal<{ id: number; name: string; email: string }[]>([]);
  readonly guardando = signal<number | null>(null);
  readonly puedeEditar = signal(false);
  elegidos: Record<number, number[]> = {};

  ngOnInit(): void { this.cargar(); }

  private cargar(): void {
    this.servicio.sedesRecepcion().subscribe((r) => {
      this.sedes.set(r.data);
      this.candidatos.set(r.candidatos);
      this.puedeEditar.set(r.candidatos.length > 0);
      this.elegidos = Object.fromEntries(r.data.map((s) => [s.id, s.recepcionistas.map((x) => x.id)]));
    });
  }

  cambio(s: SedeRecepcion): boolean {
    const a = [...(this.elegidos[s.id] ?? [])].sort().join(','), b = s.recepcionistas.map((x) => x.id).sort().join(',');
    return a !== b;
  }

  guardar(s: SedeRecepcion): void {
    this.guardando.set(s.id);
    this.servicio.asignarRecepcionistas(s.id, this.elegidos[s.id] ?? []).subscribe({
      next: (r) => {
        this.guardando.set(null);
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 6000 });
        this.sedes.update((l) => l.map((x) => (x.id === s.id ? r.data : x)));
      },
      error: (e) => {
        this.guardando.set(null);
        this.toast.add({ severity: 'error', summary: 'No se guardó', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }
}
