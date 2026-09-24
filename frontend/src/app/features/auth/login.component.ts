import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <main class="pantalla">
      <form [formGroup]="formulario" (ngSubmit)="ingresar()" class="tarjeta">
        <h1>Sistema de Inventarios</h1>
        <p class="bajada">Ingrese con las credenciales que le entregó el administrador.</p>

        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="ancho-total" />
        }

        <div class="campo">
          <label for="email">Correo electrónico</label>
          <input pInputText id="email" type="email" formControlName="email" autocomplete="username" />
        </div>

        <div class="campo">
          <label for="password">Contraseña</label>
          <p-password inputId="password" formControlName="password" [feedback]="false"
                      [toggleMask]="true" styleClass="ancho" inputStyleClass="ancho"
                      autocomplete="current-password" />
        </div>

        <button pButton type="submit" label="Ingresar" [loading]="cargando()"
                [disabled]="formulario.invalid" styleClass="ancho"></button>
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
    .bajada { margin:0; font-size:.875rem; color:var(--text-color-secondary); line-height:1.5; }
    .campo { display:flex; flex-direction:column; gap:.375rem; }
    .campo label { font-size:.8125rem; font-weight:500; }
    .campo input { width:100%; }
    :host ::ng-deep .ancho, :host ::ng-deep .ancho-total { width:100%; display:block; }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  ingresar(): void {
    this.cargando.set(true);
    this.error.set(null);

    const { email, password } = this.formulario.getRawValue();

    this.auth.login(email, password).subscribe({
      next: res => this.router.navigate([
        res.usuario.debe_cambiar_clave ? '/cambiar-clave' : '/tablero',
      ]),
      error: err => {
        this.cargando.set(false);
        this.error.set(
          err.error?.errors?.email?.[0]
          ?? err.error?.message
          ?? 'No se pudo iniciar sesión. Intente nuevamente.',
        );
      },
    });
  }
}
