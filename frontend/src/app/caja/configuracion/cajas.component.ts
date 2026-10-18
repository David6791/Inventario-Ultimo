import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, debounceTime, of, switchMap } from 'rxjs';
import { mensajeDeError } from '../../cargas/core/errores';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { Caja, DatosCaja, OpcionesCaja, VistaPreviaComprobante } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { ESTILOS_CAJA } from '../core/estilos';

/**
 * Cajas por sede y el formato de su número de comprobante. La vista previa la
 * calcula la base con las mismas reglas que al numerar.
 */
@Component({
  selector: 'app-cajas',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, DropdownModule,
    InputTextModule, CheckboxModule, ToastModule, TooltipModule, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Cajas</h2>
        <p class="subtitulo">
          Una caja por sede. Cada una numera sus comprobantes con su propio formato; los comprobantes
          ya emitidos no cambian.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'caja.administrar'">
        <p-button label="Nueva caja" icon="pi pi-plus" (onClick)="abrir(null)" />
      </div>
    </header>

    <p-table [value]="cajas()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 6rem">Código</th>
          <th>Caja</th>
          <th style="width: 15rem">Formato del comprobante</th>
          <th style="width: 13rem">Próximo comprobante</th>
          <th style="width: 11rem">Estado</th>
          <th style="width: 4rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-c>
        <tr [class.inactiva]="!c.activa">
          <td><span class="codigo">{{ c.codigo }}</span></td>
          <td>
            <div>{{ c.nombre }}</div>
            <div class="secundario">
              {{ c.almacen?.nombre }}
              <span class="pastilla" *ngIf="c.maneja_usd">Bs y US$</span>
            </div>
          </td>
          <td>
            <div class="codigo">{{ c.formato_comprobante }}</div>
            <div class="secundario">{{ etiquetaReinicio(c.reinicio_comprobante) }}</div>
          </td>
          <td><span class="proximo">{{ c.proximo_numero ?? '—' }}</span></td>
          <td>
            <span class="pastilla pastilla-ok" *ngIf="c.sesion_abierta">Abierta · sesión {{ c.sesion_abierta.numero }}</span>
            <span class="pastilla" *ngIf="!c.sesion_abierta && c.activa">Cerrada</span>
            <span class="pastilla" *ngIf="!c.activa">Inactiva</span>
          </td>
          <td class="centro">
            <p-button *appTienePermiso="'caja.administrar'" icon="pi pi-pencil" [text]="true" [rounded]="true"
                      size="small" pTooltip="Editar" (onClick)="abrir(c)" />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-wallet"></i>
            <div class="titulo-vacio">Todavía no hay cajas</div>
            <span>Cree la caja de cada sede para poder abrirla y registrar movimientos.</span>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="editorVisible" [header]="actual() ? 'Editar caja ' + actual()!.codigo : 'Nueva caja'"
              [modal]="true" [style]="{ width: '44rem' }" [draggable]="false">
      <div class="nota nota-aviso nota-encabezado" *ngIf="actual()?.tiene_sesiones">
        <i class="pi pi-lock"></i>
        <span>La caja ya tiene sesiones: el código y la sede quedan fijos. El formato se puede cambiar y rige
              desde el próximo comprobante.</span>
      </div>

      <form [formGroup]="form" class="campos">
        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" maxlength="10" placeholder="PTS" class="codigo" />
          <small>Mayúsculas y números. Va en el comprobante con {{ '{' }}CAJA{{ '}' }}.</small>
        </div>
        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="100" placeholder="Caja central Potosí" />
        </div>
        <div class="campo span-3">
          <label for="almacen">Sede</label>
          <p-dropdown inputId="almacen" formControlName="almacen_id" [options]="opciones()?.almacenes ?? []"
                      optionLabel="nombre" optionValue="id" placeholder="Seleccione" appendTo="body" />
          <small>Los cajeros de esa sede la ven y la operan.</small>
        </div>
        <div class="campo span-3 check-campo alinear-abajo">
          <p-checkbox formControlName="maneja_usd" [binary]="true" inputId="usd" />
          <label for="usd">También maneja dólares</label>
        </div>

        <div class="campo span-4">
          <label for="formato">Formato del comprobante</label>
          <input #campoFormato id="formato" pInputText formControlName="formato_comprobante" maxlength="60" class="codigo" />
        </div>
        <div class="campo span-2">
          <label for="reinicio">El número vuelve a 1</label>
          <p-dropdown inputId="reinicio" formControlName="reinicio_comprobante" [options]="opciones()?.reinicios ?? []"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
        </div>

        <div class="campo span-6">
          <div class="marcadores">
            <button type="button" *ngFor="let m of opciones()?.marcadores ?? []" class="marcador"
                    [pTooltip]="m.descripcion" (click)="insertar(m.marcador)">{{ m.marcador }}</button>
          </div>
          <small>Toque un marcador para insertarlo donde está el cursor.</small>
        </div>

        <div class="campo span-6">
          <div class="previa" [class.previa-error]="previa()?.error || (previa()?.repetido && formatoCambiado())">
            <span class="rotulo">Así saldrá el próximo comprobante</span>
            <ng-container *ngIf="previa() as p; else calculando">
              <span class="codigo-grande" *ngIf="p.numero">{{ p.numero }}</span>
              <span class="mensaje" *ngIf="p.error">{{ p.error }}</span>
              <span class="mensaje" *ngIf="p.repetido && formatoCambiado()">Ese número ya existe: con este formato se repetirían comprobantes.</span>
            </ng-container>
            <ng-template #calculando><span class="mensaje neutro">Calculando…</span></ng-template>
          </div>
        </div>

        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="activa" [binary]="true" inputId="activa" />
          <label for="activa">Activa (se puede abrir)</label>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()"
                  [disabled]="form.invalid || !!previa()?.error || (!!previa()?.repetido && formatoCambiado()) || guardando()"
                  (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CAJA, `
    .proximo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 650; font-size: 0.9rem; }
    .alinear-abajo { align-self: end; padding-bottom: 0.5rem; }
    .marcadores { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .marcador {
      border: 1px solid var(--surface-border, #d1d5db); background: var(--surface-card, #fff);
      border-radius: 5px; padding: 0.2rem 0.5rem; cursor: pointer;
      font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.78rem;
    }
    .marcador:hover { background: var(--surface-hover, #f3f4f6); }
    .previa {
      display: flex; flex-direction: column; gap: 0.3rem; padding: 0.9rem 1rem; border-radius: 8px;
      background: #f0f9ff; border: 1px solid #bae6fd;
    }
    .previa-error { background: #fef2f2; border-color: #fecaca; }
    .previa .rotulo { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
                      color: var(--text-color-secondary, #6b7280); }
    .codigo-grande { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.35rem; font-weight: 700; }
    .previa .mensaje { font-size: 0.85rem; color: #b91c1c; }
    .previa .mensaje.neutro { color: var(--text-color-secondary, #6b7280); }
  `],
})
export class CajasComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly destruir = inject(DestroyRef);

  @ViewChild('campoFormato') campoFormato?: ElementRef<HTMLInputElement>;

  readonly cajas = signal<Caja[]>([]);
  readonly opciones = signal<OpcionesCaja | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly actual = signal<Caja | null>(null);
  readonly previa = signal<VistaPreviaComprobante | null>(null);

  editorVisible = false;

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(10)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    almacen_id: [null as number | null, Validators.required],
    maneja_usd: [false],
    formato_comprobante: ['{CAJA}-{AAAA}-{N:6}', [Validators.required, Validators.maxLength(60)]],
    reinicio_comprobante: ['ANUAL', Validators.required],
    activa: [true],
  });

  ngOnInit(): void {
    this.servicio.opciones$.subscribe((o) => this.opciones.set(o));
    this.cargar();

    this.form.valueChanges.pipe(
      debounceTime(300),
      switchMap(() => {
        this.previa.set(null);
        const v = this.form.getRawValue();
        return this.servicio.vistaPrevia({ ...v, caja_id: this.actual()?.id ?? null } as any).pipe(
          catchError((e) => of({ numero: null, repetido: false, error: mensajeDeError(e) })),
        );
      }),
      takeUntilDestroyed(this.destruir),
    ).subscribe((p) => this.previa.set(p));
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (c) => { this.cajas.set(c); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  etiquetaReinicio(valor: string): string {
    return this.opciones()?.reinicios.find((r) => r.valor === valor)?.etiqueta ?? valor;
  }

  /** Volver al formato que ya tenía no es «repetir»: el próximo número es el que sigue. */
  formatoCambiado(): boolean {
    const c = this.actual();
    const v = this.form.getRawValue();
    return !c || c.formato_comprobante !== v.formato_comprobante || c.reinicio_comprobante !== v.reinicio_comprobante;
  }

  abrir(c: Caja | null): void {
    this.actual.set(c);
    this.previa.set(null);
    const sede = this.opciones()?.almacenes.length === 1 ? this.opciones()!.almacenes[0].id : null;
    this.form.reset(c ? { ...c } as any : {
      almacen_id: sede, maneja_usd: false, formato_comprobante: '{CAJA}-{AAAA}-{N:6}',
      reinicio_comprobante: 'ANUAL', activa: true,
    });

    for (const campo of ['codigo', 'almacen_id']) {
      c?.tiene_sesiones ? this.form.get(campo)!.disable({ emitEvent: false }) : this.form.get(campo)!.enable({ emitEvent: false });
    }

    this.editorVisible = true;
    this.form.updateValueAndValidity();
  }

  insertar(marcador: string): void {
    const control = this.form.get('formato_comprobante')!;
    const campo = this.campoFormato?.nativeElement;
    const texto = control.value ?? '';
    const desde = campo?.selectionStart ?? texto.length;
    const hasta = campo?.selectionEnd ?? texto.length;

    control.setValue(texto.slice(0, desde) + marcador + texto.slice(hasta));
    setTimeout(() => {
      campo?.focus();
      campo?.setSelectionRange(desde + marcador.length, desde + marcador.length);
    });
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.guardar(this.form.getRawValue() as DatosCaja, this.actual()?.id).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: `Caja ${c.codigo} guardada` });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }
}
