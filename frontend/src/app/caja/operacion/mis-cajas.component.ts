import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../../cargas/core/errores';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { Caja } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';

/** Las cajas de las sedes del usuario, con su estado y su efectivo del momento. */
@Component({
  selector: 'app-mis-cajas',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, SkeletonModule, ToastModule, DineroPipe, TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Caja</h2>
        <p class="subtitulo">Elija la caja para abrirla, registrar ingresos y egresos o ver su saldo.</p>
      </div>
      <div class="acciones" *appTienePermiso="'caja.administrar'">
        <p-button label="Administrar cajas" icon="pi pi-cog" [outlined]="true" routerLink="/caja/cajas" />
      </div>
    </header>

    <div class="grilla" *ngIf="cargando()">
      <p-skeleton height="9.5rem" *ngFor="let _ of [1, 2]" />
    </div>

    <div class="grilla" *ngIf="!cargando()">
      <a class="tarjeta" *ngFor="let c of activas()" [routerLink]="['/caja/operar', c.id]" [class.abierta]="c.sesion_abierta">
        <div class="cabeza">
          <span class="codigo">{{ c.codigo }}</span>
          <span class="pastilla" [class.pastilla-ok]="c.sesion_abierta">
            {{ c.sesion_abierta ? 'Abierta · sesión ' + c.sesion_abierta.numero : 'Cerrada' }}
          </span>
        </div>
        <div class="nombre">{{ c.nombre }}</div>
        <div class="secundario">{{ c.almacen?.nombre }}</div>

        <div class="saldos" *ngIf="c.sesion_abierta as s">
          <div *ngFor="let saldo of s.saldos" class="saldo">
            <span class="rotulo">Efectivo {{ saldo.moneda === 'USD' ? 'en dólares' : '' }}</span>
            <span class="monto grande">{{ saldo.saldo_efectivo_actual | dinero: saldo.moneda }}</span>
          </div>
          <div class="secundario">Abrió {{ s.abierta_por }} · {{ s.abierta_en | date: 'dd/MM HH:mm' }}</div>
        </div>
        <div class="saldos" *ngIf="!c.sesion_abierta">
          <span class="secundario">Ábrala para registrar movimientos.</span>
        </div>
        <i class="pi pi-angle-right flecha"></i>
      </a>

      <div class="vacio" *ngIf="!activas().length">
        <i class="pi pi-wallet"></i>
        <div class="titulo-vacio">No hay cajas en sus sedes</div>
        <span>Pida a quien administra las cajas que cree la de su sede o que le asigne la sede a su usuario.</span>
      </div>
    </div>
  `,
  styles: [ESTILOS_CAJA, `
    .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 1rem; }
    .tarjeta {
      position: relative; display: flex; flex-direction: column; gap: 0.2rem; padding: 1rem 1.1rem;
      border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; background: var(--surface-card, #fff);
      color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s;
    }
    .tarjeta:hover { border-color: #93c5fd; box-shadow: 0 2px 10px rgb(0 0 0 / 0.05); }
    .tarjeta.abierta { border-left: 4px solid #22c55e; }
    .cabeza { display: flex; justify-content: space-between; align-items: center; }
    .cabeza .codigo { font-weight: 700; font-size: 0.95rem; }
    .nombre { font-weight: 600; margin-top: 0.3rem; }
    .saldos { margin-top: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .saldo { display: flex; flex-direction: column; }
    .saldo .rotulo { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-color-secondary, #6b7280); }
    .monto.grande { font-size: 1.35rem; font-weight: 700; }
    .flecha { position: absolute; right: 1rem; bottom: 1rem; color: var(--text-color-secondary, #9ca3af); }
    .vacio { grid-column: 1 / -1; }
  `],
})
export class MisCajasComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);

  readonly activas = signal<Caja[]>([]);
  readonly cargando = signal(true);

  ngOnInit(): void {
    this.servicio.listar().subscribe({
      next: (c) => { this.activas.set(c.filter((x) => x.activa)); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudieron cargar las cajas', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }
}
