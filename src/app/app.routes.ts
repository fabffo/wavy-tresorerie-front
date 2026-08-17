import { Routes } from '@angular/router';

import { authGuard } from './core/services/auth.guard';

export const routes: Routes = [
  {
    path: 'connexion',
    redirectTo: 'tresorerie',
    pathMatch: 'full',
  },
  {
    path: 'profil',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profil/profil.page').then((m) => m.ProfilPage),
  },
  {
    path: 'tresorerie',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tresorerie/pages/tresorerie.page').then((m) => m.TresoreriePage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tresorerie',
  },
  {
    path: '**',
    redirectTo: 'tresorerie',
  },
];
