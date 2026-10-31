import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

/**
 * Las cajas del usuario, con su estado y su efectivo del momento. Primero las
 * que opera (es su cajero); las que solo puede consultar (supervisión o
 * administración) aparecen aparte y solo si las pide, o si no opera ninguna.
 */
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

    <ng-template #tarjeta let-c>
      <a class="tarjeta" [routerLink]="['/caja/operar', c.id]" [class.abierta]="c.sesion_abierta" [class.ajena]="!c.soy_cajero">
        <div class="cabeza">
          <span class="codigo">{{ c.codigo }}</span>
          <span class="pastilla" [class.pastilla-ok]="c.sesion_abierta">
            {{ c.sesion_abierta ? 'Abierta · sesión ' + c.sesion_abierta.numero : 'Cerrada' }}
          </span>
        </div>
        <div class="nombre">{{ c.nombre }}
          <span class="por-recibir" *ngIf="c.envios_por_recibir"><i class="pi pi-send"></i>
            {{ c.envios_por_recibir === 1 ? '1 envío por recibir' : c.envios_por_recibir + ' envíos por recibir' }}</span>
          <span class="central" *ngIf="c.es_central">Sede central</span></div>
        <div class="secundario">
          {{ c.almacen?.centro_costo?.nombre ?? c.almacen?.nombre }} ·
          <span [class.mia]="c.soy_cajero">{{ c.soy_cajero ? 'Usted es cajero' : 'Solo consulta' }}</span>
        </div>

        <div class="saldos" *ngIf="c.sesion_abierta as s">
          <div *ngFor="let saldo of s.saldos" class="saldo">
            <span class="rotulo">Efectivo {{ saldo.moneda === 'USD' ? 'en dólares' : '' }}</span>
            <span class="monto grande">{{ saldo.saldo_efectivo_actual | dinero: saldo.moneda }}</span>
          </div>
          <div class="secundario">Abrió {{ s.abierta_por }} · {{ s.abierta_en | date: 'dd/MM HH:mm' }}</div>
        </div>
        <div class="saldos" *ngIf="!c.sesion_abierta">
          <span class="secundario">{{ c.soy_cajero ? 'Ábrala para registrar movimientos.' : 'Está cerrada.' }}</span>
        </div>
        <i class="pi pi-angle-right flecha"></i>
      </a>
    </ng-template>

    <ng-container *ngIf="!cargando()">
      <!-- Las cajas que el usuario opera -->
      <div class="grilla" *ngIf="mias().length">
        <ng-container *ngFor="let c of mias()"><ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: c }" /></ng-container>
      </div>

      <!-- Las demás (supervisión o administración): solo si las pide, o si no opera ninguna -->
      <ng-container *ngIf="otras().length">
        <div class="ver-otras" *ngIf="mias().length">
          <p-button [label]="verOtras() ? 'Ocultar las otras cajas' : 'Ver las otras cajas (' + otras().length + ', solo consulta)'"
                    [icon]="verOtras() ? 'pi pi-eye-slash' : 'pi pi-eye'" [text]="true" size="small" (onClick)="alternarOtras()" />
        </div>
        <ng-container *ngIf="verOtras() || !mias().length">
          <h3 class="titulo-otras">{{ mias().length ? 'Otras cajas' : 'Cajas que puede consultar' }}
            <span class="secundario">· no es cajero de estas: solo puede ver su estado y movimientos</span></h3>
          <div class="grilla">
            <ng-container *ngFor="let c of otras()"><ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: c }" /></ng-container>
          </div>
        </ng-container>
      </ng-container>

      <div class="vacio" *ngIf="!mias().length && !otras().length">
        <i class="pi pi-wallet"></i>
        <div class="titulo-vacio">No tiene cajas asignadas</div>
        <span>Pida a quien administra las cajas que lo asigne como cajero de la caja de su sede.</span>
      </div>
    </ng-container>
  `,
  styles: [...ESTILOS_CAJA, `
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
    .mia { color: #15803d; font-weight: 600; }
    .flecha { position: absolute; right: 1rem; bottom: 1rem; color: var(--text-color-secondary, #9ca3af); }
    .vacio { grid-column: 1 / -1; }
    .tarjeta.ajena { background: var(--surface-ground, #f8fafc); }
    .por-recibir { font-size: 0.72rem; font-weight: 600; color: #1d4ed8; background: #dbeafe; border-radius: 999px; padding: 0.1rem 0.5rem; margin-left: 0.4rem; }
    .central { font-size: 0.72rem; font-weight: 600; color: #075985; background: #e0f2fe; border-radius: 999px; padding: 0.1rem 0.5rem; margin-left: 0.4rem; }
    .ver-otras { margin-top: 1rem; }
    .titulo-otras { font-size: 0.95rem; margin: 1.2rem 0 0.7rem; }
    .titulo-otras .secundario { font-weight: 400; font-size: 0.82rem; }
  `],
})
export class MisCajasComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);

  readonly activas = signal<Caja[]>([]);
  readonly cargando = signal(true);
  readonly mias = computed(() => this.activas().filter((c) => c.soy_cajero));
  readonly otras = computed(() => this.activas().filter((c) => !c.soy_cajero));
  readonly verOtras = signal(MisCajasComponent.otrasGuardado());

  private static otrasGuardado(): boolean {
    try { return localStorage.getItem('caja.ver-otras') === 'si'; } catch { return false; }
  }

  alternarOtras(): void {
    this.verOtras.update((v) => !v);
    try { localStorage.setItem('caja.ver-otras', this.verOtras() ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  }

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
