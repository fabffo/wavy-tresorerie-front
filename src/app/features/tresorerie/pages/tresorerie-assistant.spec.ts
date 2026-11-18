import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { TresoreriePage } from './tresorerie.page';
import { TresorerieApiService } from '../../../core/services/tresorerie-api.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { WavyShellBridgeService } from '../../../core/services/wavy-shell-bridge.service';
import { ApercuAssistant, CandidatAssistant, LigneAssistant, OperationBancaire, EtapeAssistant } from '../models/tresorerie.model';

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
    api = { previsualiserAssistant: vi.fn().mockReturnValue(of(apercu)), confirmerAssistant: vi.fn().mockReturnValue(of({ reussis: 1, refuses: 0, conflits: 0, aReprendre: 0,
      lignes: [{ operationId: 1, statut: 'SUCCES', message: 'Confirmé', rapprochementId: 10 }] })), dashboard: vi.fn().mockReturnValue(of({})),
      rechercherTiersAssistant: vi.fn().mockReturnValue(of([{ id: 21, libelle: 'Adobe', roles: ['FOURNISSEUR_GENERAL'] }])) };
    TestBed.configureTestingModule({ providers: [
      { provide: TresorerieApiService, useValue: api }, { provide: ActivatedRoute, useValue: {} }, { provide: Router, useValue: {} },
      { provide: ContexteService, useValue: { changementSociete: signal(0), societeCouranteId: societe, tenantId: () => 1 } },
      { provide: WavyShellBridgeService, useValue: { navigate } },
    ] });
    page = TestBed.runInInjectionContext(() => new TresoreriePage());
    page.etapeAssistant.set('FOURNISSEURS');page.operations.set([operation]);
    vi.spyOn(page,'chargerOperations').mockImplementation(() => {});
    vi.spyOn(TresoreriePage.prototype,'ngOnInit').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  function analyser(etape: EtapeAssistant = 'FOURNISSEURS', lignes = [ligne]) {
    api['previsualiserAssistant'].mockReturnValue(of({ ...apercu, etape, lignes }));
    page.etapeAssistant.set(etape);page.previsualiserAssistant();
  }
  function selectionner(l = ligne, c = candidat) { page.selectionnerAssistant(l,c,true); }

  it('navigue librement dans les six étapes sans déclencher de traitement', () => {
    page.ouvrirAssistant();page.changerEtapeAssistant('PIECES');page.naviguerAssistant(-1);page.changerEtapeAssistant('TIERS');
    expect(page.etapesAssistant).toHaveLength(6);expect(api['confirmerAssistant']).not.toHaveBeenCalled();expect(api['previsualiserAssistant']).toHaveBeenCalled();
  });
  it('transmet tous les filtres et distingue la page du périmètre complet', () => {
    page.filtresOperations.set({ tiersReconnu: 'Adobe', natureOperation: 'FACTURE_FOURNISSEUR', statutRapprochement: 'NON_RAPPROCHEE' });
    page.pageOperations.set(4);page.porteeAssistant.set('PAGE');page.previsualiserAssistant();
    expect(api['previsualiserAssistant']).toHaveBeenLastCalledWith('FOURNISSEURS','CARTE',expect.objectContaining({ operationIds: [1], tiersReconnu: 'Adobe' }));
    page.porteeAssistant.set('FILTRES');page.previsualiserAssistant();
    expect(api['previsualiserAssistant'].mock.calls[1][2].operationIds).toBeUndefined();
    expect(page.pageOperations()).toBe(4);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('une page vide ne devient jamais un traitement de toutes les opérations', () => {
    page.porteeAssistant.set('PAGE');page.operations.set([]);page.previsualiserAssistant();
    expect(api['previsualiserAssistant']).not.toHaveBeenCalled();expect(page.error()).toContain('aucune opération');
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
  it('conserve la nature par défaut et exige un choix explicite pour sa correction', () => {
    const c={ ...candidat,cle:'T:21',typePiece:'TIERS',pieceId:null,montantPropose:0,natureProposee:'FACTURE_FOURNISSEUR' as const };
    const l={ ...ligne,operation:{ ...operation,natureOperation:'SALAIRE' as const },candidats:[c] };analyser('TIERS',[l]);selectionner(l,c);page.preparerAssistant();
    expect(page.recapAssistant()?.selections[0].confirmerNature).toBe(false);
    page.modifierChoixAssistant(1,c.cle,'confirmerNature',true);page.preparerAssistant();expect(page.recapAssistant()?.selections[0].confirmerNature).toBe(true);
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
  it('affiche directement six étapes, les filtres et un tableau unique avec propositions', () => {
    const fixture=TestBed.createComponent(TresoreriePage);page=fixture.componentInstance;page.onglet.set('operations');fixture.detectChanges();
    const html: HTMLElement=fixture.nativeElement;expect(html.querySelector('.operations-table')).not.toBeNull();
    page.etapeAssistant.set('FOURNISSEURS');page.previsualiserAssistant();fixture.detectChanges();
    expect(html.querySelectorAll('.operations-table')).toHaveLength(1);expect(html.querySelector('#onglet-assistant')).toBeNull();expect(html.querySelectorAll('[aria-label="Étapes du rapprochement"] button')).toHaveLength(6);
    page.detailAssistant.set(ligne);fixture.detectChanges();expect(html.querySelector('[aria-label="Détail de la proposition"]')?.textContent).toContain('Date d’achat concordante');
    expect(html.textContent).toContain('Ouvrir la pièce et son justificatif');selectionner();page.preparerAssistant();fixture.detectChanges();
    expect(html.querySelector('[aria-label="Récapitulatif de confirmation"]')?.textContent).toContain('2026-01-09');expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('transmet un motif proposé vers la fiche Tiers sans créer de règle ni associer le tiers', () => {
    analyser('TIERS');page.detailAssistant.set({...ligne,operation:{...operation,id:2,libelle:'MICROSOFT'}});page.ouvrirTiersAssistant(21,1,true);
    expect(navigate).toHaveBeenCalledWith('tiers','/tiers/21?retourAssistant=1&operationId=1&proposerRegle=1&motifBancaire=Adobe.com',expect.any(String));
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
    expect(page.proposerMotifBancaire('VIR SEPA MEROVE 18/11/2026 123456')).toBe('MEROVE');
    expect(page.proposerMotifBancaire('PAIEMENT MICROSOFT£G134725849 10/01')).toBe('MICROSOFT');
  });
  it('au retour de création, propose le nouveau tiers sans enregistrer son association', () => {
    Object.assign(TestBed.inject(ActivatedRoute),{queryParamMap:of(convertToParamMap({vue:'operations',assistant:'tiers',operationId:'1',tiersProposeId:'99'}))});
    vi.spyOn(page,'charger').mockImplementation(()=>{});initialiserPage.call(page);
    api['obtenirTiersAssistant']=vi.fn(()=>of({id:99,libelle:'Alice Merove',roles:['SALARIE'],actif:true}));
    page.previsualiserAssistant();
    expect(api['obtenirTiersAssistant']).toHaveBeenCalledWith(99);
    expect(page.detailAssistant()?.candidats).toEqual(expect.arrayContaining([expect.objectContaining({cle:'MANUEL:99',tiersId:99})]));
    expect(page.choixAssistant()).toHaveLength(0);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });
  it('pagine les opérations prévisualisées sans élargir le périmètre bancaire ni perdre les filtres', () => {
    const lignes=Array.from({length:26},(_,i)=>({...ligne,operation:{...operation,id:i+1}}));
    page.filtresOperations.set({tiersReconnu:'Adobe'});page.taillePageOperations.set(25);page.porteeAssistant.set('FILTRES');
    analyser('FOURNISSEURS',lignes);expect(page.operationsAffichees()).toHaveLength(25);page.pageResultatsAssistant.set(2);
    expect(page.operationsAffichees()).toHaveLength(1);expect(page.totalPagesResultatsAssistant()).toBe(2);
    expect(page.operationsPage().map(o=>o.id)).toEqual([1]);expect(page.filtresOperations()).toEqual({tiersReconnu:'Adobe'});
    expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  });

  it('trie les résultats sans rester en chargement et sans déplacer la page bancaire source', () => {
    page.pageOperations.set(4);analyser('FOURNISSEURS',[
      {...ligne,operation:{...operation,id:1,libelle:'Adobe'}},{...ligne,operation:{...operation,id:2,libelle:'Microsoft'}},
    ]);
    page.trierOperations('libelle');expect(page.loading()).toBe(false);expect(page.pageOperations()).toBe(4);
    expect(page.operationsAffichees().map(o=>o.libelle)).toEqual(['Microsoft','Adobe']);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
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

});
