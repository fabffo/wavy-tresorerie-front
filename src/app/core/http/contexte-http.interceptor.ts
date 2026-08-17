import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ContexteService } from '../services/contexte.service';

export const contexteHttpInterceptor: HttpInterceptorFn = (request, next) => {
  const contexteService = inject(ContexteService);
  const headers: Record<string, string> = {};
  const contexte = contexteService.contextePourRequete();

  if (contexte && shouldAddContexteHeaders(request.url)) {
    headers['X-Tenant-Id'] = String(contexte.tenantId);
    headers['X-Utilisateur-Id'] = String(contexte.utilisateurId);
    headers['X-Societe-Courante-Id'] = String(contexte.societeCouranteId);
    headers['X-Wavy-Roles'] = contexteService.roles().join(',');
  }

  return next(
    request.clone({
      setHeaders: headers,
      withCredentials: shouldSendCredentials(request.url) || request.withCredentials,
    }),
  );
};

function shouldAddContexteHeaders(url: string): boolean {
  const path = url.replace(environment.apiBaseUrl, '');
  return path.startsWith('/api/tresorerie') || path.startsWith('/api/tiers') || path.startsWith('/api/parametres');
}

function shouldSendCredentials(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}
