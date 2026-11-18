import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TresorerieApiService } from './tresorerie-api.service';

describe('Contrat HTTP des propositions carte', () => {
  let api: TresorerieApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(TresorerieApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('la recherche est un GET sans effet de paiement', () => {
    api.proposerCartes().subscribe();
    const req = http.expectOne(r => r.url.endsWith('/operations-bancaires/rapprochement-cartes'));
    expect(req.request.method).toBe('GET');
    req.flush({ operationsExaminees: 78, piecesExaminees: 31, operationsSansMatch: 78, propositions: [] });
  });
  it('la confirmation transmet explicitement la pièce, le tiers et les consentements', () => {
    const demande = { factureId: 10, tiersConfirme: 7, confirmation: true, confirmerAffectation: true, confirmerDateAtypique: false };
    api.confirmerCarte(4, demande).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/operations-bancaires/4/rapprochement-carte'));
    expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(demande);
    req.flush({ operationsTraitees: 1, rapprochementsCrees: 1, propositionsCreees: 0, operationsSansMatch: 0, messages: [] });
  });
  it('le lot transmet les couples et consentements à la confirmation existante étendue', () => {
    const demande = { confirmation: true, lignes: [{ operationId: 4, demande: { factureId: 10,
      tiersConfirme: 7, confirmation: true, confirmerAffectation: true, confirmerDateAtypique: false } }] };
    api.confirmerCartes(demande).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/operations-bancaires/rapprochement-cartes/confirmer'));
    expect(req.request.method).toBe('POST');expect(req.request.body).toEqual(demande);
    req.flush({ reussis: 1, refuses: 0, conflits: 0, lignes: [] });
  });

  it('assistant : prévisualisation GET filtrée et confirmation POST distincte', () => {
    api.previsualiserAssistant('PIECES','CARTE',{tiersReconnu:'Impôt',operationIds:[1,2]}).subscribe();
    const r=http.expectOne(r=>r.url.endsWith('/operations-bancaires/assistant'));
    expect(r.request.method).toBe('GET');expect(r.request.params.get('tiersReconnu')).toBe('Impôt');expect(r.request.params.getAll('operationIds')).toEqual(['1','2']);
    r.flush({etape:'PIECES',lignes:[]});
    const demande={etape:'PIECES' as const,categorie:'CARTE',perimetre:{operationIds:[1]},confirmation:true,selections:[{operationId:1,candidatCle:'CREATION',pieceId:null,tiersId:59,montant:100,confirmerNature:false,verifierJustificatif:false,confirmerAffectation:false}]};
    api.confirmerAssistant(demande).subscribe();const p=http.expectOne(r=>r.url.endsWith('/operations-bancaires/assistant/confirmer'));
    expect(p.request.method).toBe('POST');expect(p.request.body).toEqual(demande);p.flush({reussis:1,lignes:[]});
  });

  it('charge le tiers créé avec son identité et ses rôles via le GET existant', () => {
    let tiers:unknown;api.obtenirTiersAssistant(21).subscribe(t=>tiers=t);
    const r=http.expectOne(req=>req.url.endsWith('/api/tiers/21'));expect(r.request.method).toBe('GET');
    r.flush({id:21,prenom:'Alice',nom:'Merove',roles:['SALARIE'],actif:true});
    expect(tiers).toEqual(expect.objectContaining({id:21,libelle:'Alice Merove',roles:['SALARIE'],actif:true}));
  });

});
