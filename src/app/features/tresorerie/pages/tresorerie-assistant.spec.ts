import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { TresoreriePage } from './tresorerie.page';
import { TresorerieApiService } from '../../../core/services/tresorerie-api.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { WavyShellBridgeService } from '../../../core/services/wavy-shell-bridge.service';
import { ApercuAssistant, CandidatAssistant, LigneAssistant, OperationBancaire, EtapeAssistant, RapprochementBancaire } from '../models/tresorerie.model';

const initialiserPage=TresoreriePage.prototype.ngOnInit;
const chargerPage=TresoreriePage.prototype.chargerOperations;
const operation = { id: 1, compteBancaireId: 1, dateOperation: '2026-01-12', libelle: 'Paiement Adobe.com 09/01',
  sens: 'DEBIT', debit: 100, credit: 0, montant: 100, natureOperation: 'FACTURE_FOURNISSEUR', statutClassification: 'CLASSEE_AUTO',
  statutRapprochement: 'NON_RAPPROCHEE', typeOperation: 'PAIEMENT_CB', tiersId: 21, tiersReconnu: 'Adobe', typeTiersReconnu: 'FOURNISSEUR', rapprochee: false } as OperationBancaire;
const candidat: CandidatAssistant = { cle: 'P:ACHAT:10', tiersId: 21, nomTiers: 'Adobe', typeTiers: 'FOURNISSEUR', pieceId: 10,
  numeroPiece: 'FA-10', typePiece: 'ACHAT', montantDisponible: 100, montantPropose: 100, datePiece: '2026-01-09', dateEcheance: '2026-01-09',
  sur: true, criteres: ['Montant restant exact', 'Date d’achat concordante'], avertissements: [], natureProposee: null, carte: null };
const ligne: LigneAssistant = { operation, candidats: [candidat], anomalies: [], bloquee: false };
const apercu: ApercuAssistant = { etape: 'FOURNISSEURS', categorie: 'CARTE', operationsPerimetre: 1, eligibles: 1, piecesDisponibles: 1,
  propositions: 1, anomalies: 0, traitees: 0, restantes: 1, montantEligible: 100, lignes: [ligne] };

describe('Assistant bancaire : lecture, périmètre et confirmation explicite', () => {
  let page: TresoreriePage;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let societe: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    societe = vi.fn(() => 1); navigate = vi.fn();
    api = { reglesIdentification:vi.fn(()=>of([])),rolesIdentification:vi.fn(()=>of(['AUTRE','SALARIE'])),previsualiserAssistant: vi.fn().mockReturnValue(of(apercu)), confirmerAssistant: vi.fn().mockReturnValue(of({ reussis: 1, refuses: 0, conflits: 0, aReprendre: 0,
      lignes: [{ operationId: 1, statut: 'SUCCES', message: 'Confirmé', rapprochementId: 10 }] })), dashboard: vi.fn().mockReturnValue(of({})),
      rechercherTiersAssistant: vi.fn().mockReturnValue(of([{ id: 21, libelle: 'Adobe', roles: ['FOURNISSEUR_GENERAL'] }])) };
    TestBed.configureTestingModule({ providers: [
      { provide: TresorerieApiService, useValue: api }, { provide: ActivatedRoute, useValue: {} }, { provide: Router, useValue: {} },
      { provide: ContexteService, useValue: { changementSociete: signal(0), societeCouranteId: societe, tenantId: () => 1, utilisateurId:()=>2 } },
      { provide: WavyShellBridgeService, useValue: { navigate } },
    ] });
    page = TestBed.runInInjectionContext(() => new TresoreriePage());
    page.etapeAssistant.set('FOURNISSEURS');page.operations.set([operation]);
    vi.spyOn(page,'chargerOperations').mockImplementation(fin => fin?.());
    vi.spyOn(TresoreriePage.prototype,'ngOnInit').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  function analyser(etape: EtapeAssistant = 'FOURNISSEURS', lignes = [ligne]) {
    api['previsualiserAssistant'].mockReturnValue(of({ ...apercu, etape, lignes }));
    page.etapeAssistant.set(etape);page.previsualiserAssistant();
  }
  function selectionner(l = ligne, c = candidat) { page.selectionnerAssistant(l,c,true); }

  it('annule une ligne validée après confirmation puis ouvre le choix manuel sur son opération', () => {
    const rapprochement = { id: 42, operationBancaireId: operation.id, statut: 'VALIDE' } as RapprochementBancaire;
    const annule = { ...rapprochement, statut: 'ANNULE' } as RapprochementBancaire;
    const reponse = new Subject<RapprochementBancaire>();
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    api['annulerRapprochementValide'] = vi.fn(() => reponse);
    api['operation'] = vi.fn(() => of(operation));
    api['facturesCandidates'] = vi.fn(() => of([]));
    api['rapprochements'] = vi.fn(() => of([annule]));
    page.rapprochements.set([rapprochement]);

    page.annulerRapprochementValide(rapprochement);
    expect(api['annulerRapprochementValide']).not.toHaveBeenCalled();
    page.annulerRapprochementValide(rapprochement);
    page.annulerRapprochementValide(rapprochement);
    expect(confirmation).toHaveBeenCalledTimes(2);
    expect(api['annulerRapprochementValide']).toHaveBeenCalledExactlyOnceWith(42);
    expect(page.rapprochements()).toEqual([rapprochement]);

    reponse.next(annule);
    expect(page.rapprochements()).toEqual([annule]);
    page.rapprocherOperationAnnulee(annule);
    expect(api['operation']).toHaveBeenCalledExactlyOnceWith(operation.id);
    expect(api['facturesCandidates']).toHaveBeenCalledExactlyOnceWith(operation.id);
  });

  it('sélectionne manuellement une paie sans confondre une pièce achat du même identifiant', () => {
    api['facturesCandidates'] = vi.fn(() => of([
      { id: 20, typeFacture: 'ACHAT', numeroFacture: 'NDF-20', resteAPayer: 100 },
      { id: 20, typeFacture: 'SALAIRE', numeroFacture: 'SAL-20', resteAPayer: 100 },
    ]));
    api['rapprocherManuellement'] = vi.fn(() => new Subject());
    page.operations.set([{ ...operation, montantRapproche: 30 }]);
    page.operationManuelleId.set(operation.id);
    page.choisirOperationManuelle();
    page.selectionnerCandidate('SALAIRE:20', true);
    expect(page.totalRapprochementManuel()).toBe(70);
    expect(api['rapprocherManuellement']).not.toHaveBeenCalled();
    page.validerRapprochementManuel();
    page.validerRapprochementManuel();
    expect(api['rapprocherManuellement']).toHaveBeenCalledExactlyOnceWith(operation.id,
      [{ factureId: 20, typeFacture: 'SALAIRE', montantRapproche: 70 }]);
  });

  it('ouvre quatre traitements et bloque le rapprochement avant identification', () => {
    page.ouvrirAssistant();page.changerEtapeAssistant('SALAIRES');expect(api['previsualiserAssistant']).not.toHaveBeenCalled();
    page.changerEtapeAssistant('TIERS');
    expect(page.etapesAssistant.map(e=>e.libelle)).toEqual(['Tiers','Salariés','Clients','Fournisseurs']);expect(api['confirmerAssistant']).not.toHaveBeenCalled();expect(api['previsualiserAssistant']).toHaveBeenCalled();
  });
  it('choisit le dernier import par ses métadonnées et conserve les filtres sur les autres imports', () => {
    vi.mocked(page.chargerOperations).mockRestore();
    page.onglet.set('operations');
    api['imports'] = vi.fn(() => of([
      { id: 15, dateImport: '2026-01-12T11:00:00' },
      { id: 12, dateImport: '2026-01-13T09:00:00' },
    ]));
    api['operations'] = vi.fn(() => of({content:[operation],totalElements:51,totalPages:6}));
    api['compteursOperations'] = vi.fn(() => of({
      total:51,partielles:20,rapprochees:10,tiersIdentifies:20,nonRapprochees:1,sansTiers:1,
    }));
    page.charger();
    expect(api['operations']).toHaveBeenLastCalledWith({importId:'12'},expect.objectContaining({page:0}));
    expect(api['previsualiserAssistant']).not.toHaveBeenCalled();
    expect(page.compteursOperations()?.partielles).toBe(20);
    page.changerImport('15');
    page.filtrerOperations('natureOperation','FACTURE_FOURNISSEUR');
    page.filtrerOperations('statutConsultation','PARTIELLE');
    page.filtrerOperations('tiersReconnu','Adobe');
    page.pageSuivanteOperations();
    expect(api['operations']).toHaveBeenLastCalledWith(
      {importId:'15',statutConsultation:'PARTIELLE',tiersReconnu:'Adobe'},
      expect.objectContaining({page:1}));
    expect(api['compteursOperations'].mock.lastCall?.[0]).not.toHaveProperty('natureOperation');
    page.changerImport('tous');
    expect(api['operations']).toHaveBeenLastCalledWith(
      {importId:undefined,statutConsultation:'PARTIELLE',tiersReconnu:'Adobe'},
      expect.objectContaining({page:0}));
  });

  it('transmet les rôles et les autres filtres sur tout le périmètre, même avec une page vide', () => {
    page.filtresOperations.set({ tiersReconnu: 'Adobe', natureOperation: 'FACTURE_FOURNISSEUR',
      statutRapprochement: 'NON_RAPPROCHEE', rolesTiers: ['MARCHAND', 'SALARIE'] });
    page.pageOperations.set(4);
    page.operations.set([]);
    page.previsualiserAssistant();
    const perimetre = api['previsualiserAssistant'].mock.calls[0][2];
    expect(perimetre).toMatchObject({ tiersReconnu: 'Adobe', rolesTiers: ['MARCHAND', 'SALARIE'] });
    expect(perimetre.operationIds).toBeUndefined();
    expect(perimetre).not.toHaveProperty('natureOperation');
    expect(page.pageOperations()).toBe(4);
  });

  it('filtre plusieurs rôles et trie le rôle en ordre croissant puis décroissant', () => {
    page.pageOperations.set(3);
    page.filtrerRolesTiers('SALARIE', true);
    page.filtrerRolesTiers('MARCHAND', true);
    expect(page.filtresOperations().rolesTiers).toEqual(['MARCHAND', 'SALARIE']);
    expect(page.pageOperations()).toBe(1);
    page.trierOperations('rolesTiers');
    expect(page.triOperations()).toEqual({ sortBy: 'rolesTiers', sortDirection: 'ASC' });
    page.trierOperations('rolesTiers');
    expect(page.triOperations()).toEqual({ sortBy: 'rolesTiers', sortDirection: 'DESC' });
    page.filtrerRolesTiers('SALARIE', false);
    page.filtrerRolesTiers('MARCHAND', false);
    expect(page.filtresOperations().rolesTiers).toBeUndefined();
  });

  it('résume la multisélection des rôles dans la liste déroulante', () => {
    const fixture = TestBed.createComponent(TresoreriePage);
    page = fixture.componentInstance;
    page.onglet.set('operations');
    fixture.detectChanges();
    page.rolesTiersDisponibles.set([
      { code: 'MARCHAND', libelle: 'Marchand' }, { code: 'SALARIE', libelle: 'Salarié' },
    ]);
    vi.spyOn(page, 'chargerOperations').mockImplementation(fin => fin?.());
    fixture.detectChanges();

    const menu: HTMLDetailsElement = fixture.nativeElement.querySelector('.filtre-roles details');
    const resume = () => menu.querySelector('summary')?.textContent?.trim();
    expect(resume()).toBe('Tous');
    menu.open = true;
    const cases = menu.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    cases[1].click();
    fixture.detectChanges();
    expect(resume()).toBe('Salarié');
    cases[0].click();
    fixture.detectChanges();
    expect(resume()).toBe('2 rôles');
    expect(Array.from(cases).every(caseRole => caseRole.checked)).toBe(true);
    menu.querySelector('button')?.click();
    fixture.detectChanges();
    expect(resume()).toBe('Tous');
  });

  it('réutilise tout le périmètre filtré à la confirmation puis permet de changer de rôle', () => {
    const fixture = TestBed.createComponent(TresoreriePage);
    page = fixture.componentInstance;
    page.onglet.set('operations');
    page.imports.set([{ id: 12, nomFichier: 'Import janvier 2026', dateImport: '2026-01-31' }] as ReturnType<typeof page.imports>);
    page.choixImport.set('12');
    page.filtresOperations.set({ tiersReconnu: 'Adobe', statutConsultation: 'TIERS_IDENTIFIE', rolesTiers: ['MARCHAND'] });
    const autre = { ...ligne, operation: { ...operation, id: 22 }, candidats: [{ ...candidat, cle: 'P:ACHAT:11', pieceId: 11 }] };
    const roles = [{ code: 'MARCHAND', libelle: 'Marchand' }, { code: 'CLIENT', libelle: 'Client' }];
    const compteurs = { total: 18, rapprochees: 0, partielles: 0, tiersIdentifies: 18,
      nonRapprochees: 0, sansTiers: 0, rolesTiersDisponibles: roles };
    api['operations'] = vi.fn(() => of({ content: [operation], totalElements: 18, totalPages: 2 }));
    api['compteursOperations'] = vi.fn(() => of(compteurs));
    api['previsualiserAssistant'].mockReturnValue(of({ ...apercu, operationsPerimetre: 18, lignes: [ligne, autre] }));
    fixture.detectChanges();
    page.pageOperations.set(2);
    page.chargerOperations();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Import janvier 2026 · Tiers Adobe · Marchand · Tiers identifié · 18 opérations');

    page.changerEtapeAssistant('FOURNISSEURS');
    page.preparerAssistant(true);
    page.confirmerAssistant();
    const filtres = { importId: '12', tiersReconnu: 'Adobe', statutConsultation: 'TIERS_IDENTIFIE', rolesTiers: ['MARCHAND'] };
    expect(api['confirmerAssistant']).toHaveBeenCalledWith(expect.objectContaining({
      perimetre: { ...filtres, operationIds: undefined, consultation: true },
      selections: [expect.objectContaining({ operationId: 1 }), expect.objectContaining({ operationId: 22 })],
    }));
    expect(api['compteursOperations']).toHaveBeenLastCalledWith(filtres);
    expect(api['operations']).toHaveBeenLastCalledWith(filtres, expect.objectContaining({ page: 1 }));

    page.effacerFiltreRolesTiers();
    page.filtrerRolesTiers('CLIENT', true);
    page.changerEtapeAssistant('CLIENTS');
    expect(api['previsualiserAssistant']).toHaveBeenLastCalledWith('CLIENTS', 'CARTE',
      { ...filtres, rolesTiers: ['CLIENT'], operationIds: undefined, consultation: true });
    expect(page.pageOperations()).toBe(1);
  });

  it('Rapprocher limite explicitement le périmètre à la ligne sélectionnée', () => {
    page.ouvrirAssistant(operation);page.previsualiserAssistant();
    expect(api['previsualiserAssistant'].mock.calls[0][2].operationIds).toEqual([1]);expect(page.operationAssistant()).toBe(1);
  });
  it('exige une prévisualisation et une confirmation distincte', () => {
    page.confirmerAssistant();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    analyser();selectionner();page.preparerAssistant();expect(page.recapAssistant()?.selections).toHaveLength(1);
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    page.recapAssistant.set(null);page.confirmerAssistant();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    page.preparerAssistant();page.confirmerAssistant();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);
    expect(page.bilanAssistant()?.reussis).toBe(1);
  });
  it('bloque une deuxième confirmation tant que la première est en cours', () => {
    analyser();selectionner();page.preparerAssistant();const resultat=new Subject<unknown>();api['confirmerAssistant'].mockReturnValue(resultat);
    page.confirmerAssistant();page.confirmerAssistant();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);resultat.complete();
  });
  it('ne sélectionne pas automatiquement les dates atypiques, ambiguïtés ou commerçants différents', () => {
    const atypique={ ...candidat, cle: 'P:ACHAT:20', pieceId:20, sur:false, avertissements:['Date atypique'] };
    const l={ ...ligne, candidats:[atypique] };analyser('FOURNISSEURS',[l]);page.selectionnerSuresAssistant();expect(page.choixAssistant()).toHaveLength(0);
    selectionner(l,atypique);page.preparerAssistant();expect(page.recapAssistant()).toBeNull();expect(page.error()).toContain('justificatifs');
    page.modifierChoixAssistant(1,atypique.cle,'verifierJustificatif',true);page.preparerAssistant();expect(page.recapAssistant()).not.toBeNull();
  });
  it('empêche une pièce sélectionnée sur deux opérations, notamment INDIGO / Free Mobile', () => {
    const autre={ ...ligne, operation:{ ...operation,id:2,libelle:'FREE MOBILE' } };analyser('NOTES_FRAIS',[ligne,autre]);
    selectionner();selectionner(autre);expect(page.choixAssistant()).toHaveLength(1);expect(page.error()).toContain('autre opération');
  });
  it('permet plusieurs factures pour une opération et conserve les montants choisis', () => {
    const a={ ...candidat,montantPropose:40,montantDisponible:40 };const b={ ...candidat,cle:'P:ACHAT:11',pieceId:11,montantPropose:60,montantDisponible:60 };
    const l={ ...ligne,candidats:[a,b] };analyser('FOURNISSEURS',[l]);selectionner(l,a);selectionner(l,b);page.preparerAssistant();
    expect(page.recapAssistant()?.selections.map(s=>s.montant)).toEqual([40,60]);expect(page.totalAssistant()).toBe(100);
  });
  it('prépare un tiers et sa règle sans paiement ni correction de classification', () => {
    const c={...candidat,cle:'T:21',typePiece:'TIERS',pieceId:null,montantPropose:0,natureProposee:'FACTURE_FOURNISSEUR' as const};
    const l={...ligne,operation:{...operation,tiersId:null,natureOperation:'SALAIRE' as const},candidats:[c]} as LigneAssistant;
    analyser('TIERS',[l]);selectionner(l,c);page.preparerAssistant();
    expect(page.recapAssistant()).toBeNull();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();expect(page.identification()?.tiersId).toBe(21);
    expect(page.choixAssistant()[0].choix.confirmerNature).toBe(false);
  });
  it('un changement de société ou de filtres interdit la confirmation périmée', () => {
    analyser();selectionner();page.preparerAssistant();societe.mockReturnValue(2);page.confirmerAssistant();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    societe.mockReturnValue(1);page.filtresOperations.set({ tiersReconnu:'Benome' });page.confirmerAssistant();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('ignore les réponses tardives de la société précédente et expose les erreurs de recherche', () => {
    const resultat=new Subject<unknown>();api['previsualiserAssistant'].mockReturnValue(resultat);page.previsualiserAssistant();societe.mockReturnValue(2);
    resultat.next(apercu);resultat.complete();expect(page.apercuAssistant()).toBeNull();
    api['previsualiserAssistant'].mockReturnValue(throwError(()=>new Error('Factures indisponible')));page.previsualiserAssistant();expect(page.error()).not.toBeNull();expect(page.apercuAssistant()).toBeNull();
  });
  it('reprend la même demande après interruption réseau sans écriture automatique supplémentaire', () => {
    analyser();selectionner();page.preparerAssistant();api['confirmerAssistant'].mockReturnValue(throwError(()=>new Error('Réseau')));
    page.confirmerAssistant();const initial=api['confirmerAssistant'].mock.calls[0][0];expect(page.repriseAssistant()).toEqual(initial);
    expect(page.error()).toContain('incertain');api['confirmerAssistant'].mockReturnValue(of({reussis:1,refuses:0,conflits:0,aReprendre:0,lignes:[]}));
    page.preparerRepriseAssistant();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);page.confirmerAssistant();
    expect(api['confirmerAssistant'].mock.calls[1][0]).toEqual(initial);
  });
  it('montre les résultats partiels et conserve les lignes à reprendre', () => {
    analyser();selectionner();page.preparerAssistant();api['confirmerAssistant'].mockReturnValue(of({reussis:0,refuses:0,conflits:0,aReprendre:1,lignes:[{operationId:1,statut:'A_REPRENDRE',message:'Réponse perdue'}]}));
    page.confirmerAssistant();expect(page.bilanAssistant()?.aReprendre).toBe(1);expect(page.repriseAssistant()?.selections).toHaveLength(1);
  });
  it('prépare le lot des pièces autorisées, mais ne le lance pas avant confirmation globale', () => {
    const c={...candidat,cle:'CREATION',pieceId:null,typePiece:'IMPOT_TAXE',avertissements:['TVA zéro, sans annulation coordonnée']};
    const l={...ligne,candidats:[c]};analyser('PIECES',[l]);page.preparerAssistant(true);
    expect(page.recapAssistant()?.etape).toBe('PIECES');expect(page.totalAssistant()).toBe(100);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    page.confirmerAssistant();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);
  });
  it('la recherche et la mémorisation ouvrent le référentiel sans créer de tiers ni de règle', () => {
    analyser('TIERS');page.detailAssistant.set(ligne);page.chercherTiersAssistant('Adobe');
    expect(page.tiersManuelsAssistant()).toHaveLength(1);page.ouvrirTiersAssistant(21);
    expect(navigate).toHaveBeenCalledWith('tiers','/tiers/21?retourAssistant=1&operationId=1',expect.any(String));
    page.ouvrirTiersAssistant();expect(navigate).toHaveBeenLastCalledWith('tiers','/tiers/nouveau?retourAssistant=1&operationId=1',expect.any(String));
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('affiche directement quatre traitements, les filtres et un tableau unique avec propositions', () => {
    const fixture=TestBed.createComponent(TresoreriePage);page=fixture.componentInstance;page.onglet.set('operations');fixture.detectChanges();
    const html: HTMLElement=fixture.nativeElement;expect(html.querySelector('.operations-table')).not.toBeNull();
    page.etapeAssistant.set('FOURNISSEURS');page.previsualiserAssistant();fixture.detectChanges();
    expect(html.querySelectorAll('.operations-table')).toHaveLength(1);expect(html.querySelector('#onglet-assistant')).toBeNull();expect(html.querySelectorAll('[aria-label="Traitements bancaires"] button')).toHaveLength(4);
    page.detailAssistant.set(ligne);fixture.detectChanges();expect(html.querySelector('[aria-label="Détail de la proposition"]')?.textContent).toContain('Date d’achat concordante');
    expect(html.textContent).toContain('Ouvrir la pièce et son justificatif');selectionner();page.preparerAssistant();fixture.detectChanges();
    expect(html.querySelector('[aria-label="Récapitulatif de confirmation"]')?.textContent).toContain('2026-01-09');expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('transmet un motif proposé vers la fiche Tiers sans créer de règle ni associer le tiers', () => {
    page.operationAssistant.set(1);analyser('TIERS',[{...ligne,operation:{...operation,tiersId:null}} as LigneAssistant]);page.detailAssistant.set({...ligne,operation:{...operation,id:2,libelle:'MICROSOFT'}});page.ouvrirTiersAssistant(21,1,true);
    expect(navigate).toHaveBeenCalledWith('tiers','/tiers/21?retourAssistant=1&operationId=1&proposerRegle=1&motifBancaire=ADOBE.COM',expect.any(String));
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    expect(page.proposerMotifBancaire('VIR SEPA MEROVE 18/11/2026 123456')).toBe('MEROVE');
    expect(page.proposerMotifBancaire('PAIEMENT MICROSOFT£G134725849 10/01')).toBe('MICROSOFT');
  });
  it('au retour de création, propose le nouveau tiers sans enregistrer son association', () => {
    Object.assign(TestBed.inject(ActivatedRoute),{queryParamMap:of(convertToParamMap({vue:'operations',assistant:'tiers',operationId:'1',tiersProposeId:'99'}))});
    vi.spyOn(page,'charger').mockImplementation(()=>{});initialiserPage.call(page);
    api['obtenirTiersAssistant']=vi.fn(()=>of({id:99,libelle:'Alice Merove',roles:['SALARIE'],actif:true}));
    api['previsualiserAssistant'].mockReturnValue(of({...apercu,lignes:[{...ligne,operation:{...operation,tiersId:null}}]}));
    page.previsualiserAssistant();
    expect(api['obtenirTiersAssistant']).toHaveBeenCalledWith(99);
    expect(page.detailAssistant()?.candidats).toEqual(expect.arrayContaining([expect.objectContaining({cle:'MANUEL:99',tiersId:99})]));
    expect(page.choixAssistant()).toHaveLength(0);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('pagine les opérations prévisualisées sans élargir le périmètre bancaire ni perdre les filtres', () => {
    const lignes=Array.from({length:26},(_,i)=>({...ligne,operation:{...operation,id:i+1}}));
    page.filtresOperations.set({tiersReconnu:'Adobe'});page.taillePageOperations.set(25);
    analyser('FOURNISSEURS',lignes);expect(page.operationsAffichees()).toHaveLength(25);page.pageResultatsAssistant.set(2);
    expect(page.operationsAffichees()).toHaveLength(1);expect(page.totalPagesResultatsAssistant()).toBe(2);
    expect(page.operationsPage().map(o=>o.id)).toEqual([1]);expect(page.filtresOperations()).toEqual({tiersReconnu:'Adobe'});
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

  it('trie le tableau bancaire et revient à la première page', () => {
    page.pageOperations.set(4);analyser('FOURNISSEURS',[
      {...ligne,operation:{...operation,id:1,libelle:'Adobe'}},{...ligne,operation:{...operation,id:2,libelle:'Microsoft'}},
    ]);
    page.trierOperations('tiersReconnu');expect(page.loading()).toBe(false);expect(page.pageOperations()).toBe(1);
    expect(page.triOperations()).toEqual({sortBy:'tiersReconnu',sortDirection:'DESC'});expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

  it('trie par libellé dans les deux sens en conservant le périmètre bancaire', () => {
    const fixture = TestBed.createComponent(TresoreriePage);
    page = fixture.componentInstance;
    page.onglet.set('operations');
    page.choixImport.set('42');
    page.filtresOperations.set({ tiersReconnu: 'Adobe', statutConsultation: 'TIERS_IDENTIFIE' });
    page.pageOperations.set(2);
    api['operations'] = vi.fn(() => of({ content: [operation], totalElements: 20, totalPages: 2 }));
    api['compteursOperations'] = vi.fn(() => of({
      total: 20, rapprochees: 0, partielles: 0, tiersIdentifies: 20, nonRapprochees: 0, sansTiers: 0,
    }));

    fixture.detectChanges();
    const entete = fixture.nativeElement.querySelector('thead th:nth-child(2)') as HTMLElement;
    const bouton = entete.querySelector('button')!;
    const filtres = { importId: '42', tiersReconnu: 'Adobe', statutConsultation: 'TIERS_IDENTIFIE' };
    bouton.click();
    fixture.detectChanges();
    expect(entete.getAttribute('aria-sort')).toBe('descending');
    expect(api['operations']).toHaveBeenLastCalledWith(filtres, { page: 0, size: 10, sortBy: 'libelle', sortDirection: 'DESC' });

    bouton.click();
    fixture.detectChanges();
    expect(entete.getAttribute('aria-sort')).toBe('ascending');
    expect(api['operations']).toHaveBeenLastCalledWith(filtres, { page: 0, size: 10, sortBy: 'libelle', sortDirection: 'ASC' });
    expect(api['compteursOperations']).toHaveBeenLastCalledWith(filtres);
    expect(page.compteursOperations()?.total).toBe(20);
  });

  it('invalide les propositions après rechargement des opérations modifiées', () => {
    analyser();selectionner();page.preparerAssistant();
    api['operations']=vi.fn(()=>of({content:[operation],totalElements:1,totalPages:1}));
    chargerPage.call(page);
    expect(page.apercuAssistant()).toBeNull();expect(page.choixAssistant()).toHaveLength(0);expect(page.recapAssistant()).toBeNull();
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

  it('revient à la dernière page après traitement sans perdre le bilan ni doubler le rafraîchissement', () => {
    vi.mocked(page.chargerOperations).mockRestore();
    page.pageOperations.set(4);const bilan={reussis:1,refuses:0,conflits:0,aReprendre:0,lignes:[]};page.bilanAssistant.set(bilan);
    api['operations']=vi.fn().mockReturnValueOnce(of({content:[],totalElements:1,totalPages:1})).mockReturnValueOnce(of({content:[operation],totalElements:1,totalPages:1}));
    const fin=vi.fn();chargerPage.call(page,fin,true);
    expect(page.pageOperations()).toBe(1);expect(api['operations']).toHaveBeenCalledTimes(2);expect(fin).toHaveBeenCalledTimes(1);expect(page.bilanAssistant()).toEqual(bilan);
  });

  it('affiche le libellé bancaire, les rôles du tiers et le détail', () => {
    const fixture=TestBed.createComponent(TresoreriePage);page=fixture.componentInstance;
    page.onglet.set('operations');page.etapeAssistant.set('FOURNISSEURS');page.operations.set([{...operation, tiersId: 8, rolesTiers: ['SALARIE', 'PORTEUR_CARTE']},
      {...operation, id: 2, tiersId: 9, typeTiersReconnu: 'SALARIE', montantRapproche: 40, rolesTiers: []}]);fixture.detectChanges();
    const html:HTMLElement=fixture.nativeElement;
    expect(html.querySelectorAll('table')).toHaveLength(1);
    expect(Array.from(html.querySelectorAll('thead th')).map(th=>th.textContent?.trim().replace(/[↑↓↕▼▲]/g,'').trim())).toEqual([
      'Date opération','Libellé','Tiers','Rôle du tiers','Pièce associée','Montant','Statut','Options']);
    expect(Array.from(html.querySelectorAll('tbody tr td:nth-child(4)')).map(td => td.textContent?.trim()))
      .toEqual(['Salarié, Porteur de carte', '—']);
    const libelle = html.querySelector('tbody tr td:nth-child(2) span');
    expect(libelle?.textContent).toBe(operation.libelle);
    expect(libelle?.getAttribute('title')).toBe(operation.libelle);
    expect(html.querySelector('[role="dialog"]')).toBeNull();
    const cellule=html.querySelector('tbody tr td:last-child')!;
    expect(Array.from(cellule.querySelectorAll('button')).map(b=>b.textContent?.trim())).toEqual(['Voir', 'Rapprocher manuellement', 'Rapprocher par défaut', 'Rapprocher sur exercice antérieur']);
    const partielle = html.querySelector('tbody tr:nth-child(2) td:last-child')!;
    expect(Array.from(partielle.querySelectorAll('button')).map(b=>b.textContent?.trim())).toEqual(['Voir', 'Rapprocher manuellement']);
    api['consulterOperation']=vi.fn(()=>of({operation,historique:[],solde:100}));
    cellule.querySelector('button')!.click();fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')?.textContent).toContain(operation.libelle);
    expect(api['consulterOperation']).toHaveBeenCalledWith(operation.id);
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('crée une pièce locale une seule fois et recharge la liste et les compteurs filtrés', () => {
    vi.mocked(page.chargerOperations).mockRestore();
    page.onglet.set('operations');
    page.choixImport.set('12');
    page.filtresOperations.set({ tiersReconnu: 'MACIF', rolesTiers: ['CLIENT'], statutConsultation: 'TIERS_IDENTIFIE' });
    const reponse = new Subject<OperationBancaire>();
    api['rapprocherParDefaut'] = vi.fn(() => reponse);
    api['operations'] = vi.fn(() => of({ content: [], totalElements: 0, totalPages: 1 }));
    api['compteursOperations'] = vi.fn(() => of({ total: 0, rapprochees: 0, partielles: 0, tiersIdentifies: 0, nonRapprochees: 0, sansTiers: 0 }));
    page.ouvrirRapprochementParDefaut({ ...operation, pieceRapprochementAutorisee: false });
    page.libellePieceLocale.set('Facture octobre 2025');
    page.validerRapprochementParDefaut();
    expect(api['rapprocherParDefaut']).not.toHaveBeenCalled();
    page.confirmationPieceLocale.set(true);
    page.validerRapprochementParDefaut();
    page.validerRapprochementParDefaut();
    expect(api['rapprocherParDefaut']).toHaveBeenCalledExactlyOnceWith(1,
      { libelle: 'Facture octobre 2025', tiersId: 21, montantDisponible: 100, confirmation: true });
    reponse.next({ ...operation, statutRapprochement: 'RAPPROCHEE' });
    reponse.complete();
    const filtres = { importId: '12', tiersReconnu: 'MACIF', rolesTiers: ['CLIENT'], statutConsultation: 'TIERS_IDENTIFIE' };
    expect(api['operations']).toHaveBeenCalledWith(filtres, expect.anything());
    expect(api['compteursOperations']).toHaveBeenCalledWith(filtres);
    expect(page.operationRapprochementDefaut()).toBeNull();
  });

  it('confirme le suivi sur un exercice antérieur et recharge le périmètre filtré', () => {
    vi.mocked(page.chargerOperations).mockRestore();
    page.onglet.set('operations');
    page.choixImport.set('12');
    page.filtresOperations.set({ tiersReconnu: 'MACIF', rolesTiers: ['CLIENT'], statutConsultation: 'TIERS_IDENTIFIE' });
    const reponse = new Subject<RapprochementBancaire>();
    api['rapprocherExerciceAnterieur'] = vi.fn(() => reponse);
    api['operations'] = vi.fn(() => of({ content: [], totalElements: 0, totalPages: 1 }));
    api['compteursOperations'] = vi.fn(() => of({ total: 0, rapprochees: 0, partielles: 0, tiersIdentifies: 0, nonRapprochees: 0, sansTiers: 0 }));
    page.ouvrirExerciceAnterieur({
      ...operation, tiersReconnu: 'MACIF', dateOperation: '2026-01-26', sens: 'CREDIT', debit: 0, credit: 6480, montant: 6480,
    });
    page.exerciceReference.set(2026);
    page.motifExercice.set('Facture octobre 2025');
    page.confirmationExercice.set(true);
    page.validerExerciceAnterieur();
    page.exerciceReference.set(2025);
    page.confirmationExercice.set(false);
    page.validerExerciceAnterieur();
    page.confirmationExercice.set(true);
    page.motifExercice.set(' ');
    page.validerExerciceAnterieur();
    expect(api['rapprocherExerciceAnterieur']).not.toHaveBeenCalled();
    page.motifExercice.set('Facture octobre 2025');
    page.validerExerciceAnterieur();
    page.validerExerciceAnterieur();
    expect(api['rapprocherExerciceAnterieur']).toHaveBeenCalledExactlyOnceWith(1,
      { tiersId: 21, montantDisponible: 6480, exerciceReference: 2025, motif: 'Facture octobre 2025', confirmation: true });
    reponse.next({ id: 42, modeRapprochement: 'EXERCICE_ANTERIEUR', exerciceReference: 2025 } as RapprochementBancaire);
    reponse.complete();
    const filtres = { importId: '12', tiersReconnu: 'MACIF', rolesTiers: ['CLIENT'], statutConsultation: 'TIERS_IDENTIFIE' };
    expect(api['operations']).toHaveBeenCalledWith(filtres, expect.anything());
    expect(api['compteursOperations']).toHaveBeenCalledWith(filtres);
    expect(page.operationExerciceAnterieur()).toBeNull();
  });

  it('affiche le suivi bancaire et son annulation dans l’historique de l’opération', () => {
    const fixture = TestBed.createComponent(TresoreriePage);
    page = fixture.componentInstance;
    page.onglet.set('operations');
    fixture.detectChanges();
    const trace = {
      id: 42, operationBancaireId: 1, modeRapprochement: 'EXERCICE_ANTERIEUR', exerciceReference: 2025,
      commentaire: 'Facture octobre 2025', montantRapproche: 6480, statut: 'VALIDE',
      dateValidation: '2026-11-23T08:00:00', utilisateurValidationId: 7,
    };
    api['consulterOperation'] = vi.fn(() => of({ operation, historique: [trace], solde: 0, annulationsLocales: [42] }));
    page.voirOperation(operation);
    fixture.detectChanges();
    const dialogue: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogue.textContent).toContain('Suivi bancaire — exercice 2025');
    expect(dialogue.textContent).toContain('Facture octobre 2025');
    expect(dialogue.textContent).toContain('Utilisateur n° 7');
    expect(Array.from(dialogue.querySelectorAll('button')).map(b => b.textContent?.trim()))
      .toContain('Annuler le rapprochement');
  });

  it('examine les tiers inconnus sans réintroduire les opérations déjà identifiées', () => {
    const inconnue={...ligne,operation:{...operation,id:2,tiersId:null,tiersReconnu:null}} as LigneAssistant;
    analyser('TIERS',[ligne,inconnue]);expect(page.apercuAssistant()?.lignes.map(l=>l.operation.id)).toEqual([2]);
    page.identifierTiersOperation(operation);expect(page.apercuAssistant()?.lignes.map(l=>l.operation.id)).toEqual([2]);
    expect(page.detailAssistant()).toBeNull();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('propose ADOBE.COM par défaut, permet sa correction ou son refus sans enregistrer de règle', () => {
    const c={...candidat,cle:'MANUEL:21',typePiece:'TIERS',pieceId:null,sur:false,montantPropose:0};
    const l={...ligne,operation:{...operation,tiersId:null,libelle:'Adobe.com Saggart'},candidats:[c]} as LigneAssistant;
    analyser('TIERS',[l]);selectionner(l,c);
    expect(page.reglesProposeesAssistant()[1]).toMatchObject({memoriser:true,motif:'ADOBE.COM'});
    page.modifierRegleProposee(1,'motif','ADOBE');page.modifierRegleProposee(1,'memoriser',false);
    expect(page.reglesProposeesAssistant()[1]).toMatchObject({memoriser:false,motif:'ADOBE'});
    expect(page.motifBancaireValide('PAIEMENT CB')).toBe(false);
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();
  });
  it('affiche un montant signé cohérent pour les débits et crédits', () => {
    expect(page.montantSigne(operation)).toBe(-100);
    expect(page.montantSigne({...operation,sens:'CREDIT',debit:0,credit:45,montant:45})).toBe(45);
    expect(page.propositionSure({...ligne,bloquee:true})).toBeNull();
    expect(page.propositionSure({...ligne,operation:{...operation,rapprochee:true}})).toBeNull();
  });

  it('ne sélectionne pas en lot une ligne ambiguë même si un seul candidat est dit sûr', () => {
    analyser('FOURNISSEURS',[{...ligne,candidats:[candidat,{...candidat,cle:'P:ACHAT:11',pieceId:11,sur:false}]}]);
    page.selectionnerSuresAssistant();expect(page.choixAssistant()).toHaveLength(0);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

  it('affiche tous les tiers candidats et remplace le choix au lieu de cumuler des tiers', () => {
    const candidats=[21,22,23].map(id=>({...candidat,cle:'T:'+id,typePiece:'TIERS',pieceId:null,tiersId:id,nomTiers:'Tiers '+id,sur:false}));
    const l={...ligne,operation:{...operation,tiersId:null},candidats} as LigneAssistant;
    const fixture=TestBed.createComponent(TresoreriePage);page=fixture.componentInstance;page.onglet.set('operations');fixture.detectChanges();
    analyser('TIERS',[l]);fixture.detectChanges();const html:HTMLElement=fixture.nativeElement;
    expect(html.querySelectorAll('[aria-label="Propositions de traitement"] input[type="radio"]')).toHaveLength(3);
    expect(page.choixAssistant()).toHaveLength(0);selectionner(l,candidats[0]);selectionner(l,candidats[2]);
    expect(page.choixAssistant().map(s=>s.choix.tiersId)).toEqual([23]);
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

  it('recharge le tiers confirmé au retour sans proposer une seconde association', () => {
    Object.assign(TestBed.inject(ActivatedRoute),{queryParamMap:of(convertToParamMap({vue:'operations',assistant:'tiers',operationId:'1',tiersProposeId:'99',tiersValideId:'99'}))});
    vi.spyOn(page,'charger').mockImplementation(()=>{});initialiserPage.call(page);
    api['obtenirTiersAssistant']=vi.fn();
    api['previsualiserAssistant'].mockReturnValue(of({...apercu,etape:'TIERS',lignes:[{...ligne,operation:{...operation,tiersId:99,tiersReconnu:'Tiers confirmé'}}]}));
    page.previsualiserAssistant();
    expect(page.operationsAffichees()).toHaveLength(0);expect(page.choixAssistant()).toHaveLength(0);
    expect(api['obtenirTiersAssistant']).not.toHaveBeenCalled();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

});
