import { HttpErrorResponse } from '@angular/common/http';

export function getHttpErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) {
      return 'Identifiants incorrects.';
    }

    if (error.status === 403) {
      return 'Acces refuse pour ce profil.';
    }

    if (error.status === 400) {
      return 'Erreur de contexte ou de validation.';
    }

    if (error.status >= 500) {
      return 'Erreur serveur.';
    }

    if (error.status === 0) {
      return 'Backend injoignable.';
    }

    return `Erreur HTTP ${error.status}.`;
  }

  return 'Erreur inattendue.';
}
