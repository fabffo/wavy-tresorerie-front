import { restaurerFiltresEcheances, memoriserFiltresEcheances } from '../../../shared/filters/echeances-filters';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, forkJoin, firstValueFrom } from 'rxjs';

import { TresorerieApiService } from '../../../core/services/tresorerie-api.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { WavyShellBridgeService } from '../../../core/services/wavy-shell-bridge.service';
import { getHttpErrorMessage } from '../../../shared/http/http-error-message';
import {
  PropositionCarte, BrouillonIdentification, TiersIdentification, RegleBancaireIdentification,
  EtapeAssistant, ApercuAssistant, LigneAssistant, CandidatAssistant, ChoixAssistant, ConfirmationAssistant, BilanAssistant, TiersAssistant,
  ConfirmationCartesResultat,
  PropositionsCarteResultat,
  BalanceAgee,
  CompteBancaire,
  CompteBancairePayload,
  DashboardTresorerie,
  FactureEcheance,
  FiltresEcheances,
  KpiEcheances,
  FactureCandidateRapprochement,
  ImportReleve,
  ImportReleveResultat,
  FiltresOperations, CompteursOperations, DetailOperation, StatutConsultation,
  NatureOperationBancaire,
  OperationBancaire,
  OperationBancairePayload,
  OperationBancaireSortBy,
  PieceRapprochement,
  RapprochementBancaire,
  RegleRapprochement,
  SortDirection,
  StatutClassificationOperation,
  TypeFactureRapprochement,
  TypeOperationBancaire,
  TypeTiersReconnu,
} from '../models/tresorerie.model';

type OngletTresorerie =
  | 'dashboard'
  | 'comptes'
  | 'imports'
  | 'operations'
  | 'rapprochements'
  | 'pieces-rapprochement'
  | 'factures-echeances'
  | 'balance-agee'
  | 'previsionnel';

type ModeCompte = 'liste' | 'creation' | 'modification' | 'detail';
type ModeOperation = 'liste' | 'creation' | 'modification';
type ChampCompte = 'nomCompte' | 'banque' | 'iban' | 'bic' | 'devise' | 'soldeInitial' | 'dateSoldeInitial' | 'actif';
type ChampOperation =
  | 'compteBancaireId'
  | 'dateOperation'
  | 'libelle'
  | 'sens'
  | 'montant'
  | 'typeOperation'
  | 'natureOperation'
  | 'statutClassification'
  | 'statutRapprochement';

class ErreurMotifBancaire extends Error {}

@Component({
  selector: 'app-tresorerie-page',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './tresorerie.page.html',
  styleUrl: './tresorerie.page.css',
})
export class TresoreriePage implements OnInit {
  private readonly api = inject(TresorerieApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contexteService = inject(ContexteService);
  private readonly shellBridge = inject(WavyShellBridgeService);

  constructor() {
    effect(() => { if (this.contexteService.changementSociete() > 0) this.charger(); });
    effect(() => { this.filtresOperations(); this.contexteService.societeCouranteId(); this.invaliderAssistant(); });
  }

  readonly onglet = signal<OngletTresorerie>('dashboard');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly dashboard = signal<DashboardTresorerie | null>(null);
  readonly comptes = signal<CompteBancaire[]>([]);
  readonly compteSelectionne = signal<CompteBancaire | null>(null);
  readonly modeCompte = signal<ModeCompte>('liste');
  readonly propositionsCartes = signal<PropositionsCarteResultat | null>(null);
  private contexteCartes: string | null = null;
  readonly selectionCartes = signal<Set<string>>(new Set());
  readonly recapitulatifCartes = signal<PropositionCarte[]>([]);
  readonly bilanCartes = signal<ConfirmationCartesResultat | null>(null);
  readonly reprisesCartes = signal<PropositionCarte[]>([]);
  readonly cartesSelectionnees = computed(() => (this.propositionsCartes()?.propositions ?? [])
    .filter(p => this.selectionCartes().has(this.cleCarte(p))));

  readonly operations = signal<OperationBancaire[]>([]);
  readonly operationSelectionnee = signal<OperationBancaire | null>(null);
  readonly modeOperation = signal<ModeOperation>('liste');
  readonly filtresOperations = signal<FiltresOperations>({});
  readonly pageOperations = signal(1);
  readonly taillePageOperations = signal(10);
  readonly totalOperations = signal(0);
  readonly totalPagesOperations = signal(1);
  readonly triOperations = signal<{ sortBy: OperationBancaireSortBy; sortDirection: SortDirection }>({
    sortBy: 'dateOperation',
    sortDirection: 'DESC',
  });
  readonly imports = signal<ImportReleve[]>([]);
  readonly fichierImport = signal<File | null>(null);
  readonly resultatImport = signal<ImportReleveResultat | null>(null);
  readonly compteImportId = signal<number | null>(null);
  readonly rapprochements = signal<RapprochementBancaire[]>([]);
  readonly piecesRapprochement = signal<PieceRapprochement[]>([]);
  readonly regles = signal<RegleRapprochement[]>([]);
  readonly factures = signal<FactureEcheance[]>([]);
  readonly kpisEcheances = signal<KpiEcheances | null>(null);
  readonly filtresEcheances = signal<FiltresEcheances>(restaurerFiltresEcheances(sessionStorage));
  readonly totalFactures = signal(0);
  readonly vuesEcheances = ['TOUTES', 'A_ENCAISSER', 'A_PAYER', 'EN_RETARD', 'PARTIELLEMENT_PAYEE'] as const;
  readonly vueEcheances = signal<(typeof this.vuesEcheances)[number]>('TOUTES');
  readonly balance = signal<BalanceAgee | null>(null);
  readonly operationRapprochementManuel = signal<OperationBancaire | null>(null);
  readonly candidatesRapprochement = signal<Array<FactureCandidateRapprochement & { selectionnee: boolean; montantRapproche: number }>>([]);

  readonly etapesAssistant: Array<{ id: EtapeAssistant; libelle: string }> = [
    { id: 'TIERS', libelle: 'Tiers' },
    { id: 'SALAIRES', libelle: 'Salariés' },
    { id: 'CLIENTS', libelle: 'Clients' },
    { id: 'FOURNISSEURS', libelle: 'Fournisseurs' },
  ];
  readonly etapeAssistant = signal<EtapeAssistant>('TIERS');
  readonly pageResultatsAssistant = signal(1);
  readonly precedentePage = (page: number) => Math.max(1,page-1);
  readonly suivantePage = (page: number) => page+1;
  private tiersRetourAssistant: number | null = null;
  private detailAttenduAssistant: number | null = null;
  readonly categorieAssistant = signal('CARTE');
  readonly porteeAssistant = signal<'FILTRES' | 'PAGE'>('FILTRES');
  readonly operationAssistant = signal<number | null>(null);
  readonly apercuAssistant = signal<ApercuAssistant | null>(null);
  readonly detailAssistant = signal<LigneAssistant | null>(null);
  readonly menuOperation = signal<number | null>(null);
  readonly compteursOperations = signal<CompteursOperations | null>(null);
  readonly detailOperation = signal<DetailOperation | null>(null);
  readonly choixImport = signal('dernier');
  readonly statutsConsultation = {
    RAPPROCHEE: 'Rapprochée', NON_RAPPROCHEE: 'Non rapprochée',
    PARTIELLE: 'Partielle', TIERS_IDENTIFIE: 'Tiers identifié',
  };
  readonly colonnesOperations: Array<{ cle: OperationBancaireSortBy; libelle: string }> = [
    { cle: 'dateOperation', libelle: 'Date opération' },
    { cle: 'libelle', libelle: 'Libellé' },
    { cle: 'tiersReconnu', libelle: 'Tiers' },
    { cle: 'numeroPieceAssociee', libelle: 'Pièce associée' },
    { cle: 'natureOperation', libelle: 'Nature' },
    { cle: 'montantSigne', libelle: 'Montant' },
    { cle: 'statutConsultation', libelle: 'Statut' },
  ];
  readonly ambiguitesTiers = computed(() => this.apercuAssistant()?.lignes.filter(l =>
    !l.bloquee && l.candidats.length > 0 && !l.candidats.some(c => c.sur)).length ?? 0);
  readonly sansCorrespondanceTiers = computed(() => this.apercuAssistant()?.lignes.filter(l => !l.candidats.length).length ?? 0);
  readonly aPropositionCertaine = computed(() => this.apercuAssistant()?.lignes.some(l =>
    !l.bloquee && l.candidats.length === 1 && l.candidats[0].sur && !l.candidats[0].carte?.conflit) ?? false);

  nomImportOperation(operation: OperationBancaire): string {
    if (!operation.importReleveBancaireId) return 'Saisie manuelle';
    const releve = this.imports().find(i => i.id === operation.importReleveBancaireId);
    return releve ? releve.nomFichier : `Import n° ${operation.importReleveBancaireId}`;
  }

  readonly valeursStatutConsultation = Object.keys(this.statutsConsultation) as StatutConsultation[];

  statutConsultation(op: OperationBancaire): StatutConsultation {
    const rapproche = op.montantRapproche ?? 0;
    const montant = Math.abs(op.sens === 'DEBIT' ? op.debit ?? op.montant : op.montant);
    if (rapproche > 0) return rapproche >= montant ? 'RAPPROCHEE' : 'PARTIELLE';
    return op.tiersId ? 'TIERS_IDENTIFIE' : 'NON_RAPPROCHEE';
  }

  pieceAssociee(op: OperationBancaire): string {
    return op.numeroPieceAssociee || op.documentAssocieNumero || this.referencePieceHistorique(op) || '—';
  }

  referencePieceHistorique(piece: OperationBancaire | RapprochementBancaire): string {
    if (piece.factureId) return `Facture n° ${piece.factureId}`;
    if (piece.salaireId) return `Paie n° ${piece.salaireId}`;
    return piece.pieceRapprochementId ? `Pièce n° ${piece.pieceRapprochementId}` : '';
  }

  private filtresConsultation(): FiltresOperations {
    const choix = this.choixImport();
    const importId = choix === 'tous' ? undefined : choix === 'dernier' ? String(this.imports()[0]?.id ?? 0) : choix;
    return { ...this.filtresOperations(), importId };
  }

  changerImport(choix: string): void {
    this.choixImport.set(choix);
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  readonly operationConsultee = signal<OperationBancaire | null>(null);
  readonly reglesProposeesAssistant = signal<Record<number,{memoriser:boolean;motif:string;tiersId?:number}>>({});
  readonly choixAssistant = signal<Array<{ ligne: LigneAssistant; candidat: CandidatAssistant; choix: ChoixAssistant }>>([]);
  readonly recapAssistant = signal<ConfirmationAssistant | null>(null);
  readonly tiersConfirmesAssistant = signal<Array<{ id: number; nom: string; operation: number; libelle: string; memoriser?: boolean; motif?: string }>>([]);
  readonly bilanAssistant = signal<BilanAssistant | null>(null);
  readonly repriseAssistant = signal<ConfirmationAssistant | null>(null);
  readonly tiersManuelsAssistant = signal<TiersAssistant[]>([]);
  readonly rechercheTiersAssistant = signal('');
  private contexteApercuAssistant: string | null = null;
  private contexteRepriseAssistant: string | null = null;
  private sequenceAssistant = 0;

  invaliderAssistant(): void {
    this.sequenceIdentification++;this.identification.set(null);
    this.sequenceAssistant++; this.pageResultatsAssistant.set(1); this.menuOperation.set(null); this.operationConsultee.set(null); this.reglesProposeesAssistant.set({}); this.detailAttenduAssistant=null;
    this.apercuAssistant.set(null); this.detailAssistant.set(null); this.choixAssistant.set([]);
    this.recapAssistant.set(null); this.bilanAssistant.set(null); this.repriseAssistant.set(null); this.tiersConfirmesAssistant.set([]);
    this.tiersManuelsAssistant.set([]); this.contexteApercuAssistant = null; this.contexteRepriseAssistant = null;
  }

  private perimetreAssistant() {
    const id = this.operationAssistant();
    const operationIds = id ? [id] : this.porteeAssistant() === 'PAGE' ? this.operationsPage().map(o => o.id) : undefined;
    return { ...this.filtresConsultation(), operationIds, consultation: true };
  }

  private cleAssistant(avecPage = true): string {
    return JSON.stringify([this.cleContexteCartes(), this.etapeAssistant(), this.categorieAssistant(), this.porteeAssistant(), this.operationAssistant(), avecPage ? this.perimetreAssistant() : this.filtresConsultation()]);
  }

  ouvrirAssistant(operation?: OperationBancaire): void {
    if (this.loading()) return;
    this.operationAssistant.set(operation?.id ?? null);
    this.etapeAssistant.set(!operation?.tiersId ? 'TIERS' : operation.natureOperation === 'SALAIRE' ? 'SALAIRES'
      : operation.natureOperation === 'NOTE_DE_FRAIS' ? 'NOTES_FRAIS' : operation.sens === 'CREDIT' ? 'CLIENTS' : 'FOURNISSEURS');
    this.invaliderAssistant();
  }

  changerEtapeAssistant(etape: EtapeAssistant): void {
    if (this.loading() || (etape !== 'TIERS' && this.compteursOperations()?.sansTiers !== 0)) return;
    this.operationAssistant.set(null);
    this.porteeAssistant.set('FILTRES');
    this.etapeAssistant.set(etape);
    this.invaliderAssistant();
    this.previsualiserAssistant();
  }

  naviguerAssistant(delta: number): void {
    const index = this.etapesAssistant.findIndex(e => e.id === this.etapeAssistant());
    const etape = this.etapesAssistant[index + delta]; if (etape) this.changerEtapeAssistant(etape.id);
  }

  previsualiserAssistant(conserverBilan = false,pageCible=1): void {
    if (this.loading()) return;
    if (this.porteeAssistant() === 'PAGE' && !this.operationAssistant() && !this.operationsPage().length) {
      this.invaliderAssistant(); this.error.set('Cette page ne contient aucune opération à analyser.'); return;
    }
    const contexte = this.cleAssistant(); const sequence = ++this.sequenceAssistant;
    this.choixAssistant.set([]); this.recapAssistant.set(null); this.detailAssistant.set(null); this.apercuAssistant.set(null);
    if (!conserverBilan) this.bilanAssistant.set(null);
    this.loading.set(true); this.error.set(null);
    this.api.previsualiserAssistant(this.etapeAssistant(), this.categorieAssistant(), this.perimetreAssistant()).subscribe({
      next: reponse => {
        if (sequence !== this.sequenceAssistant || contexte !== this.cleAssistant()) return;
        const apercu=this.apercuDisponible(reponse);
        this.contexteApercuAssistant = contexte; this.apercuAssistant.set(apercu); this.pageResultatsAssistant.set(Math.min(pageCible,this.totalPagesResultatsAssistant()));
        const attente=this.detailAttenduAssistant;this.detailAttenduAssistant=null;
        const detail=apercu.lignes.find(l=>l.operation.id===attente);if(detail)this.examinerOperation(detail);
        const retour=this.tiersRetourAssistant; const operation=this.operationAssistant();
        const ligne=apercu.lignes.find(l => l.operation.id===operation);
        if (retour && ligne && this.etapeAssistant()==='TIERS') {
          this.tiersRetourAssistant=null;
          this.api.obtenirTiersAssistant(retour).subscribe({next: tiers => {
            if (contexte===this.cleAssistant() && tiers.actif!==false) this.choisirTiersManuelAssistant(ligne,tiers,false);
          },error: e => { if(contexte===this.cleAssistant()) this.error.set(getHttpErrorMessage(e)); }});
        }
      },
      error: e => { if (contexte === this.cleAssistant()) this.error.set(getHttpErrorMessage(e)); this.loading.set(false); },
      complete: () => this.loading.set(false),
    });
  }

  private apercuDisponible(apercu: ApercuAssistant): ApercuAssistant {
    const lignes=apercu.lignes.filter(l=>!this.operationAssistant() || l.operation.id===this.operationAssistant()).filter(l => this.etapeAssistant() === 'TIERS' || this.statutConsultation(l.operation) !== 'RAPPROCHEE' && l.operation.statutRapprochement !== 'IGNOREE')
      .filter(l=>this.etapeAssistant()!=='TIERS' || !l.operation.tiersId);
    return {...apercu,lignes,eligibles:lignes.filter(l=>!l.bloquee && l.candidats.length>0).length,
      propositions:lignes.reduce((n,l)=>n+l.candidats.length,0),anomalies:lignes.filter(l=>l.anomalies.length || l.candidats.some(c=>c.avertissements.length)).length,restantes:lignes.length};
  }
  montantSigne(operation: OperationBancaire): number { return operation.sens==='DEBIT' ? -Math.abs(operation.debit || operation.montant) : Math.abs(operation.credit || operation.montant); }
  basculerActions(id:number): void { this.menuOperation.set(this.menuOperation()===id ? null : id); }
  operationDisponible(op:OperationBancaire): boolean { return !op.rapprochee && !['RAPPROCHEE','IGNOREE'].includes(op.statutRapprochement); }
  operationModifiable(op:OperationBancaire): boolean { return !op.rapprochee && op.statutRapprochement!=='RAPPROCHEE' && !this.ligneAssistant(op.id)?.bloquee; }
  propositionSure(ligne:LigneAssistant): CandidatAssistant|null {
    if (ligne.bloquee || !this.operationDisponible(ligne.operation) || this.etapeAssistant()==='PIECES') return null;
    return ligne.candidats.length===1 && ligne.candidats[0].sur && !ligne.candidats[0].carte?.conflit ? ligne.candidats[0] : null;
  }
  examinerOperation(ligne:LigneAssistant): void { if(this.etapeAssistant()==='TIERS'){this.ouvrirValidationTiers(ligne);return;} this.menuOperation.set(null);this.operationConsultee.set(null);this.detailAssistant.set(ligne);this.tiersManuelsAssistant.set([]); }
  preparerLigne(ligne:LigneAssistant,candidat:CandidatAssistant): void {
    this.choixAssistant.set([]);this.selectionnerAssistant(ligne,candidat,true);this.preparerAssistant();
  }
  identifierTiersOperation(op:OperationBancaire): void {
    if(this.loading() || !this.operationModifiable(op)) return;
    this.operationAssistant.set(op.id);this.etapeAssistant.set('TIERS');this.operationAssistant.set(null);this.invaliderAssistant();this.detailAttenduAssistant=op.id;this.previsualiserAssistant();
  }
  examinerSansApercu(op:OperationBancaire): void { this.operationAssistant.set(op.id);this.invaliderAssistant();this.detailAttenduAssistant=op.id;this.previsualiserAssistant(); }
  creerTiersPourOperation(ligne:LigneAssistant): void { this.ouvrirValidationTiers(ligne); }
  revenirPerimetreFiltre(): void { this.operationAssistant.set(null);this.invaliderAssistant();this.previsualiserAssistant(); }
  changerTailleResultats(value:string): void { const size=Number(value);if([10,25,50,100].includes(size)){this.taillePageOperations.set(size);this.pageResultatsAssistant.set(1);} }

  estSelectionAssistant(ligne: LigneAssistant, candidat: CandidatAssistant): boolean {
    return this.choixAssistant().some(s => s.choix.operationId === ligne.operation.id && s.choix.candidatCle === candidat.cle);
  }

  selectionnerAssistant(ligne: LigneAssistant, candidat: CandidatAssistant, selectionner: boolean): void {
    if (this.loading() || ligne.bloquee || this.contexteApercuAssistant !== this.cleAssistant()) return;
    const autres = this.choixAssistant().filter(s => !(s.choix.operationId === ligne.operation.id && s.choix.candidatCle === candidat.cle));
    if (!selectionner) { this.choixAssistant.set(autres); this.recapAssistant.set(null); return; }
    if (candidat.pieceId && autres.some(s => s.choix.pieceId === candidat.pieceId && s.candidat.typePiece === candidat.typePiece && s.choix.operationId !== ligne.operation.id)) {
      this.error.set('Cette pièce est déjà sélectionnée sur une autre opération.'); return;
    }
    if(this.etapeAssistant()==='TIERS') {
      const autresOperations:typeof autres=[];
      this.choixAssistant.set(autresOperations);
      autres.splice(0,autres.length,...autresOperations);
    }
    const uneOperation = !candidat.sur;
    if (autres.some(s => (uneOperation || !s.candidat.sur) && s.choix.operationId !== ligne.operation.id)) {
      this.error.set('Cette proposition doit être confirmée individuellement.'); return;
    }
    if (autres.some(s => s.choix.operationId === ligne.operation.id
      && (this.etapeAssistant() === 'TIERS' || this.etapeAssistant() === 'NOTES_FRAIS'
        || candidat.cle.startsWith('C:') || s.candidat.cle.startsWith('C:')
        || candidat.cle === 'CREATION' || s.candidat.cle === 'CREATION'))) {
      this.error.set('Choisissez une seule correspondance pour cette opération.'); return;
    }
    this.choixAssistant.set([...autres, { ligne, candidat, choix: { operationId: ligne.operation.id,
      candidatCle: candidat.cle, pieceId: candidat.pieceId, tiersId: candidat.tiersId, montant: candidat.montantPropose,
      confirmerNature: false, verifierJustificatif: false, confirmerAffectation: candidat.carte?.affectationRequise ?? false,
    } }]);
    if (candidat.typePiece==='TIERS') {
      if (!candidat.sur || candidat.cle.startsWith('MANUEL:')) {
        const precedente=this.reglesProposeesAssistant()[ligne.operation.id];
        if (!precedente || precedente.tiersId!==candidat.tiersId) this.reglesProposeesAssistant.update(r=>({...r,[ligne.operation.id]:{memoriser:true,motif:this.proposerMotifBancaire(ligne.operation.libelle,candidat.nomTiers),tiersId:candidat.tiersId}}));
      } else this.reglesProposeesAssistant.update(r=>{const copie={...r};delete copie[ligne.operation.id];return copie;});
    }
    this.recapAssistant.set(null); this.error.set(null);
  }

  modifierChoixAssistant(operationId: number, cle: string, champ: 'montant' | 'confirmerNature' | 'verifierJustificatif' | 'confirmerAffectation', valeur: number | boolean): void {
    if (this.loading()) return;
    this.choixAssistant.update(ss => ss.map(s => s.choix.operationId === operationId && s.choix.candidatCle === cle
      ? { ...s, choix: { ...s.choix, [champ]: valeur } } : s)); this.recapAssistant.set(null);
  }

  selectionnerSuresAssistant(): void {
    this.choixAssistant.set([]);
    for (const ligne of this.apercuAssistant()?.lignes ?? []) {
      if (ligne.bloquee || !this.operationDisponible(ligne.operation) || ligne.candidats.length !== 1) continue;
      const sures = ligne.candidats.filter(c => c.sur && !c.carte?.conflit);
      if (sures.length === 1) this.selectionnerAssistant(ligne, sures[0], true);
      if (this.choixAssistant().length === 200) break;
    }
  }

  preparerAssistant(automatique = false): void {
    if (this.loading() || this.contexteApercuAssistant !== this.cleAssistant()) return;
    if(this.etapeAssistant()==='TIERS') {
      const choix=this.choixAssistant();
      if(choix.length!==1){this.error.set('Choisissez un seul tiers pour cette opération.');return;}
      this.ouvrirValidationTiers(choix[0].ligne,choix[0].candidat.tiersId);return;
    }
    if (automatique) this.selectionnerSuresAssistant();
    const selections = this.choixAssistant();
    if (!selections.length) { this.error.set('Sélectionnez une proposition.'); return; }
    if (selections.length > 200) { this.error.set('Affinez le périmètre : 200 lignes maximum par confirmation.'); return; }
    if (this.etapeAssistant() !== 'PIECES' && selections.some(s => s.candidat.cle !== 'CREATION' && s.candidat.avertissements.length && !s.choix.verifierJustificatif)) {
      this.error.set('Vérifiez explicitement les avertissements et justificatifs des lignes sélectionnées.'); return;
    }
    if (selections.some(s => s.candidat.typePiece !== 'TIERS' && (!(s.choix.montant > 0) || s.choix.montant > s.candidat.montantPropose))) {
      this.error.set('Le montant doit rester positif et dans les soldes disponibles.'); return;
    }
    for (const id of new Set(selections.map(s => s.choix.operationId))) {
      const lignes = selections.filter(s => s.choix.operationId === id);
      const operation = lignes[0].ligne.operation;
      const plafond = Math.max(0, Math.abs(this.montantSigne(operation)) - (operation.montantRapproche ?? 0));
      if (lignes.reduce((s,l) => s + l.choix.montant,0) > plafond + 0.000001) {
        this.error.set('La sélection dépasse le montant bancaire ; réduisez les affectations.'); return;
      }
    }
    this.detailAssistant.set(null); this.menuOperation.set(null);
    this.recapAssistant.set({ etape: this.etapeAssistant(), categorie: this.categorieAssistant(), perimetre: this.perimetreAssistant(),
      confirmation: true, selections: selections.map(s => ({ ...s.choix })) });
  }

  confirmerAssistant(): void {
    const demande = this.recapAssistant();
    if (!demande || this.loading() || this.contexteApercuAssistant !== this.cleAssistant()) return;
    const contexte = this.cleAssistant(); const contexteVue=this.cleAssistant(false);
    if (demande.etape==='TIERS' && demande.selections.some(c=>{const r=this.reglesProposeesAssistant()[c.operationId];return r?.memoriser && !this.motifBancaireValide(r.motif);})) {
      this.error.set('Choisissez un motif bancaire distinctif, sans date ni référence variable, ou décochez sa mémorisation.');return;
    }
    const regles={...this.reglesProposeesAssistant()};
    this.loading.set(true); this.error.set(null); this.recapAssistant.set(null);
    this.api.confirmerAssistant(demande).subscribe({
      next: bilan => {
        if (contexte !== this.cleAssistant()) return;
        this.bilanAssistant.set(bilan);
        if (demande.etape === 'TIERS') this.tiersConfirmesAssistant.set(this.choixAssistant().filter(s => bilan.lignes.some(r => r.operationId === s.choix.operationId && r.statut === 'SUCCES'))
          .map(s => ({ id: s.choix.tiersId, nom: s.candidat.nomTiers, operation: s.choix.operationId, libelle:s.ligne.operation.libelle,memoriser:regles[s.choix.operationId]?.memoriser ?? false,motif:regles[s.choix.operationId]?.motif })));
        const selections = demande.selections.filter(s => bilan.lignes.some(r => r.operationId === s.operationId && r.statut === 'A_REPRENDRE'));
        this.repriseAssistant.set(selections.length ? { ...demande, selections } : null);
        this.contexteRepriseAssistant = contexte;
        this.chargerOperations(() => {
          this.loading.set(false);
          if (contexteVue===this.cleAssistant(false)) this.previsualiserAssistant(true);
        },true);
        this.api.dashboard().subscribe({ next: stats => this.dashboard.set(stats) });
        const memorisation=this.tiersConfirmesAssistant();
        if (demande.etape==='TIERS' && memorisation.length===1 && memorisation[0].memoriser && !bilan.refuses && !bilan.conflits && !bilan.aReprendre) {
          this.ouvrirTiersAssistant(memorisation[0].id,memorisation[0].operation,true);
        }
      },
      error: e => {
        this.loading.set(false); if (contexte !== this.cleAssistant()) return;
        this.repriseAssistant.set(demande); this.contexteRepriseAssistant = contexte;
        this.error.set(`${getHttpErrorMessage(e)} Résultat incertain : reprendre la même sélection, sans recréer de pièce.`);
      },
    });
  }

  preparerRepriseAssistant(): void {
    if (this.loading() || this.contexteRepriseAssistant !== this.cleAssistant()) return;
    this.contexteApercuAssistant = this.cleAssistant(); this.recapAssistant.set(this.repriseAssistant());
  }

  chercherTiersAssistant(query: string): void {
    this.rechercheTiersAssistant.set(query);
    if (query.trim().length < 2) { this.tiersManuelsAssistant.set([]); return; }
    const contexte = this.cleAssistant();
    this.api.rechercherTiersAssistant(query).subscribe({ next: tiers => {
      if (contexte === this.cleAssistant() && query === this.rechercheTiersAssistant()) this.tiersManuelsAssistant.set(tiers);
    }, error: e => this.error.set(getHttpErrorMessage(e)) });
  }

  choisirTiersManuelAssistant(ligne: LigneAssistant, tiers: TiersAssistant, selectionner = true): void {
    const type: TypeTiersReconnu = tiers.roles.includes('SALARIE') ? 'SALARIE' : tiers.roles.includes('CLIENT') ? 'CLIENT'
      : tiers.roles.some(r=>['FOURNISSEUR_SERVICES','PRESTATAIRE'].includes(r)) ? 'FOURNISSEUR_SERVICE' : tiers.roles.some(r=>['FOURNISSEUR_GENERAL','FOURNISSEUR','MARCHAND'].includes(r)) ? 'FOURNISSEUR'
      : tiers.roles.some(r => ['ORGANISME_FISCAL', 'ORGANISME_SOCIAL'].includes(r)) ? 'ADMINISTRATION' : 'AUTRE';
    const candidat: CandidatAssistant = { cle: `MANUEL:${tiers.id}`, tiersId: tiers.id, nomTiers: tiers.libelle, typeTiers: type,
      pieceId: null, numeroPiece: null, typePiece: 'TIERS', montantDisponible: 0, montantPropose: 0, datePiece: null, dateEcheance: null,
      sur: false, criteres: ['Choix manuel du référentiel'], avertissements: [], natureProposee: null, carte: null };
    const enrichie = { ...ligne, candidats: [...ligne.candidats.filter(c => c.cle !== candidat.cle), candidat] };
    this.detailAssistant.set(enrichie);
    this.apercuAssistant.update(a => a ? { ...a, lignes: a.lignes.map(l => l.operation.id === ligne.operation.id ? enrichie : l) } : a);
    if (selectionner) this.selectionnerAssistant(enrichie, candidat, true);
  }

  regleCertaine(ligne: LigneAssistant): CandidatAssistant | undefined {
    const candidates = ligne.candidats.filter(c => c.sur && c.typePiece === 'TIERS' && c.cle === `REGLE_BANCAIRE:${c.tiersId}`);
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  readonly identificationsCertaines = computed(() =>
    (this.apercuAssistant()?.lignes ?? [])
      .filter(ligne => !ligne.bloquee && !ligne.operation.tiersId)
      .flatMap(ligne => {
        const candidat = this.regleCertaine(ligne);
        return candidat ? [{ ligne, candidat }] : [];
      })
  );

  async identifierAutomatiquement():Promise<void> {
    if(this.etapeAssistant()!=='TIERS' || this.loading() || this.contexteApercuAssistant!==this.cleAssistant())return;
    const certaines=this.identificationsCertaines();if(!certaines.length)return;
    const contexte=this.cleAssistant();this.loading.set(true);this.error.set(null);this.bilanAssistant.set(null);
    const demande:ConfirmationAssistant={etape:'TIERS',categorie:'CARTE',confirmation:true,
      perimetre:this.perimetreAssistant(),
      selections:certaines.map(({ligne,candidat})=>({operationId:ligne.operation.id,candidatCle:candidat.cle,tiersId:candidat.tiersId,pieceId:null,
        montant:0,confirmerNature:false,verifierJustificatif:false,confirmerAffectation:false}))};
    try {
      const bilans: BilanAssistant[] = [];
      for (let debut = 0; debut < demande.selections.length && contexte === this.cleAssistant(); debut += 200) {
        bilans.push(await firstValueFrom(this.api.confirmerAssistant({
          ...demande, selections: demande.selections.slice(debut, debut + 200),
        })));
      }
      const bilan = bilans.reduce<BilanAssistant>((b, suivant) => ({
        reussis: b.reussis + suivant.reussis, refuses: b.refuses + suivant.refuses,
        conflits: b.conflits + suivant.conflits, aReprendre: b.aReprendre + suivant.aReprendre,
        lignes: [...b.lignes, ...suivant.lignes],
      }), { reussis: 0, refuses: 0, conflits: 0, aReprendre: 0, lignes: [] });
      if(contexte!==this.cleAssistant())return;
      this.bilanAssistant.set(bilan);
      const succes=new Map(certaines.filter(c=>bilan.lignes.some(r=>r.operationId===c.ligne.operation.id && r.statut==='SUCCES')).map(c=>[c.ligne.operation.id,c.candidat]));
      const actualiser=(op:OperationBancaire)=>{const c=succes.get(op.id);return c?{...op,tiersId:c.tiersId,tiersReconnu:c.nomTiers,typeTiersReconnu:c.typeTiers}:op;};
      this.operations.update(ops=>ops.map(actualiser));
      this.apercuAssistant.update(a=>a?this.apercuDisponible({...a,lignes:a.lignes.map(l=>({...l,operation:actualiser(l.operation),
        candidats:bilan.lignes.some(r=>r.operationId===l.operation.id && r.statut!=='SUCCES')?l.candidats.map(c=>({...c,sur:false})):l.candidats}))}):a);
      this.pageResultatsAssistant.set(Math.min(this.pageResultatsAssistant(),this.totalPagesResultatsAssistant()));
      if(succes.has(this.identification()?.operationId ?? 0))this.identification.set(null);
      this.choixAssistant.update(cs=>cs.filter(c=>!succes.has(c.choix.operationId)));
    }catch(e){if(contexte===this.cleAssistant())this.error.set('Identification non confirmée. Actualisez les propositions avant de reprendre. '+getHttpErrorMessage(e));}
    finally {
      if (contexte === this.cleAssistant()) this.chargerOperations(() => this.loading.set(false), true);
      else this.loading.set(false);
    }
  }

  readonly identification = signal<BrouillonIdentification|null>(null);
  readonly erreurIdentification = signal<string|null>(null);
  readonly erreurMotifIdentification = signal<string | null>(null);
  readonly rolesIdentification = signal<string[]>([]);
  readonly naturesOrganisationIdentification = signal<string[]>([]);
  readonly naturesPersonneIdentification = signal<string[]>([]);
  readonly doublonsIdentification = signal<TiersIdentification[]>([]);
  readonly reglesIdentification = signal<RegleBancaireIdentification[]>([]);
  readonly chargementIdentification = signal(false);
  private sequenceIdentification = 0;
  private motifIdentificationModifie = false;

  private contexteIdentification():string {
    return `${this.cleContexteCartes()}:${this.contexteService.utilisateurId?.() ?? ''}`;
  }
  private cleRepriseIdentification(operationId:number):string {
    return `wavy-identification:${this.contexteIdentification()}:${operationId}`;
  }
  private normaliserIdentification(v:string):string {
    return v.normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  }
  nomIdentification(t:TiersIdentification):string { return t.raisonSociale || [t.prenom,t.nom].filter(Boolean).join(' ') || t.nomNormalise || `Tiers ${t.id}`; }
  modifierIdentification(champ:keyof BrouillonIdentification,valeur:string):void {
    if(this.loading())return;
    if(champ==='motif') {
      this.motifIdentificationModifie = true;
      this.erreurMotifIdentification.set(null);
    }
    this.identification.update(d=>d ? {...d,[champ]:valeur} : d);this.erreurIdentification.set(null);
  }
  private regleCorrespondante(r:RegleBancaireIdentification,libelle:string):boolean {
    const texte=this.normaliserIdentification(libelle),motif=this.normaliserIdentification(r.motif);
    return !!motif && (r.typeMotif==='CONTIENT' ? texte.includes(motif) : texte===motif);
  }
  private verifierReglesIdentification(regles:RegleBancaireIdentification[],d:BrouillonIdentification,libelle:string):RegleBancaireIdentification|null {
    const motif=this.normaliserIdentification(d.motif);
    const adaptee=regles.find(r=>r.typeRegle==='OPERATION_BANCAIRE' && r.actif && r.tiersId===d.tiersId && this.normaliserIdentification(r.motif)===motif && this.regleCorrespondante(r,libelle));
    if(!adaptee && (!this.motifBancaireValide(d.motif) || !this.normaliserIdentification(libelle).includes(motif)))throw new ErreurMotifBancaire('Corrigez le motif : utilisez un nom distinctif présent dans le libellé, sans date ni référence variable.');
    const actives=regles.filter(r=>r.actif && r.typeRegle==='OPERATION_BANCAIRE');
    const conflit=actives.find(r=>r.tiersId!==d.tiersId && (this.regleCorrespondante(r,libelle)
      || (r.typeMotif==='CONTIENT' && (motif.includes(this.normaliserIdentification(r.motif)) || this.normaliserIdentification(r.motif).includes(motif)))));
    if(conflit && !adaptee)throw new ErreurMotifBancaire('Ce motif entre en conflit avec la règle d’un autre tiers. Précisez le motif ou corrigez la règle existante.');
    const equivalente=regles.find(r=>r.typeRegle==='OPERATION_BANCAIRE' && r.tiersId===d.tiersId && this.normaliserIdentification(r.motif)===motif && r.typeMotif==='CONTIENT');
    if(equivalente && !equivalente.actif)throw new ErreurMotifBancaire('Une règle équivalente est désactivée ; elle ne sera pas réactivée automatiquement.');
    return actives.find(r=>r.tiersId===d.tiersId && this.normaliserIdentification(r.motif)===motif && this.regleCorrespondante(r,libelle)) ?? null;
  }

  private motifDunAutreCandidat(motif:string,tiersId:number|null,ligne:LigneAssistant):boolean {
    const motifNormalise=this.normaliserIdentification(motif);
    if(!motifNormalise)return false;
    return ligne.candidats.some(c=>{
      if(c.tiersId===tiersId)return false;
      const nom=c.nomTiers.normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
      return this.normaliserIdentification(c.nomTiers).includes(motifNormalise)
        || (nom.length===2 && nom[0][0]+nom[1]===motifNormalise);
    });
  }

  ouvrirValidationTiers(ligne:LigneAssistant,tiersId?:number):void {
    const certaine = this.regleCertaine(ligne);
    if (this.loading() || ligne.bloquee || ligne.operation.tiersId || (certaine && certaine.tiersId !== tiersId)) return;
    const sequence=++this.sequenceIdentification,contexte=this.contexteIdentification();
    this.motifIdentificationModifie=false;
    this.erreurMotifIdentification.set(null);
    this.detailAssistant.set(null);this.menuOperation.set(null);this.erreurIdentification.set(null);this.doublonsIdentification.set([]);
    const candidat=ligne.candidats.find(c=>c.tiersId===tiersId);
    let reprise:{tiersId?:number;motif?:string;incertain?:boolean}|null=null;
    try {reprise=JSON.parse(sessionStorage.getItem(this.cleRepriseIdentification(ligne.operation.id)) || 'null');}
    catch {reprise={incertain:true};this.erreurIdentification.set('La reprise locale est illisible. Retrouvez la fiche existante avant de créer.');}
    const id=tiersId ?? reprise?.tiersId ?? null;
    const motifRepriseBrut=(!tiersId || tiersId===reprise?.tiersId)?reprise?.motif:undefined;
    const motifReprise=motifRepriseBrut && !this.motifDunAutreCandidat(motifRepriseBrut,id,ligne) ? motifRepriseBrut : undefined;
    const marchand = id ? '' : this.marchandDepuisPaiementCarte(ligne.operation.libelle);
    let motifPropose=motifReprise || marchand || this.proposerMotifBancaire(ligne.operation.libelle,candidat?.nomTiers ?? '');
    if(!motifReprise && this.motifDunAutreCandidat(motifPropose,id,ligne))motifPropose='';
    this.identification.set({operationId:ligne.operation.id,tiersId:id,nomTiers:candidat?.nomTiers ?? '',
      motif:motifPropose,nouveau:!id,
      typeTiers:'ORGANISATION',raisonSociale:marchand,nom:'',prenom:'',role:marchand ? 'MARCHAND' : '',
      nature:marchand ? 'ENTREPRISE' : '',nomCommercial:marchand,pieceRapprochementAutorisee:'non',actif:'oui',
      categorieMarchand:marchand ? 'AUTRE' : '',
      creationIncertaine:reprise?.incertain ?? false,tiersCree:!!reprise?.tiersId});
    this.chargementIdentification.set(true);
    this.api.reglesIdentification().subscribe({next:regles=>{
      if(sequence!==this.sequenceIdentification || contexte!==this.contexteIdentification())return;
      this.reglesIdentification.set(regles);
      const adaptee=regles.filter(r=>r.actif && r.typeRegle==='OPERATION_BANCAIRE' && r.tiersId===id && this.regleCorrespondante(r,ligne.operation.libelle) && !this.motifDunAutreCandidat(r.motif,id,ligne)).sort((a,b)=>b.motif.length-a.motif.length)[0];
      if(adaptee && !motifReprise && !this.motifIdentificationModifie)this.identification.update(d=>d && d.tiersId===id && d.motif===motifPropose ? {...d,motif:adaptee.motif} : d);
    },error:e=>{if(sequence===this.sequenceIdentification){this.erreurIdentification.set(getHttpErrorMessage(e));this.chargementIdentification.set(false);}},complete:()=>{if(sequence===this.sequenceIdentification)this.chargementIdentification.set(false);}});
    if(id && !candidat)this.api.lireTiersIdentification(id).subscribe({next:t=>{
      if(sequence===this.sequenceIdentification && contexte===this.contexteIdentification())this.identification.update(d=>d ? {...d,nomTiers:this.nomIdentification(t),motif:!motifReprise && !this.motifIdentificationModifie && d.motif===motifPropose ? this.proposerMotifBancaire(ligne.operation.libelle,this.nomIdentification(t)) : d.motif} : d);
    },error:e=>{if(sequence===this.sequenceIdentification)this.erreurIdentification.set(getHttpErrorMessage(e));}});
    if (!id) {
      forkJoin({
        roles: this.api.rolesIdentification(),
        organisations: this.api.naturesIdentification('organisation'),
        personnes: this.api.naturesIdentification('personne'),
      }).subscribe({
        next: ({ roles, organisations, personnes }) => {
          if (contexte !== this.contexteIdentification()) return;
          this.rolesIdentification.set(roles);
          this.naturesOrganisationIdentification.set(organisations);
          this.naturesPersonneIdentification.set(personnes);
        },
        error: e => { if (contexte === this.contexteIdentification()) this.erreurIdentification.set(getHttpErrorMessage(e)); },
      });
    }
  }

  choisirPropositionIdentification(ligne:LigneAssistant,candidat:CandidatAssistant):void {
    if(this.loading() || ligne.bloquee || !ligne.candidats.some(c=>c.tiersId===candidat.tiersId && c.cle===candidat.cle))return;
    this.selectionnerAssistant(ligne,candidat,true);this.ouvrirValidationTiers(ligne,candidat.tiersId);
  }
  hypothesesIdentification(ligne:LigneAssistant):Array<{type:'ORGANISATION'|'PERSONNE_PHYSIQUE';nom:string;prenom:string}> {
    const libelle=ligne.operation.libelle;
    const contrepartie=libelle.match(/\b(?:vers|pour)\s+(.+)/iu)?.[1] ?? libelle.replace(/^(?:(?:VIREMENT(?: [ÉE]MIS)?|VIR|INST|SEPA|PAIEMENT|CARTE|CB|PRLV)[\s:-]*)+/i,'');
    const organisation=contrepartie.match(/^([\p{L}\p{N}][\p{L}\p{N} .'&-]*?\b(?:SASU|SAS|SARL|SA|LTD|LIMITED))\b/iu)?.[1];
    const personne=libelle.match(/\b(?:M\.|Mme\.?\s+|Mr\.?\s+|Monsieur\s+|Madame\s+)\s*([\p{L}][\p{L}'’-]+)/iu);
    const propositions:Array<{type:'ORGANISATION'|'PERSONNE_PHYSIQUE';nom:string;prenom:string}>=[];
    if(organisation)propositions.push({type:'ORGANISATION',nom:organisation.trim(),prenom:''});
    else if(/\b[A-Z0-9-]+\.[A-Z]{2,}\b/i.test(libelle))propositions.push({type:'ORGANISATION',nom:this.proposerMotifBancaire(libelle),prenom:''});
    if(personne)propositions.push({type:'PERSONNE_PHYSIQUE',nom:personne[1],prenom:''});
    return propositions;
  }
  choisirHypotheseIdentification(p:{type:'ORGANISATION'|'PERSONNE_PHYSIQUE';nom:string;prenom:string}):void {
    this.identification.update(d=>d ? {...d,typeTiers:p.type,raisonSociale:p.type==='ORGANISATION'?p.nom:'',nom:p.type==='PERSONNE_PHYSIQUE'?p.nom:'',prenom:p.prenom,motif:p.type==='ORGANISATION'?p.nom.toUpperCase():p.nom.toUpperCase()} : d);
  }
  choisirExistantIdentification(t:TiersIdentification):void {
    const ligne=this.ligneAssistant(this.identification()?.operationId ?? 0);if(!ligne || t.actif===false)return;
    this.choixAssistant.set([]);
    this.ouvrirValidationTiers({...ligne,candidats:[...ligne.candidats,{...ligne.candidats[0],tiersId:t.id,nomTiers:this.nomIdentification(t)} as CandidatAssistant]},t.id);
    // Un choix explicite remplace une création incertaine retrouvée ; aucune création supplémentaire.
    this.identification.update(d=>d ? {...d,tiersId:t.id,nomTiers:this.nomIdentification(t),nouveau:false,creationIncertaine:false} : d);
  }
  private sauvegarderRepriseIdentification(d:BrouillonIdentification,incertain:boolean):void {
    sessionStorage.setItem(this.cleRepriseIdentification(d.operationId),JSON.stringify({tiersId:d.tiersId,motif:d.motif,incertain}));
  }
  async retrouverIdentification():Promise<void> {
    const d=this.identification();if(!d || this.loading())return;
    const contexte=this.contexteIdentification();this.chargementIdentification.set(true);
    try {
      const tiers=await firstValueFrom(this.api.listerTiersIdentification(d.raisonSociale || [d.prenom,d.nom].filter(Boolean).join(' ') || d.motif));
      if(contexte===this.contexteIdentification())this.doublonsIdentification.set(tiers);
    }catch(e){this.erreurIdentification.set(getHttpErrorMessage(e));}finally{this.chargementIdentification.set(false);}
  }
  async validerIdentification():Promise<void> {
    const initial=this.identification();if(!initial || this.loading() || this.chargementIdentification())return;
    const d={...initial},contexte=this.contexteIdentification(),vue=this.cleAssistant();
    const verifier=()=>{if(!this.contexteService.tenantId() || !this.contexteService.societeCouranteId() || !this.contexteService.utilisateurId?.())throw new Error('Contexte utilisateur incomplet.');if(contexte!==this.contexteIdentification() || vue!==this.cleAssistant() || this.etapeAssistant()!=='TIERS')throw new Error('Le contexte ou la société a changé. Revenez à l’opération.');};
    this.loading.set(true);this.erreurIdentification.set(null);
    this.erreurMotifIdentification.set(null);
    try {
      verifier();
      if (!d.tiersId && d.actif === 'non') throw new Error('Activez le nouveau tiers pour l’associer à cette opération.');
      if(d.creationIncertaine && !d.tiersId)throw new Error('La création a pu réussir. Retrouvez et sélectionnez sa fiche avant de reprendre.');
      const apercu=await firstValueFrom(this.api.previsualiserAssistant('TIERS','CARTE',{...this.filtresConsultation(),operationIds:[d.operationId]}));verifier();
      const ligne=apercu.lignes.find(l=>l.operation.id===d.operationId);
      if(!ligne || ligne.bloquee)throw new Error('Cette opération n’est plus disponible.');
      if(ligne.operation.tiersId && ligne.operation.tiersId!==d.tiersId)throw new Error('Cette opération possède déjà un autre tiers. Actualisez les propositions.');
      const certaine = this.regleCertaine(ligne);
      if (certaine && certaine.tiersId !== d.tiersId) {
        throw new Error('Une règle bancaire certaine identifie déjà ce tiers. Actualisez les propositions.');
      }
      if (certaine) {
        if (this.motifIdentificationModifie && (!this.motifBancaireValide(d.motif)
            || !this.normaliserIdentification(ligne.operation.libelle).includes(this.normaliserIdentification(d.motif)))) {
          throw new ErreurMotifBancaire('Corrigez le motif : utilisez un nom distinctif présent dans le libellé, sans date ni référence variable.');
        }
        d.nomTiers = certaine.nomTiers;
      } else {
        const regles=await firstValueFrom(this.api.reglesIdentification());verifier();
        let regle=this.verifierReglesIdentification(regles,d,ligne.operation.libelle);
        if(!regle && ligne.candidats.some(c=>c.tiersId!==d.tiersId && this.normaliserIdentification(c.nomTiers).includes(this.normaliserIdentification(d.motif))))throw new ErreurMotifBancaire('Ce motif pourrait reconnaître plusieurs tiers proposés. Précisez-le avant validation.');
        if(!d.tiersId) {
          const natures = d.typeTiers === 'ORGANISATION' ? this.naturesOrganisationIdentification() : this.naturesPersonneIdentification();
          if(!natures.includes(d.nature) || !d.role || !this.rolesIdentification().includes(d.role) || (d.typeTiers==='ORGANISATION'?!d.raisonSociale.trim():!d.nom.trim() || !d.prenom.trim()) || (d.role==='MARCHAND' && !d.categorieMarchand))throw new Error('Complétez le nom, le type, le rôle et les informations obligatoires.');
          const nom=d.typeTiers==='ORGANISATION'?d.raisonSociale.trim():[d.prenom.trim(),d.nom.trim()].join(' ');
          const doublons=await firstValueFrom(this.api.listerTiersIdentification(nom));verifier();
          if(doublons.length){this.doublonsIdentification.set(doublons);throw new Error('Une fiche peut déjà correspondre. Sélectionnez-la ou précisez l’identité.');}
          this.sauvegarderRepriseIdentification(d,true);this.identification.update(x=>x?{...x,creationIncertaine:true}:x);
          let tiers:TiersIdentification;
          try {tiers=await firstValueFrom(this.api.creerTiersIdentification({typeTiers:d.typeTiers,roles:[d.role], actif: d.actif === 'oui', pieceRapprochementAutorisee: d.pieceRapprochementAutorisee === 'oui',
            ...(d.typeTiers==='ORGANISATION'?{raisonSociale:d.raisonSociale.trim(),natureOrganisation:d.nature,nomCommercial:d.nomCommercial.trim() || d.raisonSociale.trim()}:{nom:d.nom.trim(),prenom:d.prenom.trim(),naturePersonne:d.nature}),
            ...(d.role==='MARCHAND'?{categorieMarchand:d.categorieMarchand}:{}),}));}
          catch(e){if(e instanceof HttpErrorResponse && [400,401,403,404,422].includes(e.status)){this.sauvegarderRepriseIdentification(d,false);this.identification.update(x=>x?{...x,creationIncertaine:false}:x);}throw e;}
          // Conserver l’ID avant tout autre appel, même si le contexte vient de changer.
          d.tiersId=tiers.id;d.nomTiers=this.nomIdentification(tiers);d.tiersCree=true;d.creationIncertaine=false;
          if(contexte===this.contexteIdentification())this.identification.set({...d,nouveau:false});
          sessionStorage.setItem(`wavy-identification:${contexte}:${d.operationId}`,JSON.stringify({tiersId:tiers.id,motif:d.motif,incertain:false}));
          verifier();this.identification.set({...d,nouveau:false});
        } else {
          const tiers=await firstValueFrom(this.api.lireTiersIdentification(d.tiersId));verifier();
          if(tiers.actif===false)throw new Error('Le tiers sélectionné est inactif.');d.nomTiers=this.nomIdentification(tiers);
        }
        this.sauvegarderRepriseIdentification(d,false);
        if(!regle) {
          regle=await firstValueFrom(this.api.enregistrerRegleIdentification(d.tiersId!,d.motif.trim()));verifier();
          if(!regle.actif || regle.tiersId!==d.tiersId || regle.typeRegle!=='OPERATION_BANCAIRE' || this.normaliserIdentification(regle.motif)!==this.normaliserIdentification(d.motif))throw new ErreurMotifBancaire('La règle enregistrée doit être vérifiée avant association.');
        }
      }
      if(ligne.operation.tiersId!==d.tiersId) {
        const bilan=await firstValueFrom(this.api.confirmerAssistant({etape:'TIERS',categorie:'CARTE',perimetre:{...this.filtresConsultation(),operationIds:[d.operationId]},confirmation:true,
          selections:[{operationId:d.operationId,candidatCle: certaine?.cle ?? `MANUEL:${d.tiersId}`,pieceId:null,tiersId:d.tiersId!,montant:0,confirmerNature:false,verifierJustificatif:true,confirmerAffectation:false}]}));verifier();
        if(bilan.reussis!==1 || !bilan.lignes.some(l=>l.operationId===d.operationId && l.statut==='SUCCES'))throw new Error(bilan.lignes[0]?.message || 'Association non confirmée. Reprenez avec ce même tiers.');
      }
      const mettreAJour=(op:OperationBancaire)=>op.id===d.operationId?{...op,tiersId:d.tiersId!,tiersReconnu:d.nomTiers}:op;
      this.operations.update(ops=>ops.map(mettreAJour));
      this.apercuAssistant.update(a=>a?this.apercuDisponible({...a,lignes:a.lignes.map(l=>({...l,operation:mettreAJour(l.operation)}))}):a);
      this.pageResultatsAssistant.set(Math.min(this.pageResultatsAssistant(),this.totalPagesResultatsAssistant()));
      this.identification.set(null);this.choixAssistant.set([]);this.menuOperation.set(null);
      sessionStorage.removeItem(this.cleRepriseIdentification(d.operationId));
      this.chargerOperations(undefined, true);
    } catch (e) {
      if (e instanceof ErreurMotifBancaire) this.erreurMotifIdentification.set(e.message);
      else this.erreurIdentification.set(e instanceof Error && !('status' in e) ? e.message : getHttpErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  private marchandDepuisPaiementCarte(libelle: string): string {
    // Format du relevé avec référence carte masquée, enseigne, lieu sur quatre lettres et date.
    const paiement = libelle.trim().match(/^PAIEMENT PAR CARTE\s*[-–]\s*X\d{4}\s+(.+)\s+\p{L}{4}\s+\d{2}\/\d{2}(?:\/\d{4})?$/iu);
    const marchand = paiement?.[1].trim().toUpperCase() ?? '';
    return /\s/.test(marchand) && this.motifBancaireValide(marchand) ? marchand : '';
  }

  proposerMotifBancaire(libelle: string, nomTiers = ''): string {
    const nettoyer=(texte:string)=>texte.normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
    const banque=' '+nettoyer(libelle)+' ',nom=nettoyer(nomTiers);
    const domaines=[...libelle.toUpperCase().matchAll(/\b(?:WWW\.)?([A-Z0-9][A-Z0-9-]+(?:\.[A-Z][A-Z0-9-]*)+)\b/g)]
      .map(m=>m[1]).filter(d=>!['GMAIL.COM','OUTLOOK.COM','HOTMAIL.COM','YAHOO.COM'].includes(d));
    const generiques=new Set(['SASU','SAS','SARL','SA','LTD','LLC','LIMITED','FRANCE','IRELAND','SYSTEMS','SOFTWARE','SERVICES','SERVICE','COMPANY','UNLIMITED','BANQUE','CREDIT']);
    const termes=nom.split(' ').filter(t=>t.length>=3 && !generiques.has(t));
    if(nom) {
      // Une identité sélectionnée interdit tout repli sur une autre contrepartie du libellé.
      const domaine=domaines.find(d=>termes.includes(d.split('.')[0]));
      if(domaine)return domaine;
      if(termes.length && banque.includes(' '+nom+' '))return nom;
      const mots=nom.split(' ');
      if(mots.length===2 && mots[1].length>=4) {
        const personnel=new RegExp('\\b'+mots[0][0]+'(?:\\s*\\.\\s*|\\s+)'+mots[1]+'\\b');
        const texte=libelle.normalize('NFD').replace(/\p{M}/gu,'').toUpperCase();
        if(personnel.test(texte))return mots[0][0]+'.'+mots[1];
      }
      const presents=termes.filter(t=>banque.includes(' '+t+' '));
      // Sans le prénom ou son initiale, un patronyme isolé ne suffit pas à proposer une identité.
      if(mots.length===2 && presents.length===1 && presents[0]===mots[1] && !generiques.has(mots[0]))return '';
      return presents.length===1 ? presents[0] : '';
    }
    const societe=libelle.match(/\b(?:vers|pour)\s+([\p{L}\p{N}][\p{L}\p{N} .'&-]*?\b(?:SASU|SAS|SARL|SA|LTD|LIMITED))\b/iu)?.[1];
    if(societe)return societe.trim().toUpperCase();
    if(new Set(domaines).size===1)return domaines[0];
    return libelle.normalize('NFKC').replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g,' ')
      .replace(/\b[A-Z]{0,3}\d{4,}[A-Z0-9]*\b/gi,' ').replace(/[£€$]/g,' ').replace(/\b(PAIEMENT|CARTE|CB|VIREMENT|VIR|SEPA|PRLV|PRELEVEMENT|ACHAT)\b/gi,' ')
      .replace(/\s+/g,' ').trim().toUpperCase().slice(0,200);
  }
  motifBancaireValide(motif: string): boolean {
    const normalise=motif.trim().toUpperCase();
    const distinctif=normalise.normalize('NFD').replace(/\p{M}/gu,'').replace(/\b(VIR|VIREMENT|EMIS|RECU|INST|SEPA|PAIEMENT|CARTE|CB|FACTURE|VERS|POUR|PAR|DU|DE|LA|LE|PRELEVEMENT|ACHAT|FRAIS|COMMISSION|REMBOURSEMENT)\b/g,' ');
    return /[A-Z]{3}/.test(distinctif) && normalise.length>=3 && normalise.length<=200 && /\p{L}/u.test(normalise)
      && !/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b|\b[A-Z]{0,3}\d{4,}[A-Z0-9]*\b/i.test(normalise)
      && !['VIR','VIREMENT','VIREMENT SEPA','SEPA','PAIEMENT','PAIEMENT CB','CARTE','SALAIRE','FRAIS','COMMISSION','REMBOURSEMENT','FACTURE','VIR INST','VIR INST VERS'].includes(normalise);
  }
  modifierRegleProposee(id: number, champ: 'motif'|'memoriser', valeur: string|boolean): void {
    if(this.loading()) return;
    this.reglesProposeesAssistant.update(r=>({...r,[id]:{...r[id],[champ]:valeur}}));
  }
  ouvrirTiersAssistant(id?: number, origine?: number, proposerRegle = false): void {
    const operationId = origine ?? this.detailAssistant()?.operation.id ?? this.operationAssistant();
    const detail=this.detailAssistant()?.operation;
    const op=(detail?.id===operationId ? detail : null) ?? this.choixAssistant().find(s=>s.choix.operationId===operationId)?.ligne.operation
      ?? this.apercuAssistant()?.lignes.find(l=>l.operation.id===operationId)?.operation;
    const libelle=op?.libelle ?? this.tiersConfirmesAssistant().find(t=>t.operation===operationId)?.libelle;
    const propose=this.tiersConfirmesAssistant().find(t=>t.operation===operationId)?.motif;
    const motif=proposerRegle ? (propose || (libelle ? this.proposerMotifBancaire(libelle) : '')) : '';
    const retour = `retourAssistant=1${operationId ? `&operationId=${operationId}` : ''}${motif && id ? `&proposerRegle=1&motifBancaire=${encodeURIComponent(motif)}` : ''}`;
    this.shellBridge.navigate('tiers', id ? `/tiers/${id}?${retour}` : `/tiers/nouveau?${retour}`, id ? 'Fiche et règles bancaires' : 'Créer un tiers après recherche des doublons');
  }

  choixPourAssistant(ligne: LigneAssistant, candidat: CandidatAssistant): ChoixAssistant | null {
    return this.choixAssistant().find(s => s.choix.operationId === ligne.operation.id && s.choix.candidatCle === candidat.cle)?.choix ?? null;
  }
  libelleChoixAssistant(choix: ChoixAssistant): string {
    const selection = this.choixAssistant().find(s => s.choix.operationId === choix.operationId && s.choix.candidatCle === choix.candidatCle);
    const ligne = selection?.ligne ?? this.apercuAssistant()?.lignes.find(l => l.operation.id === choix.operationId);
    const candidat = selection?.candidat ?? ligne?.candidats.find(c => c.cle === choix.candidatCle);
    return `${ligne?.operation.libelle ?? ''} · ${candidat?.nomTiers ?? ''} · ${candidat?.numeroPiece ?? choix.candidatCle} · ${candidat?.typePiece ?? ''} · Banque ${ligne?.operation.dateOperation ?? ''}, pièce ${candidat?.datePiece ?? ''} · ${candidat?.avertissements.join(' ; ') ?? ''}`;
  }

  resumeFiltresAssistant(): string {
    const labels: Record<string,string> = {tiersReconnu:'Tiers reconnu',typeTiersReconnu:'Type de tiers',natureOperation:'Nature',statutClassification:'Classification',statutRapprochement:'Rapprochement'};
    const valeurs = Object.entries(this.filtresOperations()).filter(([,v]) => v !== undefined && v !== '').map(([k,v]) => `${labels[k] || k} : ${v}`);
    return valeurs.length ? valeurs.join(' ; ') : 'Aucun filtre : toutes les opérations de la société courante';
  }

  totalAssistant(): number { return this.choixAssistant().reduce((s, l) => s + l.choix.montant, 0); }


  readonly onglets: Array<{ id: OngletTresorerie; label: string }> = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'comptes', label: 'Comptes bancaires' },
    { id: 'imports', label: 'Import relevés' },
    { id: 'operations', label: 'Opérations bancaires' },
    { id: 'rapprochements', label: 'Rapprochement bancaire' },
    { id: 'pieces-rapprochement', label: 'Pièces de rapprochement' },
    { id: 'factures-echeances', label: 'Factures échéances' },
    { id: 'balance-agee', label: 'Balance âgée' },
    { id: 'previsionnel', label: 'Prévisionnel' },
  ];
  readonly naturesOperation: NatureOperationBancaire[] = [
    'FACTURE_FOURNISSEUR',
    'FACTURE_CLIENT',
    'SALAIRE',
    'NOTE_DE_FRAIS',
    'TVA',
    'URSSAF',
    'IMPOT',
    'FRAIS_BANCAIRES',
    'COTISATION',
    'VIREMENT_INTERNE',
    'APPORT_CAPITAL',
    'COMPTE_COURANT',
    'EMPRUNT',
    'REMBOURSEMENT',
    'AUTRE',
  ];
  readonly statutsClassification: StatutClassificationOperation[] = ['NON_CLASSEE', 'CLASSEE_AUTO', 'CLASSEE_MANUELLE', 'A_VERIFIER'];
  readonly typesTiers: TypeTiersReconnu[] = ['FOURNISSEUR', 'FOURNISSEUR_SERVICE', 'CLIENT', 'SALARIE', 'ADMINISTRATION', 'AUTRE'];
  readonly statutsRapprochement: OperationBancaire['statutRapprochement'][] = ['NON_RAPPROCHEE', 'PARTIELLEMENT_RAPPROCHEE', 'RAPPROCHEE', 'IGNOREE'];
  readonly typesOperation: TypeOperationBancaire[] = ['PAIEMENT_CB', 'PRELEVEMENT', 'VIREMENT_RECU', 'VIREMENT_EMIS', 'CHEQUE', 'REMISE_CHEQUE', 'FRAIS_BANCAIRES', 'COTISATION', 'COMMISSION', 'RETRAIT_DAB', 'ESPECES', 'AUTRE'];
  readonly sensOperations: OperationBancaire['sens'][] = ['DEBIT', 'CREDIT'];
  readonly typesFacture: TypeFactureRapprochement[] = ['VENTE', 'ACHAT', 'SALAIRE'];

  readonly titre = computed(() => this.onglets.find((item) => item.id === this.onglet())?.label ?? 'Trésorerie');
  readonly operationsPage = computed(() => this.operations());
  readonly totalPagesResultatsAssistant = computed(() => Math.max(1,Math.ceil((this.apercuAssistant()?.lignes.length ?? 0)/this.taillePageOperations())));
  readonly operationsAffichees = computed(() => {
    const apercu=this.apercuAssistant();
    if (!apercu) return this.operationsPage();
    const debut=(this.pageResultatsAssistant()-1)*this.taillePageOperations();
    const tri=this.triOperations();
    const cle=tri.sortBy as keyof OperationBancaire;
    const operations=apercu.lignes.map(l=>l.operation).sort((a,b)=>{
      const gauche=tri.sortBy==='montantSigne' ? this.montantSigne(a) : a[cle] ?? '';const droite=tri.sortBy==='montantSigne' ? this.montantSigne(b) : b[cle] ?? '';
      const ordre=typeof gauche==='number' && typeof droite==='number' ? gauche-droite : String(gauche).localeCompare(String(droite),'fr',{numeric:true});
      return tri.sortDirection==='DESC' ? -ordre : ordre;
    });
    return operations.slice(debut,debut+this.taillePageOperations());
  });
  revenirOperationsFiltrees(): void {
    if (this.loading()) return;
    this.operationAssistant.set(null);this.invaliderAssistant();this.loading.set(true);
    this.chargerOperations(()=>this.loading.set(false));
  }
  ligneAssistant(id: number): LigneAssistant | null { return this.apercuAssistant()?.lignes.find(l=>l.operation.id===id) ?? null; }

  readonly rapprochementsProposes = computed(() => this.rapprochements().filter((rapprochement) => rapprochement.statut === 'PROPOSE'));
  readonly totalRapprochementManuel = computed(() => this.candidatesRapprochement()
    .filter((facture) => facture.selectionnee)
    .reduce((total, facture) => total + Number(facture.montantRapproche || 0), 0));
  readonly operationManuelleId = signal<number | null>(null);
  readonly montantOperationManuel = computed(() => {
    const operation = this.operationRapprochementManuel();
    return Math.max(0, Math.abs((operation?.sens === 'DEBIT' ? operation.debit ?? operation.montant : operation?.montant) ?? 0) - (operation?.montantRapproche ?? 0));
  });
  readonly resteRapprochementManuel = computed(() => Math.max(0, this.montantOperationManuel() - this.totalRapprochementManuel()));
  readonly debutOperations = computed(() => this.totalOperations() === 0 ? 0 : (Math.min(this.pageOperations(), this.totalPagesOperations()) - 1) * this.taillePageOperations() + 1);
  readonly finOperations = computed(() => Math.min(this.debutOperations() + this.operationsPage().length - 1, this.totalOperations()));
  readonly formulaireCompte = this.fb.nonNullable.group({
    nomCompte: ['', Validators.required],
    banque: ['', Validators.required],
    iban: ['', Validators.required],
    bic: [''],
    devise: ['EUR', Validators.required],
    soldeInitial: [0, Validators.required],
    dateSoldeInitial: [''],
    actif: [true],
  });
  readonly formulaireOperation = this.fb.group({
    compteBancaireId: [null as number | null, Validators.required],
    dateOperation: ['', Validators.required],
    dateValeur: [''],
    libelle: ['', Validators.required],
    referenceBancaire: [''],
    sens: ['DEBIT' as OperationBancaire['sens'], Validators.required],
    montant: [0, Validators.required],
    typeOperation: ['AUTRE' as TypeOperationBancaire, Validators.required],
    tiersReconnu: [''],
    typeTiersReconnu: ['' as TypeTiersReconnu | ''],
    natureOperation: ['AUTRE' as NatureOperationBancaire, Validators.required],
    statutClassification: ['CLASSEE_MANUELLE' as StatutClassificationOperation, Validators.required],
    statutRapprochement: ['NON_RAPPROCHEE' as OperationBancaire['statutRapprochement'], Validators.required],
    tiersId: [null as number | null],
    factureId: [null as number | null],
    typeFacture: ['' as TypeFactureRapprochement | ''],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.onglet.set(this.normaliserOnglet(params.get('vue')));
      if (params.get('assistant') === 'tiers') {
        this.etapeAssistant.set('TIERS');
        const cree=params.get('tiersValideId') ? 0 : Number(params.get('tiersProposeId'));
        this.tiersRetourAssistant=Number.isSafeInteger(cree) && cree>0 ? cree : null;
        const operation = Number(params.get('operationId'));
        if (Number.isSafeInteger(operation) && operation > 0) this.operationAssistant.set(operation);
      }
      if (this.onglet() === 'factures-echeances') {
        const vue = params.get('vueEcheances');
        if (this.vuesEcheances.includes(vue as (typeof this.vuesEcheances)[number])) this.vueEcheances.set(vue as (typeof this.vuesEcheances)[number]);
        const depuisUrl: FiltresEcheances = {
          dateDebut: params.has('dateDebut') ? params.get('dateDebut') || undefined : this.filtresEcheances().dateDebut,
          dateFin: params.has('dateFin') ? params.get('dateFin') || undefined : this.filtresEcheances().dateFin,
          typeFacture: params.get('typeFacture') || undefined, tiersId: this.nombreParam(params.get('tiersId')),
          statut: params.get('statut') || undefined, enRetard: params.get('enRetard') === 'true' || undefined,
          partiellementPayees: params.get('partiellementPayees') === 'true' || undefined,
          familleActivite: params.get('familleActivite') || undefined, contratId: this.nombreParam(params.get('contratId')),
          montantMinimum: this.nombreParam(params.get('montantMinimum')), montantMaximum: this.nombreParam(params.get('montantMaximum')),
          page: this.nombreParam(params.get('page')) ?? 0, size: this.nombreParam(params.get('size')) ?? 25,
          sort: params.get('sort') || 'dateEcheance,asc',
        };
        const fusion = { ...this.filtresEcheances() };
        for (const key of Object.keys(depuisUrl) as (keyof FiltresEcheances)[]) {
          if (params.has(key)) Object.assign(fusion, { [key]: depuisUrl[key] });
        }
        this.filtresEcheances.set(fusion);
        memoriserFiltresEcheances(sessionStorage, fusion);
      }
      this.charger();
    });
  }

  choisirOperationManuelle(): void {
    const operation = this.operationsPage().find(o => o.id === this.operationManuelleId());
    if (!this.loading() && operation && this.rapprochementManuelPossible(operation))
      this.ouvrirRapprochementManuel(operation);
  }

  paginerOperationsManuelles(delta: number): void {
    this.operationManuelleId.set(null);
    this.pageOperations.update(page => page + delta);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  ouvrirRapprochementManuel(operation: OperationBancaire): void {
    const contexte = this.cleContexteCartes();
    this.error.set(null);
    this.operationRapprochementManuel.set(operation);
    this.candidatesRapprochement.set([]);
    this.loading.set(true);
    this.api.facturesCandidates(operation.id).subscribe({
      next: (factures) => {
        if (contexte !== this.cleContexteCartes()) return;
        this.candidatesRapprochement.set(factures.map((facture) => ({ ...facture, selectionnee: false, montantRapproche: 0 })));
        this.loading.set(false);
      },
      error: (error) => {
        if (contexte !== this.cleContexteCartes()) return;
        this.error.set(getHttpErrorMessage(error));
        this.operationRapprochementManuel.set(null);
        this.loading.set(false);
      },
    });
  }

  ouvrirTiers(id: number, label?: string | null): void {
    this.shellBridge.navigate('tiers', `/tiers/${id}`, label || `Tiers ${id}`);
  }

  ouvrirFacture(id: number | null | undefined, type: TypeFactureRapprochement | null | undefined, numero?: string | null): void {
    if (!id || !type) return;
    const path = type === 'ACHAT' ? `/factures/achats/${id}` : type === 'SALAIRE' ? `/salaires/${id}` : `/factures/ventes/${id}`;
    this.shellBridge.navigate('factures', path, numero || `Facture ${id}`);
  }

  cleCandidateManuelle(facture: FactureCandidateRapprochement): string {
    return facture.typeFacture + ':' + facture.id;
  }

  selectionnerCandidate(cle: string, selectionnee: boolean): void {
    this.candidatesRapprochement.update(items => items.map(facture => ({
      ...facture,
      selectionnee: selectionnee && this.cleCandidateManuelle(facture) === cle,
      montantRapproche: selectionnee && this.cleCandidateManuelle(facture) === cle
        ? Math.min(facture.resteAPayer, this.montantOperationManuel()) : 0,
    })));
  }

  modifierMontantCandidate(cle: string, valeur: string): void {
    this.candidatesRapprochement.update(items => items.map(facture => this.cleCandidateManuelle(facture) === cle
      ? { ...facture, montantRapproche: Number(valeur) || 0 }
      : facture));
  }

  readonly confirmationManuellePossible = computed(() => !this.loading() &&
    this.candidatesRapprochement().some(f => f.selectionnee && f.montantRapproche > 0
      && f.montantRapproche <= Math.min(f.resteAPayer, this.montantOperationManuel())
      && Math.abs(f.montantRapproche * 100 - Math.round(f.montantRapproche * 100)) < 0.000001));

  validerRapprochementManuel(): void {
    const operation = this.operationRapprochementManuel();
    if (!operation || !this.confirmationManuellePossible()) return;
    const lignes = this.candidatesRapprochement().filter((facture) => facture.selectionnee).map((facture) => ({
      factureId: facture.id,
      typeFacture: facture.typeFacture,
      montantRapproche: facture.montantRapproche,
    }));
    const contexte = this.cleContexteCartes();
    this.error.set(null);
    this.loading.set(true);
    this.api.rapprocherManuellement(operation.id, lignes).subscribe({
      next: (resultat) => {
        if (contexte !== this.cleContexteCartes()) return;
        this.operationManuelleId.set(null);
        this.message.set(`Rapprochement ${resultat.statutRapprochement.toLowerCase()} : ${this.montant(resultat.montantRapproche)}.`);
        this.operationRapprochementManuel.set(null);
        this.loading.set(false);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (error) => {
        if (contexte !== this.cleContexteCartes()) return;
        this.error.set(error?.error?.message || getHttpErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  fermerRapprochementManuel(): void {
    if (!this.loading()) this.operationRapprochementManuel.set(null);
  }

  rapprochementManuelPossible(operation: OperationBancaire): boolean {
    return operation.statutRapprochement !== 'RAPPROCHEE' && operation.statutRapprochement !== 'IGNOREE'
      && !!operation.tiersId && Math.abs(operation.sens === 'DEBIT' ? operation.debit ?? operation.montant : operation.montant) > (operation.montantRapproche ?? 0);
  }

  changerOnglet(onglet: OngletTresorerie): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vue: onglet === 'dashboard' ? null : onglet },
      queryParamsHandling: 'merge',
    });
  }

  charger(): void {
    this.operationRapprochementManuel.set(null);
    this.operationManuelleId.set(null);
    this.propositionsCartes.set(null);
    this.contexteCartes = null;
    this.selectionCartes.set(new Set());
    this.recapitulatifCartes.set([]);
    this.bilanCartes.set(null);
    this.reprisesCartes.set([]);
    this.loading.set(true);
    this.error.set(null);
    this.api.dashboard().subscribe({
      next: (dashboard) => this.dashboard.set(dashboard),
      error: (error) => this.error.set(getHttpErrorMessage(error)),
    });

    const fin = () => this.loading.set(false);
    switch (this.onglet()) {
      case 'comptes':
        this.chargerComptes(fin);
        break;
      case 'imports':
        this.api.comptes().subscribe({ next: (data) => {
          this.comptes.set(data);
          this.compteImportId.set(this.compteImportId() ?? data[0]?.id ?? null);
        }, error: () => this.comptes.set([]) });
        this.api.imports().subscribe({ next: (data) => this.imports.set(data), error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin });
        break;
      case 'operations':
        this.compteursOperations.set(null);
        this.operations.set([]);
        this.invaliderAssistant();
        const contexteImport = this.cleContexteCartes();
        this.api.imports().subscribe({
          next: imports => {
            if (this.onglet() !== 'operations' || contexteImport !== this.cleContexteCartes()) return;
            this.imports.set([...imports].sort((a, b) => b.dateImport.localeCompare(a.dateImport) || b.id - a.id));
            if (!['dernier', 'tous'].includes(this.choixImport()) && !imports.some(i => String(i.id) === this.choixImport())) {
              this.choixImport.set('dernier');
            }
            this.chargerOperations(fin);
          },
          error: e => { if (contexteImport === this.cleContexteCartes()) { this.error.set(getHttpErrorMessage(e)); fin(); } },
        });
        break;
      case 'previsionnel':
        this.chargerOperations(fin);
        break;
      case 'rapprochements':
        this.operations.set([]);
        this.chargerOperations();
        this.chargerRapprochements(fin);
        this.api.regles().subscribe({ next: (data) => this.regles.set(data), error: () => this.regles.set([]) });
        break;
      case 'pieces-rapprochement':
        this.api.piecesRapprochement().subscribe({ next: (data) => this.piecesRapprochement.set(data), error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin });
        break;
      case 'factures-echeances':
        this.chargerEcheances(fin);
        break;
      case 'balance-agee':
        this.api.balanceAgee().subscribe({ next: (data) => this.balance.set(data), error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin });
        break;
      default:
        this.api.operations(undefined, this.parametresOperations()).subscribe({ next: (data) => this.appliquerPageOperations(data), error: () => this.operations.set([]), complete: fin });
    }
  }

  montant(value: number | null | undefined): string {
    return `${(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  chargerEcheances(fin?: () => void): void {
    this.api.kpisFacturesEcheances().subscribe({ next: (data) => this.kpisEcheances.set(data) });
    this.api.facturesEcheances(this.filtresEcheances()).subscribe({
      next: (data) => { this.factures.set(data.content); this.totalFactures.set(data.totalElements); },
      error: (e) => this.error.set(getHttpErrorMessage(e)), complete: fin,
    });
  }

  changerVueEcheances(vue: (typeof this.vuesEcheances)[number]): void {
    this.vueEcheances.set(vue);
    const f: FiltresEcheances = { ...this.filtresEcheances(), page: 0, typeFacture: undefined, statut: undefined, enRetard: undefined, partiellementPayees: undefined };
    if (vue === 'A_ENCAISSER') f.typeFacture = 'VENTE';
    if (vue === 'A_PAYER') f.typeFacture = 'ACHAT';
    if (vue === 'EN_RETARD') { f.enRetard = true; f.sort = 'joursRetard,desc'; }
    if (vue === 'PARTIELLEMENT_PAYEE') f.partiellementPayees = true;
    this.appliquerFiltresEcheances(f);
  }

  filtreEcheance(cle: keyof FiltresEcheances, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.appliquerFiltresEcheances({ ...this.filtresEcheances(), page: 0, [cle]: value || undefined });
  }

  pageEcheances(delta: number): void {
    this.appliquerFiltresEcheances({ ...this.filtresEcheances(), page: Math.max(0, this.filtresEcheances().page + delta) });
  }

  private appliquerFiltresEcheances(filtres: FiltresEcheances): void {
    this.filtresEcheances.set(filtres);
    memoriserFiltresEcheances(sessionStorage, filtres);
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...filtres, dateDebut: filtres.dateDebut || '', dateFin: filtres.dateFin || '', vueEcheances: this.vueEcheances() }, queryParamsHandling: 'merge', replaceUrl: true });
    this.chargerEcheances();
  }

  dateFr(value: string | null | undefined): string {
    if (!value) return '-'; const [a, m, j] = value.split('-'); return `${j}/${m}/${a}`;
  }

  private nombreParam(value: string | null): number | undefined {
    if (value === null || value === '') return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined;
  }

  libelleStatutEcheance(statut: string): string {
    return ({ A_ECHOIR: 'À échoir', ECHEANCE_AUJOURD_HUI: "Échéance aujourd’hui", EN_RETARD: 'En retard',
      PARTIELLEMENT_PAYEE: 'Partiellement payée', PAYEE: 'Payée' } as Record<string, string>)[statut] ?? statut;
  }

  private chargerRapprochements(fin?: () => void): void {
    this.api.rapprochements().subscribe({
      next: (data) => this.rapprochements.set(data),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: fin,
    });
  }

  choisirCompteImport(value: string): void {
    this.compteImportId.set(value ? Number(value) : null);
  }

  choisirFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fichierImport.set(input.files?.[0] ?? null);
    this.resultatImport.set(null);
  }

  deposerFichier(event: DragEvent): void {
    event.preventDefault();
    this.fichierImport.set(event.dataTransfer?.files?.[0] ?? null);
    this.resultatImport.set(null);
  }

  importerReleve(): void {
    const compteId = this.compteImportId();
    const fichier = this.fichierImport();
    if (!compteId || !fichier) {
      this.error.set('Selectionnez un compte bancaire et un fichier.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.importerReleve(compteId, fichier).subscribe({
      next: (resultat) => {
        this.resultatImport.set(resultat);
        this.api.imports().subscribe({ next: (imports) => this.imports.set(imports) });
        this.pageOperations.set(1);
        this.api.operations(this.filtresOperations(), this.parametresOperations()).subscribe({ next: (operations) => this.appliquerPageOperations(operations) });
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  voirOperationsImportees(): void {
    this.changerOnglet('operations');
  }

  private sequenceOperations = 0;

  chargerOperations(fin?: () => void, conserverBilan = false): void {
    if (!conserverBilan) {
      this.invaliderAssistant();
      this.error.set(null);
    }
    let pageCorrigee = false;
    const sequence = ++this.sequenceOperations;
    const contexte = this.cleContexteCartes();
    const consultation = this.onglet() === 'operations';
    const filtres = consultation ? this.filtresConsultation() : this.filtresOperations();
    if (consultation) this.compteursOperations.set(null);
    forkJoin({
      data: this.api.operations(filtres, this.parametresOperations()),
      ...(consultation ? { compteurs: this.api.compteursOperations(filtres) } : {}),
    }).subscribe({
      next: ({ data, compteurs }) => {
        if (sequence !== this.sequenceOperations || contexte !== this.cleContexteCartes()) return;
        if (compteurs) this.compteursOperations.set(compteurs);
        this.appliquerPageOperations(data);
        if (this.pageOperations() > this.totalPagesOperations()) {
          pageCorrigee=true;this.pageOperations.set(this.totalPagesOperations());
          this.chargerOperations(fin,conserverBilan);
        }
      },
      error: (e) => { if (sequence === this.sequenceOperations && contexte === this.cleContexteCartes()) { this.error.set(getHttpErrorMessage(e)); this.loading.set(false); } },
      complete: () => { if (sequence === this.sequenceOperations && contexte === this.cleContexteCartes() && !pageCorrigee) fin?.(); },
    });
  }

  private appliquerPageOperations(data: { content: OperationBancaire[]; totalElements: number; totalPages: number }): void {
    this.operations.set(data.content);
    this.totalOperations.set(data.totalElements);
    this.totalPagesOperations.set(Math.max(1, data.totalPages));
  }

  private parametresOperations() {
    return {
      page: Math.max(0, this.pageOperations() - 1),
      size: this.taillePageOperations(),
      ...this.triOperations(),
    };
  }

  trierOperations(sortBy: OperationBancaireSortBy): void {
    const triCourant = this.triOperations();
    this.triOperations.set({
      sortBy,
      sortDirection: triCourant.sortBy === sortBy && triCourant.sortDirection === 'DESC' ? 'ASC' : 'DESC',
    });
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  indicateurTriOperations(sortBy: OperationBancaireSortBy): string {
    const tri = this.triOperations();
    if (tri.sortBy !== sortBy) {
      return '';
    }
    return tri.sortDirection === 'ASC' ? '▲' : '▼';
  }

  filtrerOperations(cle: keyof FiltresOperations, valeur: string): void {
    const filtres = { ...this.filtresOperations(), [cle]: valeur || undefined };
    this.filtresOperations.set(filtres);
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  reinitialiserFiltresOperations(): void {
    this.choixImport.set('dernier');
    this.filtresOperations.set({});
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  changerTaillePageOperations(valeur: string): void {
    this.taillePageOperations.set(Number(valeur) || 10);
    this.pageOperations.set(1);
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  pagePrecedenteOperations(): void {
    this.pageOperations.update((page) => Math.max(1, page - 1));
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  pageSuivanteOperations(): void {
    this.pageOperations.update((page) => Math.min(this.totalPagesOperations(), page + 1));
    this.loading.set(true);
    this.chargerOperations(() => this.loading.set(false));
  }

  modifierNatureOperation(operation: OperationBancaire, natureOperation: string): void {
    this.loading.set(true);
    this.api.modifierClassificationOperation(operation.id, natureOperation as NatureOperationBancaire).subscribe({
      next: (operationModifiee) => this.operations.update((operations) => operations.map((item) => item.id === operation.id ? operationModifiee : item)),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  retraiterOperation(operation: OperationBancaire): void {
    this.loading.set(true);
    this.api.retraiterOperation(operation.id).subscribe({
      next: (operationModifiee) => this.operations.update((operations) => operations.map((item) => item.id === operation.id ? operationModifiee : item)),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  retraiterOperationsNonRapprochees(): void {
    this.loading.set(true);
    this.api.retraiterOperationsNonRapprochees().subscribe({
      next: () => this.chargerOperations(),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  calculerNomTiersOperationsNonRapprochees(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Calcul du tiers reconnu sur les opérations bancaires non rapprochées');
    this.api.calculerNomTiersOperationsNonRapprochees().subscribe({
      next: () => this.chargerOperations(),
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherFactures(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement des opérations avec les factures ouvertes');
    this.api.rapprocherFactures().subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement factures : ${resultat.rapprochementsCrees} validé(s), ${resultat.operationsTraitees} opération(s) examinée(s), ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherSalaires(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement des virements avec les salaires');
    this.api.rapprocherSalaires().subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement salaires : ${resultat.rapprochementsCrees} validé(s), ${resultat.operationsTraitees} opération(s) examinée(s), ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherSalaire(operation: OperationBancaire): void {
    if (!this.salaireRapprochementPossible(operation)) return;
    this.loading.set(true);
    this.api.rapprocherFacture(operation.id).subscribe({
      next: (resultat) => {
        this.message.set(`Salaire : ${resultat.rapprochementsCrees} validé(s), ${resultat.propositionsCreees} proposition(s).`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  private cleContexteCartes(): string {
    return `${this.contexteService.tenantId()}:${this.contexteService.societeCouranteId()}`;
  }

  cleCarte(p: PropositionCarte): string { return `${p.operationId}:${p.factureId}`; }

  carteSure(p: PropositionCarte): boolean {
    const propositions = this.propositionsCartes()?.propositions ?? [];
    return !p.conflit && !p.ambiguite && !p.dateAtypique && p.commercantReconnu
      && p.ecart === 0 && p.montantOperation === p.montantPiece
      && !propositions.some(a => this.cleCarte(a) !== this.cleCarte(p)
        && (a.operationId === p.operationId || a.factureId === p.factureId));
  }

  selectionnerCarte(p: PropositionCarte, selectionnee: boolean): void {
    if (this.loading()) return;
    const selection = new Set(this.selectionCartes());
    if (selectionnee && this.carteSure(p)) selection.add(this.cleCarte(p));
    else selection.delete(this.cleCarte(p));
    this.selectionCartes.set(selection);
    this.recapitulatifCartes.set([]);
  }

  selectionnerCartesSures(selectionner: boolean): void {
    if (this.loading()) return;
    this.selectionCartes.set(new Set(selectionner
      ? (this.propositionsCartes()?.propositions ?? []).filter(p => this.carteSure(p)).map(p => this.cleCarte(p)) : []));
    this.recapitulatifCartes.set([]);
  }

  toutesCartesSuresSelectionnees(): boolean {
    const sures = (this.propositionsCartes()?.propositions ?? []).filter(p => this.carteSure(p));
    return sures.length > 0 && sures.every(p => this.selectionCartes().has(this.cleCarte(p)));
  }

  preparerConfirmationCartes(reprise = false): void {
    if (this.loading() || !this.verifierContexteCartes()) return;
    this.recapitulatifCartes.set(reprise ? [...this.reprisesCartes()]
      : this.cartesSelectionnees().filter(p => this.carteSure(p)));
  }

  private verifierContexteCartes(): boolean {
    if (this.contexteCartes === this.cleContexteCartes()) return true;
    this.propositionsCartes.set(null);
    this.selectionCartes.set(new Set());
    this.recapitulatifCartes.set([]);
    this.reprisesCartes.set([]);
    this.bilanCartes.set(null);
    this.error.set('La société a changé. Recherchez de nouveau les propositions carte.');
    return false;
  }

  confirmerSelectionCartes(): void {
    if (this.loading() || !this.verifierContexteCartes()) return;
    const propositions = [...this.recapitulatifCartes()];
    if (!propositions.length) return;
    const contexte = this.cleContexteCartes();
    this.loading.set(true);
    this.error.set(null);
    this.api.confirmerCartes({ confirmation: true, lignes: propositions.map(p => ({
      operationId: p.operationId, demande: { factureId: p.factureId, tiersConfirme: p.tiersId,
        confirmation: true, confirmerAffectation: p.affectationRequise, confirmerDateAtypique: false },
    })) }).subscribe({
      next: bilan => {
        this.loading.set(false);
        if (contexte !== this.cleContexteCartes()) return;
        this.bilanCartes.set(bilan);
        this.recapitulatifCartes.set([]);
        this.selectionCartes.set(new Set());
        this.reprisesCartes.update(anciennes => [
          ...anciennes.filter(p => !propositions.some(a => this.cleCarte(a) === this.cleCarte(p))),
          ...propositions.filter(p => bilan.lignes.some(l => l.operationId === p.operationId
            && l.factureId === p.factureId && l.code === 'RESULTAT_A_REPRENDRE')),
        ]);
        this.chargerOperations();
        this.chargerRapprochements();
        this.proposerCartes();
      },
      error: e => {
        this.loading.set(false);
        if (contexte !== this.cleContexteCartes()) return;
        this.recapitulatifCartes.set([]);
        this.reprisesCartes.update(anciennes => [
          ...anciennes.filter(p => !propositions.some(a => this.cleCarte(a) === this.cleCarte(p))), ...propositions,
        ]);
        this.error.set(`${getHttpErrorMessage(e)} Résultat du lot non confirmé : reprenez les mêmes couples pour éviter tout double paiement.`);
      },
    });
  }

  proposerCartes(): void {
    if (this.loading()) return;
    const contexte = this.cleContexteCartes();
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.propositionsCartes.set(null);
    this.selectionCartes.set(new Set());
    this.recapitulatifCartes.set([]);
    this.api.proposerCartes().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (resultat) => {
        if (contexte !== this.cleContexteCartes()) return;
        this.contexteCartes = contexte;
        this.propositionsCartes.set(resultat);
        this.message.set(`Dépenses carte : ${resultat.operationsExaminees} opération(s) examinée(s), ${resultat.propositions.length} proposition(s). Aucune validation automatique.`);
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
    });
  }

  confirmerCarte(proposition: PropositionCarte): void {
    if (this.loading() || proposition.conflit) return;
    if (!this.verifierContexteCartes()) return;
    const avertissements = [
      proposition.ambiguite ? 'Plusieurs correspondances existent : vous choisissez uniquement cette pièce et cette opération.' : '',
      proposition.affectationRequise ? `Associer le fournisseur ${proposition.nomTiers} (tiers ${proposition.tiersId}) à cette opération et la classer en achat.` : '',
      !proposition.commercantReconnu ? 'Commerçant différent : vérifiez le justificatif et le fournisseur, aucun alias ne sera créé.' : '',
      proposition.dateAtypique ? 'Date atypique : confirmez avoir vérifié le justificatif.' : '',
      proposition.ecart > 0 ? 'Un écart de 0,01 sera conservé comme reliquat non soldé.' : '',
    ].filter(Boolean).join('\n');
    if (!confirm(`Confirmer la pièce ${proposition.numeroPiece ?? proposition.factureId} (${this.montant(proposition.montantPiece)}) avec l'opération « ${proposition.libelleOperation} » du ${proposition.dateOperation} ?\nFournisseur : ${proposition.nomTiers}. Montant affecté : ${this.montant(proposition.montantRapproche)}.\n${avertissements}`)) return;
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    const contexte = this.cleContexteCartes();
    this.api.confirmerCarte(proposition.operationId, {
      factureId: proposition.factureId, tiersConfirme: proposition.tiersId, confirmation: true,
      confirmerAffectation: proposition.affectationRequise, confirmerDateAtypique: proposition.dateAtypique,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        if (contexte !== this.cleContexteCartes()) return;
        this.reprisesCartes.update(ps => ps.filter(p => this.cleCarte(p) !== this.cleCarte(proposition)));
        this.chargerOperations();
        this.chargerRapprochements();
        this.proposerCartes();
      },
      error: (e) => {
        this.loading.set(false);
        if (contexte === this.cleContexteCartes()) this.error.set(getHttpErrorMessage(e));
      },
    });
  }

  rapprocherNotesFrais(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement des remboursements de notes de frais');
    this.api.rapprocherNotesFrais().subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement notes de frais : ${resultat.operationsTraitees} opération(s) examinée(s), ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  rapprocherNoteFrais(operation: OperationBancaire): void {
    if (!this.noteFraisRapprochementPossible(operation)) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set('Rapprochement note de frais');
    this.api.rapprocherNoteFrais(operation.id).subscribe({
      next: (resultat) => {
        this.message.set(`Rapprochement note de frais : ${resultat.operationsTraitees} opération(s) examinée(s), ${resultat.propositionsCreees} proposition(s), ${resultat.operationsSansMatch} sans match.`);
        this.chargerOperations();
        this.chargerRapprochements();
      },
      error: (e) => {
        this.message.set(null);
        this.error.set(getHttpErrorMessage(e));
      },
      complete: () => this.loading.set(false),
    });
  }

  creerFactureRapprochement(operation: OperationBancaire): void {
    if (!this.pieceRapprochementPossible(operation)) {
      return;
    }
    if (!confirm(`Créer une pièce de rapprochement pour l'opération "${operation.libelle}" ?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.creerPieceRapprochement(operation.id).subscribe({
      next: (operationModifiee) => {
        this.operations.update((operations) => operations.map((item) => item.id === operation.id ? operationModifiee : item));
        this.message.set('Pièce de rapprochement créée.');
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  creerFacturesRapprochementPossibles(): void {
    const operationsEligibles = this.operationsPieceRapprochementPossibles();
    if (operationsEligibles.length === 0) {
      return;
    }
    if (!confirm(`Créer ${operationsEligibles.length} pièce(s) de rapprochement pour les opérations éligibles affichées ?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    forkJoin(operationsEligibles.map((operation) => this.api.creerPieceRapprochement(operation.id))).subscribe({
      next: (operationsModifiees) => {
        const parId = new Map(operationsModifiees.map((operation) => [operation.id, operation]));
        this.operations.update((operations) => operations.map((operation) => parId.get(operation.id) ?? operation));
        this.message.set(`${operationsModifiees.length} pièce(s) de rapprochement créée(s).`);
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  operationsPieceRapprochementPossibles(): OperationBancaire[] {
    return this.operationsPage().filter((operation) => this.pieceRapprochementPossible(operation));
  }

  pieceRapprochementPossible(operation: OperationBancaire): boolean {
    return operation.statutRapprochement === 'NON_RAPPROCHEE'
      && !operation.rapprochee
      && !!operation.tiersId
      && !!operation.tiersReconnu
      && operation.pieceRapprochementAutorisee === true
      && !operation.factureId
      && !operation.factureRapprochementId;
  }

  noteFraisRapprochementPossible(operation: OperationBancaire): boolean {
    return operation.sens === 'DEBIT'
      && operation.statutRapprochement === 'NON_RAPPROCHEE'
      && !operation.rapprochee
      && !!operation.tiersId
      && !!operation.tiersReconnu
      && operation.natureOperation === 'NOTE_DE_FRAIS';
  }

  salaireRapprochementPossible(operation: OperationBancaire): boolean {
    return operation.sens === 'DEBIT'
      && operation.statutRapprochement === 'NON_RAPPROCHEE'
      && !operation.rapprochee
      && !!operation.tiersId
      && operation.typeTiersReconnu === 'SALARIE'
      && operation.natureOperation === 'SALAIRE';
  }

  validerRapprochement(rapprochement: RapprochementBancaire): void {
    if (rapprochement.statut !== 'PROPOSE') {
      return;
    }
    if (!confirm('Valider cette proposition de rapprochement ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.validerRapprochement(rapprochement.id).subscribe({
      next: (rapprochementModifie) => {
        this.rapprochements.update((items) => items.map((item) => item.id === rapprochement.id ? rapprochementModifie : item));
        this.message.set('Proposition de rapprochement validée.');
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerRapprochement(rapprochement: RapprochementBancaire): void {
    if (rapprochement.statut !== 'PROPOSE') {
      return;
    }
    if (!confirm('Annuler cette proposition ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.annulerRapprochement(rapprochement.id).subscribe({
      next: (rapprochementModifie) => {
        this.rapprochements.update((items) => items.map((item) => item.id === rapprochement.id ? rapprochementModifie : item));
        this.message.set('Proposition de rapprochement annulée.');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerRapprochementValide(rapprochement: RapprochementBancaire): void {
    if (this.loading() || rapprochement.statut !== 'VALIDE'
      || !confirm('Annuler ce rapprochement et le paiement associé ?')) return;

    const contexte = this.cleContexteCartes();
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.annulerRapprochementValide(rapprochement.id).subscribe({
      next: resultat => {
        if (contexte !== this.cleContexteCartes()) return;
        this.rapprochements.update(items => items.map(item => item.id === resultat.id ? resultat : item));
        this.chargerRapprochements();
        this.chargerOperations(() => this.loading.set(false));
        this.message.set('Rapprochement annulé. Les soldes ont été actualisés.');
        this.api.dashboard().subscribe({ next: dashboard => {
          if (contexte === this.cleContexteCartes()) this.dashboard.set(dashboard);
        } });
      },
      error: erreur => {
        if (contexte !== this.cleContexteCartes()) return;
        this.error.set(erreur?.error?.message || getHttpErrorMessage(erreur));
        this.loading.set(false);
      },
    });
  }

  rapprocherOperationAnnulee(rapprochement: RapprochementBancaire): void {
    if (this.loading() || rapprochement.statut !== 'ANNULE') return;
    const contexte = this.cleContexteCartes();
    this.loading.set(true);
    this.error.set(null);
    this.api.operation(rapprochement.operationBancaireId).subscribe({
      next: operation => {
        if (contexte !== this.cleContexteCartes()) return;
        this.loading.set(false);
        if (this.rapprochementManuelPossible(operation)) this.ouvrirRapprochementManuel(operation);
        else this.error.set('Cette opération n’a plus de disponible pour un rapprochement manuel.');
      },
      error: erreur => {
        if (contexte !== this.cleContexteCartes()) return;
        this.error.set(getHttpErrorMessage(erreur));
        this.loading.set(false);
      },
    });
  }

  validerToutesPropositions(): void {
    const total = this.rapprochementsProposes().length;
    if (total === 0 || !confirm('Valider toutes les propositions de rapprochement ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.validerRapprochementsProposes().subscribe({
      next: (resultat) => {
        this.message.set(`Propositions traitées : ${resultat.propositionsTraitees}, validées : ${resultat.validees}, erreurs : ${resultat.erreurs}.`);
        if (resultat.messages?.length) {
          this.error.set(resultat.messages.join('\n'));
        }
        this.chargerRapprochements();
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerToutesPropositions(): void {
    const total = this.rapprochementsProposes().length;
    if (total === 0 || !confirm('Annuler toutes les propositions de rapprochement ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.annulerRapprochementsProposes().subscribe({
      next: (resultat) => {
        this.message.set(`Propositions traitées : ${resultat.propositionsTraitees}, annulées : ${resultat.annulees}, erreurs : ${resultat.erreurs}.`);
        if (resultat.messages?.length) {
          this.error.set(resultat.messages.join('\n'));
        }
        this.chargerRapprochements();
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  actionRapprochementPossible(rapprochement: RapprochementBancaire): boolean {
    return rapprochement.statut === 'PROPOSE';
  }

  libelleNature(nature: string | null | undefined): string {
    const libelles: Record<string, string> = {
      FACTURE_FOURNISSEUR: 'Facture fournisseur',
      FACTURE_CLIENT: 'Facture client',
      SALAIRE: 'Salaire',
      NOTE_DE_FRAIS: 'Note de frais',
      TVA: 'TVA',
      URSSAF: 'URSSAF',
      IMPOT: 'Impôt',
      FRAIS_BANCAIRES: 'Frais bancaires',
      COTISATION: 'Cotisation',
      VIREMENT_INTERNE: 'Virement interne',
      APPORT_CAPITAL: 'Apport capital',
      COMPTE_COURANT: 'Compte courant',
      REMBOURSEMENT: 'Remboursement',
      AUTRE: 'Autre',
    };
    return nature ? (libelles[nature] ?? nature) : '-';
  }

  libelleStatutClassification(statut: string | null | undefined): string {
    const libelles: Record<string, string> = {
      NON_CLASSEE: 'Non classée',
      CLASSEE_AUTO: 'Classée auto',
      CLASSEE_MANUELLE: 'Classée manuelle',
      A_VERIFIER: 'À vérifier',
    };
    return statut ? (libelles[statut] ?? statut) : '-';
  }

  voirOperation(operation: OperationBancaire): void {
    this.detailAssistant.set(null);this.recapAssistant.set(null);this.menuOperation.set(null);this.operationConsultee.set(operation);
    this.detailOperation.set(null);
    this.api.consulterOperation(operation.id).subscribe({
      next: detail => {
        if (this.operationConsultee() === operation) this.detailOperation.set(detail);
      },
      error: e => { if (this.operationConsultee() === operation) this.error.set(getHttpErrorMessage(e)); },
    });
  }

  nouvelleOperation(): void {
    this.error.set(null);
    this.message.set(null);
    this.operationSelectionnee.set(null);
    if (this.comptes().length === 0) {
      this.chargerComptes();
    }
    this.formulaireOperation.reset({
      compteBancaireId: this.comptes()[0]?.id ?? null,
      dateOperation: this.dateJour(),
      dateValeur: '',
      libelle: '',
      referenceBancaire: '',
      sens: 'DEBIT',
      montant: 0,
      typeOperation: 'AUTRE',
      tiersReconnu: '',
      typeTiersReconnu: '',
      natureOperation: 'AUTRE',
      statutClassification: 'CLASSEE_MANUELLE',
      statutRapprochement: 'NON_RAPPROCHEE',
      tiersId: null,
      factureId: null,
      typeFacture: '',
    });
    this.modeOperation.set('creation');
  }

  modifierOperation(operation: OperationBancaire): void {
    this.error.set(null);
    this.message.set(null);
    if (this.comptes().length === 0) {
      this.chargerComptes();
    }
    this.loading.set(true);
    this.api.operation(operation.id).subscribe({
      next: (detail) => {
        this.operationSelectionnee.set(detail);
        this.remplirFormulaireOperation(detail);
        this.modeOperation.set('modification');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  enregistrerOperation(): void {
    if (this.formulaireOperation.invalid) {
      this.formulaireOperation.markAllAsTouched();
      return;
    }
    const operation = this.operationSelectionnee();
    const payload = this.payloadOperation();
    const mode = this.modeOperation();
    const requete = this.modeOperation() === 'modification' && operation
      ? this.api.modifierOperationBancaire(operation.id, payload)
      : this.api.creerOperation(payload);
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    requete.subscribe({
      next: (operationEnregistree) => {
        this.operationSelectionnee.set(operationEnregistree);
        this.modeOperation.set('liste');
        this.message.set(mode === 'modification' ? 'Transaction modifiée.' : 'Transaction créée.');
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerOperation(): void {
    this.error.set(null);
    this.operationSelectionnee.set(null);
    this.modeOperation.set('liste');
  }

  champOperationInvalide(champ: ChampOperation): boolean {
    const controle = this.formulaireOperation.controls[champ];
    return controle.invalid && (controle.dirty || controle.touched);
  }

  supprimerOperation(operation: OperationBancaire): void {
    if (!confirm('Voulez-vous vraiment supprimer cette operation bancaire ?')) {
      return;
    }
    this.loading.set(true);
    this.api.supprimerOperation(operation.id).subscribe({
      next: () => {
        this.chargerOperations();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  nouveauCompte(): void {
    this.error.set(null);
    this.compteSelectionne.set(null);
    this.formulaireCompte.reset({
      nomCompte: '',
      banque: '',
      iban: '',
      bic: '',
      devise: 'EUR',
      soldeInitial: 0,
      dateSoldeInitial: '',
      actif: true,
    });
    this.modeCompte.set('creation');
  }

  voirCompte(compte: CompteBancaire): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.compte(compte.id).subscribe({
      next: (detail) => {
        this.compteSelectionne.set(detail);
        this.modeCompte.set('detail');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  modifierCompte(compte: CompteBancaire): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.compte(compte.id).subscribe({
      next: (detail) => {
        this.compteSelectionne.set(detail);
        this.remplirFormulaireCompte(detail);
        this.modeCompte.set('modification');
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  enregistrerCompte(): void {
    if (this.formulaireCompte.invalid) {
      this.formulaireCompte.markAllAsTouched();
      return;
    }
    const compte = this.compteSelectionne();
    const payload = this.payloadCompte();
    this.loading.set(true);
    this.error.set(null);
    const requete = this.modeCompte() === 'modification' && compte
      ? this.api.modifierCompte(compte.id, payload)
      : this.api.creerCompte(payload);
    requete.subscribe({
      next: (enregistre) => {
        this.compteSelectionne.set(enregistre);
        this.modeCompte.set('detail');
        this.chargerComptes();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  annulerCompte(): void {
    this.error.set(null);
    this.modeCompte.set(this.compteSelectionne() ? 'detail' : 'liste');
  }

  retourListeComptes(): void {
    this.compteSelectionne.set(null);
    this.modeCompte.set('liste');
  }

  desactiverCompte(compte: CompteBancaire): void {
    if (!confirm('Voulez-vous vraiment désactiver ce compte bancaire ?')) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.desactiverCompte(compte.id).subscribe({
      next: () => {
        this.compteSelectionne.set(null);
        this.modeCompte.set('liste');
        this.chargerComptes();
        this.api.dashboard().subscribe({ next: (dashboard) => this.dashboard.set(dashboard) });
      },
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: () => this.loading.set(false),
    });
  }

  champCompteInvalide(champ: ChampCompte): boolean {
    const controle = this.formulaireCompte.controls[champ];
    return controle.invalid && (controle.dirty || controle.touched);
  }

  private normaliserOnglet(value: string | null): OngletTresorerie {
    return this.onglets.some((item) => item.id === value) ? (value as OngletTresorerie) : 'dashboard';
  }

  private chargerComptes(fin: () => void = () => undefined): void {
    this.api.comptes().subscribe({
      next: (data) => this.comptes.set(data),
      error: (e) => this.error.set(getHttpErrorMessage(e)),
      complete: fin,
    });
  }

  private remplirFormulaireCompte(compte: CompteBancaire): void {
    this.formulaireCompte.reset({
      nomCompte: compte.nomCompte,
      banque: compte.banque,
      iban: compte.iban ?? '',
      bic: compte.bic ?? '',
      devise: compte.devise,
      soldeInitial: compte.soldeInitial ?? 0,
      dateSoldeInitial: compte.dateSoldeInitial ?? '',
      actif: compte.actif,
    });
  }

  private payloadCompte(): CompteBancairePayload {
    const valeur = this.formulaireCompte.getRawValue();
    return {
      nomCompte: valeur.nomCompte.trim(),
      banque: valeur.banque.trim(),
      iban: valeur.iban.trim(),
      bic: valeur.bic.trim() || null,
      devise: valeur.devise.trim().toUpperCase(),
      soldeInitial: Number(valeur.soldeInitial ?? 0),
      dateSoldeInitial: valeur.dateSoldeInitial || null,
      actif: valeur.actif,
    };
  }

  private remplirFormulaireOperation(operation: OperationBancaire): void {
    this.formulaireOperation.reset({
      compteBancaireId: operation.compteBancaireId,
      dateOperation: operation.dateOperation,
      dateValeur: operation.dateValeur ?? '',
      libelle: operation.libelle,
      referenceBancaire: operation.referenceBancaire ?? '',
      sens: operation.sens,
      montant: Math.abs(operation.montant ?? operation.debit ?? operation.credit ?? 0),
      typeOperation: operation.typeOperation as TypeOperationBancaire,
      tiersReconnu: operation.tiersReconnu ?? '',
      typeTiersReconnu: operation.typeTiersReconnu ?? '',
      natureOperation: operation.natureOperation,
      statutClassification: operation.statutClassification,
      statutRapprochement: operation.statutRapprochement,
      tiersId: operation.tiersId ?? null,
      factureId: operation.factureId ?? null,
      typeFacture: operation.typeFacture ?? '',
    });
  }

  private payloadOperation(): OperationBancairePayload {
    const valeur = this.formulaireOperation.getRawValue();
    const sens = valeur.sens ?? 'DEBIT';
    const montantAbsolu = Math.abs(Number(valeur.montant ?? 0));
    return {
      compteBancaireId: Number(valeur.compteBancaireId),
      importReleveBancaireId: null,
      dateOperation: valeur.dateOperation ?? this.dateJour(),
      dateValeur: valeur.dateValeur || null,
      libelle: (valeur.libelle ?? '').trim(),
      referenceBancaire: valeur.referenceBancaire?.trim() || null,
      debit: sens === 'DEBIT' ? montantAbsolu : 0,
      credit: sens === 'CREDIT' ? montantAbsolu : 0,
      montant: sens === 'DEBIT' ? -montantAbsolu : montantAbsolu,
      sens,
      typeOperation: valeur.typeOperation || 'AUTRE',
      tiersReconnu: valeur.tiersReconnu?.trim() || null,
      typeTiersReconnu: valeur.typeTiersReconnu || null,
      natureOperation: valeur.natureOperation || 'AUTRE',
      statutClassification: valeur.statutClassification || 'CLASSEE_MANUELLE',
      statutRapprochement: valeur.statutRapprochement || 'NON_RAPPROCHEE',
      tiersId: this.nombreOptionnel(valeur.tiersId),
      factureId: this.nombreOptionnel(valeur.factureId),
      typeFacture: valeur.typeFacture || null,
    };
  }

  private nombreOptionnel(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    return Number(value);
  }

  private dateJour(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
