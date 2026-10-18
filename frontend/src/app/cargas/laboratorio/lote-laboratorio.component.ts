import { CommonModule } from '@angular/common';
import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';
import { abrirPdf, hoy } from '../../caja/core/archivos';
import { PermisosService } from '../../core/services/permisos.service';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import {
  Analisis, CriterioLey, ElementoLote, Ensaye, LaboratorioLote, LeyFinal, Lote, Muestra, TipoAnalisis,
} from '../core/models/cargas.model';
import { LaboratorioService } from '../core/services/laboratorio.service';
import { ESTILOS_LABORATORIO } from './estilos-laboratorio';

/** «10,25», «10.25» o vacío. Sin separador de miles: las leyes son números chicos. */
export function aNumero(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().replace(',', '.');
  return /^\d+(\.\d{1,4})?$/.test(t) ? Number(t) : null;
}

interface FilaLey { elemento: ElementoLote; ensaye: Ensaye | null; ley: LeyFinal | null; }

/**
 * Laboratorio dentro de la ficha del lote: lectura estimada, muestra con sus
 * porciones, análisis de empresa, productor y dirimente, comparación con el
 * split limit, ley final por elemento, cierre y reapertura.
 */
@Component({
  selector: 'app-lote-laboratorio',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, DropdownModule, InputNumberModule, InputTextModule,
            InputTextareaModule, RadioButtonModule, TooltipModule],
  template: `
    <section class="laboratorio" *ngIf="datos() as d">
      <div class="cabeza">
        <h3 class="titulo-seccion">Laboratorio</h3>
        <div class="acciones-lab">
          <ng-container *ngIf="d.estado === 'RECIBIDO' && puede('cargas.muestrear')">
            <p-button label="Registrar muestra" icon="pi pi-box" size="small" (onClick)="nuevaMuestra()" />
          </ng-container>
          <ng-container *ngIf="d.estado === 'MUESTREADO'">
            <p-button *ngIf="puede('cargas.muestrear')" label="Remuestreo" icon="pi pi-refresh" size="small" [text]="true"
                      pTooltip="Tomar una muestra nueva: las leyes fijadas dejan de valer" (onClick)="nuevaMuestra()" />
            <p-button *ngIf="puede('cargas.fijar-ley')" label="Cerrar análisis" icon="pi pi-check-circle" size="small"
                      [disabled]="!completo()" [pTooltip]="completo() ? '' : 'Faltan leyes finales: ' + faltan().join(', ')"
                      (onClick)="cerrar()" />
          </ng-container>
          <ng-container *ngIf="d.estado === 'ANALIZADO' && puede('cargas.fijar-ley')">
            <p-button label="Reabrir" icon="pi pi-lock-open" size="small" [outlined]="true" (onClick)="motivo = ''; reabrirVisible = true" />
          </ng-container>
        </div>
      </div>

      <!-- Resultado: lo que importa con el lote analizado -->
      <div class="resultado" *ngIf="d.estado === 'ANALIZADO' || d.estado === 'LIQUIDADO'">
        <div><span class="rotulo">Humedad</span><span class="monto">{{ num(d.humedad_pct) }} %</span></div>
        <div><span class="rotulo">Peso neto seco</span><span class="monto">{{ kg(d.peso_neto_seco_kg) }} kg</span></div>
        <div *ngFor="let f of filas()"><ng-container *ngIf="f.elemento.codigo !== 'H2O' && f.ley">
          <span class="rotulo">{{ f.elemento.codigo }}</span><span class="monto">{{ num(f.ley.valor) }} {{ unidad(f.elemento) }}</span>
        </ng-container></div>
      </div>

      <!-- Lectura estimada (recepción) -->
      <div class="tarjeta-lab" *ngIf="d.estado === 'RECIBIDO' || d.lecturas.length">
        <div class="titulo-tarjeta">Lectura estimada <span class="secundario">· referencial, no se usa para pagar</span></div>
        <div class="estimada">
          <div class="campo-mini" *ngFor="let e of elementosLinea()">
            <label>{{ e.codigo }} <span class="secundario">{{ unidad(e) }}</span></label>
            <input pInputText inputmode="decimal" [(ngModel)]="estimadas[e.id]" [class.ng-invalid]="invalido(estimadas[e.id])"
                   [class.ng-dirty]="invalido(estimadas[e.id])"
                   [disabled]="d.estado !== 'RECIBIDO' && d.estado !== 'MUESTREADO' || !puede('cargas.recibir')" />
          </div>
          <div class="campo-mini ancho">
            <label>Método</label>
            <input pInputText [(ngModel)]="metodoEstimado" maxlength="30" placeholder="Visual, portátil…"
                   [disabled]="d.estado !== 'RECIBIDO' && d.estado !== 'MUESTREADO' || !puede('cargas.recibir')" />
          </div>
          <p-button *ngIf="(d.estado === 'RECIBIDO' || d.estado === 'MUESTREADO') && puede('cargas.recibir')" label="Guardar"
                    size="small" [outlined]="true" [loading]="guardando()" (onClick)="guardarEstimada()" />
        </div>
      </div>

      <p class="secundario" *ngIf="d.estado === 'RECIBIDO' && !d.muestras.length">
        Sin muestra todavía. Al registrarla con sus tres porciones precintadas, el lote pasa a MUESTREADO.</p>

      <!-- Muestra vigente -->
      <div class="tarjeta-lab" *ngIf="vigente() as m">
        <div class="titulo-tarjeta">
          <span class="codigo">{{ m.codigo }}</span>
          <span class="pastilla" [class.pastilla-aviso]="m.tipo === 'REMUESTREO'">{{ m.tipo === 'REMUESTREO' ? 'Remuestreo' : 'Principal' }}</span>
          <span class="secundario">{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}{{ m.metodo ? ' · ' + (m.metodo | lowercase) : '' }}{{ m.peso_g ? ' · ' + num(m.peso_g) + ' g' : '' }}</span>
          <p-button label="Etiquetas" icon="pi pi-print" size="small" [text]="true" (onClick)="etiquetas(m)" />
        </div>
        <div class="porciones">
          <span *ngFor="let p of m.porciones" class="porcion">
            <span class="rotulo">{{ p.destino }}</span> <span class="codigo">{{ p.precinto ?? '—' }}</span>
            <span class="secundario" *ngIf="p.entregada_a"> · a {{ p.entregada_a }}</span>
          </span>
        </div>

        <div class="analisis-grid">
          <div class="slot" *ngFor="let t of tiposVisibles()">
            <div class="slot-titulo">{{ etiquetaTipo(t) }}</div>
            <ng-container *ngIf="analisisDe(m, t) as a; else vacio">
              <div class="secundario">{{ a.laboratorio?.nombre }} · cert. <span class="codigo">{{ a.numero_certificado }}</span>
                {{ a.fecha_emision ? ' · ' + (a.fecha_emision | date: 'dd/MM/yyyy') : '' }}</div>
              <div class="valores">
                <span *ngFor="let r of a.resultados"><b>{{ r.elemento?.codigo }}</b> {{ num(r.valor) }}</span>
              </div>
              <div class="slot-acciones">
                <p-button *ngIf="a.con_certificado" label="Certificado" icon="pi pi-file" size="small" [text]="true" (onClick)="verCertificado(a)" />
                <ng-container *ngIf="d.estado === 'MUESTREADO' && puede('cargas.cargar-analisis')">
                  <label class="adjuntar" *ngIf="!a.con_certificado">
                    <i class="pi pi-paperclip"></i> Adjuntar certificado
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="adjuntar(a, $event)" hidden />
                  </label>
                  <p-button icon="pi pi-ban" size="small" [text]="true" severity="danger" pTooltip="Anular análisis"
                            (onClick)="pedirAnularAnalisis(a)" />
                </ng-container>
              </div>
            </ng-container>
            <ng-template #vacio>
              <p class="secundario">{{ t === 'DIRIMENTE' ? 'Hace falta: un elemento excede el split limit.' : 'Sin cargar.' }}</p>
              <p-button *ngIf="d.estado === 'MUESTREADO' && puede('cargas.cargar-analisis')" label="Cargar análisis" icon="pi pi-plus"
                        size="small" [outlined]="true" [disabled]="t === 'DIRIMENTE' && !(analisisDe(m, 'EMPRESA') && analisisDe(m, 'PRODUCTOR'))"
                        (onClick)="nuevoAnalisis(m, t)" />
            </ng-template>
          </div>
        </div>
      </div>

      <!-- Comparación y ley final -->
      <table class="leyes" *ngIf="vigente()">
        <thead>
          <tr><th>Elemento</th><th class="derecha">Empresa</th><th class="derecha">Productor</th><th class="derecha">Diferencia</th>
              <th class="derecha">Dirimente</th><th class="derecha">Ley final</th><th></th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let f of filas()" [class.excede]="f.ensaye?.excede_split_limit">
            <td><b>{{ f.elemento.codigo }}</b> <span class="secundario">{{ unidad(f.elemento) }}</span>
              <span class="pastilla" *ngIf="f.elemento.requerido">{{ f.elemento.rol === 'HUMEDAD' ? 'Humedad' : 'Pagable' }}</span></td>
            <td class="derecha monto">{{ num(f.ensaye?.ley_empresa) }}</td>
            <td class="derecha monto">{{ num(f.ensaye?.ley_productor) }}</td>
            <td class="derecha monto">
              <ng-container *ngIf="f.ensaye?.diferencia !== null && f.ensaye?.diferencia !== undefined; else guion">
                <span [class.rojo]="f.ensaye!.excede_split_limit" [class.verde]="!f.ensaye!.excede_split_limit && f.ensaye!.split_limit">
                  {{ num(f.ensaye!.diferencia) }}</span>
                <div class="secundario">{{ f.ensaye!.split_limit ? 'límite ' + num(f.ensaye!.split_limit) : 'sin límite' }}</div>
              </ng-container>
            </td>
            <td class="derecha monto">{{ num(f.ensaye?.ley_dirimente) }}</td>
            <td class="derecha">
              <ng-container *ngIf="f.ley as l; else guion">
                <span class="monto fuerte">{{ num(l.valor) }}</span>
                <div class="secundario">{{ etiquetaCriterio(l.criterio) }}</div>
              </ng-container>
            </td>
            <td class="centro">
              <p-button *ngIf="d.estado === 'MUESTREADO' && puede('cargas.fijar-ley') && f.ensaye?.ley_empresa !== null && f.ensaye"
                        [label]="f.ley ? 'Cambiar' : 'Fijar'" size="small" [text]="true" (onClick)="pedirLey(f)" />
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #guion><span class="secundario">—</span></ng-template>

      <!-- Muestras anteriores e historial -->
      <details class="anteriores" *ngIf="anteriores().length || d.historial.length">
        <summary>Historial ({{ anteriores().length }} muestra(s) anterior(es), {{ d.historial.length }} cambio(s) de ley)</summary>
        <div *ngFor="let m of anteriores()" class="secundario linea-hist">
          <span class="codigo">{{ m.codigo }}</span> · {{ m.fecha | date: 'dd/MM/yyyy' }} ·
          <span *ngFor="let a of m.analisis">{{ etiquetaTipo(a.tipo) }}{{ a.anulado ? ' (anulado)' : '' }}:
            <span *ngFor="let r of a.resultados">{{ r.elemento?.codigo }} {{ num(r.valor) }} </span>; </span>
        </div>
        <div *ngFor="let h of d.historial" class="secundario linea-hist">
          {{ h.cambiado_en | date: 'dd/MM/yyyy HH:mm' }} · {{ h.elemento }} {{ num(h.valor) }} ({{ etiquetaCriterio(h.criterio) }})
          {{ h.accion === 'QUITADA' ? 'quitada' : 'cambiada' }}{{ h.cambiado_por_nombre ? ' por ' + h.cambiado_por_nombre : '' }}
        </div>
      </details>
    </section>

    <!-- Registrar muestra -->
    <p-dialog [(visible)]="muestraVisible" [header]="vigente() ? 'Remuestreo' : 'Registrar muestra'" [modal]="true"
              [style]="{ width: '40rem' }" [draggable]="false">
      <p class="explicacion" *ngIf="vigente()">Las leyes fijadas con la muestra {{ vigente()!.codigo }} dejan de valer y hay que
        volver a cargar los análisis.</p>
      <div class="formulario">
        <div class="campo"><label>Método</label>
          <p-dropdown [options]="metodos" [(ngModel)]="muestraForm.metodo" placeholder="Cómo se tomó" [showClear]="true" appendTo="body" /></div>
        <div class="campo"><label>Peso de la muestra (g)</label>
          <p-inputNumber [(ngModel)]="muestraForm.peso_g" [min]="0" [maxFractionDigits]="2" locale="es-BO" /></div>
        <div class="campo" *ngFor="let p of muestraForm.porciones">
          <label>Precinto · porción {{ p.destino | lowercase }}</label>
          <input pInputText [(ngModel)]="p.precinto" maxlength="30" class="codigo" />
        </div>
        <div class="campo"><label>Porción del productor entregada a <span class="secundario">(opcional)</span></label>
          <input pInputText [(ngModel)]="muestraForm.porciones[1].entregada_a" maxlength="150" /></div>
        <div class="campo ancho"><label>Observaciones</label>
          <textarea pInputTextarea rows="2" [(ngModel)]="muestraForm.observaciones" maxlength="250"></textarea></div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="muestraVisible = false" />
        <p-button label="Registrar" icon="pi pi-check" [loading]="guardando()" [disabled]="!muestraLista()" (onClick)="guardarMuestra()" />
      </ng-template>
    </p-dialog>

    <!-- Cargar análisis -->
    <p-dialog [(visible)]="analisisVisible" [header]="'Análisis ' + etiquetaTipo(analisisForm.tipo).toLowerCase()" [modal]="true"
              [style]="{ width: '44rem' }" [draggable]="false">
      <div class="formulario">
        <div class="campo"><label>Laboratorio</label>
          <p-dropdown [options]="datos()?.laboratorios ?? []" [(ngModel)]="analisisForm.laboratorio_id" optionLabel="nombre"
                      optionValue="id" placeholder="Elija el laboratorio" appendTo="body" /></div>
        <div class="campo"><label>N.º de certificado</label>
          <input pInputText [(ngModel)]="analisisForm.numero_certificado" maxlength="30" class="codigo" /></div>
        <div class="campo"><label>Fecha del certificado</label>
          <input pInputText type="date" [(ngModel)]="analisisForm.fecha_emision" [max]="hoy" /></div>
        <div class="campo"><label>Certificado escaneado <span class="secundario">(PDF o foto, opcional)</span></label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="archivoAnalisis = archivoDe($event)" /></div>
      </div>
      <div class="resultados">
        <div class="campo-mini" *ngFor="let e of elementosParaAnalisis()">
          <label>{{ e.codigo }} <span class="secundario">{{ unidad(e) }}</span></label>
          <input pInputText inputmode="decimal" [(ngModel)]="analisisForm.valores[e.id]"
                 [class.ng-invalid]="invalido(analisisForm.valores[e.id])" [class.ng-dirty]="invalido(analisisForm.valores[e.id])" />
        </div>
      </div>
      <p class="secundario">Decimales con coma o punto (10,25 o 10.25). Los elementos vacíos no se registran. Un análisis no se corrige: si hay un error, se anula y se carga otro.</p>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="analisisVisible = false" />
        <p-button label="Registrar análisis" icon="pi pi-check" [loading]="guardando()" [disabled]="!analisisListo()" (onClick)="guardarAnalisis()" />
      </ng-template>
    </p-dialog>

    <!-- Fijar ley -->
    <p-dialog [(visible)]="leyVisible" [header]="'Ley final de ' + (leyFila?.elemento?.codigo ?? '')" [modal]="true"
              [style]="{ width: '34rem' }" [draggable]="false">
      <ng-container *ngIf="leyFila as f">
        <p class="explicacion" *ngIf="f.ensaye?.excede_split_limit">
          La diferencia ({{ num(f.ensaye!.diferencia) }}) excede el split limit ({{ num(f.ensaye!.split_limit) }}):
          se resuelve con el dirimente o por acuerdo.</p>
        <div class="criterios">
          <label *ngFor="let c of criterios" class="criterio" [class.deshabilitado]="!criterioPosible(f, c.valor)">
            <p-radioButton name="criterio" [value]="c.valor" [(ngModel)]="leyForm.criterio" [disabled]="!criterioPosible(f, c.valor)" />
            <span>{{ c.etiqueta }}</span>
            <span class="monto">{{ valorCriterio(f, c.valor) }}</span>
            <span class="pastilla pastilla-acento" *ngIf="c.valor === sugerido(f)">sugerido</span>
          </label>
        </div>
        <div class="formulario" *ngIf="leyForm.criterio === 'ACUERDO'">
          <div class="campo"><label>Valor acordado ({{ unidad(f.elemento) }})</label>
            <input pInputText inputmode="decimal" [(ngModel)]="leyForm.valor" [class.ng-invalid]="invalido(leyForm.valor)"
                   [class.ng-dirty]="invalido(leyForm.valor)" /></div>
          <div class="campo ancho"><label>Observación (con quién y por qué)</label>
            <textarea pInputTextarea rows="2" [(ngModel)]="leyForm.observacion" maxlength="250"></textarea></div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="leyVisible = false" />
        <p-button label="Fijar ley" icon="pi pi-check" [loading]="guardando()" [disabled]="!leyLista()" (onClick)="guardarLey()" />
      </ng-template>
    </p-dialog>

    <!-- Motivos: anular análisis / reabrir -->
    <p-dialog [(visible)]="anularVisible" header="Anular análisis" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      <p class="explicacion">El análisis queda anulado con su motivo; las leyes que dependían de él se quitan. Luego cargue el correcto.</p>
      <textarea pInputTextarea rows="3" [(ngModel)]="motivo" maxlength="250" class="ancho-total"></textarea>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="anularVisible = false" />
        <p-button label="Anular" severity="danger" icon="pi pi-ban" [loading]="guardando()" [disabled]="motivo.trim().length < 10"
                  (onClick)="anularAnalisis()" />
      </ng-template>
    </p-dialog>
    <p-dialog [(visible)]="reabrirVisible" header="Reabrir el lote" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      <p class="explicacion">El lote vuelve a MUESTREADO para corregir una ley o registrar un remuestreo. El motivo queda en la bitácora.</p>
      <textarea pInputTextarea rows="3" [(ngModel)]="motivo" maxlength="250" class="ancho-total"></textarea>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="reabrirVisible = false" />
        <p-button label="Reabrir" icon="pi pi-lock-open" [loading]="guardando()" [disabled]="motivo.trim().length < 10" (onClick)="reabrir()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, ESTILOS_LABORATORIO],
})
export class LoteLaboratorioComponent implements OnChanges {
  readonly lote = input.required<Lote>();
  readonly cambio = output<void>();

  private readonly servicio = inject(LaboratorioService);
  private readonly permisos = inject(PermisosService);
  private readonly toast = inject(MessageService);

  readonly datos = signal<LaboratorioLote | null>(null);
  readonly guardando = signal(false);
  readonly hoy = hoy();
  readonly metodos = ['CUARTEO', 'CANALETA', 'PALA ALTERNA', 'TUBO', 'OTRO'].map((m) => ({ label: m.toLowerCase(), value: m }));
  readonly criterios: { valor: CriterioLey; etiqueta: string }[] = [
    { valor: 'PROMEDIO', etiqueta: 'Promedio empresa y productor' }, { valor: 'EMPRESA', etiqueta: 'Análisis de la empresa' },
    { valor: 'DIRIMENTE', etiqueta: 'Análisis dirimente' }, { valor: 'ACUERDO', etiqueta: 'Acuerdo (valor digitado)' },
  ];

  readonly vigente = computed(() => { const m = this.datos()?.muestras ?? []; return m.length ? m[m.length - 1] : null; });
  readonly anteriores = computed(() => (this.datos()?.muestras ?? []).slice(0, -1));
  readonly elementosLinea = computed(() => (this.datos()?.elementos ?? []).filter((e) => e.rol !== 'INFORMATIVO' || true));
  readonly filas = computed<FilaLey[]>(() => {
    const d = this.datos();
    if (!d) return [];
    return d.elementos
      .filter((e) => e.requerido || d.ensayes.some((x) => x.elemento_id === e.id) || d.leyes.some((l) => l.elemento_id === e.id))
      .map((e) => ({ elemento: e, ensaye: d.ensayes.find((x) => x.elemento_id === e.id) ?? null,
                     ley: d.leyes.find((l) => l.elemento_id === e.id) ?? null }));
  });
  readonly faltan = computed(() => this.filas().filter((f) => f.elemento.requerido && !f.ley).map((f) => f.elemento.codigo));
  readonly completo = computed(() => this.faltan().length === 0 && this.filas().length > 0);

  estimadas: Record<number, string | null> = {};
  metodoEstimado = '';
  muestraVisible = false;
  muestraForm = this.muestraVacia();
  analisisVisible = false;
  analisisForm = this.analisisVacio('EMPRESA', 0);
  archivoAnalisis: File | null = null;
  leyVisible = false;
  leyFila: FilaLey | null = null;
  leyForm: { criterio: CriterioLey | null; valor: string | null; observacion: string } = { criterio: null, valor: null, observacion: '' };
  anularVisible = false;
  reabrirVisible = false;
  aAnular: Analisis | null = null;
  motivo = '';

  ngOnChanges(): void { this.cargar(); }

  cargar(): void {
    this.servicio.ver(this.lote().id).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estimadas = Object.fromEntries(d.lecturas.map((l) => [l.elemento_id, this.num(l.valor).replace(/\./g, '')]));
        this.metodoEstimado = d.lecturas[0]?.metodo ?? '';
      },
      error: (e) => this.error('No se pudo cargar el laboratorio', e),
    });
  }

  puede(p: string): boolean { return this.permisos.can(p); }
  /** Texto que no es un número válido (vacío es válido: «sin dato»). */
  invalido(v: string | null | undefined): boolean { return !!v && String(v).trim() !== '' && aNumero(v) === null; }
  num(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === '') return '—';
    return Number(v).toLocaleString('es-BO', { maximumFractionDigits: 4 });
  }
  kg(v: string | number | null | undefined): string {
    return v === null || v === undefined ? '—' : Number(v).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  unidad(e: { unidad_ley: string }): string { return ({ '%': '%', DM: 'DM', G_TM: 'g/t', OZ_TM: 'oz/t', PPM: 'ppm' } as Record<string, string>)[e.unidad_ley] ?? e.unidad_ley; }
  etiquetaTipo(t: TipoAnalisis): string { return ({ EMPRESA: 'Empresa', PRODUCTOR: 'Productor', DIRIMENTE: 'Dirimente' } as Record<string, string>)[t]; }
  etiquetaCriterio(c: CriterioLey): string { return ({ PROMEDIO: 'promedio', EMPRESA: 'empresa', DIRIMENTE: 'dirimente', ACUERDO: 'acuerdo' } as Record<string, string>)[c]; }

  analisisDe(m: Muestra, t: TipoAnalisis): Analisis | null { return m.analisis.find((a) => a.tipo === t && !a.anulado) ?? null; }
  tiposVisibles(): TipoAnalisis[] {
    const m = this.vigente();
    const dirimente = !!m && (!!this.analisisDe(m, 'DIRIMENTE') || (this.datos()?.ensayes ?? []).some((e) => e.excede_split_limit));
    return dirimente ? ['EMPRESA', 'PRODUCTOR', 'DIRIMENTE'] : ['EMPRESA', 'PRODUCTOR'];
  }

  // --------------------------------------------------------- lectura estimada
  guardarEstimada(): void {
    if (Object.values(this.estimadas).some((v) => this.invalido(v))) return;
    const lecturas = this.elementosLinea().map((e) => ({ elemento_id: e.id, valor: aNumero(this.estimadas[e.id]) }));
    this.enviar(this.servicio.lecturaEstimada(this.lote().id, this.metodoEstimado || null, lecturas), false);
  }

  // ------------------------------------------------------------------ muestra
  private muestraVacia() {
    return { metodo: 'CUARTEO' as string | null, peso_g: null as number | null, observaciones: '',
             porciones: (['EMPRESA', 'PRODUCTOR', 'TESTIGO'] as const).map((d) => ({ destino: d, precinto: '', entregada_a: '' as string | null })) };
  }
  nuevaMuestra(): void { this.muestraForm = this.muestraVacia(); this.muestraVisible = true; }
  muestraLista(): boolean {
    const p = this.muestraForm.porciones.map((x) => x.precinto.trim().toUpperCase());
    return p.every((x) => x) && new Set(p).size === 3;
  }
  guardarMuestra(): void {
    const f = this.muestraForm;
    this.enviar(this.servicio.registrarMuestra(this.lote().id, {
      metodo: f.metodo, peso_g: f.peso_g, observaciones: f.observaciones || null,
      porciones: f.porciones.map((p) => ({ destino: p.destino, precinto: p.precinto, entregada_a: p.entregada_a || null })),
    }), true, () => (this.muestraVisible = false));
  }
  etiquetas(m: Muestra): void {
    this.servicio.etiquetas(m.id).subscribe({ next: abrirPdf, error: (e) => this.error('No se pudieron generar las etiquetas', e) });
  }

  // ----------------------------------------------------------------- análisis
  private analisisVacio(tipo: TipoAnalisis, muestraId: number) {
    return { tipo, muestra_id: muestraId, laboratorio_id: null as number | null, numero_certificado: '',
             fecha_emision: hoy() as string | null, valores: {} as Record<number, string | null> };
  }
  elementosParaAnalisis(): ElementoLote[] {
    const todos = this.datos()?.elementos ?? [];
    if (this.analisisForm.tipo !== 'DIRIMENTE') return todos;
    const excede = new Set((this.datos()?.ensayes ?? []).filter((e) => e.excede_split_limit).map((e) => e.elemento_id));
    return todos.filter((e) => excede.has(e.id));
  }
  nuevoAnalisis(m: Muestra, t: TipoAnalisis): void {
    this.analisisForm = this.analisisVacio(t, m.id);
    if (t === 'EMPRESA') this.analisisForm.laboratorio_id = this.datos()?.laboratorios.find((l) => l.propio)?.id ?? null;
    this.archivoAnalisis = null;
    this.analisisVisible = true;
  }
  analisisListo(): boolean {
    const f = this.analisisForm;
    const v = Object.values(f.valores);
    return !!f.laboratorio_id && !!f.numero_certificado.trim() && v.some((x) => aNumero(x) !== null) && !v.some((x) => this.invalido(x));
  }
  archivoDe(ev: Event): File | null { return (ev.target as HTMLInputElement).files?.[0] ?? null; }
  guardarAnalisis(): void {
    const f = this.analisisForm;
    const resultados = Object.entries(f.valores).filter(([, v]) => aNumero(v) !== null)
      .map(([id, v]) => ({ elemento_id: +id, valor: aNumero(v)! }));
    this.enviar(this.servicio.registrarAnalisis(f.muestra_id, {
      tipo: f.tipo, laboratorio_id: f.laboratorio_id!, numero_certificado: f.numero_certificado, fecha_emision: f.fecha_emision, resultados,
    }, this.archivoAnalisis), false, () => (this.analisisVisible = false));
  }
  adjuntar(a: Analisis, ev: Event): void {
    const archivo = this.archivoDe(ev);
    if (archivo) this.enviar(this.servicio.adjuntarCertificado(a.id, archivo), false);
  }
  verCertificado(a: Analisis): void {
    this.servicio.certificado(a.id).subscribe({ next: abrirPdf, error: (e) => this.error('No se pudo abrir el certificado', e) });
  }
  pedirAnularAnalisis(a: Analisis): void { this.aAnular = a; this.motivo = ''; this.anularVisible = true; }
  anularAnalisis(): void {
    if (this.aAnular) this.enviar(this.servicio.anularAnalisis(this.aAnular.id, this.motivo.trim()), false, () => (this.anularVisible = false));
  }

  // ---------------------------------------------------------------- ley final
  sugerido(f: FilaLey): CriterioLey | null {
    if (!f.ensaye) return null;
    if (f.ensaye.excede_split_limit) return f.ensaye.ley_dirimente !== null ? 'DIRIMENTE' : null;
    if (f.ensaye.ley_productor === null) return 'EMPRESA';
    return this.datos()?.criterio_sugerido ?? 'PROMEDIO';
  }
  criterioPosible(f: FilaLey, c: CriterioLey): boolean {
    const e = f.ensaye;
    if (!e || e.ley_empresa === null) return false;
    switch (c) {
      case 'PROMEDIO': return e.ley_productor !== null && !e.excede_split_limit;
      case 'EMPRESA': return !e.excede_split_limit;
      case 'DIRIMENTE': return e.ley_dirimente !== null;
      case 'ACUERDO': return true;
    }
  }
  valorCriterio(f: FilaLey, c: CriterioLey): string {
    const e = f.ensaye;
    if (!e) return '';
    return c === 'PROMEDIO' ? this.num(e.promedio) : c === 'EMPRESA' ? this.num(e.ley_empresa) : c === 'DIRIMENTE' ? this.num(e.ley_dirimente) : '';
  }
  pedirLey(f: FilaLey): void {
    this.leyFila = f;
    const actual = f.ley?.criterio ?? null;
    this.leyForm = { criterio: actual ?? this.sugerido(f), valor: actual === 'ACUERDO' ? this.num(f.ley!.valor).replace(/\./g, '') : null, observacion: f.ley?.observacion ?? '' };
    this.leyVisible = true;
  }
  leyLista(): boolean {
    const c = this.leyForm.criterio;
    if (!c || !this.leyFila || !this.criterioPosible(this.leyFila, c)) return false;
    return c !== 'ACUERDO' || (aNumero(this.leyForm.valor) !== null && !this.invalido(this.leyForm.valor) && this.leyForm.observacion.trim().length >= 10);
  }
  guardarLey(): void {
    const f = this.leyFila!;
    this.enviar(this.servicio.fijarLey(this.lote().id, f.elemento.id, this.leyForm.criterio!,
      this.leyForm.criterio === 'ACUERDO' ? aNumero(this.leyForm.valor) : null, this.leyForm.criterio === 'ACUERDO' ? this.leyForm.observacion : null),
      false, () => (this.leyVisible = false));
  }

  // ------------------------------------------------------------------ estados
  cerrar(): void { this.enviar(this.servicio.cerrar(this.lote().id), true); }
  reabrir(): void { this.enviar(this.servicio.reabrir(this.lote().id, this.motivo.trim()), true, () => (this.reabrirVisible = false)); }

  /** Envía, avisa, recarga el laboratorio y, si cambió el estado del lote, la ficha entera. */
  private enviar(pedido: Observable<{ mensaje: string }>, cambiaLote: boolean, alTerminar?: () => void): void {
    this.guardando.set(true);
    pedido.subscribe({
      next: (r) => {
        this.guardando.set(false);
        alTerminar?.();
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 6000 });
        this.cargar();
        if (cambiaLote) this.cambio.emit();
      },
      error: (e) => { this.guardando.set(false); this.error('No se guardó', e); },
    });
  }

  private error(titulo: string, e: unknown): void {
    this.toast.add({ severity: 'error', summary: titulo, detail: mensajeDeError(e), life: 10000 });
  }
}
