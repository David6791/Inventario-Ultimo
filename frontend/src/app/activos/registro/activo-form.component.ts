import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ActivoService } from '../core/services/activo.service';
import { CatalogoService } from '../core/services/catalogo.service';
import { CONCEPTOS_COSTO, CONDICIONES, ORIGENES } from '../core/models/activo.model';
import { Clase, Subclase, Ubicacion } from '../core/models/catalogo.model';

@Component({
  selector: 'app-activo-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ButtonModule, CalendarModule, DropdownModule,
    InputNumberModule, InputTextModule, InputTextareaModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <button class="volver" type="button" (click)="volver()">
          <i class="pi pi-arrow-left"></i> Activos fijos
        </button>
        <h2>Nuevo activo fijo</h2>
      </div>
    </header>

    <form [formGroup]="form" class="formulario">

      <!-- =============================================== 1. Identificación -->
      <section class="bloque">
        <div class="bloque-titulo">
          <span class="numero">1</span>
          <div>
            <h3>Identificación</h3>
            <p>Qué es el bien y a qué categoría pertenece.</p>
          </div>
        </div>

        <div class="campos">
          <div class="campo span-3">
            <label for="clase">Clase</label>
            <p-dropdown inputId="clase" formControlName="clase_id" [options]="clases()"
                        optionLabel="nombre" optionValue="id" placeholder="Seleccione"
                        [filter]="true" filterBy="nombre" appendTo="body"
                        (onChange)="alCambiarClase()" />
          </div>

          <div class="campo span-3">
            <label for="subclase">Subclase</label>
            <p-dropdown inputId="subclase" formControlName="subclase_id"
                        [options]="subclasesDeLaClase()" optionLabel="nombre" optionValue="id"
                        [placeholder]="form.value.clase_id ? 'Seleccione' : 'Elija la clase primero'"
                        appendTo="body" [disabled]="!form.value.clase_id" />
          </div>

          <div class="span-6" *ngIf="claseElegida() as c">
            <div class="nota" [class.nota-neutra]="!c.deprecia">
              <i class="pi" [ngClass]="c.deprecia ? 'pi-calculator' : 'pi-minus-circle'"></i>
              <span *ngIf="c.deprecia">
                Vida útil fiscal: <strong>{{ c.vida_util_fiscal_meses! / 12 }} años</strong>
                según el Anexo del Art. 22 del DS 24051. Se hereda al registrar.
              </span>
              <span *ngIf="!c.deprecia">
                Esta clase no se deprecia. El activo no llevará vida útil fiscal.
              </span>
            </div>
          </div>

          <div class="campo span-6">
            <label for="denominacion">Denominación</label>
            <input id="denominacion" pInputText formControlName="denominacion"
                   placeholder="Ej. Laptop Dell Latitude 5440" />
          </div>

          <div class="campo span-2">
            <label for="marca">Marca</label>
            <input id="marca" pInputText formControlName="marca" />
          </div>
          <div class="campo span-2">
            <label for="modelo">Modelo</label>
            <input id="modelo" pInputText formControlName="modelo" />
          </div>
          <div class="campo span-2">
            <label for="anio">Año de fabricación</label>
            <p-inputNumber inputId="anio" formControlName="anio_fabricacion"
                           [useGrouping]="false" [min]="1900" [max]="2100" />
          </div>

          <div class="campo span-3">
            <label for="serie">Número de serie</label>
            <input id="serie" pInputText formControlName="serie" />
            <small>Único en el sistema: no puede repetirse.</small>
          </div>
          <div class="campo span-3">
            <label for="placa">Placa</label>
            <input id="placa" pInputText formControlName="placa" />
          </div>

          <div class="campo span-6">
            <label for="descripcion">Descripción</label>
            <textarea id="descripcion" pInputTextarea formControlName="descripcion" rows="2"></textarea>
          </div>
        </div>
      </section>

      <!-- ================================================ 2. Procedencia -->
      <section class="bloque">
        <div class="bloque-titulo">
          <span class="numero">2</span>
          <div>
            <h3>Procedencia y recepción</h3>
            <p>De dónde viene y desde cuándo responde la empresa por él.</p>
          </div>
        </div>

        <div class="campos">
          <div class="campo span-3">
            <label for="origen">Tipo de origen</label>
            <p-dropdown inputId="origen" formControlName="tipo_origen" [options]="origenes"
                        optionLabel="etiqueta" optionValue="valor" appendTo="body"
                        (onChange)="alCambiarOrigen()" />
          </div>
          <div class="campo span-3">
            <label for="condicion">Condición</label>
            <p-dropdown inputId="condicion" formControlName="condicion" [options]="condiciones"
                        optionLabel="etiqueta" optionValue="valor" appendTo="body" />
          </div>

          <div class="campo span-3">
            <label for="factura">N° de factura</label>
            <input id="factura" pInputText formControlName="factura_nro" />
          </div>
          <div class="campo span-3">
            <label for="facturaFecha">Fecha de factura</label>
            <p-calendar inputId="facturaFecha" formControlName="factura_fecha"
                        dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" />
          </div>

          <div class="campo span-3">
            <label for="acta">
              N° de acta de recepción
              <span class="obligatorio" *ngIf="exigeActa()">obligatorio</span>
            </label>
            <input id="acta" pInputText formControlName="acta_recepcion_nro" />
          </div>
          <div class="campo span-3">
            <label for="actaFecha">Fecha del acta</label>
            <p-calendar inputId="actaFecha" formControlName="acta_recepcion_fecha"
                        dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" />
          </div>

          <div class="span-6">
            <div class="nota nota-aviso">
              <i class="pi pi-info-circle"></i>
              <span>
                Las dos fechas siguientes <strong>no son lo mismo</strong>. La incorporación es
                contable; el inicio de uso es la base del cómputo de la depreciación y puede ser
                posterior, nunca anterior.
              </span>
            </div>
          </div>

          <div class="campo span-3">
            <label for="incorporacion">Fecha de incorporación</label>
            <p-calendar inputId="incorporacion" formControlName="fecha_incorporacion"
                        dateFormat="dd/mm/yy" [showIcon]="true" [maxDate]="hoy" appendTo="body" />
            <small>Fecha del acta de recepción.</small>
          </div>
          <div class="campo span-3">
            <label for="inicioUso">Fecha de inicio de uso</label>
            <p-calendar inputId="inicioUso" formControlName="fecha_inicio_uso"
                        dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" />
            <small>Cuando entra efectivamente en servicio.</small>
          </div>

          <div class="campo span-3">
            <label for="ubicacion">Ubicación</label>
            <p-dropdown inputId="ubicacion" formControlName="ubicacion_id" [options]="ubicaciones()"
                        optionLabel="nombre" optionValue="id" placeholder="Seleccione"
                        [filter]="true" filterBy="nombre" appendTo="body" />
          </div>
          <div class="campo span-2">
            <label for="moneda">Moneda</label>
            <p-dropdown inputId="moneda" formControlName="moneda"
                        [options]="monedas" optionLabel="etiqueta" optionValue="valor"
                        appendTo="body" (onChange)="alCambiarMoneda()" />
          </div>
          <div class="campo span-1" *ngIf="form.value.moneda !== 'BOB'">
            <label for="tc">Tipo de cambio</label>
            <p-inputNumber inputId="tc" formControlName="tipo_cambio"
                           mode="decimal" [minFractionDigits]="2" [maxFractionDigits]="6" />
          </div>
        </div>
      </section>

      <!-- ======================================================= 3. Costo -->
      <section class="bloque">
        <div class="bloque-titulo">
          <span class="numero">3</span>
          <div>
            <h3>Costo de incorporación</h3>
            <p>
              Todo lo necesario para dejar el bien en condiciones de uso. No entran
              capacitación ni gastos administrativos generales.
            </p>
          </div>
        </div>

        <div class="costos" formArrayName="costos">
          <div class="costos-encabezado">
            <span>Concepto</span>
            <span class="derecha">Monto</span>
            <span>Documento</span>
            <span>Observación</span>
            <span></span>
          </div>

          <div class="costo-fila" *ngFor="let fila of costos.controls; let i = index" [formGroupName]="i">
            <p-dropdown formControlName="concepto" [options]="conceptos"
                        optionLabel="etiqueta" optionValue="valor" appendTo="body" />
            <p-inputNumber formControlName="monto" mode="decimal"
                           [minFractionDigits]="2" [min]="0" inputStyleClass="derecha" />
            <input pInputText formControlName="documento" placeholder="N° de respaldo" />
            <input pInputText formControlName="observacion" />
            <p-button icon="pi pi-times" severity="danger" [text]="true" [rounded]="true"
                      [disabled]="costos.length === 1" (onClick)="quitarCosto(i)" />
          </div>

          <button type="button" class="agregar" (click)="agregarCosto()">
            <i class="pi pi-plus"></i> Agregar concepto
          </button>
        </div>
      </section>

      <!-- ------------------------------------------------- Barra de acción -->
      <div class="barra-accion">
        <div class="resumen">
          <span class="etiqueta-total">Valor de origen</span>
          <span class="total">{{ form.value.moneda }} {{ total() | number: '1.2-2' }}</span>
        </div>

        <div class="botones">
          <p-button label="Cancelar" [text]="true" (onClick)="volver()" />
          <p-button label="Registrar activo" icon="pi pi-check"
                    [disabled]="form.invalid || guardando()" [loading]="guardando()"
                    (onClick)="guardar()" />
        </div>
      </div>
    </form>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem 1.5rem 7rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    /* ---------------------------------------------------------- Encabezado */

    .encabezado { margin-bottom: 1.75rem; }

    .volver {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0;
      margin-bottom: 0.5rem;
      font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
      background: none;
      border: none;
      cursor: pointer;
    }

    .volver:hover { color: var(--primary-color, #3b82f6); }

    .encabezado h2 {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 650;
      letter-spacing: -0.02em;
    }

    /* ------------------------------------------------------------ Bloques */

    .formulario { display: flex; flex-direction: column; gap: 1.25rem; }

    .bloque {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .bloque-titulo {
      display: flex;
      gap: 0.85rem;
      align-items: flex-start;
      padding-bottom: 1.25rem;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--surface-border, #f1f3f5);
    }

    .numero {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      font-size: 0.8rem;
      font-weight: 650;
      color: var(--primary-color, #3b82f6);
      background: var(--primary-50, #eff6ff);
      border-radius: 50%;
    }

    .bloque-titulo h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .bloque-titulo p {
      margin: 0.2rem 0 0;
      font-size: 0.82rem;
      line-height: 1.4;
      color: var(--text-color-secondary, #6b7280);
    }

    /* ------------------------------------------------------------- Campos */

    .campos {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 1rem;
    }

    .campo { display: flex; flex-direction: column; gap: 0.35rem; }

    .span-1 { grid-column: span 1; }
    .span-2 { grid-column: span 2; }
    .span-3 { grid-column: span 3; }
    .span-6 { grid-column: span 6; }

    @media (max-width: 820px) {
      .campos { grid-template-columns: repeat(2, 1fr); }
      .span-1, .span-2, .span-3 { grid-column: span 1; }
      .span-6 { grid-column: span 2; }
    }

    .campo label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      font-weight: 550;
    }

    .campo small {
      font-size: 0.73rem;
      color: var(--text-color-secondary, #9ca3af);
    }

    .obligatorio {
      font-size: 0.62rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #b45309;
      background: #fef3c7;
      padding: 0.08rem 0.35rem;
      border-radius: 3px;
    }

    .campo :is(input, textarea, .p-dropdown, .p-calendar, .p-inputnumber) { width: 100%; }

    /* -------------------------------------------------------------- Notas */

    .nota {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      padding: 0.75rem 0.9rem;
      font-size: 0.82rem;
      line-height: 1.45;
      color: #1e40af;
      background: #eff6ff;
      border-left: 3px solid #3b82f6;
      border-radius: 6px;
    }

    .nota i { margin-top: 0.1rem; }

    .nota-neutra {
      color: var(--text-color-secondary, #4b5563);
      background: var(--surface-ground, #f9fafb);
      border-left-color: var(--surface-border, #d1d5db);
    }

    .nota-aviso {
      color: #92400e;
      background: #fffbeb;
      border-left-color: #f59e0b;
    }

    /* ------------------------------------------------------------- Costos */

    .costos { display: flex; flex-direction: column; gap: 0.5rem; }

    .costos-encabezado,
    .costo-fila {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1.2fr 1.6fr 2.5rem;
      gap: 0.6rem;
      align-items: center;
    }

    .costos-encabezado span {
      font-size: 0.7rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-color-secondary, #9ca3af);
    }

    .costo-fila :is(input, .p-dropdown, .p-inputnumber) { width: 100%; }

    :host ::ng-deep .derecha input { text-align: right; }

    @media (max-width: 820px) {
      .costos-encabezado { display: none; }
      .costo-fila {
        grid-template-columns: 1fr 1fr 2.5rem;
        padding: 0.75rem;
        background: var(--surface-ground, #f9fafb);
        border-radius: 8px;
      }
    }

    .agregar {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      align-self: flex-start;
      margin-top: 0.5rem;
      padding: 0.4rem 0.75rem;
      font-size: 0.82rem;
      font-weight: 550;
      color: var(--primary-color, #3b82f6);
      background: none;
      border: 1px dashed var(--surface-border, #d1d5db);
      border-radius: 6px;
      cursor: pointer;
    }

    .agregar:hover {
      background: var(--primary-50, #eff6ff);
      border-color: var(--primary-color, #3b82f6);
    }

    /* ------------------------------------------------- Barra inferior fija */

    .barra-accion {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 2rem;
      background: var(--surface-card, #fff);
      border-top: 1px solid var(--surface-border, #e5e7eb);
      box-shadow: 0 -2px 12px rgb(0 0 0 / 0.04);
    }

    .resumen { display: flex; flex-direction: column; }

    .etiqueta-total {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-color-secondary, #9ca3af);
    }

    .total {
      font-size: 1.35rem;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    .botones { display: flex; gap: 0.5rem; }
  `],
})
export class ActivoFormComponent implements OnInit {
  private readonly servicio = inject(ActivoService);
  private readonly catalogos = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly claseId = signal<number | null>(null);

  readonly clases = signal<Clase[]>([]);
  readonly subclases = signal<Subclase[]>([]);
  readonly ubicaciones = signal<Ubicacion[]>([]);
  readonly guardando = signal(false);

  readonly origenes = ORIGENES;
  readonly condiciones = CONDICIONES;
  readonly conceptos = CONCEPTOS_COSTO;
  readonly hoy = new Date();

  readonly monedas = [
    { etiqueta: 'Bolivianos', valor: 'BOB' },
    { etiqueta: 'Dólares', valor: 'USD' },
  ];

  readonly form = this.fb.group({
    clase_id: [null as number | null, Validators.required],
    subclase_id: [null as number | null, Validators.required],
    denominacion: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: [''],
    marca: [''],
    modelo: [''],
    serie: [''],
    placa: [''],
    anio_fabricacion: [null as number | null],

    tipo_origen: ['COMPRA', Validators.required],
    factura_nro: [''],
    factura_fecha: [null as Date | null],
    acta_recepcion_nro: ['', Validators.required],
    acta_recepcion_fecha: [null as Date | null, Validators.required],

    fecha_incorporacion: [new Date() as Date | null, Validators.required],
    fecha_inicio_uso: [null as Date | null],

    moneda: ['BOB', Validators.required],
    tipo_cambio: [1, [Validators.required, Validators.min(0.000001)]],
    condicion: ['NUEVO', Validators.required],
    ubicacion_id: [null as number | null, Validators.required],

    costos: this.fb.array([this.nuevaLineaCosto('PRECIO')]),
  });

  get costos(): FormArray {
    return this.form.get('costos') as FormArray;
  }

  /** Solo las subclases de la clase elegida: el backend rechaza lo contrario. */
  readonly subclasesDeLaClase = computed(() =>
    this.subclases().filter((s) => s.clase_id === this.claseId())
  );

  readonly claseElegida = computed(() =>
    this.clases().find((c) => c.id === this.claseId())
  );

  ngOnInit(): void {
    this.catalogos.listarClases(true).subscribe((c) => this.clases.set(c));
    this.catalogos.listarSubclases().subscribe((s) => this.subclases.set(s));
    this.catalogos.listarUbicaciones(true).subscribe((u) => this.ubicaciones.set(u));
  }

  private nuevaLineaCosto(concepto = 'FLETE') {
    return this.fb.group({
      concepto: [concepto, Validators.required],
      monto: [0, [Validators.required, Validators.min(0)]],
      documento: [''],
      observacion: [''],
    });
  }

  agregarCosto(): void {
    this.costos.push(this.nuevaLineaCosto());
  }

  quitarCosto(i: number): void {
    if (this.costos.length > 1) {
      this.costos.removeAt(i);
    }
  }

  total(): number {
    return this.costos.controls.reduce((suma, c) => suma + (Number(c.value.monto) || 0), 0);
  }

  exigeActa(): boolean {
    return ['COMPRA', 'IMPORTACION'].includes(this.form.value.tipo_origen ?? '');
  }

  alCambiarClase(): void {
    this.claseId.set(this.form.value.clase_id ?? null);
    this.form.patchValue({ subclase_id: null });
  }

  /** Donaciones y sobrantes no tienen acta de recepción de compra. */
  alCambiarOrigen(): void {
    const acta = this.form.get('acta_recepcion_nro');
    const fecha = this.form.get('acta_recepcion_fecha');

    if (this.exigeActa()) {
      acta?.addValidators(Validators.required);
      fecha?.addValidators(Validators.required);
    } else {
      acta?.clearValidators();
      fecha?.clearValidators();
    }

    acta?.updateValueAndValidity();
    fecha?.updateValueAndValidity();
  }

  alCambiarMoneda(): void {
    if (this.form.value.moneda === 'BOB') {
      this.form.patchValue({ tipo_cambio: 1 });
    }
  }

  guardar(): void {
    this.guardando.set(true);

    const v = this.form.getRawValue();

    const payload = {
      ...v,
      factura_fecha: this.aFecha(v.factura_fecha),
      acta_recepcion_fecha: this.aFecha(v.acta_recepcion_fecha),
      fecha_incorporacion: this.aFecha(v.fecha_incorporacion),
      fecha_inicio_uso: this.aFecha(v.fecha_inicio_uso),
    };

    this.servicio.crear(payload).subscribe({
      next: (activo) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'success',
          summary: 'Activo registrado',
          detail: `Código ${activo.codigo}`,
          life: 5000,
        });
        this.router.navigate(['/activos/registro', activo.id]);
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: e?.error?.mensaje ?? this.primerErrorDeValidacion(e) ?? 'Revise los datos.',
          life: 8000,
        });
      },
    });
  }

  private primerErrorDeValidacion(e: any): string | null {
    const errores = e?.error?.errors;
    if (!errores) return null;
    const primera = Object.values(errores)[0] as string[] | undefined;
    return primera?.[0] ?? null;
  }

  private aFecha(valor: Date | null | undefined): string | null {
    if (!valor) return null;
    const d = new Date(valor);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  volver(): void {
    this.router.navigate(['/activos/registro']);
  }
}