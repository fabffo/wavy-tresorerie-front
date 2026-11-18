import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute,Router } from '@angular/router';
import { of,Subject,throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TresoreriePage } from './tresorerie.page';
import { TresorerieApiService } from '../../../core/services/tresorerie-api.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { WavyShellBridgeService } from '../../../core/services/wavy-shell-bridge.service';
import { ApercuAssistant,CandidatAssistant,LigneAssistant,OperationBancaire,RegleBancaireIdentification,TiersIdentification } from '../models/tresorerie.model';

const operation={id:91,compteBancaireId:1,libelle:'Virement émis - VIR INST vers ELIOS DIGITAL SASU',dateOperation:'2026-11-02',sens:'DEBIT',debit:10140,credit:0,montant:10140,tiersId:null,tiersReconnu:null,natureOperation:'SALAIRE',statutClassification:'CLASSEE_MANUELLE',statutRapprochement:'NON_RAPPROCHEE',rapprochee:false} as unknown as OperationBancaire;
const tiers:TiersIdentification={id:9,roles:['FOURNISSEUR_SERVICES'],raisonSociale:'ELIOS DIGITAL SASU',actif:true};
const candidat:CandidatAssistant={cle:'T:9',tiersId:9,nomTiers:'ELIOS DIGITAL SASU',typeTiers:'FOURNISSEUR_SERVICE',pieceId:null,numeroPiece:null,datePiece:null,dateEcheance:null,typePiece:'TIERS',montantPropose:0,montantDisponible:0,sur:true,criteres:[],avertissements:[],natureProposee:'FACTURE_FOURNISSEUR',carte:null};
const ligne={operation,candidats:[candidat],anomalies:[],bloquee:false} as LigneAssistant;
const regle:RegleBancaireIdentification={id:7,tiersId:9,motif:'ELIOS DIGITAL SASU',typeMotif:'CONTIENT',typeRegle:'OPERATION_BANCAIRE',actif:true,scorePriorite:100};
const reponse=(lignes=[ligne])=>({etape:'TIERS',categorie:'CARTE',lignes,eligibles:lignes.length,operationsPerimetre:lignes.length,propositions:lignes.length,anomalies:0,restantes:lignes.length,piecesDisponibles:0,traitees:0,montantEligible:0}) as ApercuAssistant;

describe('Identification du tiers sur la ligne bancaire',()=>{
 let page:TresoreriePage;let api:Record<string,ReturnType<typeof vi.fn>>;let societe:number;let tenant:number;let navigate:ReturnType<typeof vi.fn>;
 beforeEach(()=>{
  sessionStorage.clear();societe=3;tenant=1;navigate=vi.fn();
  api={previsualiserAssistant:vi.fn(()=>of(reponse())),reglesIdentification:vi.fn(()=>of([])),rolesIdentification:vi.fn(()=>of(['AUTRE','SALARIE','FOURNISSEUR_GENERAL','MARCHAND'])),
   lireTiersIdentification:vi.fn(()=>of(tiers)),listerTiersIdentification:vi.fn(()=>of([])),creerTiersIdentification:vi.fn(()=>of(tiers)),
   enregistrerRegleIdentification:vi.fn(()=>of(regle)),rechercherTiersAssistant:vi.fn(()=>of([{id:9,libelle:'ELIOS DIGITAL SASU',roles:['FOURNISSEUR_SERVICES']}])),
   confirmerAssistant:vi.fn(()=>of({reussis:1,refuses:0,conflits:0,aReprendre:0,lignes:[{operationId:91,statut:'SUCCES',message:'Tiers associé',rapprochementId:null}]}))};
  TestBed.configureTestingModule({providers:[{provide:TresorerieApiService,useValue:api},{provide:ActivatedRoute,useValue:{}},{provide:Router,useValue:{navigate:vi.fn()}},
   {provide:ContexteService,useValue:{changementSociete:signal(0),societeCouranteId:()=>societe,tenantId:()=>tenant,utilisateurId:()=>2}},{provide:WavyShellBridgeService,useValue:{navigate}}]});
  vi.spyOn(TresoreriePage.prototype,'ngOnInit').mockImplementation(()=>{});
  page=TestBed.runInInjectionContext(()=>new TresoreriePage());page.operations.set([operation]);page.previsualiserAssistant();
 });
 afterEach(()=>vi.restoreAllMocks());
 function ouvrir(id:number|undefined=9){page.ouvrirValidationTiers(ligne,id);}
 function nouvelle(type:'ORGANISATION'|'PERSONNE_PHYSIQUE'='ORGANISATION'){
  api['previsualiserAssistant'].mockReturnValue(of(reponse([{...ligne,candidats:[]}])));
  page.ouvrirValidationTiers({...ligne,candidats:[]});page.modifierIdentification('typeTiers',type);page.modifierIdentification('role',type==='PERSONNE_PHYSIQUE'?'SALARIE':'AUTRE');
  page.modifierIdentification('raisonSociale','ELIOS DIGITAL SASU');page.modifierIdentification('nom','Baroudi');page.modifierIdentification('prenom','Karim');
 }
 it('charge en lecture seule les opérations sans tiers et suspend seulement les filtres incompatibles',()=>{
  page.etapeAssistant.set('FOURNISSEURS');page.filtresOperations.set({tiersReconnu:'ELIOS',typeTiersReconnu:'FOURNISSEUR',natureOperation:'SALAIRE',statutClassification:'CLASSEE_MANUELLE'});
  page.changerEtapeAssistant('TIERS');expect(api['previsualiserAssistant']).toHaveBeenLastCalledWith('TIERS','CARTE',expect.objectContaining({natureOperation:'SALAIRE',statutClassification:'CLASSEE_MANUELLE'}));
  expect(page.filtresOperations().tiersReconnu).toBeUndefined();page.changerEtapeAssistant('FOURNISSEURS');expect(page.filtresOperations().tiersReconnu).toBe('ELIOS');
  expect(api['confirmerAssistant']).not.toHaveBeenCalled();expect(api['creerTiersIdentification']).not.toHaveBeenCalled();expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();
 });
 it('réutilise une règle adaptée, confirme sans paiement et retire immédiatement la ligne',async()=>{
  api['reglesIdentification'].mockReturnValue(of([{...regle,motif:'ELIOS'}]));ouvrir();expect(page.identification()?.motif).toBe('ELIOS');await page.validerIdentification();
  expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();expect(api['creerTiersIdentification']).not.toHaveBeenCalled();
  expect(page.operations()[0]).toMatchObject({tiersId:9,tiersReconnu:'ELIOS DIGITAL SASU',natureOperation:'SALAIRE',statutClassification:'CLASSEE_MANUELLE',statutRapprochement:'NON_RAPPROCHEE',montant:10140});
  expect(page.operationsAffichees()).toHaveLength(0);expect(page.apercuAssistant()?.restantes).toBe(0);expect(navigate).not.toHaveBeenCalled();
  expect(api['confirmerAssistant']).toHaveBeenCalledWith(expect.objectContaining({etape:'TIERS',selections:[expect.objectContaining({tiersId:9,montant:0,pieceId:null,confirmerNature:false,confirmerAffectation:false})]}));
 });
 it('crée la règle ELIOS DIGITAL SASU seulement au clic Valider',async()=>{
  ouvrir();expect(page.identification()?.motif).toBe('ELIOS DIGITAL SASU');expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();
  await page.validerIdentification();expect(api['enregistrerRegleIdentification']).toHaveBeenCalledWith(9,'ELIOS DIGITAL SASU');
 });
 it('garde tous les candidats visibles sans sélectionner arbitrairement',()=>{
  const l={...ligne,candidats:[candidat,{...candidat,cle:'T:10',tiersId:10,nomTiers:'Autre ELIOS',sur:false}]} as LigneAssistant;
  api['previsualiserAssistant'].mockReturnValue(of(reponse([l])));page.previsualiserAssistant();expect(page.identification()).toBeNull();
  page.choisirPropositionIdentification(l,candidat as never);expect(page.identification()?.tiersId).toBe(9);
  page.choisirPropositionIdentification(l,l.candidats[1]);expect(page.identification()?.tiersId).toBe(10);expect(page.choixAssistant()).toHaveLength(1);
  expect(api['confirmerAssistant']).not.toHaveBeenCalled();
 });
 it('permet la recherche puis le choix manuel d’un autre tiers, sans navigation',async()=>{
  ouvrir();page.chercherTiersAssistant('ELIOS');expect(api['rechercherTiersAssistant']).toHaveBeenCalledWith('ELIOS');
  page.choisirExistantIdentification(tiers);await page.validerIdentification();expect(navigate).not.toHaveBeenCalled();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);
 });
 it('propose uniquement les identités étayées par le libellé et laisse compléter le prénom',()=>{
  const l={...ligne,operation:{...operation,libelle:'VIR INST vers ELIOS DIGITAL SASU - Wavy services 20251102 M.Baroudi nov25'}};
  const hypotheses=page.hypothesesIdentification(l);expect(hypotheses).toEqual([{type:'ORGANISATION',nom:'ELIOS DIGITAL SASU',prenom:''},{type:'PERSONNE_PHYSIQUE',nom:'Baroudi',prenom:''}]);
  expect(page.hypothesesIdentification({...ligne,operation:{...operation,libelle:'VIR SEPA 123456'}})).toEqual([]);
 });
 it.each(['ORGANISATION','PERSONNE_PHYSIQUE'] as const)('crée un tiers de type %s, sa règle et son association en une validation',async type=>{
  nouvelle(type);await page.validerIdentification();expect(api['creerTiersIdentification']).toHaveBeenCalledTimes(1);
  expect(api['creerTiersIdentification']).toHaveBeenCalledWith(expect.objectContaining({typeTiers:type,roles:[type==='PERSONNE_PHYSIQUE'?'SALARIE':'AUTRE']}));
  expect(api['enregistrerRegleIdentification']).toHaveBeenCalledTimes(1);expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);expect(page.operationsAffichees()).toHaveLength(0);
 });
 it('accepte une saisie libre et exige les informations obligatoires d’une personne',async()=>{
  nouvelle('PERSONNE_PHYSIQUE');page.modifierIdentification('prenom','');await page.validerIdentification();expect(api['creerTiersIdentification']).not.toHaveBeenCalled();
  page.modifierIdentification('prenom','Karim');await page.validerIdentification();expect(api['creerTiersIdentification']).toHaveBeenCalledTimes(1);
 });
 it('détecte une fiche équivalente et permet de la choisir au lieu de recréer',async()=>{
  nouvelle();api['listerTiersIdentification'].mockReturnValue(of([tiers]));await page.validerIdentification();expect(page.doublonsIdentification()).toEqual([tiers]);expect(api['creerTiersIdentification']).not.toHaveBeenCalled();
  page.choisirExistantIdentification(tiers);await page.validerIdentification();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);expect(api['creerTiersIdentification']).not.toHaveBeenCalled();
 });
 it('bloque un motif ambigu et permet de le corriger sur place',async()=>{
  ouvrir();page.modifierIdentification('motif','VIREMENT');await page.validerIdentification();expect(page.erreurIdentification()).toContain('Corrigez');expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();
  page.modifierIdentification('motif','ELIOS DIGITAL SASU');await page.validerIdentification();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);
 });
 it('refuse un motif trop large entre plusieurs identités sans règle préalable',async()=>{
  ouvrir();page.modifierIdentification('motif','ELIOS');api['previsualiserAssistant'].mockReturnValue(of(reponse([{...ligne,candidats:[candidat,{...candidat,tiersId:10,cle:'T:10',nomTiers:'ELIOS CONSEIL',sur:false}]}])));
  await page.validerIdentification();expect(page.erreurIdentification()).toContain('plusieurs tiers');expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
 });
 it('refuse un conflit de règle avec un autre tiers avant toute création',async()=>{
  nouvelle();api['reglesIdentification'].mockReturnValue(of([{...regle,tiersId:10,motif:'ELIOS'}]));await page.validerIdentification();
  expect(page.erreurIdentification()).toContain('conflit');expect(api['creerTiersIdentification']).not.toHaveBeenCalled();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
 });
 it('réutilise une règle équivalente ponctuée et ne la réactive pas si elle est désactivée',async()=>{
  ouvrir();api['reglesIdentification'].mockReturnValue(of([{...regle,motif:'ELIOS-DIGITAL-SASU',actif:false}]));await page.validerIdentification();expect(page.erreurIdentification()).toContain('désactivée');
  api['reglesIdentification'].mockReturnValue(of([{...regle,motif:'ELIOS-DIGITAL-SASU'}]));await page.validerIdentification();expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);
 });
 it('reprend après une création réussie puis une réponse d’association perdue, sans doublon',async()=>{
  nouvelle();api['confirmerAssistant'].mockReturnValueOnce(throwError(()=>new Error('Réseau')));await page.validerIdentification();
  expect(page.identification()?.tiersId).toBe(9);expect(page.operationsAffichees()).toHaveLength(1);
  api['reglesIdentification'].mockReturnValue(of([regle]));await page.validerIdentification();expect(api['creerTiersIdentification']).toHaveBeenCalledTimes(1);expect(api['enregistrerRegleIdentification']).toHaveBeenCalledTimes(1);expect(page.operationsAffichees()).toHaveLength(0);
 });
 it('retrouve après rechargement le tiers créé quand l’enregistrement de règle a échoué',async()=>{
  nouvelle();api['enregistrerRegleIdentification'].mockReturnValueOnce(throwError(()=>new Error('Réseau')));await page.validerIdentification();
  page.identification.set(null);page.ouvrirValidationTiers(ligne);expect(page.identification()?.tiersId).toBe(9);
  await page.validerIdentification();expect(api['creerTiersIdentification']).toHaveBeenCalledTimes(1);expect(page.operationsAffichees()).toHaveLength(0);
 });
 it('ne recrée pas un tiers après une réponse de création perdue',async()=>{
  nouvelle();api['creerTiersIdentification'].mockReturnValueOnce(throwError(()=>new HttpErrorResponse({status:0})));await page.validerIdentification();
  page.identification.set(null);page.ouvrirValidationTiers(ligne);expect(page.identification()?.creationIncertaine).toBe(true);
  await page.validerIdentification();expect(api['creerTiersIdentification']).toHaveBeenCalledTimes(1);expect(api['confirmerAssistant']).not.toHaveBeenCalled();
  api['listerTiersIdentification'].mockReturnValue(of([tiers]));await page.retrouverIdentification();page.choisirExistantIdentification(tiers);await page.validerIdentification();expect(page.operationsAffichees()).toHaveLength(0);
 });
 it('reconnaît une association déjà enregistrée après une réponse perdue sans la renvoyer',async()=>{
  ouvrir();api['previsualiserAssistant'].mockReturnValue(of(reponse([{...ligne,operation:{...operation,tiersId:9,tiersReconnu:'ELIOS DIGITAL SASU'}}])));
  api['reglesIdentification'].mockReturnValue(of([regle]));await page.validerIdentification();expect(api['confirmerAssistant']).not.toHaveBeenCalled();expect(page.operationsAffichees()).toHaveLength(0);
 });
 it('conserve les filtres et la pagination et garde la prochaine opération disponible',async()=>{
  const lignes=Array.from({length:12},(_,i)=>({...ligne,operation:{...operation,id:91+i}}));api['previsualiserAssistant'].mockReturnValue(of(reponse(lignes)));page.previsualiserAssistant();page.taillePageOperations.set(10);page.pageResultatsAssistant.set(2);
  page.filtresOperations.set({natureOperation:'SALAIRE'});ouvrir();await page.validerIdentification();expect(page.pageResultatsAssistant()).toBe(2);expect(page.apercuAssistant()?.restantes).toBe(11);expect(page.filtresOperations().natureOperation).toBe('SALAIRE');
 });
 it.each(['tenant','societe'])('isole la reprise et les écritures lorsque le %s change',async champ=>{
  ouvrir();const attente=new Subject<RegleBancaireIdentification[]>();api['reglesIdentification'].mockReturnValueOnce(attente);const execution=page.validerIdentification();
  await vi.waitFor(()=>expect(api['reglesIdentification']).toHaveBeenCalledTimes(2));if(champ==='tenant')tenant=2;else societe=4;
  attente.next([]);attente.complete();await execution;expect(api['enregistrerRegleIdentification']).not.toHaveBeenCalled();expect(api['confirmerAssistant']).not.toHaveBeenCalled();
 });
 it('bloque un double clic pendant une validation',async()=>{
  ouvrir();const attente=new Subject<RegleBancaireIdentification[]>();api['reglesIdentification'].mockReturnValueOnce(attente);const execution=page.validerIdentification();await page.validerIdentification();
  await vi.waitFor(()=>expect(api['reglesIdentification']).toHaveBeenCalledTimes(2));attente.next([]);attente.complete();await execution;expect(api['confirmerAssistant']).toHaveBeenCalledTimes(1);
 });
 it.each(['VIREMENT ÉMIS','PAIEMENT PAR CARTE','FACTURE 2026'])('refuse un motif bancaire générique composé : %s',motif=>{
  expect(page.motifBancaireValide(motif)).toBe(false);
 });
 it('présente Adobe.com comme motif stable et ne propose pas de mot bancaire générique',()=>{
  expect(page.proposerMotifBancaire('Adobe.com Saggart','Adobe Systems Software Ireland Ltd')).toBe('ADOBE.COM');expect(page.motifBancaireValide('FACTURE')).toBe(false);
 });
 it('affiche un seul tableau et un formulaire dans sa ligne, sans fiche Tiers ni messages comptables',()=>{
  const fixture=TestBed.createComponent(TresoreriePage);page=fixture.componentInstance;page.onglet.set('operations');fixture.detectChanges();page.previsualiserAssistant();ouvrir();fixture.detectChanges();
  const html:HTMLElement=fixture.nativeElement;expect(html.querySelectorAll('table')).toHaveLength(1);expect(html.querySelectorAll('thead th')).toHaveLength(7);
  const editeur=html.querySelector('[aria-label="Identification du tiers"]');expect(editeur).not.toBeNull();expect(editeur?.textContent).toContain('Valider');
  expect(editeur?.querySelector('input[type="checkbox"]')).toBeNull();expect(editeur?.textContent).not.toMatch(/disponible|échéance|justificatif|nature actuelle|fiche Tiers/i);expect(html.querySelector('[role="dialog"]')).toBeNull();
 });
});
