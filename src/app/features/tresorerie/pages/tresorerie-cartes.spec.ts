import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { TresoreriePage } from './tresorerie.page';
import { TresorerieApiService } from '../../../core/services/tresorerie-api.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { WavyShellBridgeService } from '../../../core/services/wavy-shell-bridge.service';
import { PropositionCarte } from '../models/tresorerie.model';

describe('Propositions carte dans le rapprochement bancaire', () => {
  let page: TresoreriePage;
  let api: { proposerCartes: ReturnType<typeof vi.fn>; confirmerCarte: ReturnType<typeof vi.fn>; rapprochements: ReturnType<typeof vi.fn> };
  let societe: ReturnType<typeof vi.fn>;
  const p: PropositionCarte = {
    operationId: 1, factureId: 2, tiersId: 3, numeroPiece: 'FA-2', libelleOperation: 'PAIEMENT CB BRIOCHE DOREE 20/01',
    nomTiers: 'SSP France', dateOperation: '2026-01-21', dateAchat: '2026-01-20', dateDepense: '2026-01-20',
    montantOperation: 15, montantPiece: 15, montantRapproche: 15, ecart: 0, dateAtypique: false,
    commercantReconnu: false, affectationRequise: true, ambiguite: false, conflit: false, criteres: ['Montant exact'],
  };
  beforeEach(() => {
    societe = vi.fn(() => 1);
    api = { proposerCartes: vi.fn().mockReturnValue(of({ operationsExaminees: 78, piecesExaminees: 31, operationsSansMatch: 1, propositions: [p] })), confirmerCarte: vi.fn().mockReturnValue(of({})), rapprochements: vi.fn().mockReturnValue(of([])) };
    TestBed.configureTestingModule({ providers: [
      { provide: TresorerieApiService, useValue: api },
      { provide: ActivatedRoute, useValue: {} }, { provide: Router, useValue: {} },
      { provide: WavyShellBridgeService, useValue: {} },
      { provide: ContexteService, useValue: { changementSociete: signal(0), tenantId: () => 1, societeCouranteId: societe } },
    ] });
    page = TestBed.runInInjectionContext(() => new TresoreriePage());
    vi.spyOn(page, 'chargerOperations').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
  it('la recherche affiche les compteurs sans déclencher de paiement', () => {
    page.proposerCartes();
    expect(page.message()).toContain('78 opération(s) examinée(s), 1 proposition(s)');
    expect(api.confirmerCarte).not.toHaveBeenCalled();
  });
  it('une erreur de recherche ne se transforme pas en zéro proposition', () => {
    page.message.set('Ancien résultat');
    api.proposerCartes.mockReturnValue(throwError(() => new Error('Service indisponible')));
    page.proposerCartes();
    expect(page.error()).not.toBeNull(); expect(page.message()).toBeNull();
    expect(page.propositionsCartes()).toBeNull(); expect(page.loading()).toBe(false);
  });
  it('annuler la confirmation ne modifie rien', () => {
    page.proposerCartes(); vi.mocked(window.confirm).mockReturnValue(false); page.confirmerCarte(p);
    expect(api.confirmerCarte).not.toHaveBeenCalled();
  });
  it('la confirmation expose le fournisseur, les ambiguïtés et le consentement à son association', () => {
    page.proposerCartes(); page.confirmerCarte({ ...p, ambiguite: true, dateAtypique: true });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Associer le fournisseur SSP France'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Date atypique'));
    expect(api.confirmerCarte).toHaveBeenCalledWith(1, { factureId: 2, tiersConfirme: 3, confirmation: true, confirmerAffectation: true, confirmerDateAtypique: true });
    expect(page.propositionsCartes()).toBeNull();
  });
  it('un conflit ou un changement de société interdit la confirmation', () => {
    page.proposerCartes(); page.confirmerCarte({ ...p, conflit: true });
    expect(api.confirmerCarte).not.toHaveBeenCalled();
    societe.mockReturnValue(2); page.confirmerCarte(p);
    expect(api.confirmerCarte).not.toHaveBeenCalled(); expect(page.error()).toContain('société a changé');
  });
  it('ignore une réponse de recherche provenant de la société précédente', () => {
    const resultat = new Subject<unknown>(); api.proposerCartes.mockReturnValue(resultat);
    page.proposerCartes(); societe.mockReturnValue(2);
    resultat.next({ operationsExaminees: 1, piecesExaminees: 1, operationsSansMatch: 0, propositions: [p] }); resultat.complete();
    expect(page.propositionsCartes()).toBeNull();
  });
});
