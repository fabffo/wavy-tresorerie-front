import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { ContexteService } from './contexte.service';
import { redirigerVersConnexionShell } from './wavy-shell-auth';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const contexteService = inject(ContexteService);
  if (authService.authenticatedUser() && contexteService.contexteCharge()) {
    return true;
  }

  return authService.restaurerSession().pipe(
    map((session) => (session ? true : redirigerVersConnexionShell(state.url))),
    catchError(() => of(redirigerVersConnexionShell(state.url))),
  );
};
