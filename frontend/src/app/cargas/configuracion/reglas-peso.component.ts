import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { Subject, catchError, debounceTime, forkJoin, map, of, switchMap } from 'rxjs';
import { hoy } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { JuegoReglas, ReglaPeso } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';

interface FilaRegla { unidad: 'KG' | 'PCT'; desde: number | null; hasta: number | null; formula: string; descripcion: string; }

/**
 * Reglas del peso que vale. Cada regla es un tramo de la diferencia
 * D = C − E (cliente menos nuestra báscula), en kg o en %, con su fórmula.
 * Vale la primera que cumpla. Un juego nuevo se publica con fecha de
 * vigencia: los pesajes ya registrados conservan el peso con que salieron.
 */
@Component({
  selector: 'app-reglas-peso',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, DropdownModule, InputNumberModule, InputTextModule, ToastModule,
            TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Reglas de peso</h2>
        <p class="subtitulo">Qué peso vale para el lote según la diferencia entre la boleta del cliente (C) y nuestra báscula (E).</p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Nuevas reglas" icon="pi pi-plus" (onClick)="nueva()" />
      </div>
    </header>

    <section class="ayuda">
      <b>Cómo se lee una regla:</b> si <span class="codigo">desde &lt; D ≤ hasta</span>, con <span class="codigo">D = C − E</span>
      (en kg, o en % de E), vale la fórmula. Se revisan en orden y vale la primera que cumpla; sin peso del cliente vale E.
      <div class="sintaxis">Fórmulas: <span class="codigo">E</span> nuestro neto, <span class="codigo">C</span> neto del cliente,
        <span class="codigo">D</span> la diferencia en kg; <span class="codigo">+ − * /</span>, paréntesis, decimales con coma y
        <span class="codigo">MIN(E; C)</span>, <span class="codigo">MAX(E; C)</span>, <span class="codigo">REDONDEAR(…)</span>,
        <span class="codigo">ABS(…)</span>. Ejemplos: <span class="codigo">(E+C)/2</span>, <span class="codigo">MIN(E; C)</span>,
        <span class="codigo">E − 0,5*D</span>.</div>
    </section>

    <section class="juego" *ngFor="let j of juegos()" [class.anterior]="j.estado === 'ANTERIOR'">
      <h3>
        <span class="pastilla" [class.pastilla-acento]="j.estado === 'VIGENTE'" [class.pastilla-aviso]="j.estado === 'PROXIMA'">
          {{ j.estado === 'VIGENTE' ? 'Vigentes' : j.estado === 'PROXIMA' ? 'Próximas' : 'Anteriores' }}</span>
        Desde {{ j.vigente_desde | date: 'dd/MM/yyyy' }}{{ j.vigente_hasta ? ' hasta ' + (j.vigente_hasta | date: 'dd/MM/yyyy') : '' }}
      </h3>
      <table class="reglas">
        <thead><tr><th style="width: 2.5rem">#</th><th style="width: 16rem">Cuando la diferencia es</th><th style="width: 11rem">Vale</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of j.reglas">
            <td class="codigo">{{ r.orden }}</td>
            <td>{{ tramo(r) }}</td>
            <td class="codigo formula">{{ r.formula }}</td>
            <td class="secundario">{{ r.descripcion || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <div class="vacio" *ngIf="!cargando() && !juegos().length">
      <i class="pi pi-sliders-h"></i><div class="titulo-vacio">No hay reglas de peso</div>
      <span>Sin reglas, vale siempre el peso de nuestra báscula.</span>
    </div>

    <p-dialog [(visible)]="editorVisible" header="Nuevas reglas de peso" [modal]="true" [style]="{ width: '64rem', maxWidth: '97vw' }" [draggable]="false">
      <div class="cabeza-editor">
        <div class="campo">
          <label for="desde">Vigentes desde</label>
          <input id="desde" pInputText type="date" [(ngModel)]="desde" [min]="minimo" />
        </div>
        <div class="prueba">
          <span>Probar con:</span>
          <label>nuestro (E) <p-inputNumber [(ngModel)]="pruebaE" (ngModelChange)="probar()" [min]="1" locale="es-BO" [maxFractionDigits]="2" inputStyleClass="corto" /></label>
          <label>cliente (C) <p-inputNumber [(ngModel)]="pruebaC" (ngModelChange)="probar()" [min]="1" locale="es-BO" [maxFractionDigits]="2" inputStyleClass="corto" /></label>
          <span class="resultado" *ngIf="aplica() as a">D = {{ fmt(pruebaC! - pruebaE!) }} kg ({{ fmt(pct()) }} %) → regla {{ a.i + 1 }}:
            <b class="codigo">{{ a.kg === null ? '…' : fmt(a.kg) + ' kg' }}</b></span>
          <span class="resultado" *ngIf="!aplica() && pruebaE && pruebaC">Ninguna regla cumple: vale E ({{ fmt(pruebaE) }} kg)</span>
        </div>
      </div>
      <table class="editor">
        <thead><tr><th style="width: 2rem">#</th><th style="width: 6.5rem">En</th><th style="width: 8.5rem">Desde (&gt;)</th><th style="width: 8.5rem">Hasta (≤)</th>
          <th>Fórmula</th><th style="width: 7.5rem" class="derecha">Con la prueba</th><th>Descripción</th><th style="width: 6.5rem"></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of filas; let i = index" [class.aplica]="aplica()?.i === i">
            <td class="codigo">{{ i + 1 }}</td>
            <td><p-dropdown [options]="unidades" [(ngModel)]="f.unidad" optionLabel="etiqueta" optionValue="valor" appendTo="body" (onChange)="probar()"
                            [style]="{ width: '100%' }" /></td>
            <td><p-inputNumber [(ngModel)]="f.desde" (ngModelChange)="probar()" locale="es-BO" [maxFractionDigits]="2" placeholder="sin límite" /></td>
            <td><p-inputNumber [(ngModel)]="f.hasta" (ngModelChange)="probar()" locale="es-BO" [maxFractionDigits]="2" placeholder="sin límite" /></td>
            <td><input pInputText [(ngModel)]="f.formula" (ngModelChange)="probar()" maxlength="200" class="codigo" placeholder="(E+C)/2"
                       [class.ng-invalid]="errores()[i]" [class.ng-dirty]="errores()[i]" />
                <small class="error" *ngIf="errores()[i]">{{ errores()[i] }}</small></td>
            <td class="derecha codigo">{{ resultados()[i] === null || resultados()[i] === undefined ? '—' : fmt(resultados()[i]) }}</td>
            <td><input pInputText [(ngModel)]="f.descripcion" maxlength="150" placeholder="Para quien lo lea" /></td>
            <td class="botones">
              <p-button icon="pi pi-arrow-up" [text]="true" [rounded]="true" size="small" [disabled]="i === 0" (onClick)="mover(i, -1)" ariaLabel="Subir" />
              <p-button icon="pi pi-arrow-down" [text]="true" [rounded]="true" size="small" [disabled]="i === filas.length - 1" (onClick)="mover(i, 1)" ariaLabel="Bajar" />
              <p-button icon="pi pi-trash" [text]="true" [rounded]="true" size="small" severity="danger" [disabled]="filas.length === 1"
                        (onClick)="filas.splice(i, 1); probar()" ariaLabel="Quitar" />
            </td>
          </tr>
        </tbody>
      </table>
      <p-button label="Agregar regla" icon="pi pi-plus" [text]="true" size="small" (onClick)="agregar()" />
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Publicar" icon="pi pi-check" [loading]="guardando()" [disabled]="!valida() || guardando()" (onClick)="publicar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .ayuda { font-size: 0.86rem; line-height: 1.55; padding: 0.7rem 0.9rem; border-radius: 8px; background: #eef2ff; border: 1px solid #c7d2fe;
             margin-bottom: 1.2rem; max-width: 62rem; }
    .sintaxis { margin-top: 0.3rem; color: var(--text-color-secondary, #475569); }
    .juego { margin-bottom: 1.4rem; max-width: 62rem; }
    .juego h3 { font-size: 0.95rem; display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.5rem; }
    .juego.anterior { opacity: 0.6; }
    table.reglas, table.editor { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    table.reglas th, table.editor th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em;
             color: var(--text-color-secondary, #6b7280); padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    table.reglas td { padding: 0.45rem 0.4rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); vertical-align: top; }
    table.editor td { padding: 0.25rem; vertical-align: top; }
    table.editor input { width: 100%; }
    :host ::ng-deep table.editor .p-inputnumber, :host ::ng-deep table.editor .p-inputnumber-input { width: 100%; }
    table.editor tr.aplica td { background: #ecfdf5; }
    .formula { font-weight: 650; color: #3730a3; }
    .botones { white-space: nowrap; }
    .cabeza-editor { display: flex; gap: 1.5rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 0.8rem; }
    .cabeza-editor .campo { display: flex; flex-direction: column; gap: 0.3rem; }
    .prueba { display: flex; gap: 0.7rem; align-items: center; flex-wrap: wrap; font-size: 0.85rem; padding: 0.5rem 0.7rem; border-radius: 8px;
              background: var(--surface-ground, #f8fafc); }
    .prueba label { display: flex; gap: 0.35rem; align-items: center; }
    :host ::ng-deep .corto { width: 7.5rem; }
    .resultado { color: #047857; }
    .error { color: #b91c1c; font-size: 0.75rem; }
    .derecha { text-align: right; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class ReglasPesoComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);

  readonly juegos = signal<JuegoReglas[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly unidades = [{ valor: 'KG', etiqueta: 'kg' }, { valor: 'PCT', etiqueta: '%' }];
  readonly fmt = formatoDinero;

  editorVisible = false;
  desde = hoy();
  readonly minimo = hoy();
  filas: FilaRegla[] = [];
  pruebaE: number | null = 12000;
  pruebaC: number | null = 12060;
  readonly resultados = signal<(number | null)[]>([]);
  readonly errores = signal<(string | null)[]>([]);
  private readonly version = signal(0);
  private readonly pruebas$ = new Subject<void>();

  /** Qué regla aplica a la prueba (como lo hace la base) y cuánto da. */
  readonly aplica = computed(() => {
    this.version();
    const e = this.pruebaE, c = this.pruebaC;
    if (!e || !c) return null;
    const i = this.filas.findIndex((f) => {
      const d = f.unidad === 'PCT' ? ((c - e) / e) * 100 : c - e;
      return (f.desde === null || d > f.desde) && (f.hasta === null || d <= f.hasta);
    });
    return i < 0 ? null : { i, kg: this.resultados()[i] ?? null };
  });
  readonly pct = computed(() => { this.version(); return this.pruebaE && this.pruebaC ? ((this.pruebaC - this.pruebaE) / this.pruebaE) * 100 : 0; });

  ngOnInit(): void {
    this.cargar();
    // Cada fórmula se prueba en la base, con la misma función que calcula los pesajes.
    this.pruebas$.pipe(
      debounceTime(300),
      switchMap(() => {
        const e = this.pruebaE, c = this.pruebaC;
        if (!e || !c || !this.filas.length) return of([] as { kg: number | null; error: string | null }[]);
        return forkJoin(this.filas.map((f) => f.formula.trim()
          ? this.servicio.probarFormula(f.formula, e, c).pipe(
              map((kg) => ({ kg, error: null as string | null })),
              catchError((err) => of({ kg: null, error: mensajeDeError(err) })))
          : of({ kg: null, error: null })));
      }),
    ).subscribe((r) => {
      this.resultados.set(r.map((x) => x.kg));
      this.errores.set(r.map((x) => x.error));
      this.version.update((v) => v + 1);
    });
  }

  cargar(): void {
    this.servicio.reglasPeso().subscribe({
      next: (j) => { this.juegos.set(j); this.cargando.set(false); },
      error: (e) => { this.cargando.set(false); this.toast.add({ severity: 'error', summary: 'No se cargaron las reglas', detail: mensajeDeError(e) }); },
    });
  }

  tramo(r: ReglaPeso): string {
    const u = r.unidad === 'PCT' ? ' %' : ' kg';
    const n = (v: string | number) => formatoDinero(v) + u;
    if (r.desde === null && r.hasta === null) return 'Cualquiera';
    if (r.desde === null) return `Hasta ${n(r.hasta!)}` + (Number(r.hasta) === 0 ? ' (nuestra pesa igual o más)' : '');
    if (r.hasta === null) return `Más de ${n(r.desde)}`;
    return `Más de ${n(r.desde)} y hasta ${n(r.hasta)}`;
  }

  probar(): void { this.version.update((v) => v + 1); this.pruebas$.next(); }

  /** Parte de las reglas más recientes para cambiar solo lo necesario. */
  nueva(): void {
    const base = this.juegos().find((j) => j.estado === 'PROXIMA') ?? this.juegos().find((j) => j.estado === 'VIGENTE');
    this.filas = base
      ? base.reglas.map((r) => ({ unidad: r.unidad, desde: r.desde === null ? null : +r.desde, hasta: r.hasta === null ? null : +r.hasta,
                                  formula: r.formula, descripcion: r.descripcion ?? '' }))
      : [{ unidad: 'KG', desde: null, hasta: null, formula: 'E', descripcion: '' }];
    this.desde = hoy();
    this.editorVisible = true;
    this.probar();
  }

  agregar(): void {
    const ultima = this.filas[this.filas.length - 1];
    this.filas.push({ unidad: ultima?.unidad ?? 'KG', desde: ultima?.hasta ?? null, hasta: null, formula: '', descripcion: '' });
    this.probar();
  }

  mover(i: number, d: number): void {
    const [f] = this.filas.splice(i, 1);
    this.filas.splice(i + d, 0, f);
    this.probar();
  }

  valida(): boolean {
    this.version();
    return !!this.desde && this.desde >= this.minimo && this.filas.length > 0
      && this.filas.every((f, i) => f.formula.trim() && !this.errores()[i] && (f.desde === null || f.hasta === null || f.hasta > f.desde));
  }

  publicar(): void {
    this.guardando.set(true);
    const reglas: ReglaPeso[] = this.filas.map((f) => ({ ...f, formula: f.formula.trim(), descripcion: f.descripcion.trim() || null }));
    this.servicio.publicarReglasPeso(this.desde, reglas).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se publicaron las reglas', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }
}
