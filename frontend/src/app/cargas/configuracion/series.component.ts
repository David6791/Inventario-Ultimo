import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, debounceTime, of, switchMap } from 'rxjs';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { LineaProducto, Opcion, Opciones, SerieLote, VistaPrevia } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { DatosSerie, SeriesService } from '../core/services/series.service';

/**
 * Series de lote y el formato de su numeración.
 *
 * El formato se arma con marcadores ({PREFIJO}, {AAAA}, {MM}, {N:4}…) y un
 * reinicio (nunca, anual, mensual, diario). La vista previa la calcula la base
 * con las mismas reglas que al numerar, así lo que se ve es lo que va a salir.
 */
@Component({
  selector: 'app-series',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    DropdownModule, InputTextModule, InputNumberModule, CheckboxModule, TagModule, ToastModule,
    TooltipModule, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Series de lote</h2>
        <p class="subtitulo">
          Cada serie numera los lotes de una línea de producto, de compra o de producción propia.
          El formato del código se define aquí; los lotes ya numerados no cambian.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.series'">
        <p-button label="Nueva serie" icon="pi pi-plus" (onClick)="abrir(null)" />
      </div>
    </header>

    <div class="barra sigla">
      <span>Sigla de la empresa para el marcador <code>{{ '{' }}SIGLA{{ '}' }}</code>:</span>
      <strong class="codigo">{{ sigla() ?? '—' }}</strong>
      <p-button *appTienePermiso="'cargas.series'" label="Cambiar" [text]="true" size="small"
                (onClick)="siglaNueva = sigla() ?? ''; siglaVisible = true" />
    </div>

    <p-table [value]="series()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 7rem">Prefijo</th>
          <th>Serie</th>
          <th style="width: 16rem">Formato</th>
          <th style="width: 15rem">Próximo código</th>
          <th style="width: 6rem" class="derecha">Lotes</th>
          <th style="width: 7rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-s>
        <tr [class.inactiva]="!s.activa">
          <td><span class="codigo">{{ s.prefijo }}</span></td>
          <td>
            <div>{{ s.nombre }}</div>
            <div class="secundario">
              {{ s.linea?.nombre }} ·
              <span class="pastilla" [class.pastilla-acento]="s.origen === 'PROPIA'">{{ s.origen === 'PROPIA' ? 'Propia' : 'Compra' }}</span>
            </div>
          </td>
          <td>
            <div class="codigo">{{ s.formato }}</div>
            <div class="secundario">{{ etiqueta(opciones()?.reinicios, s.reinicio) }}</div>
          </td>
          <td><span class="proximo">{{ s.proximo_codigo ?? '—' }}</span></td>
          <td class="derecha contador">{{ s.lotes }}</td>
          <td class="centro">
            <ng-container *appTienePermiso="'cargas.series'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" pTooltip="Editar"
                        (onClick)="abrir(s)" />
              <p-button icon="pi pi-step-forward" [text]="true" [rounded]="true" size="small"
                        pTooltip="Continuar la numeración de otro sistema" (onClick)="abrirContador(s)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Editor -->
    <p-dialog [(visible)]="editorVisible" [header]="actual() ? 'Editar serie ' + actual()!.prefijo : 'Nueva serie'"
              [modal]="true" [style]="{ width: '46rem' }" [draggable]="false">
      <div class="nota nota-aviso nota-encabezado" *ngIf="actual()?.lotes">
        <i class="pi pi-lock"></i>
        <span>La serie ya tiene {{ actual()!.lotes }} lote(s): el prefijo, la línea y el origen quedan fijos.
              El formato sí se puede cambiar y rige desde el próximo lote.</span>
      </div>

      <form [formGroup]="form" class="campos">
        <div class="campo span-2">
          <label for="prefijo">Prefijo</label>
          <input id="prefijo" pInputText formControlName="prefijo" maxlength="10" placeholder="CZP" />
        </div>
        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="100" placeholder="Compra de complejo zinc-plata" />
        </div>
        <div class="campo span-3">
          <label for="linea">Línea de producto</label>
          <p-dropdown inputId="linea" formControlName="linea_producto_id" [options]="lineas()" optionLabel="nombre"
                      optionValue="id" placeholder="Seleccione" appendTo="body" />
        </div>
        <div class="campo span-3">
          <label for="origen">Origen</label>
          <p-dropdown inputId="origen" formControlName="origen" [options]="opciones()?.origenes ?? []"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
        </div>

        <div class="campo span-4">
          <label for="formato">Formato del código</label>
          <input #campoFormato id="formato" pInputText formControlName="formato" maxlength="60" class="codigo" />
        </div>
        <div class="campo span-2">
          <label for="reinicio">El número vuelve a 1</label>
          <p-dropdown inputId="reinicio" formControlName="reinicio" [options]="opciones()?.reinicios ?? []"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
        </div>

        <div class="campo span-6">
          <div class="marcadores">
            <button type="button" *ngFor="let m of opciones()?.marcadores ?? []" class="marcador"
                    [pTooltip]="m.etiqueta" (click)="insertar(m.valor)">{{ m.valor }}</button>
          </div>
          <small>Toque un marcador para insertarlo donde está el cursor. Fuera de las llaves puede escribir
                 letras, números, guion, punto, barra o guion bajo.</small>
        </div>

        <div class="campo span-6">
          <div class="previa" [class.previa-error]="previa()?.error || previa()?.repetido">
            <span class="rotulo">Así saldrá el próximo lote</span>
            <ng-container *ngIf="previa() as p; else calculando">
              <span class="codigo-grande" *ngIf="p.codigo">{{ p.codigo }}</span>
              <span class="mensaje" *ngIf="p.error">{{ p.error }}</span>
              <span class="mensaje" *ngIf="p.repetido">Ese código ya existe: con este formato se repetirían códigos.</span>
            </ng-container>
            <ng-template #calculando><span class="mensaje neutro">Calculando…</span></ng-template>
          </div>
        </div>

        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="activa" [binary]="true" inputId="activa" />
          <label for="activa">Activa (aparece al registrar lotes)</label>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()"
                  [disabled]="form.invalid || !!previa()?.error || !!previa()?.repetido || guardando()"
                  (onClick)="guardar()" />
      </ng-template>
    </p-dialog>

    <!-- Continuar numeración -->
    <p-dialog [(visible)]="contadorVisible" header="Continuar la numeración" [modal]="true"
              [style]="{ width: '30rem' }" [draggable]="false">
      <p class="explicacion">
        Si la serie {{ serieContador()?.prefijo }} continúa la numeración de otro sistema, indique el
        <strong>último número que se usó</strong> en el período actual. El próximo lote tomará el siguiente.
        El contador nunca retrocede, para no repetir códigos.
      </p>
      <div class="campos">
        <div class="campo span-3">
          <label for="ultimo">Último número usado</label>
          <p-inputNumber inputId="ultimo" [(ngModel)]="ultimoNumero" [min]="0" [useGrouping]="false" />
          <small>Hoy va en {{ serieContador()?.ultimo_numero ?? 0 }}.</small>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="contadorVisible = false" />
        <p-button label="Fijar" icon="pi pi-check" [disabled]="ultimoNumero === null" (onClick)="fijarContador()" />
      </ng-template>
    </p-dialog>

    <!-- Sigla -->
    <p-dialog [(visible)]="siglaVisible" header="Sigla de la empresa" [modal]="true"
              [style]="{ width: '26rem' }" [draggable]="false">
      <p class="explicacion">Rige desde hoy. Los lotes ya numerados conservan la sigla con la que se numeraron.</p>
      <div class="campos">
        <div class="campo span-3">
          <label for="sigla">Sigla</label>
          <input id="sigla" pInputText [(ngModel)]="siglaNueva" maxlength="10" class="codigo" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="siglaVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="!siglaNueva.trim()" (onClick)="guardarSigla()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .sigla { gap: 0.6rem; font-size: 0.85rem; }
    .sigla code { font-size: 0.8rem; }
    .proximo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 650; font-size: 0.9rem; }
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
    .codigo-grande { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.35rem; font-weight: 700;
                     letter-spacing: -0.01em; }
    .previa .mensaje { font-size: 0.85rem; color: #b91c1c; }
    .previa .mensaje.neutro { color: var(--text-color-secondary, #6b7280); }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
  `],
})
export class SeriesComponent implements OnInit {
  private readonly servicio = inject(SeriesService);
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly destruir = inject(DestroyRef);

  @ViewChild('campoFormato') campoFormato?: ElementRef<HTMLInputElement>;

  readonly series = signal<SerieLote[]>([]);
  readonly lineas = signal<LineaProducto[]>([]);
  readonly opciones = signal<Opciones | null>(null);
  readonly sigla = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly actual = signal<SerieLote | null>(null);
  readonly previa = signal<VistaPrevia | null>(null);
  readonly serieContador = signal<SerieLote | null>(null);

  editorVisible = false;
  contadorVisible = false;
  siglaVisible = false;
  ultimoNumero: number | null = null;
  siglaNueva = '';

  readonly form = this.fb.group({
    prefijo: ['', [Validators.required, Validators.maxLength(10)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    linea_producto_id: [null as number | null, Validators.required],
    origen: ['COMPRA', Validators.required],
    formato: ['{PREFIJO}-{AAAA}{MM}-{N:4}', [Validators.required, Validators.maxLength(60)]],
    reinicio: ['MENSUAL', Validators.required],
    activa: [true],
  });

  ngOnInit(): void {
    this.catalogos.opciones$.subscribe((o) => this.opciones.set(o));
    this.catalogos.listarLineas().subscribe((l) => this.lineas.set(l.filter((x) => x.activa)));
    this.cargar();

    // Vista previa en vivo: la calcula la base con las reglas reales de numeración.
    this.form.valueChanges.pipe(
      debounceTime(300),
      switchMap(() => {
        this.previa.set(null);
        const v = this.form.getRawValue();
        return this.servicio.vistaPrevia({ ...v, serie_id: this.actual()?.id ?? null } as any).pipe(
          catchError((e) => of({ codigo: null, repetido: false, error: mensajeDeError(e) } as VistaPrevia)),
        );
      }),
      takeUntilDestroyed(this.destruir),
    ).subscribe((p) => this.previa.set(p));
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (r) => { this.series.set(r.data); this.sigla.set(r.sigla); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  etiqueta(lista: Opcion[] | undefined, valor: string): string {
    return lista?.find((o) => o.valor === valor)?.etiqueta ?? valor;
  }

  abrir(s: SerieLote | null): void {
    this.actual.set(s);
    this.previa.set(null);
    this.form.reset(s ? { ...s } as any : {
      origen: 'COMPRA', formato: '{PREFIJO}-{AAAA}{MM}-{N:4}', reinicio: 'MENSUAL', activa: true,
    });

    // Con lotes, prefijo, línea y origen quedan fijos (la base también lo impide).
    for (const campo of ['prefijo', 'linea_producto_id', 'origen']) {
      s?.lotes ? this.form.get(campo)!.disable({ emitEvent: false }) : this.form.get(campo)!.enable({ emitEvent: false });
    }

    this.editorVisible = true;
    this.form.updateValueAndValidity();   // dispara la primera vista previa
  }

  /** Inserta el marcador donde está el cursor del campo de formato. */
  insertar(marcador: string): void {
    const control = this.form.get('formato')!;
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
    this.servicio.guardar(this.form.getRawValue() as DatosSerie, this.actual()?.id).subscribe({
      next: (s) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: 'Serie guardada', detail: `Próximo lote: ${s.proximo_codigo}` });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  abrirContador(s: SerieLote): void {
    this.serieContador.set(s);
    this.ultimoNumero = s.ultimo_numero;
    this.contadorVisible = true;
  }

  fijarContador(): void {
    const s = this.serieContador();
    if (!s || this.ultimoNumero === null) return;

    this.servicio.continuarNumeracion(s.id, this.ultimoNumero).subscribe({
      next: (r) => {
        this.contadorVisible = false;
        this.toast.add({ severity: 'success', summary: 'Numeración ajustada', detail: r.mensaje, life: 6000 });
        this.cargar();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se ajustó', detail: mensajeDeError(e), life: 8000 }),
    });
  }

  guardarSigla(): void {
    this.servicio.cambiarSigla(this.siglaNueva.trim()).subscribe({
      next: (r) => {
        this.siglaVisible = false;
        this.toast.add({ severity: 'success', summary: `Sigla ${r.sigla} vigente desde ${r.vigente_desde}` });
        this.cargar();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se guardó', detail: mensajeDeError(e) }),
    });
  }
}
