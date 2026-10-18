import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { mensajeDeError } from '../../cargas/core/errores';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { Persona, PersonaCorta, PersonaDetalle, TotalPersona } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';

/**
 * Registro de personas a quienes la caja paga o de quienes recibe dinero. Se
 * llena solo al registrar movimientos; aquí se busca, se ve todo lo que se le
 * pagó o recibió de cada una y se corrigen sus datos.
 */
@Component({
  selector: 'app-personas-caja',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, AutoCompleteModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    CheckboxModule, ToastModule, TooltipModule, DineroPipe, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Personas</h2>
        <p class="subtitulo">
          Todas las personas y empresas a quienes la caja pagó o de quienes recibió dinero. Se agregan solas
          al registrar un movimiento.
        </p>
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText type="search" placeholder="Nombre o CI" [(ngModel)]="texto" (ngModelChange)="buscar$.next($event)" />
      </span>
    </div>

    <p-table [value]="personas()" [lazy]="true" (onLazyLoad)="cargar($event)" [paginator]="true" [rows]="25"
             [totalRecords]="total()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th>Persona</th>
          <th style="width: 9rem">CI o NIT</th>
          <th style="width: 8rem" class="derecha">Movimientos</th>
          <th style="width: 11rem" class="derecha">Pagado (egresos)</th>
          <th style="width: 11rem" class="derecha">Recibido (ingresos)</th>
          <th style="width: 8rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-p>
        <tr [class.inactiva]="!p.activo">
          <td>
            <div>
              {{ p.nombre }}
              <span class="pastilla pastilla-aviso" *ngIf="p.homonimos"
                    pTooltip="Hay otra persona registrada con el mismo nombre. Si es la misma, unifíquelas.">Posible duplicado</span>
            </div>
            <div class="secundario" *ngIf="p.telefono">{{ p.telefono }}</div>
          </td>
          <td><span class="codigo" *ngIf="p.ci">{{ p.ci }}</span><span class="guion" *ngIf="!p.ci">—</span></td>
          <td class="derecha contador">{{ p.movimientos }}</td>
          <td class="derecha"><div class="monto egreso" *ngFor="let t of p.totales">{{ t.total_egresos | dinero: t.moneda }}</div></td>
          <td class="derecha"><div class="monto ingreso" *ngFor="let t of p.totales">{{ t.total_ingresos | dinero: t.moneda }}</div></td>
          <td class="centro">
            <p-button icon="pi pi-list" [text]="true" [rounded]="true" size="small" pTooltip="Ver movimientos"
                      (onClick)="ver(p.id)" />
            <ng-container *appTienePermiso="'caja.administrar'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" pTooltip="Corregir datos"
                        (onClick)="editar(p)" />
              <p-button icon="pi pi-link" [text]="true" [rounded]="true" size="small" pTooltip="Unificar con otra persona (duplicado)"
                        (onClick)="pedirUnificar(p)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-users"></i>
            <div class="titulo-vacio">{{ texto ? 'Nadie coincide con la búsqueda' : 'Todavía no hay personas' }}</div>
            <span>Se agregan al registrar ingresos y egresos en caja.</span>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <!-- Ficha con sus movimientos -->
    <p-dialog [(visible)]="fichaVisible" [header]="detalle()?.nombre ?? 'Persona'" [modal]="true"
              [style]="{ width: '60rem' }" [draggable]="false">
      <ng-container *ngIf="detalle() as d">
        <p class="secundario cabecera-ficha">
          {{ d.ci ? 'CI ' + d.ci : 'Sin CI' }}<ng-container *ngIf="d.telefono"> · {{ d.telefono }}</ng-container>
          <ng-container *ngIf="d.observaciones"> · {{ d.observaciones }}</ng-container>
        </p>
        <div class="totales">
          <div class="total" *ngFor="let t of d.totales">
            <span class="rotulo">{{ t.moneda === 'USD' ? 'Dólares' : 'Bolivianos' }} · {{ t.movimientos }} movimientos</span>
            <span>Pagado <strong class="monto egreso">{{ t.total_egresos | dinero: t.moneda }}</strong></span>
            <span>Recibido <strong class="monto ingreso">{{ t.total_ingresos | dinero: t.moneda }}</strong></span>
          </div>
        </div>
        <p-table [value]="d.movimientos" styleClass="p-datatable-sm tabla" [scrollable]="true" scrollHeight="24rem">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 9rem">Fecha</th>
              <th style="width: 11rem">Comprobante</th>
              <th>Concepto y glosa</th>
              <th style="width: 10rem" class="derecha">Monto</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-m>
            <tr [class.anulado]="m.estado === 'ANULADO'">
              <td>{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                <div class="codigo">{{ m.numero }}</div>
                <div class="secundario">{{ m.caja?.nombre }}</div>
              </td>
              <td>
                <div>{{ m.concepto?.nombre }} <span class="pastilla pastilla-aviso" *ngIf="m.estado === 'ANULADO'">Anulado</span></div>
                <div class="secundario">{{ m.glosa }}</div>
              </td>
              <td class="derecha">
                <span class="monto" [class.ingreso]="m.tipo === 'INGRESO'" [class.egreso]="m.tipo === 'EGRESO'">
                  {{ m.tipo === 'INGRESO' ? '+' : '−' }} {{ m.monto | dinero: m.moneda }}
                </span>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </ng-container>
    </p-dialog>

    <!-- Unificar duplicado -->
    <p-dialog [(visible)]="unificarVisible" header="Unificar persona duplicada" [modal]="true"
              [style]="{ width: '38rem' }" [draggable]="false">
      <ng-container *ngIf="origen() as o">
        <p class="explicacion">
          Los <strong>{{ o.movimientos }}</strong> movimiento(s) de <strong>{{ o.nombre }}</strong>
          ({{ o.ci ? 'CI ' + o.ci : 'sin CI' }}) pasan a la persona que elija, y este registro se elimina.
          Los comprobantes ya impresos no cambian.
        </p>
        <div class="campos">
          <div class="campo span-6">
            <label>Se conserva</label>
            <div class="opciones-destino" *ngIf="candidatos().length">
              <label *ngFor="let c of candidatos()" class="destino" [class.elegido]="destino()?.id === c.id">
                <input type="radio" name="destino" [checked]="destino()?.id === c.id" (change)="destino.set(c)" />
                <span>{{ c.nombre }}</span><span class="secundario">{{ c.ci ? 'CI ' + c.ci : 'sin CI' }}</span>
              </label>
            </div>
            <p-autoComplete [(ngModel)]="destinoTexto" [suggestions]="sugerencias()" (completeMethod)="buscarDestino($event.query)"
                            (onSelect)="destino.set($event.value)" field="nombre" [minLength]="2" appendTo="body"
                            placeholder="…o busque otra por nombre o CI" [inputStyle]="{ width: '100%' }" [style]="{ width: '100%' }">
              <ng-template let-c pTemplate="item">{{ c.nombre }} · {{ c.ci ? 'CI ' + c.ci : 'sin CI' }}</ng-template>
            </p-autoComplete>
          </div>
          <div class="campo span-6">
            <label for="motivo">Motivo <span class="secundario">(opcional)</span></label>
            <input id="motivo" pInputText [(ngModel)]="motivo" maxlength="250" placeholder="CI mal digitado" />
          </div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="unificarVisible = false" />
        <p-button label="Unificar" icon="pi pi-link" [loading]="guardando()"
                  [disabled]="!destino() || destino()!.id === origen()?.id || guardando()" (onClick)="unificar()" />
      </ng-template>
    </p-dialog>

    <!-- Corregir datos -->
    <p-dialog [(visible)]="editorVisible" header="Corregir datos de la persona" [modal]="true"
              [style]="{ width: '34rem' }" [draggable]="false">
      <div class="nota nota-neutra nota-encabezado">
        <i class="pi pi-info-circle"></i>
        <span>Los comprobantes ya emitidos conservan el nombre y el CI con que se imprimieron.</span>
      </div>
      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="nombre">Nombre o razón social</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="150" />
        </div>
        <div class="campo span-3">
          <label for="ci">CI o NIT</label>
          <input id="ci" pInputText formControlName="ci" maxlength="15" />
        </div>
        <div class="campo span-3">
          <label for="telefono">Teléfono</label>
          <input id="telefono" pInputText formControlName="telefono" maxlength="30" />
        </div>
        <div class="campo span-6">
          <label for="obs">Observaciones</label>
          <input id="obs" pInputText formControlName="observaciones" maxlength="250" />
        </div>
        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="activo" [binary]="true" inputId="activo" />
          <label for="activo">Activa (aparece al registrar movimientos)</label>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()" [disabled]="form.invalid || guardando()"
                  (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [...ESTILOS_CAJA, `
    .cabecera-ficha { margin-top: 0; }
    .totales { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
    .total { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.7rem 1rem; font-size: 0.85rem;
             border: 1px solid var(--surface-border, #e5e7eb); border-radius: 8px; }
    .total .rotulo { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
                     color: var(--text-color-secondary, #6b7280); }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
    .opciones-destino { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.5rem; }
    .destino { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.75rem; cursor: pointer;
               border: 1px solid var(--surface-border, #e5e7eb); border-radius: 6px; font-size: 0.9rem; }
    .campo .destino input { width: auto; flex: none; margin: 0; }
    .destino span:first-of-type { flex: 1; }
    .destino.elegido { border-color: #93c5fd; background: #eff6ff; }
    tr.anulado td { color: var(--text-color-secondary, #9ca3af); }
    tr.anulado .monto { text-decoration: line-through; }
  `],
})
export class PersonasCajaComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruir = inject(DestroyRef);

  readonly personas = signal<Persona[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly detalle = signal<PersonaDetalle | null>(null);
  readonly actual = signal<Persona | null>(null);

  readonly buscar$ = new Subject<string>();
  texto = '';
  private pagina = 1;

  fichaVisible = false;
  editorVisible = false;
  unificarVisible = false;
  motivo = '';
  destinoTexto: string | PersonaCorta | null = null;
  readonly origen = signal<Persona | null>(null);
  readonly destino = signal<PersonaCorta | null>(null);
  readonly candidatos = signal<PersonaCorta[]>([]);
  readonly sugerencias = signal<PersonaCorta[]>([]);

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    ci: [null as string | null],
    telefono: [null as string | null],
    observaciones: [null as string | null],
    activo: [true],
  });

  ngOnInit(): void {
    this.buscar$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destruir))
      .subscribe(() => { this.pagina = 1; this.pedir(); });

    // Desde un movimiento: /caja/personas?ver=12 abre la ficha de esa persona.
    const ver = Number(this.ruta.snapshot.queryParamMap.get('ver'));
    if (ver) this.ver(ver);
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.pagina = Math.floor((evento.first ?? 0) / (evento.rows ?? 25)) + 1;
    this.pedir();
  }

  private pedir(): void {
    this.cargando.set(true);
    this.servicio.personas(this.texto, this.pagina).subscribe({
      next: (r) => { this.personas.set(r.data); this.total.set(r.total); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  ver(id: number): void {
    this.detalle.set(null);
    this.fichaVisible = true;
    this.servicio.persona(id).subscribe({
      next: (d) => this.detalle.set(d),
      error: (e) => {
        this.fichaVisible = false;
        this.toast.add({ severity: 'error', summary: 'No se pudo abrir la ficha', detail: mensajeDeError(e) });
      },
    });
  }

  editar(p: Persona): void {
    this.actual.set(p);
    this.form.reset({ ...p });
    this.editorVisible = true;
  }

  guardar(): void {
    const p = this.actual();
    if (!p) return;
    this.guardando.set(true);
    this.servicio.guardarPersona(p.id, this.form.getRawValue() as Partial<Persona>).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: 'Datos corregidos', detail: r.nombre });
        this.pedir();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  pedirUnificar(p: Persona): void {
    this.origen.set(p);
    this.destino.set(null);
    this.destinoTexto = null;
    this.motivo = '';
    this.candidatos.set([]);
    this.unificarVisible = true;
    // Los del mismo nombre son los candidatos más probables.
    this.servicio.coincidencias(p.nombre, p.ci).subscribe((r) => {
      const otros = r.mismo_nombre.filter((c) => c.id !== p.id);
      this.candidatos.set(otros);
      if (otros.length === 1) this.destino.set(otros[0]);
    });
  }

  buscarDestino(texto: string): void {
    this.servicio.buscarPersonas(texto).subscribe((r) => this.sugerencias.set(r.filter((c) => c.id !== this.origen()?.id)));
  }

  unificar(): void {
    const o = this.origen();
    const d = this.destino();
    if (!o || !d) return;
    this.guardando.set(true);
    this.servicio.unificar(o.id, d.id, this.motivo.trim() || null).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.unificarVisible = false;
        this.toast.add({ severity: 'success', summary: 'Personas unificadas', detail: r.mensaje, life: 8000 });
        this.pedir();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se unificó', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  totalDe(totales: TotalPersona[], moneda: string): TotalPersona | undefined {
    return totales.find((t) => t.moneda === moneda);
  }
}
