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
  let api: { proposerCartes: ReturnType<typeof vi.fn>; confirmerCarte: ReturnType<typeof vi.fn>; confirmerCartes: ReturnType<typeof vi.fn>; rapprochements: ReturnType<typeof vi.fn> };
  let societe: ReturnType<typeof vi.fn>;
  const p: PropositionCarte = {
    operationId: 1, factureId: 2, tiersId: 3, numeroPiece: 'FA-2', libelleOperation: 'PAIEMENT CB BRIOCHE DOREE 20/01',
    nomTiers: 'SSP France', dateOperation: '2026-01-21', dateAchat: '2026-01-20', dateDepense: '2026-01-20',
    montantOperation: 15, montantPiece: 15, montantRapproche: 15, ecart: 0, dateAtypique: false,
    commercantReconnu: false, affectationRequise: true, ambiguite: false, conflit: false, criteres: ['Montant exact'],
  };
  beforeEach(() => {
    societe = vi.fn(() => 1);
    api = { proposerCartes: vi.fn().mockReturnValue(of({ operationsExaminees: 78, piecesExaminees: 31, operationsSansMatch: 1, propositions: [p] })), confirmerCarte: vi.fn().mockReturnValue(of({})), confirmerCartes: vi.fn().mockReturnValue(of({ reussis: 1, refuses: 0, conflits: 0, lignes: [] })), rapprochements: vi.fn().mockReturnValue(of([])) };
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
    expect(api.proposerCartes).toHaveBeenCalledTimes(2);
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
  const sure: PropositionCarte = { ...p, commercantReconnu: true, nomTiers: 'INDIGO', libelleOperation: 'PAIEMENT INDIGO 20/01' };
  function chargerPropositions(propositions: PropositionCarte[]) {
    api.proposerCartes.mockReturnValue(of({ operationsExaminees: 77, piecesExaminees: 31, operationsSansMatch: 60, propositions }));
    page.proposerCartes();
  }
  it('change de sous-onglet sans requête répétée et conserve filtres, tri et pagination', () => {
    page.pageOperations.set(4); page.filtresOperations.set({ tiersReconnu: 'INDIGO' });
    chargerPropositions([sure]);
    page.changerOngletOperations('assistant');page.changerOngletOperations('operations');page.changerOngletOperations('assistant');
    expect(api.proposerCartes).toHaveBeenCalledTimes(1);
    expect(page.pageOperations()).toBe(4);expect(page.filtresOperations()).toEqual({ tiersReconnu: 'INDIGO' });
    expect(page.triOperations()).toEqual({ sortBy: 'dateOperation', sortDirection: 'DESC' });
  });
  it('sélectionne seulement les propositions sûres et permet de tout désélectionner', () => {
    chargerPropositions([sure, { ...p, operationId: 2, factureId: 3 },
      { ...sure, operationId: 3, factureId: 4, dateAtypique: true },
      { ...sure, operationId: 4, factureId: 5, conflit: true },
      { ...sure, operationId: 5, factureId: 6, ambiguite: true },
      { ...sure, operationId: 6, factureId: 7, ecart: .01 }]);
    expect(page.cartesSelectionnees()).toHaveLength(0);
    page.selectionnerCartesSures(true);expect(page.cartesSelectionnees()).toEqual([sure]);
    page.selectionnerCarte(sure,false);expect(page.cartesSelectionnees()).toHaveLength(0);
    page.selectionnerCarte(sure,true);expect(page.cartesSelectionnees()).toHaveLength(1);
    page.selectionnerCartesSures(false);expect(page.selectionCartes().size).toBe(0);
  });
  it('INDIGO et Free Mobile partageant une pièce ne sont jamais sélectionnés même sans drapeau ambiguïté', () => {
    const free = { ...sure, operationId: 9, libelleOperation: 'FREE MOBILE', commercantReconnu: false };
    chargerPropositions([sure, free]);page.selectionnerCartesSures(true);
    page.selectionnerCarte(sure,true);page.selectionnerCarte(free,true);
    expect(page.cartesSelectionnees()).toHaveLength(0);
  });
  it('deux pièces partageant une opération ne peuvent pas être sélectionnées', () => {
    chargerPropositions([sure,{ ...sure, factureId: 9 }]);page.selectionnerCartesSures(true);
    expect(page.cartesSelectionnees()).toHaveLength(0);
  });
  it('le récapitulatif précède une unique confirmation explicite et actualise les propositions', () => {
    chargerPropositions([sure]);page.selectionnerCartesSures(true);
    page.confirmerSelectionCartes();expect(api.confirmerCartes).not.toHaveBeenCalled();
    page.preparerConfirmationCartes();expect(page.recapitulatifCartes()).toEqual([sure]);
    expect(api.confirmerCartes).not.toHaveBeenCalled();
    api.proposerCartes.mockReturnValue(of({ operationsExaminees: 76, piecesExaminees: 30, operationsSansMatch: 60, propositions: [] }));
    page.confirmerSelectionCartes();page.confirmerSelectionCartes();
    expect(api.confirmerCartes).toHaveBeenCalledTimes(1);
    expect(api.confirmerCartes).toHaveBeenCalledWith({ confirmation: true, lignes: [{ operationId: 1, demande: {
      factureId: 2, tiersConfirme: 3, confirmation: true, confirmerAffectation: true, confirmerDateAtypique: false,
    } }] });
    expect(page.bilanCartes()?.reussis).toBe(1);expect(page.propositionsCartes()?.propositions).toEqual([]);
  });
  it('conserve les refus et permet une reprise explicite après perte réseau sans autre couple', () => {
    chargerPropositions([sure]);page.selectionnerCartesSures(true);page.preparerConfirmationCartes();
    api.confirmerCartes.mockReturnValue(throwError(() => new Error('Réseau interrompu')));
    page.confirmerSelectionCartes();expect(page.error()).toContain('Résultat du lot non confirmé');
    expect(page.reprisesCartes()).toEqual([sure]);expect(page.recapitulatifCartes()).toEqual([]);
    const demande = api.confirmerCartes.mock.calls[0][0];
    api.confirmerCartes.mockReturnValue(of({ reussis: 1, refuses: 0, conflits: 0, lignes: [] }));
    page.preparerConfirmationCartes(true);page.confirmerSelectionCartes();
    expect(api.confirmerCartes.mock.calls[1][0]).toEqual(demande);
    expect(page.reprisesCartes()).toEqual([]);
  });
  it('affiche les résultats partiels et les motifs sans perdre les reprises inconnues', () => {
    chargerPropositions([sure]);page.selectionnerCartesSures(true);page.preparerConfirmationCartes();
    const bilan = { reussis: 0, refuses: 1, conflits: 0, lignes: [{ operationId: 1, factureId: 2, statut: 'REFUSE',
      code: 'RESULTAT_A_REPRENDRE', message: 'Réessayez ce même couple' }] };
    api.confirmerCartes.mockReturnValue(of(bilan));page.confirmerSelectionCartes();
    expect(page.bilanCartes()).toEqual(bilan);expect(page.reprisesCartes()).toEqual([sure]);
  });
  it('bloque le lot après changement de société et ignore un résultat tardif', () => {
    chargerPropositions([sure]);page.selectionnerCartesSures(true);page.preparerConfirmationCartes();
    societe.mockReturnValue(2);page.confirmerSelectionCartes();expect(api.confirmerCartes).not.toHaveBeenCalled();
    societe.mockReturnValue(1);chargerPropositions([sure]);page.selectionnerCartesSures(true);page.preparerConfirmationCartes();
    const resultat = new Subject<unknown>();api.confirmerCartes.mockReturnValue(resultat);page.confirmerSelectionCartes();
    societe.mockReturnValue(2);resultat.next({ reussis: 1 });resultat.complete();expect(page.bilanCartes()).toBeNull();
  });
  it('rend les deux onglets, le tableau bancaire et le récapitulatif sans duplication', () => {
    vi.spyOn(TresoreriePage.prototype,'ngOnInit').mockImplementation(() => {});
    const fixture = TestBed.createComponent(TresoreriePage);page = fixture.componentInstance;
    page.onglet.set('operations');fixture.detectChanges();
    const html: HTMLElement = fixture.nativeElement;
    expect(html.querySelectorAll('[role="tablist"] [role="tab"]').length).toBe(2);
    expect(html.querySelector('.operations-table')).not.toBeNull();
    chargerPropositions([sure]);page.changerOngletOperations('assistant');fixture.detectChanges();
    expect(html.querySelector('.operations-table')).toBeNull();
    expect(html.textContent).toContain('Assistant de rapprochement');
    expect(html.querySelectorAll('[aria-label="Étapes du rapprochement"] button')).toHaveLength(6);
    expect(api.confirmerCartes).not.toHaveBeenCalled();
    page.changerOngletOperations('operations');fixture.detectChanges();expect(html.querySelector('.operations-table')).not.toBeNull();
  });

});
