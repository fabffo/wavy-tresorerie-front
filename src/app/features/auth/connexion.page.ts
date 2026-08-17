import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { getHttpErrorMessage } from '../../shared/http/http-error-message';

@Component({
  selector: 'app-connexion-page',
  imports: [ReactiveFormsModule],
  templateUrl: './connexion.page.html',
})
export class ConnexionPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    username: ['fabrice@wavy.fr', [Validators.required, Validators.email]],
    password: ['motdepasse123', Validators.required],
  });

  testerConnexion(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();
    this.loading.set(true);
    this.message.set(null);
    this.error.set(null);

    this.authService.testerConnexion(username, password).subscribe({
      next: ({ profil }) => {
        this.message.set(`Connexion OK : ${profil.email ?? username}`);
        this.loading.set(false);
        void this.router.navigateByUrl('/tresorerie');
      },
      error: (error) => {
        this.error.set(getHttpErrorMessage(error));
        this.loading.set(false);
      },
    });
  }
}
