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
});
