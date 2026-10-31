import { CommonModule } from '@angular/common';
import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { mensajeDeError } from '../../cargas/core/errores';
import { CajaOperacion, DestinoEnvio, EnvioFondos, Moneda } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';

/**
 * Dinero entre cajas. En la caja de la sede central: «Enviar dinero» a la caja
 * de un acopio. En la caja que recibe: los envíos en tránsito con «Recibir».
 * En las dos, el historial. El dinero en tránsito no está en ninguna caja.
 */
@Component({
  selector: 'app-envios-fondos',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, DropdownModule, InputNumberModule, InputTextModule, SelectButtonModule, DineroPipe],
  template: `
    <!-- Por recibir: aviso destacado -->
    <section class="por-recibir" *ngIf="porRecibir().length">
      <div class="titulo"><i class="pi pi-send"></i>
        <b>{{ porRecibir().length === 1 ? 'Hay un envío de dinero por recibir' : 'Hay ' + porRecibir().length + ' envíos de dinero por recibir' }}</b></div>
      <div class="envio" *ngFor="let e of porRecibir()">
        <div>
          <span class="monto">{{ e.monto | dinero: e.moneda }}</span>
          <span class="secundario"> de la caja {{ e.origen.codigo }} · {{ e.motivo }}{{ e.entregado_a ? ' · lo trae ' + e.entregado_a : '' }}</span>
          <div class="secundario">{{ e.numero }} · enviado por {{ e.enviado_por?.name }} el {{ e.enviado_en | date: 'dd/MM HH:mm' }}</div>
        </div>
        <p-button *ngIf="caja().soy_cajero && caja().sesion_abierta && operable()" label="Recibir" icon="pi pi-check" size="small"
                  [loading]="trabajando() === e.id" [disabled]="trabajando() !== null" (onClick)="recibir(e)" />
        <span class="secundario" *ngIf="caja().soy_cajero && !caja().sesion_abierta">Abra la caja para recibirlo.</span>
      </div>
      <small class="secundario">Cuente el dinero antes de recibirlo: al confirmar entra a esta caja con su comprobante.</small>
    </section>

    <!-- Sede central: enviar y lo que está en tránsito -->
    <section class="central" *ngIf="caja().es_central">
      <div class="cabeza">
        <span><i class="pi pi-building"></i> <b>Caja de la sede central</b>
          <span class="secundario">· envía el dinero a las cajas de los acopios</span></span>
        <div class="botones">
          <p-button label="Historial de envíos" icon="pi pi-history" [text]="true" size="small" (onClick)="historialVisible = true" />
          <p-button *ngIf="caja().soy_cajero && caja().sesion_abierta && operable()" label="Enviar dinero" icon="pi pi-send" size="small"
                    (onClick)="abrirEnvio()" />
        </div>
      </div>
      <div class="transito" *ngIf="enTransito().length">
        <span class="secundario">En tránsito:</span>
        <span class="chip" *ngFor="let e of enTransito()">{{ e.destino.codigo }} · {{ e.monto | dinero: e.moneda }}
          <button type="button" class="enlace" *ngIf="caja().soy_cajero && caja().sesion_abierta && operable()" (click)="pedirAnular(e)">anular</button></span>
      </div>
    </section>
    <div class="solo-historial" *ngIf="!caja().es_central && envios().length && !porRecibir().length">
      <p-button label="Envíos recibidos" icon="pi pi-history" [text]="true" size="small" (onClick)="historialVisible = true" />
    </div>

    <!-- Enviar -->
    <p-dialog [(visible)]="envioVisible" header="Enviar dinero a otra caja" [modal]="true" [style]="{ width: '30rem', maxWidth: '95vw' }" [draggable]="false">
      <div class="formulario">
        <div class="campo">
          <label for="destino">Caja que recibe</label>
          <p-dropdown inputId="destino" [options]="destinos()" [(ngModel)]="destino" optionValue="id" [optionLabel]="'codigo'"
                      placeholder="Elija la caja" appendTo="body" [style]="{ width: '100%' }">
            <ng-template let-d pTemplate="item"><b>{{ d.codigo }}</b> · {{ d.nombre }} <span class="secundario">{{ d.centro_costo ? '(' + d.centro_costo + ')' : '' }}</span></ng-template>
            <ng-template let-d pTemplate="selectedItem"><b>{{ d.codigo }}</b> · {{ d.nombre }}</ng-template>
          </p-dropdown>
        </div>
        <div class="fila">
          <div class="campo">
            <label for="monto-envio">Monto</label>
            <p-inputNumber inputId="monto-envio" [(ngModel)]="monto" mode="decimal" locale="es-BO" [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0" />
          </div>
          <div class="campo" *ngIf="caja().maneja_usd">
            <label>Moneda</label>
            <p-selectButton [options]="monedas" [(ngModel)]="moneda" optionLabel="etiqueta" optionValue="valor" [allowEmpty]="false" />
          </div>
        </div>
        <div class="campo">
          <label for="motivo-envio">Para qué</label>
          <input id="motivo-envio" pInputText [(ngModel)]="motivo" maxlength="200" placeholder="Apertura de la semana, reposición…" />
        </div>
        <div class="campo">
          <label for="entregado">Quién lo lleva <span class="opcional">(opcional)</span></label>
          <input id="entregado" pInputText [(ngModel)]="entregadoA" maxlength="150" />
        </div>
        <small class="secundario">Sale de esta caja ahora y queda en tránsito hasta que el cajero de destino lo recibe.</small>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="envioVisible = false" />
        <p-button label="Enviar" icon="pi pi-send" [loading]="trabajando() === 0"
                  [disabled]="!destino || !monto || monto <= 0 || motivo.trim().length < 5 || trabajando() !== null" (onClick)="enviar()" />
      </ng-template>
    </p-dialog>

    <!-- Anular -->
    <p-dialog [(visible)]="anularVisible" header="Anular envío" [modal]="true" [style]="{ width: '28rem', maxWidth: '95vw' }" [draggable]="false">
      <p *ngIf="aAnular() as e">El envío {{ e.numero }} de {{ e.monto | dinero: e.moneda }} a la caja {{ e.destino.codigo }} se anula
        y el dinero vuelve a esta caja con un comprobante de reintegro.</p>
      <div class="campo">
        <label for="motivo-anular">Motivo</label>
        <input id="motivo-anular" pInputText [(ngModel)]="motivoAnular" maxlength="250" />
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Volver" [text]="true" (onClick)="anularVisible = false" />
        <p-button label="Anular envío" icon="pi pi-times" severity="danger" [disabled]="motivoAnular.trim().length < 5 || trabajando() !== null"
                  [loading]="trabajando() === aAnular()?.id" (onClick)="anular()" />
      </ng-template>
    </p-dialog>

    <!-- Historial -->
    <p-dialog [(visible)]="historialVisible" header="Envíos de dinero" [modal]="true" [style]="{ width: '52rem', maxWidth: '96vw' }" [draggable]="false">
      <table class="historial">
        <thead><tr><th>Envío</th><th>De → a</th><th>Para qué</th><th class="derecha">Monto</th><th>Estado</th></tr></thead>
        <tbody>
          <tr *ngFor="let e of envios()">
            <td><span class="codigo">{{ e.numero }}</span><div class="secundario">{{ e.enviado_en | date: 'dd/MM/yy HH:mm' }}</div></td>
            <td>{{ e.origen.codigo }} → {{ e.destino.codigo }}</td>
            <td>{{ e.motivo }}<div class="secundario" *ngIf="e.motivo_anulacion">Anulado: {{ e.motivo_anulacion }}</div></td>
            <td class="derecha monto">{{ e.monto | dinero: e.moneda }}</td>
            <td><span class="pastilla" [class.pastilla-aviso]="e.estado === 'EN_TRANSITO'" [class.pastilla-ok]="e.estado === 'RECIBIDO'">
              {{ e.estado === 'EN_TRANSITO' ? 'En tránsito' : e.estado === 'RECIBIDO' ? 'Recibido' : 'Anulado' }}</span>
              <div class="secundario" *ngIf="e.recibido_por">{{ e.recibido_por.name }} · {{ e.recibido_en | date: 'dd/MM HH:mm' }}</div></td>
          </tr>
          <tr *ngIf="!envios().length"><td colspan="5" class="secundario">Todavía no hay envíos.</td></tr>
        </tbody>
      </table>
    </p-dialog>
  `,
  styles: [`
    .por-recibir { border: 1px solid #93c5fd; background: #eff6ff; border-radius: 10px; padding: 0.8rem 1rem; margin-bottom: 1rem;
                   display: flex; flex-direction: column; gap: 0.55rem; }
    .por-recibir .titulo { display: flex; gap: 0.5rem; align-items: center; color: #1e40af; }
    .envio { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.5rem 0.7rem; background: #fff;
             border-radius: 8px; border: 1px solid #dbeafe; flex-wrap: wrap; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 700; }
    .central { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 1rem; margin-bottom: 1rem;
               background: var(--surface-card, #fff); display: flex; flex-direction: column; gap: 0.45rem; }
    .cabeza { display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
    .botones { display: flex; gap: 0.3rem; }
    .transito { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; font-size: 0.85rem; }
    .chip { background: #fef3c7; color: #78350f; border-radius: 999px; padding: 0.15rem 0.65rem; font-family: ui-monospace, monospace; font-size: 0.8rem; }
    .enlace { border: 0; background: none; color: #b91c1c; cursor: pointer; padding: 0 0 0 0.3rem; font-size: 0.75rem; text-decoration: underline; }
    .solo-historial { margin: -0.4rem 0 0.6rem; }
    .formulario { display: flex; flex-direction: column; gap: 0.8rem; }
    .fila { display: flex; gap: 1rem; align-items: flex-end; }
    .campo { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
    .campo label { font-size: 0.8rem; font-weight: 550; }
    .campo input { width: 100%; }
    :host ::ng-deep .campo .p-inputnumber, :host ::ng-deep .campo .p-inputnumber input { width: 100%; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    table.historial { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    table.historial th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280);
                         padding: 0.35rem; border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    table.historial td { padding: 0.45rem 0.35rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); vertical-align: top; }
    .derecha { text-align: right !important; }
    .secundario { color: var(--text-color-secondary, #6b7280); font-size: 0.8rem; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .pastilla { font-size: 0.75rem; border-radius: 999px; padding: 0.1rem 0.55rem; background: #f1f5f9; }
    .pastilla-aviso { background: #fef3c7; color: #92400e; }
    .pastilla-ok { background: #dcfce7; color: #166534; }
  `],
})
export class EnviosFondosComponent implements OnChanges {
  readonly caja = input.required<CajaOperacion>();
  /** La sesión es de hoy: con una sesión de otro día no se registran movimientos (se cierra primero). */
  readonly operable = input(true);
  /** Algo cambió el saldo: la caja se vuelve a cargar. */
  readonly cambio = output<void>();

  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);

  readonly envios = signal<EnvioFondos[]>([]);
  readonly destinos = signal<DestinoEnvio[]>([]);
  readonly trabajando = signal<number | null>(null);
  readonly porRecibir = computed(() => this.envios().filter((e) => e.estado === 'EN_TRANSITO' && e.caja_destino_id === this.caja().id));
  readonly enTransito = computed(() => this.envios().filter((e) => e.estado === 'EN_TRANSITO' && e.caja_origen_id === this.caja().id));
  readonly aAnular = signal<EnvioFondos | null>(null);
  readonly monedas = [{ valor: 'BOB', etiqueta: 'Bs' }, { valor: 'USD', etiqueta: 'US$' }];

  envioVisible = false;
  anularVisible = false;
  historialVisible = false;
  destino: number | null = null;
  monto: number | null = null;
  moneda: Moneda = 'BOB';
  motivo = '';
  entregadoA = '';
  motivoAnular = '';

  ngOnChanges(): void { this.cargar(); }

  cargar(): void {
    this.servicio.envios(this.caja().id).subscribe({
      next: (r) => { this.envios.set(r.data); this.destinos.set(r.destinos); },
      error: () => { this.envios.set([]); this.destinos.set([]); },
    });
  }

  abrirEnvio(): void {
    this.destino = null; this.monto = null; this.moneda = 'BOB'; this.motivo = ''; this.entregadoA = '';
    this.envioVisible = true;
  }

  enviar(): void {
    this.trabajando.set(0);
    this.servicio.enviar(this.caja().id, { caja_destino_id: this.destino!, monto: this.monto!, moneda: this.moneda,
                                            motivo: this.motivo.trim(), entregado_a: this.entregadoA.trim() || null }).subscribe({
      next: (r) => { this.listo(r.mensaje); this.envioVisible = false; },
      error: (e) => this.fallo('No se envió el dinero', e),
    });
  }

  recibir(e: EnvioFondos): void {
    this.trabajando.set(e.id);
    this.servicio.recibirEnvio(e.id).subscribe({ next: (r) => this.listo(r.mensaje), error: (x) => this.fallo('No se recibió el envío', x) });
  }

  pedirAnular(e: EnvioFondos): void {
    this.aAnular.set(e);
    this.motivoAnular = '';
    this.anularVisible = true;
  }

  anular(): void {
    const e = this.aAnular();
    if (!e) return;
    this.trabajando.set(e.id);
    this.servicio.anularEnvio(e.id, this.motivoAnular.trim()).subscribe({
      next: (r) => { this.listo(r.mensaje); this.anularVisible = false; },
      error: (x) => this.fallo('No se anuló el envío', x),
    });
  }

  private listo(mensaje?: string): void {
    this.trabajando.set(null);
    this.toast.add({ severity: 'success', summary: mensaje ?? 'Listo', life: 8000 });
    this.cambio.emit();
  }

  private fallo(titulo: string, e: unknown): void {
    this.trabajando.set(null);
    this.toast.add({ severity: 'error', summary: titulo, detail: mensajeDeError(e), life: 10000 });
  }
}
