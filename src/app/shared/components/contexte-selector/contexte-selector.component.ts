import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ContexteService } from '../../../core/services/contexte.service';

@Component({
  selector: 'app-contexte-selector',
  imports: [FormsModule],
  templateUrl: './contexte-selector.component.html',
})
export class ContexteSelectorComponent {
  readonly contexteService = inject(ContexteService);
  readonly societeSelectionneeId = signal<number | null>(this.contexteService.societeCouranteId());
  readonly message = signal<string | null>(null);

  readonly changementDesactive = computed(() => {
    const selection = this.societeSelectionneeId();
    return !selection || selection === this.contexteService.societeCouranteId();
  });

  constructor() {
    effect(() => {
      const societeCouranteId = this.contexteService.societeCouranteId();
      if (societeCouranteId && this.societeSelectionneeId() === null) {
        this.societeSelectionneeId.set(societeCouranteId);
      }
    });
  }

  selectionnerSociete(value: string | number): void {
    this.societeSelectionneeId.set(Number(value));
    this.message.set(null);
  }

  appliquer(): void {
    const societeId = this.societeSelectionneeId();
    if (!societeId || this.changementDesactive()) {
      return;
    }

    this.contexteService.changerSocieteCourante(societeId);
    const societe = this.contexteService.societesAutorisees().find((item) => item.id === societeId);
    this.message.set(`Contexte change : ${societe ? this.contexteService.libelleSociete(societe) : `Societe ${societeId}`}`);
  }
}
