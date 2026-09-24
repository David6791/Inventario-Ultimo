import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/services/auth.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-cambiar-clave',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, PasswordModule, MessageModule],
  template: `
    <main class="pantalla">
      <form [formGroup]="formulario" (ngSubmit)="guardar()" class="tarjeta">
        <h1>Cambie su contraseña</h1>

        @if (obligatorio()) {
          <p-message severity="info" styleClass="ancho-total"
            text="Su contraseña es temporal. Debe cambiarla antes de usar el sistema." />
        }

        <div class="campo">
          <label for="actual">Contraseña actual</label>
          <p-password inputId="actual" formControlName="password_actual" [feedback]="false"
                      [toggleMask]="true" styleClass="ancho" inputStyleClass="ancho" />
        </div>

        <div class="campo">
          <label for="nueva">Contraseña nueva</label>
          <p-password inputId="nueva" formControlName="password" [toggleMask]="true"
                      styleClass="ancho" inputStyleClass="ancho"
                      promptLabel="Mínimo 8 caracteres con letras y números"
                      weakLabel="Débil" mediumLabel="Aceptable" strongLabel="Fuerte" />
        </div>

        <div class="campo">
          <label for="repetir">Repetir contraseña nueva</label>
          <p-password inputId="repetir" formControlName="password_confirmation" [feedback]="false"
                      [toggleMask]="true" styleClass="ancho" inputStyleClass="ancho" />
          @if (noCoinciden()) { <small class="error">Las contraseñas no coinciden.</small> }
        </div>

        <button pButton type="submit" label="Guardar contraseña" [loading]="cargando()"
                styleClass="ancho"></button>
      </form>
    </main>
  `,
  styles: [`
    .pantalla { min-height:100dvh; display:grid; place-items:center; padding:1.5rem;
                background:var(--surface-ground); }
    .tarjeta { width:min(24rem, 100%); display:flex; flex-direction:column; gap:1rem;
               background:var(--surface-card); padding:2rem; border-radius:10px;
               border:1px solid var(--surface-border); }
    h1 { margin:0; font-size:1.25rem; font-weight:600; }
    .campo { display:flex; flex-direction:column; gap:.375rem; }
    .campo label { font-size:.8125rem; font-weight:500; }
    .error { color:var(--red-500); font-size:.75rem; }
    :host ::ng-deep .ancho, :host ::ng-deep .ancho-total { width:100%; display:block; }
  `],
})
export class CambiarClaveComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly permisos = inject(PermisosService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly cargando = signal(false);
  readonly obligatorio = () => this.permisos.perfil()?.debe_cambiar_clave ?? false;

  readonly formulario = this.fb.nonNullable.group({
    password_actual: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  });

  noCoinciden(): boolean {
    const { password, password_confirmation } = this.formulario.getRawValue();
    return !!password_confirmation && password !== password_confirmation;
  }

  guardar(): void {
    if (this.formulario.invalid || this.noCoinciden()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    const v = this.formulario.getRawValue();

    this.auth.cambiarClave(v.password_actual, v.password, v.password_confirmation).subscribe({
      next: () => {
        this.mensajes.add({ severity: 'success', summary: 'Contraseña actualizada' });
        // Recargar el perfil limpia la marca debe_cambiar_clave y libera el guard.
        this.auth.cargarPerfil().subscribe(() => this.router.navigate(['/tablero']));
      },
      error: () => this.cargando.set(false),
    });
  }
}
