import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { ContexteService } from './contexte.service';

interface ShellContext {
  utilisateurId: number | null; email: string; nom: string;
  tenantId: number | null; tenantNom: string;
  societeInterneId: number | null; societeNom: string; roles: string[];
  readOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WavyShellBridgeService {
  readonly embedded = signal(window.parent !== window);
  readonly readOnly = signal(false);

  constructor(private readonly contexteService: ContexteService, router: Router) {
    if (!this.embedded()) return;
    window.addEventListener('message', (event) => this.receive(event));
    window.parent.postMessage({ type: 'WAVY_CONTEXT_REQUEST' }, location.origin);
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.reportRoute(event.urlAfterRedirects));
    queueMicrotask(() => this.reportRoute(router.url));
  }

  private reportRoute(path: string): void {
    window.parent.postMessage({ type: 'WAVY_ROUTE_CHANGED', module: 'tresorerie', path }, location.origin);
  }

  navigate(module: string, path: string, label?: string): void {
    if (!this.embedded()) { window.location.assign(path); return; }
    window.parent.postMessage({ type: 'WAVY_NAVIGATE', module, path, label }, location.origin);
  }

  private receive(event: MessageEvent<{ type?: string; context?: ShellContext }>): void {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (!['WAVY_CONTEXT_CHANGED', 'SOCIETE_CHANGED'].includes(event.data?.type ?? '')) return;
    const context = event.data.context;
    if (!context?.utilisateurId || !context.tenantId || !context.societeInterneId) return;
    this.readOnly.set(context.readOnly === true);
    const actuel = this.contexteService.contexteCourant();
    const societesAutorisees = actuel?.societesAutorisees.some((societe) => societe.id === context.societeInterneId)
      ? actuel.societesAutorisees
      : [...(actuel?.societesAutorisees ?? []), { id: context.societeInterneId, nom: context.societeNom }];
    this.contexteService.definirDepuisShell({
      utilisateurId: context.utilisateurId, email: context.email, nom: context.nom,
      prenom: actuel?.prenom ?? '', tenantId: context.tenantId, tenantNom: context.tenantNom,
      societeCouranteId: context.societeInterneId, societeCouranteNom: context.societeNom,
      societesAutorisees, roles: context.roles,
    });
  }
}
